from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status


def get_rol(user):
    if user.groups.filter(name='sadmin').exists():
        return 'sadmin'
    if user.groups.filter(name='admin').exists():
        return 'admin'
    return 'staff'


def user_data(user):
    return {
        'id':       user.id,
        'username': user.username,
        'nombre':   user.get_full_name() or user.username,
        'email':    user.email,
        'rol':      get_rol(user),
    }


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response({'error': 'Usuario y contraseña requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'error': 'Credenciales incorrectas.'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({'error': 'Cuenta desactivada.'}, status=status.HTTP_403_FORBIDDEN)

    login(request, user)
    return Response(user_data(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'ok': True})


@api_view(['GET'])
@ensure_csrf_cookie
@permission_classes([AllowAny])
def me_view(request):
    if not request.user.is_authenticated:
        return Response({'autenticado': False})
    return Response({'autenticado': True, **user_data(request.user)})
