import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, AlertCircle,
  CheckCircle, UserX, DollarSign, ArrowRight, Receipt
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import { useDisciplinas } from '../hooks/useDisciplinas'

// Fallbacks mientras carga la API
const DISC_LABEL_FB = { CF: 'CrossFit', HF: 'Heavy Func.', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus', FB: 'FullBody' }
const DISC_COLOR_FB = { CF: '#3b82f6', HF: '#22c55e', HX: '#eab308', TN: '#a855f7', KD: '#ec4899', BP: '#0ea5e9', FB: '#f97316' }

// ── Tooltip personalizado para el gráfico ─────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="text-dark-muted mb-1">{label}</p>
      <p className="text-green-400 font-bold text-base">{money(payload[0].value)}</p>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = 'text-dark-text', iconBg = 'bg-dark-border', to }) {
  const content = (
    <div className={clsx(
      'card flex items-center gap-4 transition-all',
      to && 'hover:border-primary-dark/40 cursor-pointer'
    )}>
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon size={20} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-dark-muted uppercase tracking-wider font-medium">{label}</p>
        <p className={clsx('text-2xl font-bold leading-tight mt-0.5', color)}>{value}</p>
        {sub && <p className="text-xs text-dark-muted mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight size={14} className="text-dark-border flex-shrink-0" />}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

// ── Barra de progreso simple ──────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reportes/dashboard/').then(r => r.data),
    staleTime: 60_000,
  })

  // Disciplinas dinámicas
  const { labelMap: apiLabelMap, colorMap: apiColorMap } = useDisciplinas()
  const DISC_LABEL = { ...DISC_LABEL_FB, ...apiLabelMap }
  const DISC_COLOR = { ...DISC_COLOR_FB, ...apiColorMap }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-dark-surface rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-dark-surface rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-dark-surface rounded-2xl animate-pulse" />
          <div className="h-64 bg-dark-surface rounded-2xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-56 bg-dark-surface rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-center py-20">
        <p className="text-dark-muted text-sm">No se pudieron cargar los datos. Recargá la página.</p>
      </div>
    )
  }

  const { recaudacion, alumnos, por_sede, grafico_meses, disc_mes_actual, pagos_por_dia } = data

  const mesActualLabel  = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
  const mesAnteriorLabel = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toLocaleString('es-AR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  })()

  // Alumnos que pagaron la cuota del mes corriente (dato del backend)
  const pagaronMes = recaudacion.pagaron_mes ?? 0
  const pctPagaron = alumnos.total > 0 ? ((pagaronMes / alumnos.total) * 100).toFixed(1) : 0
  const subioBajo  = recaudacion.variacion_pct >= 0

  // Traducir meses del gráfico a español
  const mesesES = { Dec: 'Dic', Jan: 'Ene', Feb: 'Feb', Mar: 'Mar', Apr: 'Abr', May: 'May',
                    Jun: 'Jun', Jul: 'Jul', Aug: 'Ago', Sep: 'Sep', Oct: 'Oct', Nov: 'Nov' }
  const graficoData = grafico_meses.map(m => ({
    ...m,
    mesCorto: mesesES[m.mes.split(' ')[0]] || m.mes.split(' ')[0],
  }))
  const maxRecaudacion = Math.max(...graficoData.map(m => m.total))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="order-1">
        <h1 className="text-2xl font-bold text-dark-text">Dashboard</h1>
        <p className="text-sm text-dark-muted mt-0.5">{mesActualLabel}</p>
      </div>

      {/* ── Fila 1: KPIs principales ─────────────────────────────────────── */}
      <div className="order-2 grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Recaudado este mes"
          value={money(recaudacion.mes_actual)}
          sub={
            <span className={clsx('flex items-center gap-1', subioBajo ? 'text-green-400' : 'text-red-400')}>
              {subioBajo ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {subioBajo ? '+' : ''}{recaudacion.variacion_pct}% vs {mesAnteriorLabel}
            </span>
          }
          color="text-green-400"
          iconBg="bg-green-900/40"
        />
        <KpiCard
          icon={CheckCircle}
          label="Pagaron este mes"
          value={pagaronMes}
          sub={`${pctPagaron}% del padrón`}
          color="text-green-400"
          iconBg="bg-green-900/40"
          to="/alumnos"
        />
        <KpiCard
          icon={Receipt}
          label="Ticket promedio"
          value={money(recaudacion.ticket_promedio ?? 0)}
          sub={`sobre ${pagaronMes} cuotas`}
          color="text-blue-400"
          iconBg="bg-blue-900/40"
        />
        <KpiCard
          icon={AlertCircle}
          label="En mora / impago"
          value={alumnos.mora}
          sub={`${money(recaudacion.mes_anterior)} recaudado en ${mesAnteriorLabel}`}
          color="text-yellow-400"
          iconBg="bg-yellow-900/40"
          to="/alumnos"
        />
        <KpiCard
          icon={UserX}
          label="Alejados"
          value={alumnos.alejado}
          sub={`${alumnos.total} alumnos en total`}
          color="text-red-400"
          iconBg="bg-red-900/40"
          to="/alumnos"
        />
      </div>

      {/* ── Fila 2: Gráfico + Estado ─────────────────────────────────────── */}
      <div className="order-4 lg:order-3 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Gráfico de barras — últimos 6 meses */}
        <div className="card lg:col-span-2">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">
            Recaudación últimos 6 meses
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graficoData} barCategoryGap="30%">
              <XAxis
                dataKey="mesCorto"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {graficoData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={i === graficoData.length - 1 ? '#3b82f6' : '#1e40af'}
                    opacity={i === graficoData.length - 1 ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Estado de alumnos */}
        <div className="card space-y-4">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            Estado del padrón
          </p>
          {[
            { label: 'Al día',    val: alumnos.activo,   color: 'bg-green-400',  text: 'text-green-400' },
            { label: 'En mora',   val: alumnos.mora,     color: 'bg-yellow-400', text: 'text-yellow-400' },
            { label: 'Alejados',  val: alumnos.alejado,  color: 'bg-red-400',    text: 'text-red-400' },
            { label: 'Temporal',  val: alumnos.temporal, color: 'bg-sky-400',    text: 'text-sky-400' },
          ].map(({ label, val, color, text }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-dark-muted">{label}</span>
                <span className={clsx('font-semibold', text)}>{val}</span>
              </div>
              <ProgressBar value={val} max={alumnos.total} color={color} />
            </div>
          ))}

          <div className="border-t border-dark-border pt-3 mt-2 grid grid-cols-2 gap-3">
            {[
              { label: 'Athlon 107', val: por_sede['107'] },
              { label: 'Athlon 24',  val: por_sede['24'] },
            ].map(({ label, val }) => (
              <div key={label} className="bg-dark-bg rounded-xl px-3 py-2 text-center">
                <p className="text-lg font-bold text-dark-text">{val}</p>
                <p className="text-xs text-dark-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fila 3: Disciplinas del mes + Pagos de hoy ───────────────────── */}
      <div className="order-3 lg:order-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recaudación por disciplina este mes */}
        <div className="card">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">
            Por disciplina — {mesActualLabel}
          </p>
          {disc_mes_actual.length === 0 ? (
            <p className="text-dark-muted text-sm text-center py-6">Sin pagos registrados aún</p>
          ) : (
            <div className="space-y-3">
              {disc_mes_actual.map((d) => {
                const disc = d.alumno__disciplina
                const totalDisc = disc_mes_actual.reduce((s, x) => s + x.total, 0)
                const pct = totalDisc > 0 ? (d.total / totalDisc) * 100 : 0
                return (
                  <div key={disc}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-dark-text font-medium">{DISC_LABEL[disc] || disc}</span>
                      <div className="flex gap-3">
                        <span className="text-dark-muted text-xs">{d.cant} pagos</span>
                        <span className="text-dark-text font-semibold">{money(d.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: DISC_COLOR[disc] || '#6b7280' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagos del mes día a día */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
              Pagos día a día — {mesActualLabel}
            </p>
            {recaudacion.pagos_hoy > 0 && (
              <span className="text-xs bg-green-900/40 text-green-400 px-2 py-1 rounded-lg font-medium">
                {recaudacion.pagos_hoy} hoy
              </span>
            )}
          </div>
          {pagos_por_dia.length === 0 ? (
            <p className="text-dark-muted text-sm text-center py-6">Sin pagos registrados aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={pagos_por_dia} barCategoryGap="20%">
                <XAxis
                  dataKey="fecha"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => [money(v), 'Recaudado']}
                  contentStyle={{
                    background: '#16213e', border: '1px solid #0f3460',
                    borderRadius: 12, fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {pagos_por_dia.length > 0 && (
            <div className="mt-3 flex justify-between text-xs text-dark-muted border-t border-dark-border pt-3">
              <span>{pagos_por_dia.reduce((s, p) => s + p.cant, 0)} pagos registrados</span>
              <span className="text-green-400 font-semibold">{money(recaudacion.mes_actual)} total</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Acceso rápido ────────────────────────────────────────────────── */}
      <div className="order-5 grid grid-cols-3 gap-3">
        {[
          { to: '/alumnos', label: 'Ver impagos', sub: `${alumnos.mora} alumnos`, color: 'text-yellow-400' },
          { to: '/alumnos', label: 'Ver alejados', sub: `${alumnos.alejado} alumnos`, color: 'text-red-400' },
          { to: '/alumnos', label: 'Nuevo alumno', sub: 'Registrar ingreso', color: 'text-blue-400' },
        ].map(({ to, label, sub, color }) => (
          <Link key={label} to={to}
            className="card flex items-center justify-between hover:border-primary-dark/40 transition-all group">
            <div>
              <p className={clsx('text-sm font-semibold', color)}>{label}</p>
              <p className="text-xs text-dark-muted mt-0.5">{sub}</p>
            </div>
            <ArrowRight size={14} className="text-dark-border group-hover:text-dark-muted transition-colors" />
          </Link>
        ))}
      </div>

    </div>
  )
}
