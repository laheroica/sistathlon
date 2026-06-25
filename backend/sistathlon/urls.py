from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import JsonResponse
from pathlib import Path


def health(request):
    return JsonResponse({'status': 'ok'})


class SPAView(TemplateView):
    """Sirve index.html del build de React para todas las rutas del SPA."""
    def get_template_names(self):
        return []

    def get(self, request, *args, **kwargs):
        from django.http import FileResponse, Http404
        index = Path(settings.WHITENOISE_ROOT) / 'index.html'
        if index.exists():
            return FileResponse(open(index, 'rb'), content_type='text/html')
        raise Http404


urlpatterns = [
    path('health/', health),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.alumnos.auth_urls')),
    path('api/alumnos/', include('apps.alumnos.urls')),
    path('api/disciplinas/', include('apps.alumnos.disc_urls')),
    path('api/profes/', include('apps.profes.urls')),
    path('api/horarios/', include('apps.horarios.urls')),
    path('api/pagos/', include('apps.pagos.urls')),
    path('api/mensajes/', include('apps.mensajes.urls')),
    path('api/caja/', include('apps.caja.urls')),
    path('api/liquidaciones/', include('apps.liquidaciones.urls')),
    path('api/precios/', include('apps.precios.urls')),
    path('api/temporales/', include('apps.temporales.urls')),
    path('api/reportes/', include('apps.reportes.urls')),
    path('api/productos/', include('apps.productos.urls')),
    # SPA catch-all: cualquier otra ruta devuelve index.html de React
    re_path(r'^(?!api/|admin/|static/|media/).*$', SPAView.as_view()),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
