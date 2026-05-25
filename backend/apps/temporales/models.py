from django.db import models
from apps.alumnos.models import Sede, Disciplina


class TipoTemporal(models.TextChoices):
    CLASE_SUELTA = 'clase', 'Clase suelta'
    SEMANA = 'semana', 'Semana'
    QUINCENA = 'quincena', 'Quincena'
    MES = 'mes', 'Mes completo'


class AlumnoTemporal(models.Model):
    nombre = models.CharField(max_length=200)
    dni = models.CharField(max_length=20, blank=True)
    celular = models.CharField(max_length=30, blank=True)
    sede = models.CharField(max_length=10, choices=Sede.choices)
    disciplina = models.CharField(max_length=5, choices=Disciplina.choices)
    tipo = models.CharField(max_length=10, choices=TipoTemporal.choices)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    pagado = models.BooleanField(default=False)
    notas = models.TextField(blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    registrado_por = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'Alumno temporal'
        verbose_name_plural = 'Alumnos temporales'
        ordering = ['-fecha_inicio']

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()}) — {self.sede}"
