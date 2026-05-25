from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('alumnos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='alumno',
            name='pertenencia',
            field=models.CharField(
                choices=[('athlon', 'Athlon'), ('day', 'Day Gym'), ('otro', 'Otro espacio')],
                default='athlon', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='alumno',
            name='porcentaje_athlon',
            field=models.DecimalField(decimal_places=2, default=100, max_digits=5,
                help_text='% del cobro que queda en Athlon (100 = Athlon, 50 = Day)'),
        ),
        migrations.AddField(
            model_name='alumno',
            name='precio_especial',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='alumno',
            name='motivo_precio_especial',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AlterField(
            model_name='alumno',
            name='disciplina',
            field=models.CharField(
                choices=[
                    ('CF', 'Crossfit'), ('HF', 'Heavy Funcional'), ('HX', 'Hyrox'),
                    ('TN', 'Crossfit Teens'), ('KD', 'Crossfit Kids'), ('BP', 'Bonus Pack'),
                    ('FB', 'FullBody'),
                ],
                max_length=5,
            ),
        ),
    ]
