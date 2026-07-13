from django.db.models import Q
from rest_framework import generics, filters
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS, BasePermission
from rest_framework.response import Response
from .models import Alumno, EstadoAlumno, DiscipConfig, NegocioConfig
from .serializers import (
    AlumnoListSerializer, AlumnoDetailSerializer,
    AlumnoCreateSerializer, AlumnoPatchSerializer,
    DiscipConfigSerializer, NegocioConfigSerializer,
)
from .auth_views import get_rol


class SadminOrReadOnly(BasePermission):
    """Lectura pública (para mostrar marca en el login); escritura solo sadmin."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated
                    and get_rol(request.user) == 'sadmin')


# ── Configuración del negocio (singleton) ──────────────────────────────────────

class NegocioConfigView(generics.RetrieveUpdateAPIView):
    serializer_class   = NegocioConfigSerializer
    permission_classes = [SadminOrReadOnly]

    def get_object(self):
        return NegocioConfig.get()


# ── Disciplinas (ABM dinámico) ─────────────────────────────────────────────────

class DiscipConfigListCreateView(generics.ListCreateAPIView):
    serializer_class   = DiscipConfigSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None
    queryset           = DiscipConfig.objects.all()


class DiscipConfigDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = DiscipConfigSerializer
    permission_classes = [IsAuthenticated]
    queryset           = DiscipConfig.objects.all()


class AlumnoListView(generics.ListAPIView):
    serializer_class = AlumnoListSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'apellido', 'dni', 'celular']
    ordering_fields = ['apellido', 'horario', 'estado', 'cuota_actual']
    pagination_class = None  # Sin paginación — el frontend maneja todo

    def get_queryset(self):
        from django.db.models import Prefetch
        from apps.pagos.models import Pago
        qs = Alumno.objects.filter(activo=True).prefetch_related(
            Prefetch('pagos', queryset=Pago.objects.order_by('-fecha_pago'))
        )
        sede = self.request.query_params.get('sede')
        disciplina = self.request.query_params.get('disciplina')
        estado = self.request.query_params.get('estado')
        horario = self.request.query_params.get('horario')

        if sede:
            qs = qs.filter(sede=sede)
        if disciplina:
            qs = qs.filter(disciplina=disciplina)
        if estado:
            qs = qs.filter(estado=estado)
        if horario:
            qs = qs.filter(horario=horario)

        return qs.order_by('horario', 'apellido', 'nombre')


class AlumnoCreateView(generics.CreateAPIView):
    serializer_class = AlumnoCreateSerializer
    queryset = Alumno.objects.all()


class AlumnoDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Alumno.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return AlumnoPatchSerializer
        if self.request.method == 'PUT':
            return AlumnoCreateSerializer
        return AlumnoDetailSerializer


@api_view(['GET'])
def calcular_cuota(request):
    """
    Calcula la cuota según parámetros.
    Params: disciplina, frecuencia, tipo_precio, fecha_inicio (opcional, para proporcional)
    """
    from apps.precios.models import PrecioMes
    from datetime import date
    import calendar, math

    disciplina = request.query_params.get('disciplina')
    frecuencia = request.query_params.get('frecuencia')
    tipo_precio = request.query_params.get('tipo_precio', 'regular')
    fecha_inicio_str = request.query_params.get('fecha_inicio')
    bonus_pack = request.query_params.get('bonus_pack', 'false').lower() == 'true'

    hoy = date.today()
    mes = hoy.replace(day=1)

    # Buscar precio en el mes actual; si no existe, usar el mes más reciente disponible
    precio_obj = PrecioMes.objects.filter(
        mes=mes, disciplina=disciplina, frecuencia=frecuencia, tipo=tipo_precio
    ).first()

    if not precio_obj:
        # Fallback al mes más reciente con ese plan cargado
        precio_obj = PrecioMes.objects.filter(
            disciplina=disciplina, frecuencia=frecuencia, tipo=tipo_precio
        ).order_by('-mes').first()

    if not precio_obj:
        return Response({'error': f'No hay precio configurado para {disciplina} {frecuencia} ({tipo_precio}).'}, status=404)

    precio_base = float(precio_obj.precio)
    mes_usado = precio_obj.mes

    cuota = precio_base
    proporcional = None

    if fecha_inicio_str:
        try:
            from datetime import datetime
            fecha_inicio = datetime.strptime(fecha_inicio_str, '%Y-%m-%d').date()
            if fecha_inicio.month == hoy.month and fecha_inicio.year == hoy.year and fecha_inicio.day > 1:
                dias_mes = calendar.monthrange(hoy.year, hoy.month)[1]
                dias_restantes = dias_mes - fecha_inicio.day + 1
                cuota_prop = (precio_base / dias_mes) * dias_restantes * 1.20
                cuota = math.ceil(cuota_prop / 1000) * 1000
                proporcional = {
                    'dias_mes': dias_mes,
                    'dias_restantes': dias_restantes,
                    'formula': f"(${precio_base:,.0f} ÷ {dias_mes}) × {dias_restantes} × 1.20"
                }
        except ValueError:
            pass

    if bonus_pack:
        cuota += 15000

    return Response({
        'precio_base':       precio_base,
        'cuota':             cuota,
        'proporcional':      proporcional,
        'bonus_pack_incluido': bonus_pack,
        'mes_precios':       mes_usado.strftime('%B %Y'),
        'precios_del_mes':   mes_usado == mes,
    })
