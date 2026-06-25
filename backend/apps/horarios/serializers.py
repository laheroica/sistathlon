from rest_framework import serializers
from .models import HorarioMaestro, HorarioReal, Feriado


class HorarioMaestroSerializer(serializers.ModelSerializer):
    profe_nombre = serializers.ReadOnlyField(source='profe.nombre')
    profe_color  = serializers.ReadOnlyField(source='profe.color')
    hora_str     = serializers.SerializerMethodField()
    # Acepta cualquier código dinámico de disciplina
    disciplina   = serializers.CharField(max_length=10)

    class Meta:
        model  = HorarioMaestro
        fields = [
            'id', 'sede', 'dia', 'hora', 'hora_str',
            'disciplina', 'profe', 'profe_nombre', 'profe_color',
            'capacidad_max', 'activo', 'fecha_desde',
        ]

    def get_hora_str(self, obj):
        return obj.hora.strftime('%H:%M')


class HorarioRealSerializer(serializers.ModelSerializer):
    profe_planificado_nombre = serializers.ReadOnlyField(source='profe_planificado.nombre')
    profe_real_nombre        = serializers.ReadOnlyField(source='profe_real.nombre')
    disciplina               = serializers.CharField(max_length=10)

    class Meta:
        model  = HorarioReal
        fields = [
            'id', 'semana_inicio', 'sede', 'fecha', 'hora',
            'disciplina', 'profe_planificado', 'profe_planificado_nombre',
            'profe_real', 'profe_real_nombre', 'cancelada', 'motivo', 'nota',
        ]
        read_only_fields = ['fecha_registro']


class FeriadoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Feriado
        fields = ['id', 'fecha', 'nombre', 'abrimos', 'horarios_especiales', 'nota']
