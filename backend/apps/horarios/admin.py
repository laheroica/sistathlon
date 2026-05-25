from django.contrib import admin
from .models import HorarioMaestro, HorarioReal, Feriado


@admin.register(HorarioMaestro)
class HorarioMaestroAdmin(admin.ModelAdmin):
    list_display = ['sede', 'dia', 'hora', 'disciplina', 'profe', 'activo']
    list_filter = ['sede', 'dia', 'disciplina', 'activo']
    ordering = ['sede', 'dia', 'hora']


@admin.register(HorarioReal)
class HorarioRealAdmin(admin.ModelAdmin):
    list_display = ['sede', 'fecha', 'hora', 'disciplina', 'profe_planificado', 'profe_real']
    list_filter = ['sede', 'semana_inicio']
    ordering = ['-fecha', 'hora']


@admin.register(Feriado)
class FeriadoAdmin(admin.ModelAdmin):
    list_display = ['fecha', 'nombre', 'abrimos']
    ordering = ['fecha']
