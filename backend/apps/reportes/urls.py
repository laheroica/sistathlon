from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('anual/', views.anual, name='anual'),
    path('personalizado/', views.personalizado, name='personalizado'),
]
