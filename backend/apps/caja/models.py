from django.db import models
from apps.alumnos.models import Sede

DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10]

# Sedes válidas para gastos: además de las dos, "general" (gastos/inversiones
# que sirven a ambas sucursales, ej. ropa, sogas). Los alumnos NO usan 'general'.
SEDE_GASTO_CHOICES = list(Sede.choices) + [('general', 'General')]

# ── Gastos ────────────────────────────────────────────────────────────────────

CONCEPTOS_FIJOS = [
    ('alquiler',    'Alquiler'),
    ('limpieza',    'Limpieza'),
    ('municipal',   'Imp. Municipal'),
    ('salubridad',  'Salubridad e Higiene'),
    ('electrico',   'Corpico Eléctrico'),
    ('internet',    'Corpico Internet'),
    ('seguro',      'Seguro'),
    ('mono_deni',   'Monotributo Deni'),
    ('mono_alvaro', 'Monotributo Álvaro'),
    ('mono_mario',  'Monotributo Mario'),
    ('iibb_deni',   'IIBB Deni'),
    ('iibb_alvaro', 'IIBB Álvaro'),
    ('iibb_mario',  'IIBB Mario'),
]

CONCEPTOS_COMPARTIDOS = frozenset([
    'mono_deni', 'mono_alvaro', 'mono_mario',
    'iibb_deni', 'iibb_alvaro', 'iibb_mario',
])


class ArqueoCaja(models.Model):
    fecha = models.DateField()
    sede = models.CharField(max_length=10, choices=Sede.choices)
    saldo_inicial = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Conteo de billetes — cantidad de cada denominación
    cant_20000 = models.PositiveIntegerField(default=0)
    cant_10000 = models.PositiveIntegerField(default=0)
    cant_5000 = models.PositiveIntegerField(default=0)
    cant_2000 = models.PositiveIntegerField(default=0)
    cant_1000 = models.PositiveIntegerField(default=0)
    cant_500 = models.PositiveIntegerField(default=0)
    cant_200 = models.PositiveIntegerField(default=0)
    cant_100 = models.PositiveIntegerField(default=0)
    cant_50 = models.PositiveIntegerField(default=0)
    cant_20 = models.PositiveIntegerField(default=0)
    cant_10 = models.PositiveIntegerField(default=0)

    total_billetes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    queda_en_caja  = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                         help_text='Monto que queda en caja para el próximo día')
    saldo_final = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    diferencia = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    registrado_por = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Arqueo de caja'
        verbose_name_plural = 'Arqueos de caja'
        ordering = ['-fecha', '-fecha_registro']

    def __str__(self):
        return f"Arqueo {self.sede} — {self.fecha}"

    def calcular_total_billetes(self):
        self.total_billetes = (
            self.cant_20000 * 20000 +
            self.cant_10000 * 10000 +
            self.cant_5000 * 5000 +
            self.cant_2000 * 2000 +
            self.cant_1000 * 1000 +
            self.cant_500 * 500 +
            self.cant_200 * 200 +
            self.cant_100 * 100 +
            self.cant_50 * 50 +
            self.cant_20 * 20 +
            self.cant_10 * 10
        )
        return self.total_billetes


class MovimientoCaja(models.Model):
    arqueo = models.ForeignKey(ArqueoCaja, on_delete=models.CASCADE, related_name='movimientos')
    descripcion = models.CharField(max_length=200, blank=True)
    importe = models.DecimalField(max_digits=10, decimal_places=2,
                                   help_text='Positivo = ingreso, negativo = egreso')
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['orden']

    def __str__(self):
        return f"{self.descripcion}: ${self.importe:,.0f}"


class GastoFijo(models.Model):
    """Gastos recurrentes/fijos: alquiler, limpieza, impuestos, servicios."""
    mes     = models.DateField(help_text='Primer día del mes')
    sede    = models.CharField(max_length=10, choices=SEDE_GASTO_CHOICES)
    concepto = models.CharField(max_length=20, choices=CONCEPTOS_FIJOS)
    importe = models.DecimalField(max_digits=12, decimal_places=2)
    fecha   = models.DateField()
    notas   = models.TextField(blank=True)

    class Meta:
        ordering = ['mes', 'sede', 'concepto', 'fecha']
        verbose_name = 'Gasto fijo'
        verbose_name_plural = 'Gastos fijos'

    def __str__(self):
        return f"{self.concepto} — {self.sede} — {self.mes.strftime('%Y-%m')}"


class GastoExtra(models.Model):
    """Gastos puntuales con concepto libre, precio unitario y cantidad."""
    mes             = models.DateField(help_text='Primer día del mes')
    sede            = models.CharField(max_length=10, choices=SEDE_GASTO_CHOICES)
    concepto        = models.CharField(max_length=200)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    cantidad        = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    fecha           = models.DateField()
    notas           = models.TextField(blank=True)

    class Meta:
        ordering = ['mes', 'sede', 'fecha']
        verbose_name = 'Gasto extra'
        verbose_name_plural = 'Gastos extras'

    def __str__(self):
        return f"{self.concepto} — {self.sede} — {self.mes.strftime('%Y-%m')}"
