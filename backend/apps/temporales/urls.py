from django.urls import path
from . import views

urlpatterns = [
    path('',      views.TemporalListCreateView.as_view(), name='temporal-list'),
    path('<int:pk>/', views.TemporalDetailView.as_view(),  name='temporal-detail'),
]
