from datetime import date
from decimal import Decimal
from django.db.models import Sum, Q, ProtectedError
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Producto, Venta, VentaItem, MovimientoCuentaCorriente,
    MovimientoStock, calcular_stock, costo_actual,
)
from .serializers import (
    ProductoSerializer, VentaSerializer, MovimientoCCSerializer,
    MovimientoStockSerializer,
)


def _stock_context():
    """Stock por ubicación y último costo de todos los productos (cálculo en lote)."""
    return {'stock_map': calcular_stock(), 'costo_map': costo_actual()}


# ── Productos ──────────────────────────────────────────────────────────────────

class ProductoListCreateView(generics.ListCreateAPIView):
    serializer_class   = ProductoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        qs = Producto.objects.all()
        if self.request.query_params.get('activo') == 'true':
            qs = qs.filter(activo=True)
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), **_stock_context()}


class ProductoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ProductoSerializer
    permission_classes = [IsAuthenticated]
    queryset           = Producto.objects.all()

    def get_serializer_context(self):
        return {**super().get_serializer_context(), **_stock_context()}

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError:
            # Tiene ventas — solo desactivar
            instance.activo = False
            instance.save(update_fields=['activo'])
            return Response(
                {'desactivado': True, 'detail': 'El producto tiene ventas registradas y no puede eliminarse. Se desactivó.'},
                status=status.HTTP_200_OK,
            )


# ── Movimientos de stock (ingreso / envío / ajuste) ─────────────────────────────

class MovimientoStockListCreateView(generics.ListCreateAPIView):
    serializer_class   = MovimientoStockSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        qs = MovimientoStock.objects.select_related('producto').all()
        producto = self.request.query_params.get('producto')
        tipo     = self.request.query_params.get('tipo')
        if producto:
            qs = qs.filter(producto_id=producto)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs[:400]

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class MovimientoStockDetailView(generics.RetrieveDestroyAPIView):
    serializer_class   = MovimientoStockSerializer
    permission_classes = [IsAuthenticated]
    queryset           = MovimientoStock.objects.all()


# ── Ventas ─────────────────────────────────────────────────────────────────────

class VentaListCreateView(generics.ListCreateAPIView):
    serializer_class   = VentaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        qs = (
            Venta.objects
            .prefetch_related('items__producto')
            .select_related('alumno')
            .all()
        )
        sede  = self.request.query_params.get('sede')
        desde = self.request.query_params.get('desde')
        hasta = self.request.query_params.get('hasta')
        if sede:
            qs = qs.filter(sede=sede)
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)
        return qs[:300]

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class VentaDetailView(generics.RetrieveDestroyAPIView):
    serializer_class   = VentaSerializer
    permission_classes = [IsAuthenticated]
    queryset           = (
        Venta.objects
        .prefetch_related('items__producto')
        .select_related('alumno')
        .all()
    )


# ── Cuenta corriente ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deudores(request):
    """Alumnos con saldo positivo en cuenta corriente."""
    rows = (
        MovimientoCuentaCorriente.objects
        .values('alumno_id', 'alumno__nombre', 'alumno__apellido', 'alumno__sede')
        .annotate(
            cargos=Sum('monto', filter=Q(tipo='cargo')),
            pagos=Sum('monto', filter=Q(tipo='pago')),
        )
    )

    resultado = []
    for r in rows:
        saldo = round(float(r['cargos'] or 0) - float(r['pagos'] or 0), 2)
        if saldo > 0:
            resultado.append({
                'alumno_id': r['alumno_id'],
                'nombre': f"{r['alumno__nombre']} {r['alumno__apellido']}",
                'sede':   r['alumno__sede'],
                'saldo':  saldo,
            })

    resultado.sort(key=lambda x: x['saldo'], reverse=True)
    return Response(resultado)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cuenta_corriente_alumno(request, alumno_id):
    movimientos = MovimientoCuentaCorriente.objects.filter(alumno_id=alumno_id)
    cargos = float(movimientos.filter(tipo='cargo').aggregate(t=Sum('monto'))['t'] or 0)
    pagos  = float(movimientos.filter(tipo='pago').aggregate(t=Sum('monto'))['t'] or 0)
    return Response({
        'alumno_id': alumno_id,
        'saldo':     round(cargos - pagos, 2),
        'movimientos': MovimientoCCSerializer(movimientos, many=True).data,
    })


class MovimientoCCDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = MovimientoCCSerializer
    permission_classes = [IsAuthenticated]
    queryset           = MovimientoCuentaCorriente.objects.all()

    def perform_update(self, serializer):
        serializer.save()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pagar_cuenta_corriente(request, alumno_id):
    monto_raw   = request.data.get('monto')
    descripcion = request.data.get('descripcion', 'Pago cuenta corriente')
    fecha_str   = request.data.get('fecha') or str(date.today())

    try:
        monto = Decimal(str(monto_raw))
        if monto <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return Response({'error': 'Monto inválido'}, status=400)

    MovimientoCuentaCorriente.objects.create(
        alumno_id=alumno_id,
        fecha=fecha_str,
        tipo='pago',
        monto=monto,
        descripcion=descripcion,
    )
    return Response({'ok': True})
