from django.db import models

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


# Ubicación reservada para el depósito general (además de los códigos de sede)
DEPOSITO = 'deposito'


class MovimientoStock(models.Model):
    """Libro de movimientos de stock. El stock de cada ubicación se calcula
    sumando lo que entra (destino) y restando lo que sale (origen).

    - Ingreso  : origen='',        destino='deposito'   (+ costo/proveedor)
    - Envío    : origen='deposito', destino=<sede>
    - Venta    : origen=<sede>,     destino=''           (link a Venta)
    - Ajuste + : origen='',         destino=<ubicación>
    - Ajuste − : origen=<ubicación>, destino=''
    """
    TIPOS = [
        ('ingreso', 'Ingreso'),
        ('envio',   'Envío'),
        ('venta',   'Venta'),
        ('ajuste',  'Ajuste'),
    ]
    producto  = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='movimientos')
    fecha     = models.DateField()
    tipo      = models.CharField(max_length=10, choices=TIPOS)
    cantidad  = models.PositiveIntegerField()
    origen    = models.CharField(max_length=10, blank=True, default='')   # de dónde sale ('' = entra al sistema)
    destino   = models.CharField(max_length=10, blank=True, default='')   # a dónde entra ('' = sale del sistema)

    # Solo para ingresos: costo y proveedor (para calcular margen)
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    proveedor      = models.CharField(max_length=120, blank=True, default='')

    venta          = models.ForeignKey('Venta', on_delete=models.SET_NULL, null=True, blank=True, related_name='movimientos_stock')
    notas          = models.CharField(max_length=200, blank=True, default='')
    registrado_por = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    creado         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', '-id']
        verbose_name = 'Movimiento de stock'
        verbose_name_plural = 'Movimientos de stock'

    def __str__(self):
        ruta = f"{self.origen or '—'} → {self.destino or '—'}"
        return f"{self.get_tipo_display()} {self.cantidad}× {self.producto.nombre} ({ruta})"


class Venta(models.Model):
    fecha            = models.DateField()
    alumno           = models.ForeignKey(
        'alumnos.Alumno', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='ventas'
    )
    comprador_nombre = models.CharField(max_length=100, blank=True)
    sede             = models.CharField(max_length=10)
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


def calcular_stock(producto_ids=None):
    """Stock actual por ubicación, calculado del libro de movimientos.
    Devuelve {producto_id: {ubicacion: cantidad}}."""
    from django.db.models import Sum
    movs = MovimientoStock.objects.all()
    if producto_ids is not None:
        movs = movs.filter(producto_id__in=list(producto_ids))
    stock = {}
    for row in movs.exclude(destino='').values('producto_id', 'destino').annotate(t=Sum('cantidad')):
        d = stock.setdefault(row['producto_id'], {})
        d[row['destino']] = d.get(row['destino'], 0) + (row['t'] or 0)
    for row in movs.exclude(origen='').values('producto_id', 'origen').annotate(t=Sum('cantidad')):
        d = stock.setdefault(row['producto_id'], {})
        d[row['origen']] = d.get(row['origen'], 0) - (row['t'] or 0)
    return stock


def costo_actual(producto_ids=None):
    """Último costo unitario cargado por producto (para margen). {producto_id: costo}."""
    costos = {}
    qs = MovimientoStock.objects.filter(tipo='ingreso', costo_unitario__isnull=False)
    if producto_ids is not None:
        qs = qs.filter(producto_id__in=list(producto_ids))
    for m in qs.order_by('producto_id', '-fecha', '-id'):
        costos.setdefault(m.producto_id, float(m.costo_unitario))
    return costos
