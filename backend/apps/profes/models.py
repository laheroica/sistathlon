from django.db import models


class TipoLiquidacion(models.TextChoices):
    HORA = 'hora', 'Por hora'
    PORCENTAJE = 'porcentaje', 'Porcentaje de recaudación'
    FIJO = 'fijo', 'Sueldo fijo'
    MIXTO = 'mixto', 'Horas + Porcentaje'


PROFES_COLORES = {
    'Mario': '#22d3ee',
    'Barbi': '#ec4899',
    'Damián': '#f59e0b',
    'Flor': '#a78bfa',
    'Sugus': '#34d399',
    'Sofi': '#60a5fa',
    'Maxi': '#f97316',
    'Bruno': '#e879f9',
    'Deni': '#fbbf24',
    'Day': '#f43f5e',
}


class Profe(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=7, default='#6b7280', help_text='Hex color, ej: #22d3ee')
    sede = models.CharField(
        max_length=10,
        choices=[('107', 'Athlon 107'), ('24', 'Athlon 24'),
                 ('ambas', 'Ambas sedes'), ('general', 'General')],
        default='ambas'
    )
    tipo_liquidacion = models.CharField(max_length=15, choices=TipoLiquidacion.choices, default=TipoLiquidacion.HORA)
    disciplinas_liquidables = models.JSONField(
        default=list, blank=True,
        help_text='Códigos de disciplina que cuentan como horas para este profe (ej: ["CF","HF"]). Vacío = todas.'
    )
    fecha_inicio = models.DateField()
    activo = models.BooleanField(default=True)
    notas = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = 'Profe'
        verbose_name_plural = 'Profes'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    def valor_hora_mes(self, mes):
        """Retorna el valor/hora para un mes específico."""
        vh = self.valores_hora.filter(mes__year=mes.year, mes__month=mes.month).first()
        return vh.valor_hora if vh else None


class ValorHoraProfe(models.Model):
    """Historial de valor/hora por profe y mes."""
    profe = models.ForeignKey(Profe, on_delete=models.CASCADE, related_name='valores_hora')
    mes = models.DateField(help_text='Primer día del mes')
    valor_hora = models.DecimalField(max_digits=10, decimal_places=2)
    sueldo_fijo = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                       help_text='Solo para Mario u otros con sueldo fijo')
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True,
                                      help_text='Porcentaje sobre recaudación (ej: 50.00 para Day/Mario)')
    base = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                help_text='Monto sobre el que se calcula el porcentaje (carga manual)')

    class Meta:
        verbose_name = 'Valor hora profe'
        verbose_name_plural = 'Valores hora profes'
        unique_together = [('profe', 'mes')]
        ordering = ['-mes', 'profe__nombre']

    def __str__(self):
        return f"{self.profe} — {self.mes.strftime('%m/%Y')} — ${self.valor_hora:,.0f}/h"
