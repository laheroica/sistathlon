from django.urls import path
from . import views

urlpatterns = [
    path('maestro/',          views.HorarioMaestroListCreateView.as_view(), name='horario-maestro-list'),
    path('maestro/<int:pk>/', views.HorarioMaestroDetailView.as_view(),     name='horario-maestro-detail'),
    path('real/',             views.HorarioRealListCreateView.as_view(),    name='horario-real-list'),
    path('real/<int:pk>/',    views.HorarioRealDetailView.as_view(),        name='horario-real-detail'),
    path('feriados/',         views.FeriadoListCreateView.as_view(),        name='feriado-list'),
    path('feriados/<int:pk>/',views.FeriadoDetailView.as_view(),            name='feriado-detail'),
]
