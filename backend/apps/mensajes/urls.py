from django.urls import path
from . import views

urlpatterns = [
    path('deudores/',           views.deudores),
    path('bienvenidas/',        views.bienvenidas),
    path('masivos/candidatos/', views.masivos_candidatos),
    path('registrar/',          views.registrar),
    path('desmarcar/',          views.desmarcar),
    path('registrar-bulk/',     views.registrar_bulk),
    path('historial/',          views.historial),
    path('templates/',          views.templates_view),
]
