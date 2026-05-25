"""
Actualiza el estado de los alumnos según su historial de pagos.

Lógica:
  - Pagó el mes corriente                → activo
  - No pagó este mes, pero sí el anterior → mora
  - No pagó hace 2+ meses                → alejado
  - Estado 'baja' o 'temporal'           → no se toca

Uso:
    python manage.py actualizar_estados
    python manage.py actualizar_estados --dry-run   (muestra cambios sin aplicar)
"""

from datetime import date
from django.core.management.base import BaseCommand
from django.db.models import Max


class Command(BaseCommand):
    help = 'Actualiza estados de alumnos según historial de pagos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Muestra los cambios sin aplicarlos'
        )

    def handle(self, *args, **options):
        from apps.alumnos.models import Alumno

        dry = options['dry_run']
        hoy = date.today()
        mes_actual   = date(hoy.year, hoy.month, 1)
        mes_anterior = date(hoy.year, hoy.month - 1, 1) if hoy.month > 1 else date(hoy.year - 1, 12, 1)

        # Solo tocar activo / mora / alejado — respetar baja y temporal
        alumnos = (
            Alumno.objects
            .filter(activo=True, estado__in=['activo', 'mora', 'alejado'])
            .annotate(ultimo_mes_pago=Max('pagos__mes'))
        )

        cambios = {'activo': 0, 'mora': 0, 'alejado': 0, 'sin_cambio': 0}
        detalle = []

        for alumno in alumnos:
            ultimo = alumno.ultimo_mes_pago  # None si nunca pagó

            if ultimo is None or ultimo < mes_anterior:
                nuevo = 'alejado'
            elif ultimo == mes_anterior:
                nuevo = 'mora'
            else:  # ultimo >= mes_actual
                nuevo = 'activo'

            if nuevo != alumno.estado:
                cambios[nuevo] += 1
                detalle.append(f'  {alumno.nombre_completo:<30} {alumno.estado} -> {nuevo}  (ultimo pago: {ultimo})')
                if not dry:
                    alumno.estado = nuevo
                    alumno.save(update_fields=['estado'])
            else:
                cambios['sin_cambio'] += 1

        # Reporte
        prefix = '[DRY RUN] ' if dry else ''
        self.stdout.write(f'\n{prefix}Resultados al {hoy.strftime("%d/%m/%Y")}:')
        self.stdout.write(f'  Mes actual:   {mes_actual.strftime("%m/%Y")}')
        self.stdout.write(f'  Mes anterior: {mes_anterior.strftime("%m/%Y")}')
        self.stdout.write('')
        if detalle:
            self.stdout.write(f'{prefix}Cambios ({sum(v for k,v in cambios.items() if k != "sin_cambio")}):')
            for d in detalle:
                self.stdout.write(d)
        self.stdout.write('')
        self.stdout.write(f'  -> activo:    {cambios["activo"]}')
        self.stdout.write(f'  -> mora:      {cambios["mora"]}')
        self.stdout.write(f'  -> alejado:   {cambios["alejado"]}')
        self.stdout.write(f'  Sin cambio:   {cambios["sin_cambio"]}')

        if dry:
            self.stdout.write(self.style.WARNING('\nModo dry-run: ningun cambio fue aplicado.'))
        else:
            self.stdout.write(self.style.SUCCESS('\nEstados actualizados correctamente.'))
