from rest_framework import serializers
from .models import Alumno, DiscipConfig, NegocioConfig


# ── Disciplinas ────────────────────────────────────────────────────────────────

class DiscipConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DiscipConfig
        fields = ['id', 'codigo', 'nombre', 'frecuencias', 'color_badge', 'color_hex', 'orden', 'activo']


# ── Configuración del negocio ───────────────────────────────────────────────────

class NegocioConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NegocioConfig
        fields = ['nombre', 'ciudad', 'logo_claro', 'logo_oscuro']


class AlumnoListSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    dias_hasta_vencimiento = serializers.SerializerMethodField()
    ultimo_pago = serializers.SerializerMethodField()
    dias_sin_pago = serializers.SerializerMethodField()

    class Meta:
        model = Alumno
        fields = [
            'id', 'nombre', 'apellido', 'nombre_completo', 'celular', 'instagram',
            'sede', 'disciplina', 'frecuencia', 'combo', 'bonus_pack', 'horario', 'horario_combo',
            'tipo_precio', 'cuota_actual', 'estado', 'fecha_inicio',
            'pertenencia', 'porcentaje_athlon', 'precio_especial', 'motivo_precio_especial',
            'dias_hasta_vencimiento', 'ultimo_pago', 'dias_sin_pago',
        ]

    def get_dias_hasta_vencimiento(self, obj):
        return obj.dias_hasta_vencimiento()

    def get_dias_sin_pago(self, obj):
        from datetime import date
        pago = obj.pagos.order_by('-fecha_pago').first()
        if not pago:
            return 9999  # nunca pagó
        return (date.today() - pago.fecha_pago).days

    def get_ultimo_pago(self, obj):
        pago = obj.pagos.order_by('-fecha_pago').first()
        if not pago:
            return None
        return {
            'id': pago.id,
            'fecha': pago.fecha_pago.strftime('%d/%m/%Y'),
            'monto': float(pago.monto),
            'metodo': pago.metodo,
            'mes': pago.mes.strftime('%m/%Y'),
        }


class AlumnoDetailSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    dias_hasta_vencimiento = serializers.SerializerMethodField()

    class Meta:
        model = Alumno
        fields = '__all__'

    def get_dias_hasta_vencimiento(self, obj):
        return obj.dias_hasta_vencimiento()


def normalizar_horario(valor):
    """
    Convierte cualquier formato de horario a HH:MM.
    Ejemplos: '9' → '09:00', '10hs' → '10:00', '9:30' → '09:30', '' → ''
    """
    if not valor:
        return valor
    import re
    valor = valor.strip().lower().replace('hs', '').replace('h', '').replace('am', '').replace('pm', '').strip()
    # Extraer horas y minutos
    m = re.match(r'^(\d{1,2})(?:[:\-\.](\d{2}))?$', valor)
    if m:
        hora = int(m.group(1))
        mins = int(m.group(2)) if m.group(2) else 0
        if 0 <= hora <= 23 and 0 <= mins <= 59:
            return f"{hora:02d}:{mins:02d}"
    return valor  # si no reconoce el formato, lo deja como está


class AlumnoCreateSerializer(serializers.ModelSerializer):
    # Acepta cualquier código de disciplina (incluyendo los creados dinámicamente)
    disciplina = serializers.CharField(max_length=10)
    frecuencia = serializers.CharField(max_length=10)
    dni = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    celular = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True, default=None)

    class Meta:
        model = Alumno
        fields = [
            'nombre', 'apellido', 'dni', 'celular', 'email', 'instagram', 'fecha_nacimiento',
            'sede', 'fecha_inicio', 'disciplina', 'frecuencia', 'combo', 'bonus_pack',
            'horario', 'horario_combo', 'tipo_precio', 'cuota_actual', 'notas',
            'pertenencia', 'porcentaje_athlon', 'precio_especial', 'motivo_precio_especial',
        ]

    def validate_dni(self, value):
        import uuid
        value = value.strip().replace('.', '').replace('-', '')
        if not value:
            return f'SIN-DNI-{uuid.uuid4().hex[:8].upper()}'
        qs = Alumno.objects.filter(dni=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un alumno con ese DNI.")
        return value

    def validate_horario(self, value):
        return normalizar_horario(value)


class AlumnoPatchSerializer(serializers.ModelSerializer):
    """Serializer liviano para PATCH desde el panel de ficha."""
    # Acepta cualquier código de disciplina dinámico
    disciplina = serializers.CharField(max_length=10, required=False)
    frecuencia = serializers.CharField(max_length=10, required=False)

    class Meta:
        model = Alumno
        fields = [
            'disciplina', 'frecuencia', 'horario', 'horario_combo', 'estado',
            'cuota_actual', 'combo', 'bonus_pack', 'notas',
            'pertenencia', 'porcentaje_athlon', 'precio_especial', 'motivo_precio_especial',
            'celular', 'email', 'instagram', 'nombre', 'apellido', 'sede',
        ]

    def validate_horario(self, value):
        return normalizar_horario(value)

    def validate_horario_combo(self, value):
        return normalizar_horario(value)
