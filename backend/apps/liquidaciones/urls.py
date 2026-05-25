from django.urls import path
from . import views

urlpatterns = [
    path('preview/',                  views.preview_liquidacion),
    path('guardar/',                  views.guardar_liquidacion),
    path('cerrar-mes/',               views.cerrar_mes),
    path('meses-cerrados/',           views.meses_cerrados),
    path('cierre/<str:mes_str>/',     views.detalle_cierre),
    path('',                          views.LiquidacionListView.as_view()),
    path('<int:pk>/',                 views.LiquidacionDetailView.as_view()),
    path('<int:pk>/pagar/',           views.marcar_pagada),
]
