from django.db import migrations


def seed_sedes(apps, schema_editor):
    """Crea las sedes iniciales 107 y 24 tomando el nombre visible del
    NegocioConfig si ya estaba configurado; si no, usa los defaults."""
    Sede = apps.get_model('alumnos', 'Sede')
    NegocioConfig = apps.get_model('alumnos', 'NegocioConfig')

    cfg = NegocioConfig.objects.first()
    n107 = (getattr(cfg, 'nombre_sede1', '') or '').strip() if cfg else ''
    n24  = (getattr(cfg, 'nombre_sede2', '') or '').strip() if cfg else ''

    Sede.objects.get_or_create(
        codigo='107', defaults={'nombre': n107 or 'Athlon 107', 'orden': 1})
    Sede.objects.get_or_create(
        codigo='24', defaults={'nombre': n24 or 'Athlon 24', 'orden': 2})


def unseed_sedes(apps, schema_editor):
    Sede = apps.get_model('alumnos', 'Sede')
    Sede.objects.filter(codigo__in=['107', '24']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('alumnos', '0007_sede_alter_alumno_sede'),
    ]

    operations = [
        migrations.RunPython(seed_sedes, unseed_sedes),
    ]
