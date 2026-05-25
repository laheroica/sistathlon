from django.db import models
from apps.alumnos.models import Alumno


class MetodoPago(models.TextChoices):
    EFECTIVO = 'efectivo', 'Efectivo'
    TRANSFERENCIA = 'transferencia', 'Transferencia'
    DEBITO = 'debito', 'Débito'


class Pago(models.Model):
    alumno = models.ForeignKey(Alumno, on_delete=models.PROTECT, related_name='pagos')
    mes = models.DateField(help_text='Primer día del mes que corresponde el pago')
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = models.DateField()
    metodo = models.CharField(max_length=20, choices=MetodoPago.choices, default=MetodoPago.EFECTIVO)
    monto_sugerido = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Monto que se debía cobrar según tabla de precios')
    monto_2 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Segundo monto si el pago fue mixto')
    metodo_2 = models.CharField(max_length=20, choices=MetodoPago.choices, null=True, blank=True)
    deuda = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Saldo pendiente (monto_sugerido − cobrado)')
    es_proporcional = models.BooleanField(default=False)
    dias_proporcional = models.PositiveSmallIntegerField(null=True, blank=True)
    notas = models.TextField(blank=True, null=True)
    registrado_por = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_registrados'
    )
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-fecha_pago']
        unique_together = [('alumno', 'mes')]

    def __str__(self):
        return f"{self.alumno} — {self.mes.strftime('%m/%Y')} — ${self.monto:,.0f}"
