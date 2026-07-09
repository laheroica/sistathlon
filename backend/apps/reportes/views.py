from datetime import date
from django.db.models import Sum, Count, ExpressionWrapper, DecimalField, F
from django.db.models.functions import TruncMonth
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    from apps.alumnos.models import Alumno
    from apps.pagos.models import Pago

    hoy        = date.today()
    mes_actual = date(hoy.year, hoy.month, 1)
    mes_ant    = date(hoy.year, hoy.month - 1, 1) if hoy.month > 1 else date(hoy.year - 1, 12, 1)

    rec_actual  = Pago.objects.filter(mes=mes_actual).aggregate(t=Sum('monto'))['t'] or 0
    rec_ant     = Pago.objects.filter(mes=mes_ant).aggregate(t=Sum('monto'))['t'] or 0
    pagos_hoy   = Pago.objects.filter(fecha_pago=hoy).count()

    # Alumnos distintos que pagaron la cuota del mes corriente
    pagaron_mes = Pago.objects.filter(mes=mes_actual).values('alumno').distinct().count()
    ticket_promedio = round(float(rec_actual) / pagaron_mes, 2) if pagaron_mes else 0

    estados = dict(
        Alumno.objects.filter(activo=True)
        .values_list('estado')
        .annotate(n=Count('id'))
    )

    meses_grafico = []
    for i in range(5, -1, -1):
        m = i
        anio = hoy.year
        mes_n = hoy.month - m
        while mes_n <= 0:
            mes_n += 12
            anio  -= 1
        d = date(anio, mes_n, 1)
        total = Pago.objects.filter(mes=d).aggregate(t=Sum('monto'))['t'] or 0
        meses_grafico.append({'mes': d.strftime('%b %Y'), 'total': float(total)})

    disc_mes = list(
        Pago.objects.filter(mes=mes_actual)
        .values('alumno__disciplina')
        .annotate(total=Sum('monto'), cant=Count('id'))
        .order_by('-total')
    )

    por_sede = dict(
        Alumno.objects.filter(activo=True)
        .values_list('sede')
        .annotate(n=Count('id'))
    )

    from django.db.models import Max
    alumnos_qs = Alumno.objects.filter(activo=True).annotate(
        ultimo_pago_fecha=Max('pagos__fecha_pago')
    )
    sin_pago_30  = alumnos_qs.filter(
        __import__('django').db.models.Q(ultimo_pago_fecha__isnull=True) |
        __import__('django').db.models.Q(ultimo_pago_fecha__lt=date(hoy.year, hoy.month, 1) - __import__('datetime').timedelta(days=30))
    ).count()

    pagos_por_dia = list(
        Pago.objects.filter(mes=mes_actual)
        .values('fecha_pago')
        .annotate(cant=Count('id'), total=Sum('monto'))
        .order_by('fecha_pago')
    )

    return Response({
        'recaudacion': {
            'mes_actual':  float(rec_actual),
            'mes_anterior': float(rec_ant),
            'variacion_pct': round((float(rec_actual) - float(rec_ant)) / float(rec_ant) * 100, 1) if rec_ant else 0,
            'pagos_hoy':   pagos_hoy,
            'pagaron_mes': pagaron_mes,
            'ticket_promedio': ticket_promedio,
        },
        'alumnos': {
            'total':    sum(estados.values()),
            'activo':   estados.get('activo', 0),
            'mora':     estados.get('mora', 0),
            'alejado':  estados.get('alejado', 0),
            'temporal': estados.get('temporal', 0),
            'baja':     estados.get('baja', 0),
        },
        'por_sede': {'107': por_sede.get('107', 0), '24':  por_sede.get('24', 0)},
        'grafico_meses':  meses_grafico,
        'disc_mes_actual': disc_mes,
        'pagos_por_dia':  [
            {'fecha': p['fecha_pago'].strftime('%d/%m'), 'cant': p['cant'], 'total': float(p['total'])}
            for p in pagos_por_dia
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def personalizado(request):
    from apps.alumnos.models import Alumno, DiscipConfig, ComboTipo, EstadoAlumno
    from apps.pagos.models import Pago

    disc_param = request.GET.get('disciplinas', '')
    codigos = [c for c in disc_param.split(',') if c]
    sede = request.GET.get('sede', '')
    mes_param = request.GET.get('mes')

    if mes_param:
        anio, mes_n = mes_param.split('-')
        mes = date(int(anio), int(mes_n), 1)
    else:
        hoy = date.today()
        mes = date(hoy.year, hoy.month, 1)

    if not codigos:
        return Response({'grupos': [], 'total_alumnos': 0, 'total_cobrado': 0, 'mes': mes.strftime('%Y-%m')})

    nombres = dict(DiscipConfig.objects.values_list('codigo', 'nombre'))
    codigos_set = set(codigos)

    base_qs = Alumno.objects.filter(estado=EstadoAlumno.ACTIVO)
    if sede:
        base_qs = base_qs.filter(sede=sede)

    pagadores_ids = set(
        Pago.objects.filter(mes=mes).values_list('alumno_id', flat=True)
    )

    grupos = []
    ids_totales = set()

    def serializar_alumnos(qs, pagos_por_alumno, campo_horario='horario'):
        alumnos = list(qs.order_by('sede', 'apellido', 'nombre'))
        return [
            {
                'id': a.id,
                'nombre': a.nombre_completo,
                'sede': a.sede,
                'horario': getattr(a, campo_horario, '') or '',
                'monto_pagado': float(pagos_por_alumno.get(a.id, 0)),
            }
            for a in alumnos
        ]

    # Grupos "puros": disciplina seleccionada sin combo, solo quienes pagaron el mes
    for cod in codigos:
        qs = base_qs.filter(disciplina=cod, combo='', id__in=pagadores_ids)
        ids = list(qs.values_list('id', flat=True))
        if ids:
            ids_totales.update(ids)
        pagos_por_alumno = dict(
            Pago.objects.filter(mes=mes, alumno_id__in=ids).values_list('alumno_id', 'monto')
        )
        grupos.append({
            'label': nombres.get(cod, cod),
            'tipo': 'puro',
            'cantidad': len(ids),
            'alumnos': serializar_alumnos(qs, pagos_por_alumno, 'horario'),
        })

    # Grupos "combo": se muestran si están tildadas todas las disciplinas del combo,
    # o si se tildó una sola disciplina que forma parte de ese combo
    combo_disciplinas = {
        ComboTipo.HYROX_CF: {'HX', 'CF'},
        ComboTipo.HYROX_HF: {'HX', 'HF'},
    }
    for combo_codigo, disc_req in combo_disciplinas.items():
        combo_aplica = disc_req.issubset(codigos_set) or (
            len(codigos_set) == 1 and codigos_set.issubset(disc_req)
        )
        if combo_aplica:
            qs = base_qs.filter(combo=combo_codigo, id__in=pagadores_ids)
            ids = list(qs.values_list('id', flat=True))
            if ids:
                ids_totales.update(ids)
            pagos_por_alumno = dict(
                Pago.objects.filter(mes=mes, alumno_id__in=ids).values_list('alumno_id', 'monto')
            )
            label = ' + '.join(nombres.get(c, c) for c in sorted(disc_req))
            grupos.append({
                'label': f'Combo {label}',
                'tipo': 'combo',
                'cantidad': len(ids),
                'alumnos': serializar_alumnos(qs, pagos_por_alumno, 'horario_combo'),
            })

    total_cobrado = Pago.objects.filter(
        mes=mes, alumno_id__in=ids_totales
    ).aggregate(t=Sum('monto'))['t'] or 0

    return Response({
        'grupos': grupos,
        'total_alumnos': len(ids_totales),
        'total_cobrado': float(total_cobrado),
        'mes': mes.strftime('%Y-%m'),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def anual(request):
    from apps.alumnos.models import Alumno
    from apps.pagos.models import Pago
    from apps.liquidaciones.models import Liquidacion
    from apps.caja.models import GastoFijo, GastoExtra

    hoy = date.today()
    n_meses = min(int(request.GET.get('meses', 12)), 24)

    # Build list of first-day-of-month dates (oldest first)
    meses = []
    for i in range(n_meses - 1, -1, -1):
        mes_n = hoy.month - i
        anio = hoy.year
        while mes_n <= 0:
            mes_n += 12
            anio -= 1
        meses.append(date(anio, mes_n, 1))

    # ── Pagos bulk: grouped by (mes, sede) ───────────────────────────────────
    pagos_by_key = {}
    for row in (
        Pago.objects.filter(mes__in=meses)
        .values('mes', 'alumno__sede')
        .annotate(total=Sum('monto'), cant=Count('id'))
    ):
        pagos_by_key[(row['mes'], row['alumno__sede'])] = {
            'total': float(row['total']),
            'cant': row['cant'],
        }

    # ── Métodos de pago (últimos 3 meses) ────────────────────────────────────
    mes_3 = meses[-3] if len(meses) >= 3 else meses[0]
    metodos_pago = list(
        Pago.objects.filter(mes__gte=mes_3)
        .values('metodo')
        .annotate(cant=Count('id'), total=Sum('monto'))
    )

    # ── Liquidaciones profes (prorrateado por sede según clases del detalle) ───
    # Sin clases en el detalle (ej. sueldo fijo del dueño) se reparte 50/50,
    # igual que en la vista de Gastos.
    liq_by_mes    = {}   # total
    liq107_by_mes = {}
    liq24_by_mes  = {}
    for liq in Liquidacion.objects.filter(mes__in=meses, confirmada=True):
        monto = float(liq.monto_final)
        clases = liq.detalle or []
        if clases:
            n107 = sum(1 for c in clases if c.get('sede') == '107')
            n24  = sum(1 for c in clases if c.get('sede') == '24')
            total = len(clases)
            m107 = monto * n107 / total
            m24  = monto * n24 / total
        else:
            m107 = m24 = monto / 2
        liq_by_mes[liq.mes]    = liq_by_mes.get(liq.mes, 0) + monto
        liq107_by_mes[liq.mes] = liq107_by_mes.get(liq.mes, 0) + m107
        liq24_by_mes[liq.mes]  = liq24_by_mes.get(liq.mes, 0) + m24

    # ── Gastos fijos (por sede; los compartidos ya vienen divididos ÷2) ────────
    gfijo_by_mes    = {}
    gfijo107_by_mes = {}
    gfijo24_by_mes  = {}
    for row in (
        GastoFijo.objects.filter(mes__in=meses)
        .values('mes', 'sede').annotate(total=Sum('importe'))
    ):
        t = float(row['total'])
        gfijo_by_mes[row['mes']] = gfijo_by_mes.get(row['mes'], 0) + t
        if row['sede'] == '107':
            gfijo107_by_mes[row['mes']] = gfijo107_by_mes.get(row['mes'], 0) + t
        elif row['sede'] == '24':
            gfijo24_by_mes[row['mes']] = gfijo24_by_mes.get(row['mes'], 0) + t

    # ── Gastos extras (precio_unitario * cantidad, por sede) ──────────────────
    gextra_by_mes    = {}
    gextra107_by_mes = {}
    gextra24_by_mes  = {}
    for row in (
        GastoExtra.objects.filter(mes__in=meses)
        .annotate(subtotal=ExpressionWrapper(
            F('precio_unitario') * F('cantidad'),
            output_field=DecimalField(max_digits=14, decimal_places=2)
        ))
        .values('mes', 'sede')
        .annotate(total=Sum('subtotal'))
    ):
        t = float(row['total'])
        gextra_by_mes[row['mes']] = gextra_by_mes.get(row['mes'], 0) + t
        if row['sede'] == '107':
            gextra107_by_mes[row['mes']] = gextra107_by_mes.get(row['mes'], 0) + t
        elif row['sede'] == '24':
            gextra24_by_mes[row['mes']] = gextra24_by_mes.get(row['mes'], 0) + t

    # ── Nuevos alumnos por mes ────────────────────────────────────────────────
    nuevos_by_mes = {}
    for row in (
        Alumno.objects.filter(fecha_inicio__gte=meses[0])
        .annotate(mes_inicio=TruncMonth('fecha_inicio'))
        .values('mes_inicio')
        .annotate(cant=Count('id'))
    ):
        k = row['mes_inicio']
        if hasattr(k, 'date'):
            k = k.date()
        nuevos_by_mes[k] = row['cant']

    # ── Build series ──────────────────────────────────────────────────────────
    series = []
    for mes in meses:
        r107 = pagos_by_key.get((mes, '107'), {'total': 0, 'cant': 0})
        r24  = pagos_by_key.get((mes, '24'),  {'total': 0, 'cant': 0})
        rec  = r107['total'] + r24['total']
        pag  = r107['cant']  + r24['cant']

        gp = liq_by_mes.get(mes, 0)
        gf = gfijo_by_mes.get(mes, 0)
        ge = gextra_by_mes.get(mes, 0)
        gt = gp + gf + ge

        # Gastos por sede
        gp107 = liq107_by_mes.get(mes, 0);  gp24 = liq24_by_mes.get(mes, 0)
        gf107 = gfijo107_by_mes.get(mes, 0); gf24 = gfijo24_by_mes.get(mes, 0)
        ge107 = gextra107_by_mes.get(mes, 0); ge24 = gextra24_by_mes.get(mes, 0)
        gt107 = gp107 + gf107 + ge107
        gt24  = gp24  + gf24  + ge24

        series.append({
            'mes':        mes.strftime('%b %y'),
            'mes_key':    mes.strftime('%Y-%m'),
            'recaudado':  round(rec),
            'rec_107':    round(r107['total']),
            'rec_24':     round(r24['total']),
            'pagadores':  pag,
            'pag_107':    r107['cant'],
            'pag_24':     r24['cant'],
            'ticket':     round(rec / pag) if pag else 0,
            'ticket_107': round(r107['total'] / r107['cant']) if r107['cant'] else 0,
            'ticket_24':  round(r24['total'] / r24['cant']) if r24['cant'] else 0,
            'g_profes':   round(gp),
            'g_fijos':    round(gf),
            'g_extras':   round(ge),
            'gastos':     round(gt),
            'balance':    round(rec - gt),
            # Gastos y balance por sede
            'gastos_107':  round(gt107),
            'gastos_24':   round(gt24),
            'g_profes_107': round(gp107), 'g_profes_24': round(gp24),
            'g_fijos_107':  round(gf107), 'g_fijos_24':  round(gf24),
            'g_extras_107': round(ge107), 'g_extras_24': round(ge24),
            'balance_107': round(r107['total'] - gt107),
            'balance_24':  round(r24['total'] - gt24),
            'nuevos':     nuevos_by_mes.get(mes, 0),
        })

    # Variación neta y estimación de abandonos
    for i, s in enumerate(series):
        variacion = s['pagadores'] - series[i - 1]['pagadores'] if i > 0 else 0
        s['variacion_neta'] = variacion
        # abandonaron = ingresaron - variacion_neta  (si entran 10 y sube 3, se fueron 7)
        abandonaron = max(0, s['nuevos'] - variacion)
        s['abandonaron']     = abandonaron
        s['abandonaron_neg'] = -abandonaron  # valor negativo para gráfico hacia abajo

    # ── Snapshot actual ───────────────────────────────────────────────────────
    # Usamos el último mes con pagos registrados como referencia
    from apps.pagos.models import Pago as PagoModel
    ultimo_mes_con_pagos = (
        PagoModel.objects.order_by('-mes').values_list('mes', flat=True).first()
    )
    mes_snapshot = ultimo_mes_con_pagos or mes_actual

    # IDs de alumnos que pagaron ese mes
    pagadores_ids = PagoModel.objects.filter(mes=mes_snapshot).values_list('alumno_id', flat=True)

    total_activos = len(set(pagadores_ids))

    por_disciplina = list(
        Alumno.objects.filter(id__in=pagadores_ids)
        .values('disciplina').annotate(cant=Count('id')).order_by('-cant')
    )
    # Histórico: todos los alumnos que alguna vez pasaron por el gym
    por_disciplina_historico = list(
        Alumno.objects.values('disciplina').annotate(cant=Count('id')).order_by('-cant')
    )
    por_sede = list(
        Alumno.objects.filter(id__in=pagadores_ids)
        .values('sede').annotate(cant=Count('id'))
    )

    # Variaciones del último mes vs anterior
    ultimo   = series[-1]  if len(series) >= 1 else {}
    anterior = series[-2]  if len(series) >= 2 else {}
    rec_ult  = ultimo.get('recaudado', 0)
    rec_ant2 = anterior.get('recaudado', 0)
    pag_ult  = ultimo.get('pagadores', 0)
    pag_ant2 = anterior.get('pagadores', 0)

    var_facturacion = round((rec_ult - rec_ant2) / rec_ant2 * 100, 1) if rec_ant2 else 0
    var_alumnos     = round((pag_ult - pag_ant2) / pag_ant2 * 100, 1) if pag_ant2 else 0

    return Response({
        'series': series,
        'snapshot': {
            'por_disciplina':           por_disciplina,
            'por_disciplina_historico': por_disciplina_historico,
            'por_sede':                 por_sede,
            'metodos_pago': [
                {'metodo': m['metodo'], 'cant': m['cant'], 'total': float(m['total'])}
                for m in metodos_pago
            ],
            'total_activos':        total_activos,
            'mes_snapshot':         mes_snapshot.strftime('%B %Y'),
            'ticket_ultimo_mes':    ultimo.get('ticket', 0),
            'var_facturacion_pct':  var_facturacion,
            'var_alumnos_pct':      var_alumnos,
        },
    })
