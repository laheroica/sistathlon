from datetime import date
from rest_framework import generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Pago
from .serializers import PagoSerializer


class PagoListCreateView(generics.ListCreateAPIView):
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_pago', 'mes', 'monto']
    ordering = ['-fecha_pago']

    def paginate_queryset(self, queryset):
        return None

    def get_queryset(self):
        qs = Pago.objects.select_related('alumno')
        alumno_id = self.request.query_params.get('alumno')
        mes = self.request.query_params.get('mes')
        sede = self.request.query_params.get('sede')

        if alumno_id:
            qs = qs.filter(alumno_id=alumno_id)
        if mes:
            qs = qs.filter(mes=mes)
        if sede:
            qs = qs.filter(alumno__sede=sede)

        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def perform_create(self, serializer):
        alumno = serializer.validated_data.get('alumno')
        mes = serializer.validated_data.get('mes')
        existing = Pago.objects.filter(alumno=alumno, mes=mes).first()
        if existing:
            # Actualizar pago existente en lugar de crear uno nuevo
            for field, value in serializer.validated_data.items():
                setattr(existing, field, value)
            request = self.request
            if request and request.user.is_authenticated:
                existing.registrado_por = request.user
            existing.save()
            pago = existing
        else:
            pago = serializer.save()
        _actualizar_estado(pago.alumno)


class PagoDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Pago.objects.select_related('alumno')
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        pago = serializer.save()
        _actualizar_estado(pago.alumno)

    def perform_destroy(self, instance):
        alumno = instance.alumno
        instance.delete()
        _actualizar_estado(alumno)


def _actualizar_estado(alumno):
    from django.db.models import Max
    hoy = date.today()
    mes_actual   = date(hoy.year, hoy.month, 1)
    mes_anterior = date(hoy.year, hoy.month - 1, 1) if hoy.month > 1 else date(hoy.year - 1, 12, 1)
    ultimo = alumno.pagos.aggregate(u=Max('mes'))['u']

    if ultimo is None:
        # Nunca pagó: si empezó este mes o el anterior → mora; si es más viejo → alejado
        inicio_mes = date(alumno.fecha_inicio.year, alumno.fecha_inicio.month, 1)
        nuevo_estado = 'mora' if inicio_mes >= mes_anterior else 'alejado'
    elif ultimo < mes_anterior:
        nuevo_estado = 'alejado'
    elif ultimo == mes_anterior:
        nuevo_estado = 'mora'
    else:
        nuevo_estado = 'activo'

    if alumno.estado not in ('baja', 'temporal') and alumno.estado != nuevo_estado:
        alumno.estado = nuevo_estado
        alumno.save(update_fields=['estado'])


# ── Cobros / Resumen mensual ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resumen_cobros(request):
    """
    Devuelve todos los alumnos activos con su monto sugerido y pago del mes.
    GET /cobros/resumen/?mes=2026-05
    """
    from apps.alumnos.models import Alumno
    from apps.precios.models import PrecioMes

    mes_str = request.GET.get('mes', '')
    try:
        year, month = map(int, mes_str.split('-'))
        mes_date = date(year, month, 1)
    except Exception:
        return Response({'error': 'Parámetro mes inválido. Usar YYYY-MM.'}, status=400)

    hoy = date.today()
    dia_hoy = hoy.day if hoy.year == year and hoy.month == month else 28

    alumnos = Alumno.objects.filter(activo=True).order_by('apellido', 'nombre')

    # Index de pagos del mes
    pagos_mes = {p.alumno_id: p for p in Pago.objects.filter(mes=mes_date).select_related('alumno')}

    # Index de precios: {(disciplina, frecuencia, tipo): precio}
    precios = {
        (p.disciplina, p.frecuencia, p.tipo): float(p.precio)
        for p in PrecioMes.objects.filter(mes=mes_date)
    }

    resultado = []
    for a in alumnos:
        monto_sugerido = _calcular_monto_sugerido(a, precios, dia_hoy)
        pago = pagos_mes.get(a.id)
        resultado.append({
            'alumno_id': a.id,
            'nombre': a.nombre,
            'apellido': a.apellido,
            'sede': a.sede,
            'disciplina': a.disciplina,
            'frecuencia': a.frecuencia,
            'combo': a.combo,
            'bonus_pack': a.bonus_pack,
            'horario': a.horario,
            'celular': a.celular,
            'tipo_precio': a.tipo_precio,
            'cuota_actual': float(a.cuota_actual),
            'pertenencia': a.pertenencia,
            'porcentaje_athlon': float(a.porcentaje_athlon),
            'precio_especial': a.precio_especial,
            'motivo_precio_especial': a.motivo_precio_especial,
            'estado': a.estado,
            'monto_sugerido': monto_sugerido,
            'pago': _pago_to_dict(pago) if pago else None,
        })

    pagados = sum(1 for r in resultado if r['pago'])
    total_cobrado = sum(
        (r['pago']['monto'] + (r['pago']['monto_2'] or 0)) for r in resultado if r['pago']
    )
    total_deuda = sum(r['pago']['deuda'] for r in resultado if r['pago'] and r['pago']['deuda'])

    return Response({
        'mes': mes_str,
        'alumnos': resultado,
        'stats': {
            'total': len(resultado),
            'pagados': pagados,
            'pendientes': len(resultado) - pagados,
            'total_cobrado': round(total_cobrado, 2),
            'total_deuda': round(total_deuda, 2),
        }
    })


