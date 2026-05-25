from django.db import models
from apps.alumnos.models import Alumno


class TipoMensaje(models.TextChoices):
    CUOTA_VENCIDA     = 'cuota_vencida',     'Cuota vencida'
    ACTIVO_IMPAGO     = 'activo_impago',     'Activo impago'
    REACTIVACION_1_3M = 'reactivacion_1_3m', 'Reactivación 1–3 meses'
    REACTIVACION_3_6M = 'reactivacion_3_6m', 'Reactivación 3–6 meses'
    REACTIVACION_6M   = 'reactivacion_6m',   'Reactivación +6 meses'
    BIENVENIDA        = 'bienvenida',        'Bienvenida'
    VENCE_PRONTO      = 'vence_pronto',      'Vence pronto'
    CUMPLEANIOS       = 'cumpleanios',       'Cumpleaños'
    MASIVO            = 'masivo',            'Masivo'


class CanalMensaje(models.TextChoices):
    WHATSAPP = 'whatsapp', 'WhatsApp'
    INSTAGRAM = 'instagram', 'Instagram'


class Mensaje(models.Model):
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='mensajes')
    tipo = models.CharField(max_length=30, choices=TipoMensaje.choices)
    canal = models.CharField(max_length=15, choices=CanalMensaje.choices)
    texto = models.TextField()
    fecha_hora = models.DateTimeField(auto_now_add=True)
    enviado_por = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'Mensaje'
        verbose_name_plural = 'Mensajes'
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"{self.alumno} — {self.get_tipo_display()} — {self.fecha_hora.strftime('%d/%m/%Y %H:%M')}"


class TemplateMensaje(models.Model):
    tipo = models.CharField(max_length=30, choices=TipoMensaje.choices)
    variante = models.PositiveSmallIntegerField(default=1, help_text='1 o 2')
    texto = models.TextField(help_text='Usar {nombre}, {dias}, {monto}, {sede}, {disciplina}')
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Template de mensaje'
        verbose_name_plural = 'Templates de mensajes'
        unique_together = [('tipo', 'variante')]

    def __str__(self):
        return f"{self.get_tipo_display()} — variante {self.variante}"
