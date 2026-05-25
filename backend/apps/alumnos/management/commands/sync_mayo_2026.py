"""
Sincroniza alumnos y pagos de Mayo/Abril 2026 desde los Excel actualizados.

Uso:
    python manage.py sync_mayo_2026
    python manage.py sync_mayo_2026 --dry-run   (solo muestra qué haría sin guardar)
"""

import unicodedata
import uuid
from datetime import datetime, date
from django.core.management.base import BaseCommand
from django.db import transaction

BASE = r"G:\Mi unidad\Negocios\Athlon\Control\Alumnos"
S107_FILE = rf"{BASE}\2026 - s107.xlsx"
S24_FILE  = rf"{BASE}\2026- s24.xlsx"

DISC_MAP = {
    'CF': 'CF', 'FC': 'CF',
    'HF': 'HF',
    'HX': 'HX', 'HYROX': 'HX',
    'K': 'KD', 'KD': 'KD', 'KIDS': 'KD',
    'TN': 'TN', 'TEENS': 'TN',
    'FB': 'FB', 'FULLBODY': 'FB',
    'BP': 'BP',
}


def normalizar(s):
    if not s: return ''
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()


def normalizar_dis(dis_str):
    if not dis_str:
        return {'disciplina': 'CF', 'frecuencia': '3x'}
    d = str(dis_str).upper().replace(' ', '')
    if 'TEENS' in d: return {'disciplina': 'TN', 'frecuencia': '3x'}
    if 'KIDS' in d or d.startswith('K'): return {'disciplina': 'KD', 'frecuencia': '3x'}
    if 'HYROX' in d or d.startswith('HX'): return {'disciplina': 'HX', 'frecuencia': '3x'}
    disc = 'HF' if d.startswith('HF') else 'CF'
    freq = '3x'
    if 'X2' in d: freq = '2x'
    elif 'X5' in d: freq = '5x'
    elif 'LIBRE' in d: freq = 'libre'
    return {'disciplina': disc, 'frecuencia': freq}


def split_nombre(nombre_completo):
    partes = nombre_completo.strip().split()
    if len(partes) == 1:
        return partes[0], ''
    return partes[0], ' '.join(partes[1:])


def as_date(val):
    if val is None: return None
    if isinstance(val, datetime): return val.date()
    if isinstance(val, date): return val
    if isinstance(val, (int, float)):
        try:
            return (datetime(1899, 12, 30) + __import__('datetime').timedelta(days=int(val))).date()
        except Exception: return None
    return None


