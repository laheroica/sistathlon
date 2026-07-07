from rest_framework.permissions import BasePermission

from .auth_views import get_rol


class IsSadmin(BasePermission):
    """Solo usuarios con rol 'sadmin' (grupo Django 'sadmin')."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and get_rol(request.user) == 'sadmin')
