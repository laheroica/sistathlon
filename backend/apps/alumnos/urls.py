from django.urls import path
from . import views

urlpatterns = [
    path('', views.AlumnoListView.as_view(), name='alumno-list'),
    path('nuevo/', views.AlumnoCreateView.as_view(), name='alumno-create'),
    path('<int:pk>/', views.AlumnoDetailView.as_view(), name='alumno-detail'),
    path('calcular-cuota/', views.calcular_cuota, name='calcular-cuota'),
]
