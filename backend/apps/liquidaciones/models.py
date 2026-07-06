from django.db import models
from apps.profes.models import Profe


class Liquidacion(models.Model):
    """Liquidación mensual por profe."""
    profe = models.ForeignKey(Profe, on_delete=models.PROTECT, related_name='liquidaciones')
    mes = models.DateField(help_text='Primer día del mes (YYYY-MM-01)')

    # Snapshot de la tarifa al momento de liquidar
    tipo_liquidacion = models.CharField(max_length=15, default='hora')
    clases_dadas = models.PositiveIntegerField(default=0)
    valor_hora = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sueldo_fijo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    base = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    monto_calculado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monto_final = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Detalle de clases dadas (JSON)
    detalle = models.JSONField(default=list, blank=True)

    confirmada = models.BooleanField(default=False)
    fecha_confirmacion = models.DateTimeField(null=True, blank=True)
    pagada = models.BooleanField(default=False)
    fecha_pago = models.DateField(null=True, blank=True)
    notas = models.TextField(blank=True)

    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Liquidación'
        verbose_name_plural = 'Liquidaciones'
        unique_together = [('profe', 'mes')]
        ordering = ['-mes', 'profe__nombre']

    def __str__(self):
        return f"{self.profe} — {self.mes.strftime('%m/%Y')} — ${self.monto_final:,.0f}"
