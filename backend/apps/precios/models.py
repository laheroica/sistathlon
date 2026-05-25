from django.db import models
from apps.alumnos.models import Disciplina, Frecuencia, TipoPrecio


class PrecioMes(models.Model):
    """Tabla de precios por mes — permite histórico."""
    mes = models.DateField(help_text='Primer día del mes')
    disciplina = models.CharField(max_length=5, choices=Disciplina.choices)
    frecuencia = models.CharField(max_length=10, choices=Frecuencia.choices)
    tipo = models.CharField(max_length=20, choices=TipoPrecio.choices)
    precio = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = 'Precio'
        verbose_name_plural = 'Precios'
        unique_together = [('mes', 'disciplina', 'frecuencia', 'tipo')]
        ordering = ['-mes', 'disciplina', 'frecuencia']

    def __str__(self):
        return f"{self.mes.strftime('%m/%Y')} | {self.disciplina} {self.frecuencia} ({self.tipo}) — ${self.precio:,.0f}"


# Precios iniciales Abril 2026 — usados en el fixture de datos iniciales
PRECIOS_ABRIL_2026 = [
    # (disciplina, frecuencia, regular, unlpam, despues_10)
    ('CF', '2x',    44000, 40000, 48000),
    ('CF', '3x',    48000, 44000, 52000),
    ('CF', 'libre', 50000, 45000, 55000),
    ('HF', '2x',    42000, 38000, 45000),
    ('HF', '3x',    44000, 40000, 46000),
    ('HF', '5x',    46000, 42000, 50000),
    ('HX', '3x',    45000, 45000, 50000),
    ('TN', '3x',    32000, 32000, 32000),
    ('KD', '3x',    26000, 26000, 26000),
]
