from django.urls import path
from .views import NegocioConfigView

urlpatterns = [
    path('negocio/', NegocioConfigView.as_view(), name='negocio-config'),
]
