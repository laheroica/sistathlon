from django.urls import path
from .views import PagoListCreateView, PagoDetailView, resumen_cobros, liquidacion_day

urlpatterns = [
    path('', PagoListCreateView.as_view(), name='pago-list-create'),
    path('<int:pk>/', PagoDetailView.as_view(), name='pago-detail'),
    path('resumen/', resumen_cobros, name='cobros-resumen'),
    path('liquidacion-day/', liquidacion_day, name='liquidacion-day'),
]
