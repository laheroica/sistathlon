"""
Importa todos los pagos históricos desde los Excel (Jun 2025 → May 2026).

Uso:
    python manage.py importar_pagos_historicos
    python manage.py importar_pagos_historicos --dry-run   # sin guardar
"""

import os
from datetime import date, datetime
from django.core.management.base import BaseCommand
from django.db import transaction

BASE_EXCEL = os.path.expandvars(r"G:\Mi unidad\Negocios\Athlon\Control")
S107_FILE  = os.path.join(BASE_EXCEL, "Alumnos", "2026 - s107.xlsx")
S24_FILE   = os.path.join(BASE_EXCEL, "Alumnos", "2026- s24.xlsx")

# Columnas del Excel: (col_fecha, col_monto, date_del_mes)
MESES_COLS = [
    (12, 13, date(2026,  5, 1)),   # Mayo 2026
    (14, 15, date(2026,  4, 1)),   # Abril 2026
    (16, 17, date(2026,  3, 1)),   # Marzo 2026
    (18, 19, date(2026,  2, 1)),   # Febrero 2026
    (20, 21, date(2026,  1, 1)),   # Enero 2026
    (22, 23, date(2025, 12, 1)),   # Diciembre 2025
    (24, 25, date(2025, 11, 1)),   # Noviembre 2025
    (26, 27, date(2025, 10, 1)),   # Octubre 2025
    (28, 29, date(2025,  9, 1)),   # Septiembre 2025
    (30, 31, date(2025,  8, 1)),   # Agosto 2025
    (32, 33, date(2025,  7, 1)),   # Julio 2025
    (34, 35, date(2025,  6, 1)),   # Junio 2025
]


def excel_serial_to_date(serial):
    if not serial or not isinstance(serial, (int, float)):
        return None
    try:
        from datetime import timedelta
        return (datetime(1899, 12, 30) + timedelta(days=int(serial))).date()
    except Exception:
        return None


class Command(BaseCommand):
    help = 'Importa todos los pagos históricos desde los Excel (Jun 2025–May 2026)'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Mostrar sin guardar')

    def handle(self, *args, **options):
        try:
            import openpyxl
        except ImportError:
            self.stderr.write('ERROR: openpyxl no instalado. Ejecutá: pip install openpyxl')
            return

        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING('— DRY RUN, no se guardará nada —'))

        total_creados  = 0
        total_skip     = 0
        total_sin_match = 0

        for path, sheet_name, sede in [
            (S107_FILE, '2026- s107',      '107'),
            (S24_FILE,  'LISTADO ALUMNOS', '24'),
        ]:
            try:
                wb = openpyxl.load_workbook(path, data_only=True)
            except FileNotFoundError:
                self.stderr.write(f'  ERROR: No se encontró {path}')
                continue

            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            creados = skip = sin_match = 0

            self.stdout.write(f'\nProcesando sede {sede} ({len(rows) - 5} filas)...')

            with transaction.atomic():
                for row in rows[5:]:
                    nombre_raw = row[5] if len(row) > 5 else None
                    if not nombre_raw or not isinstance(nombre_raw, str) or len(nombre_raw.strip()) < 3:
                        continue

                    nombre = nombre_raw.strip()
                    partes = nombre.split(' ')
                    primer_nombre = partes[0]
                    apellido = ' '.join(partes[1:]) if len(partes) >= 2 else ''

                    from apps.alumnos.models import Alumno
                    alumno = Alumno.objects.filter(
                        nombre=primer_nombre, apellido=apellido, sede=sede
                    ).first()

                    if not alumno:
                        sin_match += 1
                        continue

                    from apps.pagos.models import Pago

                    for col_fecha, col_monto, mes in MESES_COLS:
                        fecha_s = row[col_fecha] if len(row) > col_fecha else None
                        monto_s = row[col_monto] if len(row) > col_monto else None

                        if not monto_s:
                            continue
                        try:
                            monto = float(monto_s)
                            if monto <= 0:
                                continue
                        except (TypeError, ValueError):
                            continue

                        # Fecha de pago
                        if isinstance(fecha_s, (int, float)):
                            fecha_pago = excel_serial_to_date(fecha_s) or mes
                        elif isinstance(fecha_s, (date, datetime)):
                            fecha_pago = fecha_s if isinstance(fecha_s, date) else fecha_s.date()
                        else:
                            fecha_pago = mes  # fallback: primer día del mes

                        # Crear solo si no existe
                        if not Pago.objects.filter(alumno=alumno, mes=mes).exists():
                            if not dry_run:
                                Pago.objects.create(
                                    alumno=alumno,
                                    mes=mes,
                                    monto=monto,
                                    fecha_pago=fecha_pago,
                                    metodo='efectivo',
                                )
                            creados += 1
                        else:
                            skip += 1

            self.stdout.write(
                f'  Sede {sede}: {creados} pagos creados, '
                f'{skip} ya existían, {sin_match} alumnos sin match'
            )
            total_creados   += creados
            total_skip      += skip
            total_sin_match += sin_match

        self.stdout.write(self.style.SUCCESS(
            f'\nTotal: {total_creados} pagos importados, '
            f'{total_skip} ya existían, {total_sin_match} sin match de alumno.'
        ))

        # Actualizar estados según último pago
        if not dry_run and total_creados > 0:
            self.stdout.write('\nActualizando estados de alumnos...')
            self._actualizar_estados()

    def _actualizar_estados(self):
        from apps.alumnos.models import Alumno
        from apps.pagos.models import Pago
        from django.db.models import Max

        hoy = date.today()
        mes_actual   = date(hoy.year, hoy.month, 1)
        mes_anterior = date(hoy.year, hoy.month - 1, 1) if hoy.month > 1 else date(hoy.year - 1, 12, 1)

        actualizados = 0
        for alumno in Alumno.objects.filter(activo=True).exclude(estado__in=['baja', 'temporal']):
            ultimo = alumno.pagos.aggregate(u=Max('mes'))['u']
            if ultimo is None or ultimo < mes_anterior:
                nuevo = 'alejado'
            elif ultimo == mes_anterior:
                nuevo = 'mora'
            else:
                nuevo = 'activo'

            if alumno.estado != nuevo:
                alumno.estado = nuevo
                alumno.save(update_fields=['estado'])
                actualizados += 1

        self.stdout.write(self.style.SUCCESS(f'  {actualizados} alumnos actualizados.'))
