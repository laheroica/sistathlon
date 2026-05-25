from django.urls import path
from . import views

urlpatterns = [
    path('arqueos/',              views.ArqueoListCreateView.as_view(), name='arqueo-list'),
    path('arqueos/<int:pk>/',     views.ArqueoDetailView.as_view(),     name='arqueo-detail'),
    path('resumen/',              views.resumen_mes,                    name='caja-resumen'),
    # Gastos fijos
    path('gastos/fijos/',         views.gastos_fijos_list,              name='gastos-fijos-list'),
    path('gastos/fijos/crear/',   views.crear_gasto_fijo,               name='gastos-fijos-crear'),
    path('gastos/fijos/<int:pk>/',views.GastoFijoDetailView.as_view(),  name='gastos-fijos-detail'),
    # Gastos extras
    path('gastos/extras/',        views.GastoExtraListCreateView.as_view(), name='gastos-extras-list'),
    path('gastos/extras/<int:pk>/',views.GastoExtraDetailView.as_view(),    name='gastos-extras-detail'),
]
