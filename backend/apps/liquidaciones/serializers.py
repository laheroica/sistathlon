from rest_framework import serializers
from .models import Liquidacion


class LiquidacionSerializer(serializers.ModelSerializer):
    profe_nombre = serializers.CharField(source='profe.nombre', read_only=True)
    profe_color  = serializers.CharField(source='profe.color',  read_only=True)

    class Meta:
        model = Liquidacion
        fields = [
            'id', 'profe', 'profe_nombre', 'profe_color',
            'mes', 'tipo_liquidacion',
            'clases_dadas', 'valor_hora', 'sueldo_fijo', 'porcentaje',
            'monto_calculado', 'monto_final',
            'detalle',
            'confirmada', 'fecha_confirmacion',
            'pagada', 'fecha_pago',
            'notas',
            'creada_en', 'actualizada_en',
        ]
        read_only_fields = ['creada_en', 'actualizada_en', 'fecha_confirmacion']
