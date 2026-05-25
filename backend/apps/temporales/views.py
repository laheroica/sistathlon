from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import AlumnoTemporal
from .serializers import AlumnoTemporalSerializer


class TemporalListCreateView(generics.ListCreateAPIView):
    serializer_class   = AlumnoTemporalSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        qs     = AlumnoTemporal.objects.all()
        sede   = self.request.query_params.get('sede')
        estado = self.request.query_params.get('estado')  # 'activo' | 'vencido' | 'todos'
        if sede:
            qs = qs.filter(sede=sede)
        if estado == 'activo':
            from datetime import date
            qs = qs.filter(fecha_fin__gte=date.today())
        elif estado == 'vencido':
            from datetime import date
            qs = qs.filter(fecha_fin__lt=date.today())
        return qs

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class TemporalDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = AlumnoTemporalSerializer
    permission_classes = [IsAuthenticated]
    queryset           = AlumnoTemporal.objects.all()

    def perform_update(self, serializer):
        serializer.save(registrado_por=self.request.user)
