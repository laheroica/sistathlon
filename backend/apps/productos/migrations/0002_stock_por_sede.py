from django.db import migrations, models


def stock_a_107(apps, schema_editor):
    """Mueve el stock existente todo a sede 107."""
    Producto = apps.get_model('productos', 'Producto')
    for p in Producto.objects.all():
        p.stock_107 = p.stock
        p.save(update_fields=['stock_107'])


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='stock_107',
            field=models.IntegerField(default=0, verbose_name='Stock Sede 107'),
        ),
        migrations.AddField(
            model_name='producto',
            name='stock_24',
            field=models.IntegerField(default=0, verbose_name='Stock Sede 24'),
        ),
        migrations.RunPython(stock_a_107, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='producto',
            name='stock',
        ),
    ]
