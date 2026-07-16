from django.db import migrations
from datetime import date


def seed_stock(apps, schema_editor):
    """Siembra el stock actual (stock_107 / stock_24) como movimientos de
    'ajuste' iniciales, para que el nuevo libro de stock refleje lo cargado."""
    Producto = apps.get_model('productos', 'Producto')
    MovimientoStock = apps.get_model('productos', 'MovimientoStock')
    hoy = date.today()
    for p in Producto.objects.all():
        for ubic, cant in (('107', p.stock_107 or 0), ('24', p.stock_24 or 0)):
            if cant > 0:
                MovimientoStock.objects.create(
                    producto=p, fecha=hoy, tipo='ajuste',
                    cantidad=cant, origen='', destino=ubic,
                    notas='Stock inicial (migración)',
                )


def unseed_stock(apps, schema_editor):
    MovimientoStock = apps.get_model('productos', 'MovimientoStock')
    MovimientoStock.objects.filter(notas='Stock inicial (migración)').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0004_movimientostock'),
    ]

    operations = [
        migrations.RunPython(seed_stock, unseed_stock),
    ]
