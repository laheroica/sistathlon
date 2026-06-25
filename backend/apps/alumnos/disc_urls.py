from django.urls import path
from .views import DiscipConfigListCreateView, DiscipConfigDetailView

urlpatterns = [
    path('',        DiscipConfigListCreateView.as_view(), name='discip-list'),
    path('<int:pk>/', DiscipConfigDetailView.as_view(),   name='discip-detail'),
]
