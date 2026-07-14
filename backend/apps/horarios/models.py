from django.db import models
from apps.alumnos.models import Disciplina
from apps.profes.models import Profe


class DiaSemana(models.TextChoices):
    LUNES = 'lun', 'Lunes'
    MARTES = 'mar', 'Martes'
    MIERCOLES = 'mie', 'Miércoles'
    JUEVES = 'jue', 'Jueves'
    VIERNES = 'vie', 'Viernes'
    SABADO = 'sab', 'Sábado'


class HorarioMaestro(models.Model):
    """Grilla base de referencia con historial de versiones por fecha_desde."""
    sede = models.CharField(max_length=10)
    dia = models.CharField(max_length=5, choices=DiaSemana.choices)
    hora = models.TimeField()
    disciplina = models.CharField(max_length=5, choices=Disciplina.choices)
    profe = models.ForeignKey(Profe, on_delete=models.SET_NULL, null=True, blank=True, related_name='turnos_maestro')
    capacidad_max = models.PositiveSmallIntegerField(default=21)
    activo = models.BooleanField(default=True)
    fecha_desde = models.DateField(
        help_text='Fecha desde la que esta versión del horario es válida',
        default='2000-01-01',
    )

    class Meta:
        verbose_name = 'Horario maestro'
        verbose_name_plural = 'Horarios maestros'
        ordering = ['sede', 'dia', 'hora', 'fecha_desde']
        unique_together = [('sede', 'dia', 'hora', 'disciplina', 'fecha_desde')]

    def __str__(self):
        return f"{self.sede} | {self.get_dia_display()} {self.hora.strftime('%H:%M')} | {self.disciplina}"


class HorarioReal(models.Model):
    """Modificaciones semana a semana sobre la grilla maestra."""
    semana_inicio = models.DateField(help_text='Lunes de la semana')
    sede = models.CharField(max_length=10)
    fecha = models.DateField()
    hora = models.TimeField()
    disciplina = models.CharField(max_length=5, choices=Disciplina.choices)
    profe_planificado = models.ForeignKey(
        Profe, on_delete=models.SET_NULL, null=True, blank=True, related_name='turnos_planificados'
    )
    profe_real = models.ForeignKey(
        Profe, on_delete=models.SET_NULL, null=True, blank=True, related_name='turnos_reales'
    )
    cancelada = models.BooleanField(default=False, help_text='La clase no se dictó ese día')
    motivo = models.CharField(max_length=200, blank=True)
    nota = models.TextField(blank=True)
    registrado_por = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Modificación de horario'
        verbose_name_plural = 'Modificaciones de horario'
        ordering = ['-fecha', 'hora']

    def __str__(self):
        return f"{self.sede} | {self.fecha} {self.hora.strftime('%H:%M')} | {self.profe_planificado} → {self.profe_real}"


class Feriado(models.Model):
    fecha = models.DateField(unique=True)
    nombre = models.CharField(max_length=150)
    abrimos = models.BooleanField(default=False)
    horarios_especiales = models.TextField(blank=True, help_text='Descripción de horarios si abrimos')
    nota = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Feriado'
        verbose_name_plural = 'Feriados'
        ordering = ['fecha']

    def __str__(self):
        estado = 'Abre' if self.abrimos else 'Cerrado'
        return f"{self.fecha} — {self.nombre} ({estado})"
