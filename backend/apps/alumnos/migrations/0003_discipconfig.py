from django.db import migrations, models


INITIAL_DISCS = [
    # (codigo, nombre, frecuencias, color_badge, color_hex, orden)
    ('CF', 'CrossFit',        ['2x', '3x', 'libre'], 'bg-blue-900/70 text-blue-200',    '#3b82f6', 0),
    ('HF', 'Heavy Funcional', ['2x', '3x', '5x'],    'bg-green-900/70 text-green-200',  '#22c55e', 1),
    ('HX', 'Hyrox',           ['3x'],                'bg-yellow-900/70 text-yellow-200','#eab308', 2),
    ('FB', 'FullBody',        ['2x', '3x', '5x'],    'bg-orange-900/70 text-orange-200','#f97316', 3),
    ('TN', 'Teens',           ['3x'],                'bg-purple-900/70 text-purple-200','#a855f7', 4),
    ('KD', 'Kids',            ['3x'],                'bg-pink-900/70 text-pink-200',    '#ec4899', 5),
    ('BP', 'Bonus Pack',      ['libre'],             'bg-sky-900/70 text-sky-200',      '#0ea5e9', 6),
]


def seed_disciplinas(apps, schema_editor):
    DiscipConfig = apps.get_model('alumnos', 'DiscipConfig')
    for codigo, nombre, frecuencias, color_badge, color_hex, orden in INITIAL_DISCS:
        DiscipConfig.objects.get_or_create(
            codigo=codigo,
            defaults=dict(
                nombre=nombre,
                frecuencias=frecuencias,
                color_badge=color_badge,
                color_hex=color_hex,
                orden=orden,
                activo=True,
            ),
        )


class Migration(migrations.Migration):

    dependencies = [
        ('alumnos', '0002_pertenencia_fullbody'),
    ]

    operations = [
        migrations.CreateModel(
            name='DiscipConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(help_text='Código corto: CF, HF, HX, FB…', max_length=10, unique=True)),
                ('nombre', models.CharField(max_length=50)),
                ('frecuencias', models.JSONField(default=list, help_text='Ej: ["2x","3x","libre"]')),
                ('color_badge', models.CharField(default='bg-gray-700 text-gray-200', help_text='Clases Tailwind para el badge', max_length=150)),
                ('color_hex', models.CharField(default='#6b7280', help_text='Color hex para gráficos', max_length=20)),
                ('orden', models.PositiveIntegerField(default=0)),
                ('activo', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Disciplina',
                'verbose_name_plural': 'Disciplinas',
                'ordering': ['orden', 'nombre'],
            },
        ),
        migrations.RunPython(seed_disciplinas, migrations.RunPython.noop),
    ]
