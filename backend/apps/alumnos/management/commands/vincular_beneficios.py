# -*- coding: utf-8 -*-
import csv
import unicodedata
from django.core.management.base import BaseCommand
from apps.alumnos.models import Alumno


def norm(s):
    s = (s or '').strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    s = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in s)
    return ' '.join(s.split())


def toks(s):
    return frozenset(norm(s).split())


class Command(BaseCommand):
    help = ("Vincula alumnos de Sistathlon con su beneficio_id (QR) desde un CSV "
            "id,nombre exportado de la hoja de beneficios. Dry-run por defecto; "
            "usar --confirmar para guardar.")

    def add_arguments(self, parser):
        parser.add_argument('--csv', required=True, help='Ruta al CSV id,nombre')
        parser.add_argument('--confirmar', action='store_true', help='Guarda los beneficio_id.')

    def handle(self, *args, **opts):
        # Cargar CSV (id, nombre)
        filas = []
        with open(opts['csv'], encoding='utf-8') as f:
            r = csv.reader(f)
            next(r, None)  # header
            for row in r:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    filas.append((row[0].strip(), row[1].strip()))
        self.stdout.write(f"Filas con nombre en la hoja: {len(filas)}")

        # Índice de alumnos activos por conjunto de tokens del nombre completo
        idx = {}
        for a in Alumno.objects.filter(activo=True):
            idx.setdefault(toks(f"{a.nombre} {a.apellido}"), []).append(a)

        match_1 = []       # (alumno, bid)
        ambiguos = []      # (nombre_hoja, [alumnos])
        sin_match = []     # nombre_hoja
        ya_tenian = []     # alumnos con beneficio_id distinto

        usados = set()
        for bid, nombre in filas:
            cands = idx.get(toks(nombre), [])
            # no reasignar un alumno ya matcheado en esta corrida
            cands = [a for a in cands if a.id not in usados]
            if len(cands) == 1:
                a = cands[0]
                if a.beneficio_id and a.beneficio_id != bid:
                    ya_tenian.append((a, bid))
                    continue
                match_1.append((a, bid))
                usados.add(a.id)
            elif len(cands) > 1:
                ambiguos.append((nombre, cands))
            else:
                sin_match.append(nombre)

        self.stdout.write(self.style.SUCCESS(f"\nMatch único: {len(match_1)}"))
        self.stdout.write(f"Ambiguos (varios alumnos con ese nombre): {len(ambiguos)}")
        self.stdout.write(f"Sin match en Sistathlon: {len(sin_match)}")
        self.stdout.write(f"Ya tenían otro beneficio_id (no se tocan): {len(ya_tenian)}")

        if ambiguos:
            self.stdout.write("\n-- AMBIGUOS (resolver a mano) --")
            for nombre, cs in ambiguos[:40]:
                self.stdout.write(f"  '{nombre}' -> {[f'{a.apellido},{a.nombre}(id{a.id})' for a in cs]}")

        if sin_match:
            self.stdout.write("\n-- SIN MATCH (primeros 60) --")
            for n in sin_match[:60]:
                self.stdout.write(f"  {n}")

        if not opts['confirmar']:
            self.stdout.write(self.style.WARNING(
                f"\nDRY-RUN: no se guardó nada. Correr con --confirmar para aplicar "
                f"{len(match_1)} vinculaciones."))
            return

        for a, bid in match_1:
            a.beneficio_id = bid
            a.save(update_fields=['beneficio_id'])
        self.stdout.write(self.style.SUCCESS(f"\nGUARDADAS {len(match_1)} vinculaciones."))
