from django.urls import path
from . import views

urlpatterns = [
    path('',                        views.ProfeListCreateView.as_view(), name='profe-list'),
    path('<int:pk>/',               views.ProfeDetailView.as_view(),     name='profe-detail'),
    path('<int:profe_id>/tarifa/',  views.set_valor_hora,                name='profe-tarifa'),
]
