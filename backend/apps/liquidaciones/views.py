import calendar
from datetime import date
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.alumnos.permissions import IsSadmin
from apps.profes.models import Profe, ValorHoraProfe
from apps.horarios.models import HorarioMaestro, HorarioReal, Feriado
from .models import Liquidacion
from .serializers import LiquidacionSerializer

# lunes=0 ... sábado=5 → código del modelo
DIA_MAP = {0: 'lun', 1: 'mar', 2: 'mie', 3: 'jue', 4: 'vie', 5: 'sab'}


# ── Función de cálculo ────────────────────────────────────────────────────────

def maestros_vigentes_en(fecha, todos_maestros):
    """
    Dado un listado completo de HorarioMaestro (activos, ordenados por fecha_desde asc),
    devuelve los vigentes en `fecha`: para cada slot (sede, dia, hora, disciplina)
    toma la versión más reciente cuya fecha_desde <= fecha.
    """
    dia_str = DIA_MAP.get(fecha.weekday())
    if not dia_str:
        return []

    candidatos = [m for m in todos_maestros if m.dia == dia_str and m.fecha_desde <= fecha]

    # Por cada slot, queda el último (mayor fecha_desde) → ya viene ordenado asc
    vigentes = {}
    for m in candidatos:
        key = (m.sede, m.dia, m.hora, m.disciplina)
        vigentes[key] = m   # sobrescribe: el más reciente gana

    # Solo devolver slots cuya versión más reciente esté activa
    return [m for m in vigentes.values() if m.activo]


def calcular_clases_mes(year, month):
    """
    Devuelve dict { profe_id: { profe, clases: [...] } }
    con todas las clases del mes usando la versión de la maestra
    vigente en cada fecha (date-sensitive).
    """
    _, num_dias = calendar.monthrange(year, month)
    fechas = [date(year, month, d) for d in range(1, num_dias + 1)]

    # Feriados sin clases
    feriados_cerrados = set(
        Feriado.objects.filter(fecha__year=year, fecha__month=month, abrimos=False)
        .values_list('fecha', flat=True)
    )

    # Todos los maestros (activos e inactivos) con fecha_desde <= último día del mes.
    # Se incluyen los inactivos para que el versionado detecte correctamente
    # cuándo un slot fue "apagado" (la versión más reciente es activo=False).
    ultimo_dia = date(year, month, num_dias)
    todos_maestros = list(
        HorarioMaestro.objects.filter(fecha_desde__lte=ultimo_dia)
        .select_related('profe')
        .order_by('fecha_desde')   # orden asc → el último sobrescribe por slot
    )

    # Modificaciones del mes
    reales = HorarioReal.objects.filter(
        fecha__year=year, fecha__month=month
    ).select_related('profe_real', 'profe_planificado')

    # Index por (fecha, hora, sede, disciplina)
    reales_idx = {}
    for r in reales:
        key = (r.fecha, r.hora, r.sede, r.disciplina)
        reales_idx[key] = r

    por_profe = {}

    for fecha in fechas:
        if fecha in feriados_cerrados:
            continue
        if fecha.weekday() == 6:   # domingo
            continue

        dia_str = DIA_MAP.get(fecha.weekday(), '')

        for maestro in maestros_vigentes_en(fecha, todos_maestros):
            key = (fecha, maestro.hora, maestro.sede, maestro.disciplina)
            real = reales_idx.get(key)

            if real and real.cancelada:
                continue  # clase cancelada, no contar para nadie

            if real and real.profe_real_id:
                profe_obj = real.profe_real
                es_mod = True
                profe_plan_nombre = real.profe_planificado.nombre if real.profe_planificado else '—'
            else:
                profe_obj = maestro.profe
                es_mod = False
                profe_plan_nombre = maestro.profe.nombre if maestro.profe else '—'

            if profe_obj is None:
                continue

            pid = profe_obj.id
            if pid not in por_profe:
                por_profe[pid] = {'profe': profe_obj, 'clases': []}

            por_profe[pid]['clases'].append({
                'fecha': str(fecha),
                'dia': dia_str,
                'hora': maestro.hora.strftime('%H:%M'),
                'disciplina': maestro.disciplina,
                'sede': maestro.sede,
                'es_modificacion': es_mod,
                'profe_planificado': profe_plan_nombre,
            })

    return por_profe


