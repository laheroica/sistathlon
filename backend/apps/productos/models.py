from django.db import models
from apps.alumnos.models import Sede

CATEGORIAS = [
    ('indumentaria', 'Indumentaria'),
    ('accesorio', 'Accesorio'),
    ('bebida', 'Bebida'),
]

METODOS_VENTA = [
    ('efectivo', 'Efectivo'),
    ('transferencia', 'Transferencia'),
    ('cuenta_corriente', 'Cuenta Corriente'),
]


class Producto(models.Model):
    nombre    = models.CharField(max_length=100)
    categoria = models.CharField(max_length=20, choices=CATEGORIAS)
    precio    = models.DecimalField(max_digits=10, decimal_places=2)
    stock_107 = models.IntegerField(default=0, verbose_name='Stock Sede 107')
    stock_24  = models.IntegerField(default=0, verbose_name='Stock Sede 24')
    activo    = models.BooleanField(default=True)

    @property
    def stock(self):
        return self.stock_107 + self.stock_24

    class Meta:
        ordering = ['categoria', 'nombre']
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'

    def __str__(self):
        return f"{self.nombre} ({self.get_categoria_display()})"


class Venta(models.Model):
    fecha            = models.DateField()
    alumno           = models.ForeignKey(
        'alumnos.Alumno', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='ventas'
    )
    comprador_nombre = models.CharField(max_length=100, blank=True)
    sede             = models.CharField(max_length=10, choices=Sede.choices)
    metodo_pago      = models.CharField(max_length=20, choices=METODOS_VENTA)
    total            = models.DecimalField(max_digits=12, decimal_places=2)
    registrado_por   = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    notas            = models.TextField(blank=True)

    class Meta:
        ordering = ['-fecha', '-id']
        verbose_name = 'Venta'
        verbose_name_plural = 'Ventas'

    def __str__(self):
        comprador = str(self.alumno) if self.alumno else (self.comprador_nombre or 'Externo')
        return f"Venta {self.fecha} — {comprador} — ${self.total:,.0f}"


class VentaItem(models.Model):
    venta           = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='items')
    producto        = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='venta_items')
    cantidad        = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = 'Item de venta'
        verbose_name_plural = 'Items de venta'

    def subtotal(self):
        return self.precio_unitario * self.cantidad


class MovimientoCuentaCorriente(models.Model):
    TIPOS = [
        ('cargo', 'Cargo'),
        ('pago', 'Pago'),
    ]
    alumno      = models.ForeignKey(
        'alumnos.Alumno', on_delete=models.CASCADE, related_name='cuenta_corriente'
    )
    fecha       = models.DateField()
    tipo        = models.CharField(max_length=10, choices=TIPOS)
    monto       = models.DecimalField(max_digits=12, decimal_places=2)
    descripcion = models.CharField(max_length=200)
    venta       = models.ForeignKey(
        Venta, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ['-fecha', '-id']
        verbose_name = 'Movimiento cuenta corriente'
        verbose_name_plural = 'Movimientos cuenta corriente'

    def __str__(self):
        return f"{self.alumno} — {self.tipo} ${self.monto:,.0f} — {self.fecha}"
