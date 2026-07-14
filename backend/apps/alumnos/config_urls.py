from django.urls import path
from .views import NegocioConfigView, SedeListCreateView, SedeDetailView

urlpatterns = [
    path('negocio/', NegocioConfigView.as_view(), name='negocio-config'),
    path('sedes/', SedeListCreateView.as_view(), name='sede-list'),
    path('sedes/<int:pk>/', SedeDetailView.as_view(), name='sede-detail'),
]