def agregar_profes_sin_clases(por_profe):
    """
    Suma al dict los profes activos que no aparecen en la grilla pero cobran
    monto fijo/porcentaje (ej. sueldo del dueño): sin clases, igual se liquidan.
    """
    extras = (
        Profe.objects.filter(activo=True)
        .exclude(id__in=por_profe.keys())
        .exclude(tipo_liquidacion='hora')
    )
    for p in extras:
        por_profe[p.id] = {'profe': p, 'clases': []}
    return por_profe


def armar_resultado_profe(profe, clases, year, month, liq=None):
    """Aplica tarifa y devuelve el dict con todos los datos del profe."""
    # Si el profe tiene disciplinas_liquidables configuradas, solo esas cuentan
    # como horas (y son las únicas que se listan/exportan). Vacío = todas.
    disc_liquidables = profe.disciplinas_liquidables or []
    if disc_liquidables:
        clases = [c for c in clases if c['disciplina'] in disc_liquidables]
    count = len(clases)

    # Tarifa del mes (o la más reciente si no hay del mes exacto)
    vh = (
        ValorHoraProfe.objects.filter(profe=profe, mes__year=year, mes__month=month).first()
        or ValorHoraProfe.objects.filter(profe=profe).order_by('-mes').first()
    )

    valor_hora = round(float(vh.valor_hora), 2) if vh else 0
    sueldo_fijo = round(float(vh.sueldo_fijo), 2) if vh and vh.sueldo_fijo else 0
    porcentaje = round(float(vh.porcentaje), 2) if vh and vh.porcentaje else 0
    base = round(float(vh.base), 2) if vh and vh.base else 0

    tipo = profe.tipo_liquidacion
    monto_horas = 0
    monto_porcentaje = 0
    if tipo == 'hora':
        monto_horas = round(count * valor_hora, 2)
        monto_calc = monto_horas
    elif tipo == 'fijo':
        monto_calc = sueldo_fijo
    elif tipo == 'mixto':
        # "Horas" es un monto fijo cargado a mano por mes (combo), no horas x valor
        monto_horas = sueldo_fijo
        monto_porcentaje = round(base * porcentaje / 100, 2) if base and porcentaje else 0
        monto_calc = round(monto_horas + monto_porcentaje, 2)
    else:  # porcentaje — 0 si no hay base cargada, para ingresar manual
        monto_porcentaje = round(base * porcentaje / 100, 2) if base and porcentaje else 0
        monto_calc = monto_porcentaje

    return {
        'profe_id': profe.id,
        'profe_nombre': profe.nombre,
        'profe_color': profe.color,
        'sede': profe.sede,
        'tipo_liquidacion': tipo,
        'clases_dadas': count,
        'valor_hora': valor_hora,
        'sueldo_fijo': sueldo_fijo,
        'porcentaje': porcentaje,
        'base': base,
        'monto_horas': monto_horas,
        'monto_porcentaje': monto_porcentaje,
        'monto_calculado': monto_calc,
        'clases': sorted(clases, key=lambda c: (c['fecha'], c['hora'])),
        # Si ya hay liquidación guardada
        'liquidacion_id': liq.id if liq else None,
        'monto_final': round(float(liq.monto_final), 2) if liq else monto_calc,
        'confirmada': liq.confirmada if liq else False,
        'pagada': liq.pagada if liq else False,
        'fecha_pago': str(liq.fecha_pago) if liq and liq.fecha_pago else None,
        'notas': liq.notas if liq else '',
    }


