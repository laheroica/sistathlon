from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('anual/', views.anual, name='anual'),
    path('mes-detalle/', views.mes_detalle, name='mes-detalle'),
    path('personalizado/', views.personalizado, name='personalizado'),
]
