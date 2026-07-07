from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from apps.alumnos.permissions import IsSadmin
from .models import Profe, ValorHoraProfe
from .serializers import ProfeSerializer, ValorHoraSerializer


class ProfeListCreateView(generics.ListCreateAPIView):
    serializer_class   = ProfeSerializer
    permission_classes = [IsSadmin]
    pagination_class   = None

    def get_queryset(self):
        qs = Profe.objects.prefetch_related('valores_hora').all()
        activo = self.request.query_params.get('activo')
        if activo == 'true':
            qs = qs.filter(activo=True)
        elif activo == 'false':
            qs = qs.filter(activo=False)
        return qs


class ProfeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ProfeSerializer
    permission_classes = [IsSadmin]
    queryset           = Profe.objects.prefetch_related('valores_hora').all()


@api_view(['POST'])
@permission_classes([IsSadmin])
def set_valor_hora(request, profe_id):
    """Crea o actualiza el valor/hora de un profe para un mes dado."""
    try:
        profe = Profe.objects.get(pk=profe_id)
    except Profe.DoesNotExist:
        return Response({'detail': 'Profe no encontrado.'}, status=404)

    mes_str = request.data.get('mes')  # 'YYYY-MM'
    if not mes_str:
        return Response({'mes': 'Requerido.'}, status=400)

    try:
        from datetime import date
        anio, mes_n = mes_str.split('-')
        mes_date = date(int(anio), int(mes_n), 1)
    except (ValueError, AttributeError):
        return Response({'mes': 'Formato inválido. Usar YYYY-MM.'}, status=400)

    vh, _ = ValorHoraProfe.objects.update_or_create(
        profe=profe, mes=mes_date,
        defaults={
            'valor_hora':  request.data.get('valor_hora') or 0,
            'sueldo_fijo': request.data.get('sueldo_fijo') or None,
            'porcentaje':  request.data.get('porcentaje')  or None,
            'base':        request.data.get('base')        or None,
        }
    )
    return Response(ValorHoraSerializer(vh).data, status=200)