# ── Views ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsSadmin])
def preview_liquidacion(request):
    """
    Calcula la liquidación del mes sin guardar.
    GET /liquidaciones/preview/?mes=2026-05
    """
    mes_str = request.GET.get('mes', '')
    try:
        year, month = map(int, mes_str.split('-'))
        mes_date = date(year, month, 1)
    except Exception:
        return Response({'error': 'Parámetro mes inválido. Usar YYYY-MM.'}, status=400)

    por_profe = agregar_profes_sin_clases(calcular_clases_mes(year, month))

    # Liquidaciones ya guardadas para este mes
    liqqs = {liq.profe_id: liq for liq in Liquidacion.objects.filter(mes=mes_date).select_related('profe')}

    resultado = []
    for pid, data in por_profe.items():
        liq = liqqs.get(pid)
        resultado.append(
            armar_resultado_profe(data['profe'], data['clases'], year, month, liq)
        )

    resultado.sort(key=lambda x: x['profe_nombre'])

    return Response({
        'mes': mes_str,
        'total_calculado': round(sum(r['monto_calculado'] for r in resultado), 2),
        'total_final': round(sum(r['monto_final'] for r in resultado), 2),
        'confirmadas': sum(1 for r in resultado if r['confirmada']),
        'pagadas': sum(1 for r in resultado if r['pagada']),
        'profes': resultado,
    })


@api_view(['POST'])
@permission_classes([IsSadmin])
def guardar_liquidacion(request):
    """
    Guarda o actualiza la liquidación de un profe para un mes.
    POST /liquidaciones/guardar/
    Body: { profe_id, mes, clases_dadas, valor_hora, sueldo_fijo, porcentaje,
            monto_calculado, monto_final, notas, confirmar }
    """
    data = request.data
    mes_str = data.get('mes', '')
    try:
        year, month = map(int, mes_str.split('-'))
        mes_date = date(year, month, 1)
    except Exception:
        return Response({'error': 'mes inválido'}, status=400)

    try:
        profe = Profe.objects.get(id=data['profe_id'])
    except Profe.DoesNotExist:
        return Response({'error': 'Profe no encontrado'}, status=404)

    # Recalcular detalle fresco (ya filtrado por disciplinas_liquidables del profe)
    por_profe = calcular_clases_mes(year, month)
    clases_raw = por_profe.get(profe.id, {}).get('clases', [])
    resultado = armar_resultado_profe(profe, clases_raw, year, month)

    liq, _ = Liquidacion.objects.get_or_create(profe=profe, mes=mes_date)

    liq.tipo_liquidacion = profe.tipo_liquidacion
    liq.clases_dadas = data.get('clases_dadas', resultado['clases_dadas'])
    liq.valor_hora = data.get('valor_hora', resultado['valor_hora'])
    liq.sueldo_fijo = data.get('sueldo_fijo', resultado['sueldo_fijo'])
    liq.porcentaje = data.get('porcentaje', resultado['porcentaje'])
    liq.base = data.get('base', resultado['base'])
    liq.monto_calculado = data.get('monto_calculado', resultado['monto_calculado'])
    liq.monto_final = data.get('monto_final', data.get('monto_calculado', resultado['monto_calculado']))
    liq.notas = data.get('notas', '')
    liq.detalle = resultado['clases']

    if data.get('confirmar') and not liq.confirmada:
        liq.confirmada = True
        liq.fecha_confirmacion = timezone.now()

    liq.save()
    return Response(LiquidacionSerializer(liq).data)


@api_view(['POST'])
@permission_classes([IsSadmin])
def marcar_pagada(request, pk):
    """PATCH /liquidaciones/{id}/pagar/"""
    try:
        liq = Liquidacion.objects.get(pk=pk)
    except Liquidacion.DoesNotExist:
        return Response({'error': 'No encontrada'}, status=404)

    liq.pagada = True
    liq.fecha_pago = request.data.get('fecha_pago') or date.today()
    liq.save()
    return Response(LiquidacionSerializer(liq).data)


