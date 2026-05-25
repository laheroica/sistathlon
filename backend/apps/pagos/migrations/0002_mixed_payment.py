from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pagos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='pago',
            name='monto_sugerido',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True,
                help_text='Monto que se debía cobrar según tabla de precios'),
        ),
        migrations.AddField(
            model_name='pago',
            name='monto_2',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True,
                help_text='Segundo monto si el pago fue mixto'),
        ),
        migrations.AddField(
            model_name='pago',
            name='metodo_2',
            field=models.CharField(
                blank=True, max_length=20, null=True,
                choices=[('efectivo', 'Efectivo'), ('transferencia', 'Transferencia'), ('debito', 'Débito')],
            ),
        ),
        migrations.AddField(
            model_name='pago',
            name='deuda',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10,
                help_text='Saldo pendiente (monto_sugerido − cobrado)'),
        ),
    ]
