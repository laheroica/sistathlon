from datetime import date
from rest_framework import serializers as drf_serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import PrecioMes


class PrecioMesSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = PrecioMes
        fields = ['id', 'mes', 'disciplina', 'frecuencia', 'tipo', 'precio']


def _parse_mes(mes_str):
    """Acepta 'YYYY-MM' o 'YYYY-MM-DD'. Devuelve date del primer día del mes."""
    try:
        parts = mes_str.split('-')
        year, month = int(parts[0]), int(parts[1])
        return date(year, month, 1)
    except Exception:
        return None


@api_view(['GET'])
def lista_precios(request):
    """
    GET /precios/?mes=2026-05  — devuelve tabla de precios del mes.
    Si no hay precios para ese mes, devuelve los del mes anterior más reciente.
    """
    mes_str = request.GET.get('mes', '')
    mes_date = _parse_mes(mes_str)
    if not mes_date:
        hoy = date.today()
        mes_date = date(hoy.year, hoy.month, 1)

    precios = list(PrecioMes.objects.filter(mes=mes_date).order_by('disciplina', 'frecuencia', 'tipo'))

    if not precios:
        # Fallback: mes más reciente disponible
        ultimo = PrecioMes.objects.order_by('-mes').first()
        if ultimo:
            precios = list(PrecioMes.objects.filter(mes=ultimo.mes).order_by('disciplina', 'frecuencia', 'tipo'))

    return Response(PrecioMesSerializer(precios, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def guardar_precio(request):
    """
    POST /precios/guardar/
    Body: { mes, disciplina, frecuencia, tipo, precio }
    Crea o actualiza el precio.
    """
    data = request.data
    mes_str = data.get('mes', '')
    mes_date = _parse_mes(mes_str)
    if not mes_date:
        return Response({'error': 'mes inválido'}, status=400)

    obj, _ = PrecioMes.objects.update_or_create(
        mes=mes_date,
        disciplina=data['disciplina'],
        frecuencia=data['frecuencia'],
        tipo=data['tipo'],
        defaults={'precio': data['precio']},
    )
    return Response(PrecioMesSerializer(obj).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def copiar_precios(request):
    """
    Copia todos los precios de un mes a otro.
    POST /precios/copiar/  Body: { mes_origen, mes_destino }
    """
    origen  = _parse_mes(request.data.get('mes_origen', ''))
    destino = _parse_mes(request.data.get('mes_destino', ''))
    if not origen or not destino:
        return Response({'error': 'meses inválidos'}, status=400)

    precios_origen = PrecioMes.objects.filter(mes=origen)
    if not precios_origen.exists():
        return Response({'error': 'No hay precios en el mes origen'}, status=404)

    creados = 0
    for p in precios_origen:
        _, created = PrecioMes.objects.update_or_create(
            mes=destino, disciplina=p.disciplina, frecuencia=p.frecuencia, tipo=p.tipo,
            defaults={'precio': p.precio},
        )
        if created:
            creados += 1

    return Response({'copiados': precios_origen.count(), 'nuevos': creados})
