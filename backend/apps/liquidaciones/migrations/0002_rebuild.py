from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('liquidaciones', '0001_initial'),
        ('profes', '0001_initial'),
    ]

    operations = [
        # Drop old table completely and recreate
        migrations.DeleteModel(name='Liquidacion'),
        migrations.CreateModel(
            name='Liquidacion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mes', models.DateField(help_text='Primer día del mes (YYYY-MM-01)')),
                ('tipo_liquidacion', models.CharField(default='hora', max_length=15)),
                ('clases_dadas', models.PositiveIntegerField(default=0)),
                ('valor_hora', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('sueldo_fijo', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('porcentaje', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('monto_calculado', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('monto_final', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('detalle', models.JSONField(blank=True, default=list)),
                ('confirmada', models.BooleanField(default=False)),
                ('fecha_confirmacion', models.DateTimeField(blank=True, null=True)),
                ('pagada', models.BooleanField(default=False)),
                ('fecha_pago', models.DateField(blank=True, null=True)),
                ('notas', models.TextField(blank=True)),
                ('creada_en', models.DateTimeField(auto_now_add=True)),
                ('actualizada_en', models.DateTimeField(auto_now=True)),
                ('profe', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='liquidaciones', to='profes.profe')),
            ],
            options={
                'verbose_name': 'Liquidación',
                'verbose_name_plural': 'Liquidaciones',
                'ordering': ['-mes', 'profe__nombre'],
                'unique_together': {('profe', 'mes')},
            },
        ),
    ]
