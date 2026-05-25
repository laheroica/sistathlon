from django.contrib import admin
from .models import Pago


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ['alumno', 'mes', 'monto', 'fecha_pago', 'metodo']
    list_filter = ['mes', 'metodo', 'alumno__sede']
    search_fields = ['alumno__nombre', 'alumno__apellido']
    ordering = ['-fecha_pago']
    date_hierarchy = 'fecha_pago'