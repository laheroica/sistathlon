from django.contrib import admin
from django.db.models import Count
from urllib.parse import urlencode
from .models import Alumno, Sede, sede_labels

FILTROS_LABELS = {
    'sede':       None,   # etiquetas dinámicas desde el modelo Sede
    'disciplina': {'CF': 'Crossfit', 'HF': 'Heavy Funcional', 'HX': 'Hyrox',
                   'TN': 'Teens', 'KD': 'Kids', 'BP': 'Bonus'},
    'frecuencia': {'2x': '2x/sem', '3x': '3x/sem', '5x': '5x/sem', 'libre': 'Pase Libre'},
    'estado':     {'activo': 'Activo', 'mora': 'En mora', 'baja': 'Baja',
                   'alejado': 'Alejado', 'temporal': 'Temporal'},
    'horario':    None,   # usa el valor directamente
}

FREQ_LABELS = {'2x': '2x/sem', '3x': '3x/sem', '5x': '5x/sem', 'libre': 'Pase Libre'}

DISC_ABREV = {
    'CF': 'CF', 'HF': 'HF', 'HX': 'Hyrox', 'TN': 'Teens', 'KD': 'Kids', 'BP': 'Bonus',
}


class FrecuenciaConConteoFilter(admin.SimpleListFilter):
    title = 'Frecuencia'
    parameter_name = 'frecuencia'

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        conteos = (
            qs.values('frecuencia')
            .annotate(total=Count('id'))
            .order_by('frecuencia')
        )
        order = ['2x', '3x', '5x', 'libre']
        rows = {item['frecuencia']: item['total'] for item in conteos}
        return [
            (k, f"{FREQ_LABELS.get(k, k)} ({rows[k]})")
            for k in order
            if k in rows
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(frecuencia=self.value())
        return queryset


class HorarioConConteoFilter(admin.SimpleListFilter):
    title = 'Horario'
    parameter_name = 'horario'

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        conteos = (
            qs.values('horario')
            .annotate(total=Count('id'))
            .order_by('horario')
        )
        return [
            (item['horario'], f"{item['horario']} ({item['total']})")
            for item in conteos
            if item['horario']
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(horario=self.value())
        return queryset


class SedeConConteoFilter(admin.SimpleListFilter):
    title = 'Sede'
    parameter_name = 'sede'

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        conteos = (
            qs.values('sede')
            .annotate(total=Count('id'))
            .order_by('sede')
        )
        labels = sede_labels()
        return [
            (item['sede'], f"{labels.get(item['sede'], item['sede'])} ({item['total']})")
            for item in conteos
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(sede=self.value())
        return queryset


class EstadoConConteoFilter(admin.SimpleListFilter):
    title = 'Estado'
    parameter_name = 'estado'

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        conteos = (
            qs.values('estado')
            .annotate(total=Count('id'))
            .order_by('estado')
        )
        labels = {
            'activo': 'Activo', 'mora': 'En mora',
            'baja': 'Baja', 'alejado': 'Alejado', 'temporal': 'Temporal',
        }
        return [
            (item['estado'], f"{labels.get(item['estado'], item['estado'])} ({item['total']})")
            for item in conteos
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(estado=self.value())
        return queryset


@admin.register(Alumno)
class AlumnoAdmin(admin.ModelAdmin):
    list_display = [
        'nombre_completo', 'sede', 'horario', 'plan_display',
        'estado', 'ultimo_pago_monto_display', 'ultimo_pago_display', 'fecha_inicio',
    ]
    list_filter = [SedeConConteoFilter, 'disciplina', FrecuenciaConConteoFilter, EstadoConConteoFilter, HorarioConConteoFilter]
    search_fields = ['nombre', 'apellido', 'celular', 'instagram']
    ordering = ['horario', 'apellido', 'nombre']
    list_per_page = 100

    @admin.display(description='Plan')
    def plan_display(self, obj):
        disc = DISC_ABREV.get(obj.disciplina, obj.disciplina)
        if obj.disciplina in ('TN', 'KD', 'HX'):
            return disc
        freq_map = {'2x': '2', '3x': '3', '5x': '5', 'libre': '5'}
        num = freq_map.get(obj.frecuencia, obj.frecuencia)
        return f'{disc}x{num}'

    @admin.display(description='Ultimo pago $')
    def ultimo_pago_monto_display(self, obj):
        pago = obj.pagos.order_by('-fecha_pago').first()
        if not pago:
            return '-'
        monto = int(pago.monto)
        return f'${monto:,}'.replace(',', '.')

    @admin.display(description='Fecha pago')
    def ultimo_pago_display(self, obj):
        pago = obj.pagos.order_by('-fecha_pago').first()
        if not pago:
            return '-'
        return pago.fecha_pago.strftime('%d/%m/%Y')

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('pagos')

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        params = request.GET.copy()
        filtros_activos = []

        for param, labels in FILTROS_LABELS.items():
            val = params.get(param)
            if not val:
                continue
            label_text = labels.get(val, val) if labels else val
            # URL sin este filtro = todos los params menos este
            params_sin = {k: v for k, v in params.items() if k != param}
            url_sin = '?' + urlencode(params_sin) if params_sin else '?'
            filtros_activos.append({'label': label_text, 'url_sin_este': url_sin})

        extra_context['filtros_activos'] = filtros_activos
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(Sede)
class SedeAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'codigo', 'orden', 'activa']
    list_editable = ['orden', 'activa']
