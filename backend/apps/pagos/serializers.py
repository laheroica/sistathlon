from rest_framework import serializers
from .models import Pago


class PagoSerializer(serializers.ModelSerializer):
    alumno_nombre     = serializers.ReadOnlyField(source='alumno.nombre_completo')
    alumno_horario    = serializers.ReadOnlyField(source='alumno.horario')
    alumno_disciplina = serializers.ReadOnlyField(source='alumno.disciplina')
    alumno_frecuencia = serializers.ReadOnlyField(source='alumno.frecuencia')
    alumno_sede       = serializers.ReadOnlyField(source='alumno.sede')
    alumno_celular    = serializers.ReadOnlyField(source='alumno.celular')

    class Meta:
        model = Pago
        fields = [
            'id', 'alumno', 'alumno_nombre',
            'alumno_horario', 'alumno_disciplina', 'alumno_frecuencia',
            'alumno_sede', 'alumno_celular',
            'mes', 'monto', 'monto_sugerido', 'monto_2', 'metodo', 'metodo_2',
            'deuda', 'es_proporcional', 'notas', 'fecha_pago', 'fecha_registro',
        ]
        read_only_fields = [
            'id', 'fecha_registro',
            'alumno_nombre', 'alumno_horario', 'alumno_disciplina',
            'alumno_frecuencia', 'alumno_sede', 'alumno_celular',
        ]

    def validate(self, data):
        mes = data.get('mes')

        # Normalizar mes al primer día
        if mes and mes.day != 1:
            from datetime import date
            data['mes'] = date(mes.year, mes.month, 1)

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['registrado_por'] = request.user
        return super().create(validated_data)