class LiquidacionListView(generics.ListAPIView):
    serializer_class = LiquidacionSerializer
    permission_classes = [IsSadmin]
    pagination_class = None

    def get_queryset(self):
        qs = Liquidacion.objects.select_related('profe').all()
        mes_str = self.request.GET.get('mes')
        if mes_str:
            try:
                year, month = map(int, mes_str.split('-'))
                qs = qs.filter(mes__year=year, mes__month=month)
            except Exception:
                pass
        return qs


class LiquidacionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Liquidacion.objects.select_related('profe').all()
    serializer_class = LiquidacionSerializer
    permission_classes = [IsSadmin]


# ── Cierre de mes ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsSadmin])
def cerrar_mes(request):
    """
    Cierra el mes: crea/actualiza Liquidacion para todos los profes con clases,
    marcándolas como confirmadas y guardando el snapshot de clases.
    POST /liquidaciones/cerrar-mes/
    Body: { mes: 'YYYY-MM', ajustes: [{profe_id, monto_final, notas}] }
    """
    mes_str = request.data.get('mes', '')
    ajustes = {a['profe_id']: a for a in request.data.get('ajustes', [])}

    try:
        year, month = map(int, mes_str.split('-'))
        mes_date = date(year, month, 1)
    except Exception:
        return Response({'error': 'mes inválido'}, status=400)

    por_profe = agregar_profes_sin_clases(calcular_clases_mes(year, month))
    guardadas = []

    for pid, data in por_profe.items():
        profe = data['profe']
        resultado = armar_resultado_profe(profe, data['clases'], year, month)

        aj = ajustes.get(pid, {})
        monto_final = aj.get('monto_final', resultado['monto_calculado'])
        notas       = aj.get('notas', '')

        liq, _ = Liquidacion.objects.get_or_create(profe=profe, mes=mes_date)
        liq.tipo_liquidacion  = resultado['tipo_liquidacion']
        liq.clases_dadas      = resultado['clases_dadas']
        liq.valor_hora        = resultado['valor_hora']
        liq.sueldo_fijo       = resultado['sueldo_fijo']
        liq.porcentaje        = resultado['porcentaje']
        liq.base              = resultado['base']
        liq.monto_calculado   = resultado['monto_calculado']
        liq.monto_final       = monto_final
        liq.notas             = notas
        liq.detalle           = resultado['clases']
        if not liq.confirmada:
            liq.confirmada          = True
            liq.fecha_confirmacion  = timezone.now()
        liq.save()
        guardadas.append(liq)

    return Response({
        'mes': mes_str,
        'total_profes': len(guardadas),
        'monto_total': round(sum(float(l.monto_final) for l in guardadas), 2),
    })


@api_view(['GET'])
@permission_classes([IsSadmin])
def meses_cerrados(request):
    """
    Lista de meses que tienen al menos una liquidación confirmada.
    GET /liquidaciones/meses-cerrados/
    """
    meses = (
        Liquidacion.objects
        .filter(confirmada=True)
        .values('mes')
        .annotate(
            total_profes=Count('id'),
            monto_total=Sum('monto_final'),
            pagadas=Count('id', filter=Q(pagada=True)),
        )
        .order_by('-mes')
    )

    return Response([{
        'mes':          m['mes'].strftime('%Y-%m'),
        'total_profes': m['total_profes'],
        'monto_total':  round(float(m['monto_total'] or 0), 2),
        'pagadas':      m['pagadas'],
    } for m in meses])


@api_view(['GET'])
@permission_classes([IsSadmin])
def detalle_cierre(request, mes_str):
    """
    Detalle de un mes cerrado: todas las liquidaciones confirmadas.
    GET /liquidaciones/cierre/2026-05/
    """
    try:
        year, month = map(int, mes_str.split('-'))
        mes_date = date(year, month, 1)
    except Exception:
        return Response({'error': 'mes inválido'}, status=400)

    liqs = (
        Liquidacion.objects
        .filter(mes=mes_date, confirmada=True)
        .select_related('profe')
        .order_by('profe__nombre')
    )

    return Response(LiquidacionSerializer(liqs, many=True).data)
