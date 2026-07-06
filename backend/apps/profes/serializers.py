from rest_framework import serializers
from .models import Profe, ValorHoraProfe


class ValorHoraSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ValorHoraProfe
        fields = ['id', 'mes', 'valor_hora', 'sueldo_fijo', 'porcentaje', 'base']


class ProfeSerializer(serializers.ModelSerializer):
    valores_hora    = ValorHoraSerializer(many=True, read_only=True)
    valor_mes_actual = serializers.SerializerMethodField()

    class Meta:
        model  = Profe
        fields = [
            'id', 'nombre', 'color', 'sede', 'tipo_liquidacion', 'disciplinas_liquidables',
            'fecha_inicio', 'activo', 'notas',
            'valores_hora', 'valor_mes_actual',
        ]

    def get_valor_mes_actual(self, obj):
        from datetime import date
        hoy = date.today()
        vh  = obj.valores_hora.filter(mes__year=hoy.year, mes__month=hoy.month).first()
        if not vh:
            vh = obj.valores_hora.order_by('-mes').first()
        if not vh:
            return None
        return {
            'valor_hora':  float(vh.valor_hora) if vh.valor_hora else None,
            'sueldo_fijo': float(vh.sueldo_fijo) if vh.sueldo_fijo else None,
            'porcentaje':  float(vh.porcentaje)  if vh.porcentaje  else None,
            'base':        float(vh.base)        if vh.base        else None,
            'mes':         vh.mes.strftime('%Y-%m'),
        }
