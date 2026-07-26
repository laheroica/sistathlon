from django.core.management.base import BaseCommand
from django.db.models import Q, Count
from apps.alumnos.models import Alumno


class Command(BaseCommand):
    help = ("Lista (o elimina con --confirmar) los alumnos que tienen la palabra "
            "'BORRAR' en su nombre o apellido. Por defecto es dry-run (no borra).")

    def add_arguments(self, parser):
        parser.add_argument('--confirmar', action='store_true',
                            help='Elimina de verdad. Sin este flag, solo lista.')
        parser.add_argument('--termino', default='borrar',
                            help="Palabra a buscar en nombre/apellido (default: borrar).")

    def handle(self, *args, **opts):
        termino = opts['termino']
        qs = (Alumno.objects
              .filter(Q(nombre__icontains=termino) | Q(apellido__icontains=termino))
              .annotate(npagos=Count('pagos'))
              .order_by('apellido', 'nombre'))

        total = qs.count()
        self.stdout.write(f"Encontrados: {total} (buscando '{termino}' en nombre/apellido)")
        con_pagos = 0
        for a in qs:
            marca = ''
            if a.npagos:
                con_pagos += 1
                marca = '  <-- TIENE PAGOS'
            self.stdout.write(
                f"  id={a.id} | {a.apellido}, {a.nombre} | sede={a.sede} | "
                f"activo={a.activo} | pagos={a.npagos}{marca}"
            )

        if total == 0:
            return

        if not opts['confirmar']:
            self.stdout.write(self.style.WARNING(
                f"\nDRY-RUN: no se borró nada. {con_pagos} tienen pagos asociados. "
                "Para eliminar, correr con --confirmar."))
            return

        # Eliminación real
        ids = list(qs.values_list('id', flat=True))
        borrados, detalle = Alumno.objects.filter(id__in=ids).delete()
        self.stdout.write(self.style.SUCCESS(
            f"\nELIMINADOS {borrados} registros. Detalle: {detalle}"))
