from rest_framework import serializers
from .models import AlumnoTemporal


class AlumnoTemporalSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.SerializerMethodField()
    dias_restantes        = serializers.SerializerMethodField()
    vencido               = serializers.SerializerMethodField()

    class Meta:
        model  = AlumnoTemporal
        fields = [
            'id', 'nombre', 'dni', 'celular', 'sede', 'disciplina',
            'tipo', 'fecha_inicio', 'fecha_fin', 'monto', 'pagado',
            'notas', 'fecha_registro', 'registrado_por_nombre',
            'dias_restantes', 'vencido',
        ]
        read_only_fields = ['fecha_registro', 'registrado_por_nombre',
                            'dias_restantes', 'vencido']

    def get_registrado_por_nombre(self, obj):
        if obj.registrado_por:
            return obj.registrado_por.get_full_name() or obj.registrado_por.username
        return None

    def get_dias_restantes(self, obj):
        if not obj.fecha_fin:
            return None
        from datetime import date
        delta = (obj.fecha_fin - date.today()).days
        return delta

    def get_vencido(self, obj):
        if not obj.fecha_fin:
            return False
        from datetime import date
        return obj.fecha_fin < date.today()
