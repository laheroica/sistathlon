from django.contrib import admin
from .models import Producto, Venta, VentaItem, MovimientoCuentaCorriente

admin.site.register(Producto)
admin.site.register(Venta)
admin.site.register(VentaItem)
admin.site.register(MovimientoCuentaCorriente)