class Command(BaseCommand):
    help = 'Sync alumnos y pagos Mayo/Abril 2026 desde los Excel'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='No guardar cambios')

    def handle(self, *args, **options):
        try:
            import openpyxl
        except ImportError:
            self.stderr.write('ERROR: pip install openpyxl')
            return

        dry = options['dry_run']
        if dry:
            self.stdout.write(self.style.WARNING('=== DRY RUN — nada se guarda ==='))

        from apps.alumnos.models import Alumno
        from apps.pagos.models import Pago

        mes_abril = date(2026, 4, 1)
        mes_mayo  = date(2026, 5, 1)

        # Construir índice normalizado de alumnos existentes por sede
        def build_index(sede):
            idx = {}
            for a in Alumno.objects.filter(sede=sede):
                key = normalizar(a.nombre) + ' ' + normalizar(a.apellido)
                idx[key] = a
            return idx

        totales = {
            'alumnos_creados': 0, 'alumnos_actualizados': 0,
            'pagos_abril': 0, 'pagos_mayo': 0, 'pagos_skipped': 0,
            'no_match': [],
        }

        for path, sheet_name, sede in [
            (S107_FILE, '2026- s107', '107'),
            (S24_FILE,  'LISTADO ALUMNOS', '24'),
        ]:
            self.stdout.write(f'\n--- Sede {sede} ---')
            try:
                wb = openpyxl.load_workbook(path, data_only=True)
            except FileNotFoundError:
                self.stderr.write(f'  No se encontró {path}')
                continue

            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            idx = build_index(sede)

            with transaction.atomic():
                for row_i, row in enumerate(rows):
                    if row_i < 5: continue

                    nombre_raw = row[5] if len(row) > 5 else None
                    if not nombre_raw or not isinstance(nombre_raw, str) or len(nombre_raw.strip()) < 3:
                        continue
                    estado_raw = row[2] if len(row) > 2 else None
                    if estado_raw not in ('Vencido', 'Vigente'):
                        continue

                    # Datos del alumno
                    horario_h   = row[1] if len(row) > 1 else None
                    vto         = row[3] if len(row) > 3 else None
                    fecha_ini   = row[4] if len(row) > 4 else None
                    dis_raw     = row[7] if len(row) > 7 else ''
                    cuota       = row[8] if len(row) > 8 else 0

                    # Pagos
                    mayo_fecha  = row[12] if len(row) > 12 else None
                    mayo_monto  = row[13] if len(row) > 13 else None
                    abril_fecha = row[14] if len(row) > 14 else None
                    abril_monto = row[15] if len(row) > 15 else None

                    nombre_str = nombre_raw.strip()
                    nombre, apellido = split_nombre(nombre_str)
                    key = normalizar(nombre) + ' ' + normalizar(apellido)
                    key_full = normalizar(nombre_str)   # alternativa sin split

                    horario = f"{int(horario_h):02d}:00" if isinstance(horario_h, (int, float)) else ''
                    dis_info = normalizar_dis(str(dis_raw) if dis_raw else '')
                    cuota_val = float(cuota) if cuota else 0
                    f_inicio = as_date(fecha_ini) or date(2024, 1, 1)

                    # Determinar estado 2026
                    has_mayo  = mayo_fecha is not None and mayo_monto not in (None, 0, '')
                    has_abril = abril_fecha is not None and abril_monto not in (None, 0, '')
                    if has_mayo:
                        estado_calc = 'activo'
                    elif has_abril:
                        estado_calc = 'mora'
                    else:
                        # Verificar si vencimiento es futuro (2026)
                        vto_date = as_date(vto)
                        if vto_date and vto_date >= date(2026, 5, 1):
                            estado_calc = 'mora'
                        else:
                            estado_calc = 'alejado'

                    # Buscar alumno en DB (por nombre normalizado)
                    alumno = idx.get(key) or idx.get(key_full)

                    if alumno:
                        # Actualizar datos si cambiaron
                        changed = False
                        if abs(float(alumno.cuota_actual) - cuota_val) > 1:
                            alumno.cuota_actual = cuota_val; changed = True
                        if alumno.disciplina != dis_info['disciplina']:
                            alumno.disciplina = dis_info['disciplina']; changed = True
                        if alumno.frecuencia != dis_info['frecuencia']:
                            alumno.frecuencia = dis_info['frecuencia']; changed = True
                        if horario and alumno.horario != horario:
                            alumno.horario = horario; changed = True
                        # Solo actualizar estado si el calculado es "mejor"
                        estado_prio = {'activo': 3, 'mora': 2, 'alejado': 1, 'baja': 0, 'temporal': 0}
                        if estado_prio.get(estado_calc, 0) > estado_prio.get(alumno.estado, 0):
                            alumno.estado = estado_calc; changed = True
                        if changed:
                            if not dry: alumno.save()
                            totales['alumnos_actualizados'] += 1
                    else:
                        # Crear nuevo alumno
                        totales['no_match'].append(f"{sede}: {nombre_str}")
                        if not dry:
                            alumno = Alumno.objects.create(
                                nombre=nombre, apellido=apellido,
                                dni=f'IMPORT-{sede}-{uuid.uuid4().hex[:8]}',
                                celular='', sede=sede, fecha_inicio=f_inicio,
                                disciplina=dis_info['disciplina'],
                                frecuencia=dis_info['frecuencia'],
                                horario=horario, cuota_actual=cuota_val,
                                estado=estado_calc, tipo_precio='regular',
                            )
                            idx[key] = alumno
                        totales['alumnos_creados'] += 1
                        if dry:
                            alumno = None

                    if alumno is None:
                        continue

                    # Importar pago Abril
                    if has_abril and not dry:
                        fd = as_date(abril_fecha) or mes_abril
                        try:
                            monto_a = float(abril_monto)
                            if monto_a > 0 and not Pago.objects.filter(alumno=alumno, mes=mes_abril).exists():
                                Pago.objects.create(
                                    alumno=alumno, mes=mes_abril,
                                    monto=monto_a, fecha_pago=fd, metodo='efectivo',
                                )
                                totales['pagos_abril'] += 1
                        except (TypeError, ValueError): pass

                    # Importar pago Mayo
                    if has_mayo and not dry:
                        fd = as_date(mayo_fecha) or mes_mayo
                        try:
                            monto_m = float(mayo_monto)
                            if monto_m > 0 and not Pago.objects.filter(alumno=alumno, mes=mes_mayo).exists():
                                Pago.objects.create(
                                    alumno=alumno, mes=mes_mayo,
                                    monto=monto_m, fecha_pago=fd, metodo='efectivo',
                                )
                                totales['pagos_mayo'] += 1
                            else:
                                totales['pagos_skipped'] += 1
                        except (TypeError, ValueError): pass

        self.stdout.write(self.style.SUCCESS(f"""
Resultado:
  Alumnos creados:     {totales['alumnos_creados']}
  Alumnos actualizados:{totales['alumnos_actualizados']}
  Pagos Abril nuevos:  {totales['pagos_abril']}
  Pagos Mayo nuevos:   {totales['pagos_mayo']}
  Pagos skipped (ya existían): {totales['pagos_skipped']}
  Sin match en DB:     {len(totales['no_match'])}
"""))
        if totales['no_match']:
            self.stdout.write('  Sin match (primeros 20):')
            for n in totales['no_match'][:20]:
                self.stdout.write(f'    {n}')
