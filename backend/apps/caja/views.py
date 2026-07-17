from datetime import date
from decimal import Decimal
from django.db.models import Sum, Q
from rest_framework import generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ArqueoCaja, MovimientoCaja, GastoFijo, GastoExtra, CONCEPTOS_COMPARTIDOS
from .serializers import ArqueoCajaSerializer, GastoFijoSerializer, GastoExtraSerializer


class ArqueoListCreateView(generics.ListCreateAPIView):
    serializer_class   = ArqueoCajaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        qs = ArqueoCaja.objects.prefetch_related('movimientos').all()
        mes  = self.request.query_params.get('mes')   # 'YYYY-MM'
        sede = self.request.query_params.get('sede')
        if mes:
            try:
                anio, mes_n = mes.split('-')
                qs = qs.filter(fecha__year=int(anio), fecha__month=int(mes_n))
            except (ValueError, AttributeError):
                pass
        if sede:
            qs = qs.filter(sede=sede)
        return qs

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class ArqueoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ArqueoCajaSerializer
    permission_classes = [IsAuthenticated]
    queryset           = ArqueoCaja.objects.prefetch_related('movimientos').all()

    def perform_update(self, serializer):
        serializer.save(registrado_por=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resumen_mes(request):
    """Resumen de ingresos, egresos y balance de cuotas para un mes dado."""
    mes_param = request.query_params.get('mes')  # 'YYYY-MM'
    sede      = request.query_params.get('sede')

    hoy = date.today()
    try:
        anio, mes_n = mes_param.split('-')
        anio, mes_n = int(anio), int(mes_n)
    except (ValueError, AttributeError, TypeError):
        anio, mes_n = hoy.year, hoy.month

    # Movimientos de caja (ingresos manuales + egresos)
    arqueos_qs = ArqueoCaja.objects.filter(fecha__year=anio, fecha__month=mes_n)
    if sede:
        arqueos_qs = arqueos_qs.filter(sede=sede)

    ids = list(arqueos_qs.values_list('id', flat=True))
    movs = MovimientoCaja.objects.filter(arqueo_id__in=ids)

    ingresos_caja  = float(movs.filter(importe__gt=0).aggregate(t=Sum('importe'))['t'] or 0)
    egresos_caja   = float(abs(movs.filter(importe__lt=0).aggregate(t=Sum('importe'))['t'] or 0))

    # Cuotas cobradas ese mes (de Pagos)
    from apps.pagos.models import Pago
    from django.db.models import Count
    pagos_qs = Pago.objects.filter(
        mes__year=anio, mes__month=mes_n
    )
    if sede:
        pagos_qs = pagos_qs.filter(alumno__sede=sede)
    ingresos_cuotas = float(pagos_qs.aggregate(t=Sum('monto'))['t'] or 0)
    cant_cuotas     = pagos_qs.count()

    from apps.productos.models import Venta, MovimientoCuentaCorriente
    ventas_qs = Venta.objects.filter(
        fecha__year=anio, fecha__month=mes_n,
        metodo_pago__in=['efectivo', 'transferencia'],
    )
    if sede:
        ventas_qs = ventas_qs.filter(sede=sede)
    ingresos_productos = float(ventas_qs.aggregate(t=Sum('total'))['t'] or 0)
    cant_ventas        = ventas_qs.count()

    # Cobros de cuenta corriente (deudas de productos cobradas este mes).
    # Se cuentan cuando entra la plata, no cuando se hizo la venta a crédito.
    cc_qs = MovimientoCuentaCorriente.objects.filter(
        tipo='pago', fecha__year=anio, fecha__month=mes_n,
    )
    if sede:
        cc_qs = cc_qs.filter(alumno__sede=sede)
    ingresos_cta_corriente = float(cc_qs.aggregate(t=Sum('monto'))['t'] or 0)
    cant_cobros_cc         = cc_qs.count()

    return Response({
        'ingresos_cuotas':        ingresos_cuotas,
        'cant_cuotas':            cant_cuotas,
        'ingresos_caja':          ingresos_caja,
        'egresos_caja':           egresos_caja,
        'ingresos_productos':     ingresos_productos,
        'cant_ventas':            cant_ventas,
        'ingresos_cta_corriente': ingresos_cta_corriente,
        'cant_cobros_cc':         cant_cobros_cc,
        'balance': ingresos_cuotas + ingresos_caja + ingresos_productos
                   + ingresos_cta_corriente - egresos_caja,
    })


# ── Gastos fijos ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gastos_fijos_list(request):
    mes_str = request.GET.get('mes', '')
    sede    = request.GET.get('sede', '')
    try:
        anio, mes_n = map(int, mes_str.split('-'))
    except Exception:
        return Response([])

    qs = GastoFijo.objects.filter(mes__year=anio, mes__month=mes_n)
    if sede:
        qs = qs.filter(sede=sede)
    return Response(GastoFijoSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_gasto_fijo(request):
    data     = request.data
    concepto = data.get('concepto', '')
    mes_str  = data.get('mes', '')
    fecha    = data.get('fecha') or str(date.today())
    notas    = data.get('notas', '')

    try:
        anio, mes_n = map(int, mes_str.split('-'))
        mes_date = date(anio, mes_n, 1)
    except Exception:
        return Response({'error': 'mes inválido'}, status=400)

    try:
        importe_total = Decimal(str(data.get('importe', 0)))
    except Exception:
        return Response({'error': 'importe inválido'}, status=400)

    if concepto in CONCEPTOS_COMPARTIDOS:
        mitad = (importe_total / 2).quantize(Decimal('0.01'))
        gastos = []
        for s in ['107', '24']:
            g = GastoFijo.objects.create(
                mes=mes_date, sede=s, concepto=concepto,
                importe=mitad, fecha=fecha, notas=notas,
            )
            gastos.append(g)
        return Response(GastoFijoSerializer(gastos, many=True).data, status=201)
    else:
        sede = data.get('sede', '')
        if not sede:
            return Response({'error': 'sede requerida'}, status=400)
        g = GastoFijo.objects.create(
            mes=mes_date, sede=sede, concepto=concepto,
            importe=importe_total, fecha=fecha, notas=notas,
        )
        return Response(GastoFijoSerializer(g).data, status=201)


class GastoFijoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = GastoFijoSerializer
    permission_classes = [IsAuthenticated]
    queryset           = GastoFijo.objects.all()


# ── Gastos extras ─────────────────────────────────────────────────────────────

class GastoExtraListCreateView(generics.ListCreateAPIView):
    serializer_class   = GastoExtraSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        mes_str = self.request.GET.get('mes', '')
        sede    = self.request.GET.get('sede', '')
        try:
            anio, mes_n = map(int, mes_str.split('-'))
        except Exception:
            return GastoExtra.objects.none()
        qs = GastoExtra.objects.filter(mes__year=anio, mes__month=mes_n)
        if sede:
            qs = qs.filter(sede=sede)
        return qs


class GastoExtraDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = GastoExtraSerializer
    permission_classes = [IsAuthenticated]
    queryset           = GastoExtra.objects.all()
