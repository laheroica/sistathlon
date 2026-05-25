from django.urls import path
from . import views

urlpatterns = [
    path('', views.lista_precios, name='precios-list'),
    path('guardar/', views.guardar_precio, name='precio-guardar'),
    path('copiar/', views.copiar_precios, name='precios-copiar'),
]