def _calcular_monto_sugerido(alumno, precios, dia_hoy):
    """Calcula el monto a cobrar según tipo de precio y tabla."""
    if alumno.precio_especial:
        return float(alumno.cuota_actual)

    # FullBody: precio único, buscar con frecuencia='libre'
    frecuencia = alumno.frecuencia if alumno.disciplina != 'FB' else 'libre'

    # tipo_precio efectivo: si día > 10 y el alumno es regular o unlpam → despues_10
    tipo = alumno.tipo_precio
    if dia_hoy > 10 and tipo in ('regular', 'unlpam'):
        tipo_efectivo = 'despues_10'
    else:
        tipo_efectivo = tipo

    precio = precios.get((alumno.disciplina, frecuencia, tipo_efectivo))
    if precio is None:
        # Fallback: precio guardado en alumno
        precio = float(alumno.cuota_actual)

    bonus = 15000 if alumno.bonus_pack else 0

    # Combo: sumar la segunda disciplina si hay precio cargado
    if alumno.combo == 'hyrox_cf':
        p_hx = precios.get(('HX', '3x', tipo_efectivo), 0)
        p_cf = precios.get(('CF', '3x', tipo_efectivo), 0)
        # Descuento combo: el precio total es precio_hx + precio_cf con descuento
        # Por ahora usamos el precio guardado en cuota_actual para combos
        return float(alumno.cuota_actual) + bonus
    elif alumno.combo == 'hyrox_hf':
        return float(alumno.cuota_actual) + bonus

    return precio + bonus


def _pago_to_dict(pago):
    return {
        'id': pago.id,
        'monto': float(pago.monto),
        'monto_sugerido': float(pago.monto_sugerido) if pago.monto_sugerido else None,
        'monto_2': float(pago.monto_2) if pago.monto_2 else None,
        'metodo': pago.metodo,
        'metodo_2': pago.metodo_2,
        'deuda': float(pago.deuda),
        'fecha_pago': str(pago.fecha_pago),
        'notas': pago.notas or '',
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def liquidacion_day(request):
    """
    Resumen de lo cobrado a alumnos de espacios externos (Day, Otro).
    GET /cobros/liquidacion-day/?mes=2026-05
    """
    from apps.alumnos.models import Alumno

    mes_str = request.GET.get('mes', '')
    try:
        year, month = map(int, mes_str.split('-'))
        mes_date = date(year, month, 1)
    except Exception:
        return Response({'error': 'Parámetro mes inválido.'}, status=400)

    # Pagos del mes de alumnos no-athlon
    pagos = (
        Pago.objects
        .filter(mes=mes_date, alumno__pertenencia__in=['day', 'otro'])
        .select_related('alumno')
        .order_by('alumno__pertenencia', 'alumno__apellido')
    )

    grupos = {}
    for pago in pagos:
        a = pago.alumno
        key = a.pertenencia
        if key not in grupos:
            grupos[key] = {
                'pertenencia': key,
                'nombre_espacio': dict([('day', 'Day Gym'), ('otro', 'Otro')]).get(key, key),
                'alumnos': [],
                'total_cobrado': 0,
                'monto_athlon': 0,
                'monto_transferir': 0,
            }
        cobrado = float(pago.monto) + (float(pago.monto_2) if pago.monto_2 else 0)
        pct_athlon = float(a.porcentaje_athlon)
        m_athlon = round(cobrado * pct_athlon / 100, 2)
        m_transferir = round(cobrado * (1 - pct_athlon / 100), 2)

        grupos[key]['alumnos'].append({
            'alumno_id': a.id,
            'nombre': f"{a.apellido}, {a.nombre}",
            'disciplina': a.disciplina,
            'cobrado': cobrado,
            'porcentaje_athlon': pct_athlon,
            'monto_athlon': m_athlon,
            'monto_transferir': m_transferir,
            'pago_id': pago.id,
        })
        grupos[key]['total_cobrado'] += cobrado
        grupos[key]['monto_athlon'] += m_athlon
        grupos[key]['monto_transferir'] += m_transferir

    for g in grupos.values():
        g['total_cobrado'] = round(g['total_cobrado'], 2)
        g['monto_athlon'] = round(g['monto_athlon'], 2)
        g['monto_transferir'] = round(g['monto_transferir'], 2)

    total_cobrado = sum(g['total_cobrado'] for g in grupos.values())
    total_athlon = sum(g['monto_athlon'] for g in grupos.values())
    total_transferir = sum(g['monto_transferir'] for g in grupos.values())

    return Response({
        'mes': mes_str,
        'grupos': list(grupos.values()),
        'total_cobrado': round(total_cobrado, 2),
        'total_athlon': round(total_athlon, 2),
        'total_transferir': round(total_transferir, 2),
    })
