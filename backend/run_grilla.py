import django, os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistathlon.settings')
django.setup()

from datetime import time
from apps.profes.models import Profe
from apps.horarios.models import HorarioMaestro

_profes = {p.nombre: p for p in Profe.objects.all()}

def P(nombre):
    if not nombre:
        return None
    for n, obj in _profes.items():
        if n.lower().startswith(nombre.lower()):
            return obj
    return None

def t(h): return time(h, 0)

eliminados = HorarioMaestro.objects.filter(sede__in=['107', '24']).count()
HorarioMaestro.objects.filter(sede__in=['107', '24']).delete()
print(f"Borrados {eliminados} horarios existentes.")

GRILLA = [
    # ATHLON 107
    # HF 8:00
    ('107','lun',t(8),'HF','Mario'),
    ('107','mar',t(8),'HF','Mario'),
    ('107','mie',t(8),'HF','Barbi'),
    ('107','jue',t(8),'HF','Mario'),
    ('107','vie',t(8),'HF','Mario'),
    # CF 9:00
    ('107','lun',t(9),'CF','Mario'),
    ('107','mar',t(9),'CF','Mario'),
    ('107','mie',t(9),'CF','Barbi'),
    ('107','jue',t(9),'CF','Mario'),
    ('107','vie',t(9),'CF','Mario'),
    # CF 11:00
    ('107','lun',t(11),'CF','Mario'),
    ('107','mar',t(11),'CF','Mario'),
    ('107','mie',t(11),'CF','Mario'),
    ('107','jue',t(11),'CF','Mario'),
    ('107','vie',t(11),'CF','Mario'),
    # CF 13:00
    ('107','lun',t(13),'CF','Flor'),
    ('107','mar',t(13),'CF','Dami'),
    ('107','mie',t(13),'CF','Flor'),
    ('107','jue',t(13),'CF','Dami'),
    ('107','vie',t(13),'CF','Flor'),
    # CF 14:00
    ('107','lun',t(14),'CF','Sofi'),
    ('107','mar',t(14),'CF','Dami'),
    ('107','mie',t(14),'CF','Sofi'),
    ('107','jue',t(14),'CF','Dami'),
    ('107','vie',t(14),'CF','Flor'),
    # HF 14:00
    ('107','lun',t(14),'HF','Flor'),
    ('107','mie',t(14),'HF','Flor'),
    # CF 15:00
    ('107','lun',t(15),'CF','Sofi'),
    ('107','mar',t(15),'CF','Dami'),
    ('107','mie',t(15),'CF','Sofi'),
    ('107','jue',t(15),'CF','Dami'),
    ('107','vie',t(15),'CF','Flor'),
    # HF 15:00
    ('107','lun',t(15),'HF','Flor'),
    ('107','mie',t(15),'HF','Flor'),
    ('107','jue',t(15),'HF','Dami'),
    ('107','vie',t(15),'HF','Flor'),
    # CF 16:00
    ('107','lun',t(16),'CF','Flor'),
    ('107','mar',t(16),'CF','Dami'),
    ('107','mie',t(16),'CF','Sofi'),
    ('107','jue',t(16),'CF','Dami'),
    ('107','vie',t(16),'CF','Flor'),
    # HF 17:00
    ('107','lun',t(17),'HF','Barbi'),
    ('107','mar',t(17),'HF','Mario'),
    ('107','mie',t(17),'HF','Barbi'),
    ('107','jue',t(17),'HF','Mario'),
    ('107','vie',t(17),'HF','Mario'),
    # CF 18:00
    ('107','lun',t(18),'CF','Barbi'),
    ('107','mar',t(18),'CF','Mario'),
    ('107','mie',t(18),'CF','Barbi'),
    ('107','jue',t(18),'CF','Mario'),
    ('107','vie',t(18),'CF','Mario'),
    # HF 18:00
    ('107','mar',t(18),'HF','Flor'),
    ('107','jue',t(18),'HF','Flor'),
    # CF 19:00
    ('107','lun',t(19),'CF','Barbi'),
    ('107','mar',t(19),'CF','Mario'),
    ('107','mie',t(19),'CF','Barbi'),
    ('107','jue',t(19),'CF','Mario'),
    ('107','vie',t(19),'CF','Mario'),
    # CF 20:00
    ('107','lun',t(20),'CF','Sofi'),
    ('107','mar',t(20),'CF','Bruno'),
    ('107','mie',t(20),'CF','Sofi'),
    ('107','jue',t(20),'CF','Bruno'),
    ('107','vie',t(20),'CF','Flor'),
    # HF 20:00
    ('107','lun',t(20),'HF','Flor'),
    ('107','mar',t(20),'HF','Flor'),
    ('107','mie',t(20),'HF','Flor'),
    ('107','jue',t(20),'HF','Flor'),
    # CF 21:00
    ('107','lun',t(21),'CF','Flor'),
    ('107','mar',t(21),'CF','Flor'),
    ('107','mie',t(21),'CF','Flor'),
    ('107','jue',t(21),'CF','Bruno'),
    ('107','vie',t(21),'CF','Flor'),

    # ATHLON 24
    # HF 8:00
    ('24','mie',t(8),'HF','Mario'),
    ('24','vie',t(8),'HF','Barbi'),
    # CF 9:00
    ('24','lun',t(9),'CF','Barbi'),
    ('24','mie',t(9),'CF','Mario'),
    ('24','vie',t(9),'CF','Barbi'),
    # CF 13:00
    ('24','lun',t(13),'CF','Dami'),
    ('24','mar',t(13),'CF','Flor'),
    ('24','mie',t(13),'CF','Dami'),
    ('24','jue',t(13),'CF','Flor'),
    ('24','vie',t(13),'CF','Dami'),
    # CF 14:00
    ('24','lun',t(14),'CF','Dami'),
    ('24','mar',t(14),'CF','Sofi'),
    ('24','mie',t(14),'CF','Dami'),
    ('24','jue',t(14),'CF','Sofi'),
    ('24','vie',t(14),'CF','Dami'),
    # HF 15:00
    ('24','lun',t(15),'HF','Dami'),
    ('24','mar',t(15),'HF','Barbi'),
    ('24','mie',t(15),'HF','Dami'),
    ('24','jue',t(15),'HF','Barbi'),
    ('24','vie',t(15),'HF','Barbi'),
    # CF 16:00
    ('24','lun',t(16),'CF','Dami'),
    ('24','mar',t(16),'CF','Barbi'),
    ('24','mie',t(16),'CF','Dami'),
    ('24','jue',t(16),'CF','Barbi'),
    ('24','vie',t(16),'CF','Barbi'),
    # HF 17:00
    ('24','lun',t(17),'HF','Mario'),
    ('24','mie',t(17),'HF','Mario'),
    # CF 18:00
    ('24','lun',t(18),'CF','Mario'),
    ('24','mar',t(18),'CF','Barbi'),
    ('24','mie',t(18),'CF','Mario'),
    ('24','jue',t(18),'CF','Barbi'),
    ('24','vie',t(18),'CF','Barbi'),
    # CF 19:00
    ('24','lun',t(19),'CF','Mario'),
    ('24','mar',t(19),'CF','Barbi'),
    ('24','mie',t(19),'CF','Mario'),
    ('24','jue',t(19),'CF','Barbi'),
    ('24','vie',t(19),'CF','Barbi'),
    # HF 20:00
    ('24','lun',t(20),'HF','Bruno'),
    ('24','mar',t(20),'HF','Sofi'),
    ('24','mie',t(20),'HF','Bruno'),
    ('24','jue',t(20),'HF','Sofi'),
    # CF 21:00
    ('24','lun',t(21),'CF','Bruno'),
    ('24','mar',t(21),'CF','Sofi'),
    ('24','mie',t(21),'CF','Bruno'),
    ('24','jue',t(21),'CF','Sofi'),
    ('24','vie',t(21),'CF','Dami'),
]

creados = 0
errores = []
for sede, dia, hora, disc, profe_nombre in GRILLA:
    profe_obj = P(profe_nombre)
    if profe_nombre and not profe_obj:
        errores.append(f"No encontre profe: {profe_nombre}")
        continue
    try:
        HorarioMaestro.objects.create(
            sede=sede, dia=dia, hora=hora,
            disciplina=disc, profe=profe_obj,
            capacidad_max=21, activo=True
        )
        creados += 1
    except Exception as e:
        errores.append(f"{sede} {dia} {hora} {disc}: {e}")

print(f"Creados: {creados} horarios")
if errores:
    print(f"Errores ({len(errores)}):")
    for e in errores:
        print(f"  - {e}")
else:
    print("Sin errores.")
