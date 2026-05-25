from django.contrib import admin
from .models import Profe, ValorHoraProfe


class ValorHoraInline(admin.TabularInline):
    model = ValorHoraProfe
    extra = 1
    ordering = ['-mes']


@admin.register(Profe)
class ProfeAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'sede', 'tipo_liquidacion', 'activo', 'color']
    list_filter = ['sede', 'activo', 'tipo_liquidacion']
    inlines = [ValorHoraInline]


@admin.register(ValorHoraProfe)
class ValorHoraProfeAdmin(admin.ModelAdmin):
    list_display = ['profe', 'mes', 'valor_hora', 'sueldo_fijo', 'porcentaje']
    list_filter = ['mes', 'profe']
    ordering = ['-mes', 'profe__nombre']
