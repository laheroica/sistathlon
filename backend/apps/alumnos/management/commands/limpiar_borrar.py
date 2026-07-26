from django.core.management.base import BaseCommand
from django.core import serializers
from django.db.models import Q, Count
from apps.alumnos.models import Alumno


class Command(BaseCommand):
    help = ("Lista (o elimina) los alumnos que tienen la palabra 'BORRAR' en su "
            "nombre/apellido. Por defecto es dry-run. --confirmar borra solo los "
            "que no tienen pagos; --forzar borra TODOS (incluye su historial de "
            "pagos), guardando antes un backup.")

    def add_arguments(self, parser):
        parser.add_argument('--confirmar', action='store_true',
                            help='Borra los que NO tienen pagos (los protegidos se saltean).')
        parser.add_argument('--forzar', action='store_true',
                            help='Borra TODOS, incluido el historial de pagos. Hace backup antes.')
        parser.add_argument('--backup', default='',
                            help='Ruta del archivo de backup JSON (para --forzar).')
        parser.add_argument('--termino', default='borrar',
                            help="Palabra a buscar (default: borrar).")

    def handle(self, *args, **opts):
        from apps.pagos.models import Pago
        from apps.productos.models import MovimientoCuentaCorriente

        termino = opts['termino']
        qs = (Alumno.objects
              .filter(Q(nombre__icontains=termino) | Q(apellido__icontains=termino))
              .annotate(npagos=Count('pagos'))
              .order_by('apellido', 'nombre'))

        total = qs.count()
        self.stdout.write(f"Encontrados: {total} (buscando '{termino}' en nombre/apellido)")
        con_pagos = 0
        for a in qs:
            marca = '  <-- TIENE PAGOS' if a.npagos else ''
            if a.npagos:
                con_pagos += 1
            self.stdout.write(
                f"  id={a.id} | {a.apellido}, {a.nombre} | sede={a.sede} | "
                f"activo={a.activo} | pagos={a.npagos}{marca}")

        if total == 0:
            return

        ids = list(qs.values_list('id', flat=True))

        # ── FORZAR: backup + borrar todo (incluye pagos) ──
        if opts['forzar']:
            ruta = opts['backup']
            if ruta:
                alumnos = list(Alumno.objects.filter(id__in=ids))
                pagos   = list(Pago.objects.filter(alumno_id__in=ids))
                cc      = list(MovimientoCuentaCorriente.objects.filter(alumno_id__in=ids))
                data = serializers.serialize('json', alumnos + pagos + cc, indent=2)
                with open(ruta, 'w', encoding='utf-8') as f:
                    f.write(data)
                self.stdout.write(self.style.SUCCESS(
                    f"\nBackup guardado en {ruta} ({len(alumnos)} alumnos, "
                    f"{len(pagos)} pagos, {len(cc)} mov. cta. cte.)"))
            else:
                self.stdout.write(self.style.WARNING("\nSin --backup: se borra sin respaldo."))

            npagos, _ = Pago.objects.filter(alumno_id__in=ids).delete()
            nborr, detalle = Alumno.objects.filter(id__in=ids).delete()
            self.stdout.write(self.style.SUCCESS(
                f"ELIMINADOS: {nborr} filas de alumno (+relacionadas), "
                f"{npagos} pagos. Detalle: {detalle}"))
            return

        # ── CONFIRMAR: borrar solo los que no tienen pagos ──
        if opts['confirmar']:
            ids_sin = list(qs.filter(npagos=0).values_list('id', flat=True))
            nborr, detalle = Alumno.objects.filter(id__in=ids_sin).delete()
            self.stdout.write(self.style.SUCCESS(
                f"\nELIMINADOS {nborr} (sin pagos). Quedaron {con_pagos} con pagos. "
                f"Detalle: {detalle}"))
            return

        # ── DRY-RUN ──
        self.stdout.write(self.style.WARNING(
            f"\nDRY-RUN: no se borró nada. {con_pagos} tienen pagos. "
            "Usar --confirmar (solo sin pagos) o --forzar (todos, con backup)."))
