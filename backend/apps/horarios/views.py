from datetime import date
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import HorarioMaestro, HorarioReal, Feriado
from .serializers import HorarioMaestroSerializer, HorarioRealSerializer, FeriadoSerializer


class HorarioMaestroListCreateView(generics.ListCreateAPIView):
    serializer_class   = HorarioMaestroSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        # Quitar validador unique_together para hacer upsert manual
        serializer.validators = [
            v for v in serializer.validators
            if type(v).__name__ != 'UniqueTogetherValidator'
        ]
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lookup = {k: data[k] for k in ('sede', 'dia', 'hora', 'disciplina', 'fecha_desde')}
        defaults = {k: v for k, v in data.items() if k not in lookup}
        obj, created = HorarioMaestro.objects.update_or_create(**lookup, defaults=defaults)
        out = HorarioMaestroSerializer(obj, context=self.get_serializer_context()).data
        return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def get_queryset(self):
        qs   = HorarioMaestro.objects.select_related('profe').filter(fecha_desde__lte=date.today())
        sede = self.request.query_params.get('sede')
        if sede:
            qs = qs.filter(sede=sede)
        activo = self.request.query_params.get('activo')
        if activo == 'true':
            qs = qs.filter(activo=True)

        # Devolver solo la versión vigente por slot (la de mayor fecha_desde)
        todos = list(qs.order_by('fecha_desde'))
        vigentes = {}
        for m in todos:
            key = (m.sede, m.dia, m.hora, m.disciplina)
            vigentes[key] = m   # el último (más reciente) sobrescribe
        return list(vigentes.values())


class HorarioMaestroDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = HorarioMaestroSerializer
    permission_classes = [IsAuthenticated]
    queryset           = HorarioMaestro.objects.select_related('profe').all()


class HorarioRealListCreateView(generics.ListCreateAPIView):
    serializer_class   = HorarioRealSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        qs     = HorarioReal.objects.select_related('profe_planificado', 'profe_real').all()
        semana = self.request.query_params.get('semana')  # 'YYYY-MM-DD'
        sede   = self.request.query_params.get('sede')
        if semana:
            qs = qs.filter(semana_inicio=semana)
        if sede:
            qs = qs.filter(sede=sede)
        return qs

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class HorarioRealDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = HorarioRealSerializer
    permission_classes = [IsAuthenticated]
    queryset           = HorarioReal.objects.all()


class FeriadoListCreateView(generics.ListCreateAPIView):
    serializer_class   = FeriadoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        return Feriado.objects.all()


class FeriadoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = FeriadoSerializer
    permission_classes = [IsAuthenticated]
    queryset           = Feriado.objects.all()
