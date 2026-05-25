from datetime import date, timedelta
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.alumnos.models import Alumno
from apps.pagos.models import Pago
from .models import Mensaje, TemplateMensaje, TipoMensaje, CanalMensaje

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MESES_ES = [
    '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

FALLBACK_TEMPLATES = {
    'vence_pronto':     'Hola {nombre}! 👋 Te avisamos que tu cuota de {mes} en Athlon vence en {dias} días. Podés acercar el pago cuando quieras. ¡Nos vemos! 💪',
    'cuota_vencida':    'Hola {nombre}! Te escribimos desde Athlon porque tu cuota de {mes} está pendiente. Si ya pagaste mandanos el comprobante. Gracias! 🙌',
    'activo_impago':    'Hola {nombre}! 💪 Tu cuota de {mes} en Athlon sigue pendiente. Si tenés algún inconveniente, hablemos. ¡Te esperamos!',
    'reactivacion_1_3m':'Hola {nombre}! 🏋️ Hace un tiempo que no te vemos por Athlon. Cuando quieras retomar, ¡acá estamos! 💪',
    'reactivacion_3_6m':'Hola {nombre}! ¿Cómo estás? Ya hace un par de meses que no venís a entrenar. Si querés volver, con gusto te ayudamos a encontrar el plan ideal 🏋️',
    'reactivacion_6m':  'Hola {nombre}! Te escribimos desde Athlon. Hace bastante tiempo que no te vemos y queremos saber cómo estás. Si en algún momento querés retomar, acá te esperamos! 💪',
    'bienvenida':       'Hola {nombre}! 🎉 Bienvenido/a a Athlon! Estamos muy contentos de tenerte con nosotros. Cualquier duda sobre horarios o clases, escribinos. ¡A entrenar! 💪',
    'cumpleanios':      'Hola {nombre}! 🎂 Desde Athlon te deseamos un muy feliz cumpleaños. ¡Que lo pases genial! 🎉',
}


def mes_label(d):
    return f"{MESES_ES[d.month].capitalize()} {d.year}"


def render_template(texto, alumno, mes='', dias=0):
    nombre = alumno.nombre.split()[0] if alumno.nombre else alumno.nombre
    disc_map = {'CF': 'CrossFit', 'HF': 'Heavy Funcional', 'HX': 'Hyrox',
                'TN': 'Teens', 'KD': 'Kids', 'BP': 'Bonus Pack', 'FB': 'FullBody'}
    disc = disc_map.get(alumno.disciplina, alumno.disciplina)
    return (texto
            .replace('{nombre}', nombre)
            .replace('{mes}', mes)
            .replace('{dias}', str(dias))
            .replace('{sede}', f'Athlon {alumno.sede}')
            .replace('{disciplina}', disc))


def get_templates_db():
    return {t.tipo: t.texto for t in TemplateMensaje.objects.filter(activo=True, variante=1)}


# ---------------------------------------------------------------------------
# Deudores
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deudores(request):
    hoy = date.today()
    mes_actual = date(hoy.year, hoy.month, 1)
    dia = hoy.day
    mes_str = mes_label(hoy)

    sede = request.query_params.get('sede', '')

    qs = Alumno.objects.filter(activo=True, estado__in=['activo', 'mora', 'temporal'])
    if sede:
        qs = qs.filter(sede=sede)

    pagaron_ids = set(Pago.objects.filter(mes=mes_actual).values_list('alumno_id', flat=True))
    # Excluir alumnos que recién empezaron (≤10 días) y nunca pagaron — son nuevos, no deudores
    sin_pagar = [
        a for a in qs.order_by('apellido', 'nombre')
        if a.id not in pagaron_ids
        and not (not Pago.objects.filter(alumno=a).exists() and (hoy - a.fecha_inicio).days <= 10)
    ]

    tpls = get_templates_db()

    def get_tipo_y_dias(a):
        ultimo = Pago.objects.filter(alumno=a).order_by('-fecha_pago').first()
        dias_sin = (hoy - ultimo.fecha_pago).days if ultimo else (hoy - a.fecha_inicio).days
        if dia <= 5:
            return 'vence_pronto', dias_sin
        elif dias_sin <= 35:
            return 'cuota_vencida', dias_sin
        else:
            return 'activo_impago', dias_sin

    resultado = []
    for a in sin_pagar:
        tipo, dias_sin = get_tipo_y_dias(a)
        texto_raw = tpls.get(tipo) or FALLBACK_TEMPLATES.get(tipo, '')
        dias_para_vencer = max(0, 6 - dia)
        texto = render_template(texto_raw, a, mes=mes_str, dias=dias_para_vencer)
        ya = Mensaje.objects.filter(
            alumno=a, tipo=tipo,
            fecha_hora__year=hoy.year,
            fecha_hora__month=hoy.month
        ).exists()
        resultado.append({
            'id':             a.id,
            'nombre':         a.nombre,
            'apellido':       a.apellido,
            'celular':        a.celular,
            'sede':           a.sede,
            'disciplina':     a.disciplina,
            'estado':         a.estado,
            'tipo':           tipo,
            'mensaje':        texto,
            'dias_sin_pagar': dias_sin,
            'cuota_actual':   float(a.cuota_actual),
            'ya_enviado':     ya,
        })

    grupos = {
        'vence_pronto':  [r for r in resultado if r['tipo'] == 'vence_pronto'],
        'cuota_vencida': [r for r in resultado if r['tipo'] == 'cuota_vencida'],
        'activo_impago': [r for r in resultado if r['tipo'] == 'activo_impago'],
    }

    return Response({'total': len(resultado), 'mes': mes_str, 'dia': dia, 'grupos': grupos})


# ---------------------------------------------------------------------------
# Bienvenidas
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bienvenidas(request):
    sede = request.query_params.get('sede', '')
    desde = date.today() - timedelta(days=30)

    qs = Alumno.objects.filter(activo=True, fecha_inicio__gte=desde).order_by('-fecha_inicio')
    if sede:
        qs = qs.filter(sede=sede)

    ya_ids = set(Mensaje.objects.filter(tipo=TipoMensaje.BIENVENIDA).values_list('alumno_id', flat=True))

    tpls = get_templates_db()
    texto_raw = tpls.get('bienvenida') or FALLBACK_TEMPLATES['bienvenida']

    resultado = [
        {
            'id':           a.id,
            'nombre':       a.nombre,
            'apellido':     a.apellido,
            'celular':      a.celular,
            'sede':         a.sede,
            'disciplina':   a.disciplina,
            'fecha_inicio': a.fecha_inicio.isoformat(),
            'ya_enviado':   a.id in ya_ids,
            'mensaje':      render_template(texto_raw, a),
        }
        for a in qs
    ]
    return Response({'total': len(resultado), 'alumnos': resultado})


# ---------------------------------------------------------------------------
# Masivos
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def masivos_candidatos(request):
    sede       = request.query_params.get('sede', '')
    disciplina = request.query_params.get('disciplina', '')
    texto      = request.query_params.get('texto', '')

    qs = Alumno.objects.filter(activo=True, estado__in=['activo', 'mora', 'temporal'])
    if sede:
        qs = qs.filter(sede=sede)
    if disciplina:
        qs = qs.filter(disciplina=disciplina)

    disc_map = {'CF': 'CrossFit', 'HF': 'Heavy Funcional', 'HX': 'Hyrox',
                'TN': 'Teens', 'KD': 'Kids', 'BP': 'Bonus Pack', 'FB': 'FullBody'}

    resultado = []
    for a in qs.order_by('apellido', 'nombre'):
        nombre = a.nombre.split()[0]
        msg = (texto
               .replace('{nombre}', nombre)
               .replace('{sede}', f'Athlon {a.sede}')
               .replace('{disciplina}', disc_map.get(a.disciplina, a.disciplina)))
        resultado.append({
            'id':         a.id,
            'nombre':     a.nombre,
            'apellido':   a.apellido,
            'celular':    a.celular,
            'sede':       a.sede,
            'disciplina': a.disciplina,
            'mensaje':    msg,
        })

    return Response({'total': len(resultado), 'alumnos': resultado})


# ---------------------------------------------------------------------------
# Registrar (individual y bulk)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def registrar(request):
    alumno_id = request.data.get('alumno_id')
    tipo      = request.data.get('tipo')
    canal     = request.data.get('canal', 'whatsapp')
    texto     = request.data.get('texto', '')

    if not alumno_id or not tipo:
        return Response({'error': 'alumno_id y tipo son requeridos'}, status=400)

    try:
        alumno = Alumno.objects.get(id=alumno_id)
    except Alumno.DoesNotExist:
        return Response({'error': 'Alumno no encontrado'}, status=404)

    msg = Mensaje.objects.create(
        alumno=alumno, tipo=tipo, canal=canal,
        texto=texto, enviado_por=request.user,
    )
    return Response({'id': msg.id, 'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def desmarcar(request):
    """
    Elimina registros de mensajes enviados del mes actual.
    - Individual: { alumno_id, tipo }
    - Bulk:       { items: [{alumno_id, tipo}, ...] }
    """
    hoy = date.today()
    items = request.data.get('items')

    if items:
        # Bulk: desmarcar lista
        total = 0
        for item in items:
            d, _ = Mensaje.objects.filter(
                alumno_id=item['alumno_id'], tipo=item['tipo'],
                fecha_hora__year=hoy.year, fecha_hora__month=hoy.month,
            ).delete()
            total += d
        return Response({'ok': True, 'eliminados': total})

    # Individual
    alumno_id = request.data.get('alumno_id')
    tipo      = request.data.get('tipo')
    if not alumno_id or not tipo:
        return Response({'error': 'alumno_id y tipo requeridos'}, status=400)
    deleted, _ = Mensaje.objects.filter(
        alumno_id=alumno_id, tipo=tipo,
        fecha_hora__year=hoy.year, fecha_hora__month=hoy.month,
    ).delete()
    return Response({'ok': True, 'eliminados': deleted})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def registrar_bulk(request):
    items = request.data.get('mensajes', [])
    creados = 0
    for item in items:
        try:
            alumno = Alumno.objects.get(id=item['alumno_id'])
            Mensaje.objects.create(
                alumno=alumno,
                tipo=item.get('tipo', 'activo_impago'),
                canal=item.get('canal', 'whatsapp'),
                texto=item.get('texto', ''),
                enviado_por=request.user,
            )
            creados += 1
        except Exception:
            continue
    return Response({'creados': creados})


# ---------------------------------------------------------------------------
# Historial
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historial(request):
    page      = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 50))
    tipo      = request.query_params.get('tipo', '')
    sede      = request.query_params.get('sede', '')
    buscar    = request.query_params.get('buscar', '')

    qs = Mensaje.objects.select_related('alumno', 'enviado_por').order_by('-fecha_hora')

    if tipo:
        qs = qs.filter(tipo=tipo)
    if sede:
        qs = qs.filter(alumno__sede=sede)
    if buscar:
        qs = qs.filter(
            Q(alumno__nombre__icontains=buscar) | Q(alumno__apellido__icontains=buscar)
        )

    total  = qs.count()
    offset = (page - 1) * page_size
    items  = qs[offset: offset + page_size]

    return Response({
        'total':     total,
        'page':      page,
        'page_size': page_size,
        'mensajes': [{
            'id':             m.id,
            'alumno_id':      m.alumno_id,
            'alumno_nombre':  f"{m.alumno.nombre} {m.alumno.apellido}",
            'alumno_celular': m.alumno.celular,
            'sede':           m.alumno.sede,
            'tipo':           m.tipo,
            'tipo_display':   m.get_tipo_display(),
            'canal':          m.canal,
            'texto':          m.texto,
            'fecha_hora':     m.fecha_hora.strftime('%d/%m/%Y %H:%M'),
            'enviado_por':    (m.enviado_por.get_full_name() or m.enviado_por.username)
                              if m.enviado_por else '',
        } for m in items],
    })


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def templates_view(request):
    if request.method == 'GET':
        db = {t.tipo: {'id': t.id, 'texto': t.texto}
              for t in TemplateMensaje.objects.filter(activo=True, variante=1)}
        tipo_labels = dict(TipoMensaje.choices)
        resultado = []
        for tipo, label in tipo_labels.items():
            entry = db.get(tipo, {})
            resultado.append({
                'id':           entry.get('id'),
                'tipo':         tipo,
                'tipo_display': label,
                'texto':        entry.get('texto') or FALLBACK_TEMPLATES.get(tipo, ''),
                'en_db':        tipo in db,
            })
        return Response(resultado)

    tipo  = request.data.get('tipo')
    texto = request.data.get('texto')
    if not tipo or not texto:
        return Response({'error': 'tipo y texto requeridos'}, status=400)

    t, _ = TemplateMensaje.objects.get_or_create(tipo=tipo, variante=1)
    t.texto  = texto
    t.activo = True
    t.save()
    return Response({'ok': True, 'id': t.id})
