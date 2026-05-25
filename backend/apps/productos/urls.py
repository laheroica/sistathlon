from django.urls import path
from . import views

urlpatterns = [
    path('', views.ProductoListCreateView.as_view()),
    path('<int:pk>/', views.ProductoDetailView.as_view()),
    path('ventas/', views.VentaListCreateView.as_view()),
    path('ventas/<int:pk>/', views.VentaDetailView.as_view()),
    path('cuenta-corriente/deudores/', views.deudores),
    path('cuenta-corriente/movimientos/<int:pk>/', views.MovimientoCCDetailView.as_view()),
    path('cuenta-corriente/<int:alumno_id>/', views.cuenta_corriente_alumno),
    path('cuenta-corriente/<int:alumno_id>/pagar/', views.pagar_cuenta_corriente),
]
