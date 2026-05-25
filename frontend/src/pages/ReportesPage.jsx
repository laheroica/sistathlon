import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'

const C = {
  indigo:  '#6366f1',
  emerald: '#34d399',
  sky:     '#38bdf8',
  red:     '#f87171',
  orange:  '#fb923c',
  amber:   '#fbbf24',
  teal:    '#2dd4bf',
  purple:  '#a78bfa',
  slate:   '#64748b',
}

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy Func.', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus', FB: 'FullBody' }
const DISC_COLOR  = { CF: C.indigo, HF: C.emerald, HX: C.amber, TN: C.purple, KD: C.sky, BP: C.teal, FB: C.orange }
const METODO_COLOR = { efectivo: C.emerald, transferencia: C.sky, debito: C.purple }
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito' }

const TICK = { fill: '#64748b', fontSize: 10 }
const GRID = '#1e293b'

function fmtMoney(v) {
  if (!v && v !== 0) return '$0'
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (a >= 1_000)     return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v)}`
}

function TT({ active, payload, label, fmt = fmtMoney }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-dark-muted mb-1.5 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-dark-muted">{p.name}:</span>
          <span className="text-dark-text font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ title, sub, children, className = '' }) {
  return (
    <div className={`bg-dark-surface rounded-2xl border border-dark-border p-5 ${className}`}>
      <div className="mb-4">
        <p className="text-sm font-semibold text-dark-text">{title}</p>
        {sub && <p className="text-xs text-dark-muted mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Sk({ className = '' }) {
  return <div className={`bg-dark-border/40 rounded-xl animate-pulse ${className}`} />
}

function VarChip({ value, label }) {
  if (value === 0) return (
    <div className="flex items-center gap-1 text-dark-muted text-xs">
      <Minus size={12} /> {label}
    </div>
  )
  const pos = value > 0
  return (
    <div className={clsx('flex items-center gap-1 text-xs font-medium', pos ? 'text-green-400' : 'text-red-400')}>
      {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pos ? '+' : ''}{value}% {label}
    </div>
  )
}

export default function ReportesPage() {
  const [sede, setSede]   = useState('')
  const [meses, setMeses] = useState(12)

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-anual', meses],
    queryFn: () => api.get(`/reportes/anual/?meses=${meses}`).then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  const series   = data?.series ?? []
  const snapshot = data?.snapshot ?? {}

  const seriesFiltradas = series.map(s => {
    if (!sede) return s
    return {
      ...s,
      recaudado: sede === '107' ? s.rec_107 : s.rec_24,
      pagadores: sede === '107' ? s.pag_107 : s.pag_24,
      ticket:    sede === '107' ? s.ticket_107 : s.ticket_24,
    }
  })

  const discActual = (snapshot.por_disciplina ?? []).map(d => ({
    name: DISC_LABEL[d.disciplina] ?? d.disciplina,
    cant: d.cant,
    fill: DISC_COLOR[d.disciplina] ?? C.slate,
  }))

  const discHistorico = (snapshot.por_disciplina_historico ?? []).map(d => ({
    name: DISC_LABEL[d.disciplina] ?? d.disciplina,
    cant: d.cant,
    fill: DISC_COLOR[d.disciplina] ?? C.slate,
  }))

  const metodoData = (snapshot.metodos_pago ?? []).map(m => ({
    name:  METODO_LABEL[m.metodo] ?? m.metodo,
    value: m.cant,
    total: m.total,
    fill:  METODO_COLOR[m.metodo] ?? C.slate,
  }))

  const sedeData = [
    { sede: 'Athlon 107', cant: snapshot.por_sede?.find(s => s.sede === '107')?.cant ?? 0, fill: C.emerald },
    { sede: 'Athlon 24',  cant: snapshot.por_sede?.find(s => s.sede === '24')?.cant  ?? 0, fill: C.sky },
  ]

  const totalActivos       = snapshot.total_activos ?? 0
  const mesSnapshot        = snapshot.mes_snapshot ?? ''
  const ticketUltimoMes    = snapshot.ticket_ultimo_mes ?? 0
  const varFacturacion     = snapshot.var_facturacion_pct ?? 0
  const varAlumnos         = snapshot.var_alumnos_pct ?? 0
  const totalRec           = series.reduce((s, r) => s + r.recaudado, 0)
  const totalGast          = series.reduce((s, r) => s + r.gastos, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Reportes</h1>
          <p className="text-sm text-dark-muted mt-0.5">Métricas y evolución del negocio</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-dark-surface rounded-xl p-1 border border-dark-border">
            {[6, 12].map(m => (
              <button key={m} onClick={() => setMeses(m)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  meses === m ? 'bg-dark-border text-dark-text' : 'text-dark-muted hover:text-dark-text'
                )}
              >{m} meses</button>
            ))}
          </div>
          <div className="flex gap-1 bg-dark-surface rounded-xl p-1 border border-dark-border">
            {[['', 'Ambas'], ['107', '107'], ['24', '24']].map(([v, l]) => (
              <button key={v} onClick={() => setSede(v)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  sede === v ? 'bg-indigo-700 text-white' : 'text-dark-muted hover:text-dark-text'
                )}
              >{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs — 6 cards en 2 filas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {/* Ticket último mes */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 text-center">
          <p className="text-xs text-dark-muted mb-1">Ticket último mes</p>
          {isLoading ? <Sk className="h-7 w-20 mx-auto mt-1" /> : (
            <p className="text-xl font-bold text-indigo-400">{fmtMoney(ticketUltimoMes)}</p>
          )}
        </div>

        {/* Variación facturación */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 text-center">
          <p className="text-xs text-dark-muted mb-1">Variación facturación</p>
          {isLoading ? <Sk className="h-7 w-20 mx-auto mt-1" /> : (
            <>
              <p className={clsx('text-xl font-bold', varFacturacion >= 0 ? 'text-green-400' : 'text-red-400')}>
                {varFacturacion >= 0 ? '+' : ''}{varFacturacion}%
              </p>
              <p className="text-xs text-dark-muted mt-0.5">vs mes anterior</p>
            </>
          )}
        </div>

        {/* Alumnos activos */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 text-center">
          <p className="text-xs text-dark-muted mb-1">Alumnos activos</p>
          {isLoading ? <Sk className="h-7 w-20 mx-auto mt-1" /> : (
            <>
              <p className="text-xl font-bold text-sky-400">{totalActivos}</p>
              <div className="flex justify-center gap-3 mt-0.5">
                {sedeData.map(s => (
                  <span key={s.sede} className="text-xs" style={{ color: s.fill }}>
                    {s.sede.replace('Athlon ', '')}: {s.cant}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Variación alumnos */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 text-center">
          <p className="text-xs text-dark-muted mb-1">Variación alumnos</p>
          {isLoading ? <Sk className="h-7 w-20 mx-auto mt-1" /> : (
            <>
              <p className={clsx('text-xl font-bold', varAlumnos >= 0 ? 'text-green-400' : 'text-red-400')}>
                {varAlumnos >= 0 ? '+' : ''}{varAlumnos}%
              </p>
              <p className="text-xs text-dark-muted mt-0.5">pagadores vs mes anterior</p>
            </>
          )}
        </div>

        {/* Recaudado período */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 text-center">
          <p className="text-xs text-dark-muted mb-1">Recaudado ({meses}m)</p>
          {isLoading ? <Sk className="h-7 w-20 mx-auto mt-1" /> : (
            <p className="text-xl font-bold text-green-400">{fmtMoney(totalRec)}</p>
          )}
        </div>

        {/* Gastos período */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 text-center">
          <p className="text-xs text-dark-muted mb-1">Gastos ({meses}m)</p>
          {isLoading ? <Sk className="h-7 w-20 mx-auto mt-1" /> : (
            <p className="text-xl font-bold text-red-400">{fmtMoney(totalGast)}</p>
          )}
        </div>
      </div>

      {/* CHART 1 — Recaudación por sede (líneas) */}
      <Card title="Recaudación mensual por sede" sub="Evolución — cuotas cobradas" className="mb-4">
        {isLoading ? <Sk className="h-56" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={seriesFiltradas}>
              <defs>
                <linearGradient id="g107" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.emerald} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.sky} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.sky} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtMoney} tick={TICK} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<TT />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              {sede ? (
                <Area dataKey="recaudado" name={`Athlon ${sede}`}
                  stroke={sede === '107' ? C.emerald : C.sky}
                  fill={sede === '107' ? 'url(#g107)' : 'url(#g24)'}
                  strokeWidth={2.5} dot={false} />
              ) : (
                <>
                  <Area dataKey="rec_107" name="Athlon 107" stroke={C.emerald} fill="url(#g107)" strokeWidth={2} dot={false} />
                  <Area dataKey="rec_24"  name="Athlon 24"  stroke={C.sky}     fill="url(#g24)"  strokeWidth={2} dot={false} />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Row 2: Ticket + Alumnos que pagaron */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Ticket promedio mensual" sub="Recaudado ÷ pagadores">
          {isLoading ? <Sk className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesFiltradas}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtMoney} tick={TICK} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<TT />} />
                {sede ? (
                  <Line dataKey="ticket" name={`Ticket ${sede}`} stroke={C.indigo} strokeWidth={2.5} dot={false} />
                ) : (
                  <>
                    <Line dataKey="ticket"     name="Total"    stroke={C.indigo}  strokeWidth={2.5} dot={false} />
                    <Line dataKey="ticket_107" name="Sede 107" stroke={C.emerald} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line dataKey="ticket_24"  name="Sede 24"  stroke={C.sky}     strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </>
                )}
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Alumnos que pagaron por mes" sub="Evolución por sede">
          {isLoading ? <Sk className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesFiltradas}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<TT fmt={v => v} />} />
                {sede ? (
                  <Line dataKey="pagadores" name={`Sede ${sede}`} stroke={sede === '107' ? C.emerald : C.sky} strokeWidth={2.5} dot={false} />
                ) : (
                  <>
                    <Line dataKey="pagadores" name="Total"    stroke={C.indigo}  strokeWidth={2.5} dot={false} />
                    <Line dataKey="pag_107"   name="Sede 107" stroke={C.emerald} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line dataKey="pag_24"    name="Sede 24"  stroke={C.sky}     strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </>
                )}
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Row 3: Ingresos vs Gastos + Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Ingresos vs Gastos" sub="Comparativo mensual">
          {isLoading ? <Sk className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesFiltradas}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtMoney} tick={TICK} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<TT />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                <Line dataKey="recaudado" name="Ingresos" stroke={C.emerald} strokeWidth={2.5} dot={false} />
                <Line dataKey="gastos"    name="Gastos"   stroke={C.red}     strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Balance mensual" sub="Ingresos − gastos totales">
          {isLoading ? <Sk className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.purple} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtMoney} tick={TICK} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<TT />} />
                <ReferenceLine y={0} stroke={C.slate} strokeDasharray="3 3" />
                <Area dataKey="balance" name="Balance" stroke={C.purple} strokeWidth={2.5} fill="url(#balGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Row 4: Gastos desglosados + Variación de alumnos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Gastos mensuales desglosados" sub="Profes · Fijos · Extras">
          {isLoading ? <Sk className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={series} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtMoney} tick={TICK} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<TT />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                <Bar dataKey="g_profes" name="Profes"  stackId="g" fill={C.orange} />
                <Bar dataKey="g_fijos"  name="Fijos"   stackId="g" fill={C.red} />
                <Bar dataKey="g_extras" name="Extras"  stackId="g" fill={C.amber} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Movimiento de alumnos" sub="Ingresaron vs Abandonaron por mes">
          {isLoading ? <Sk className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="mes" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  return (
                    <div className="bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs shadow-xl">
                      <p className="text-dark-muted mb-1.5 font-semibold">{label}</p>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.amber }} />
                        <span className="text-dark-muted">Ingresaron:</span>
                        <span className="text-dark-text font-semibold">{d.nuevos}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.red }} />
                        <span className="text-dark-muted">Abandonaron:</span>
                        <span className="text-dark-text font-semibold">{d.abandonaron}</span>
                      </div>
                    </div>
                  )
                }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                <ReferenceLine y={0} stroke={C.slate} />
                <Bar dataKey="nuevos"        name="Ingresaron"  fill={C.amber} radius={[4,4,0,0]} barSize={14} />
                <Bar dataKey="abandonaron_neg" name="Abandonaron" fill={C.red}   radius={[0,0,4,4]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Row 5: Disciplinas actuales + históricas + métodos de pago */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card title="Por disciplina — actuales" sub={`${totalActivos} pagaron ${mesSnapshot}`}>
          {isLoading ? <Sk className="h-56" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={discActual} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={TICK} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<TT fmt={v => v} />} />
                <Bar dataKey="cant" name="Alumnos" radius={[0,4,4,0]}>
                  {discActual.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Por disciplina — histórico" sub="Todos los alumnos que pasaron">
          {isLoading ? <Sk className="h-56" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={discHistorico} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={TICK} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<TT fmt={v => v} />} />
                <Bar dataKey="cant" name="Total hist." radius={[0,4,4,0]}>
                  {discHistorico.map((d, i) => <Cell key={i} fill={d.fill} opacity={0.6} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Métodos de pago" sub="Últimos 3 meses">
          {isLoading ? <Sk className="h-56" /> : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={metodoData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {metodoData.map((m, i) => <Cell key={i} fill={m.fill} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs">
                        <p style={{ color: d.fill }} className="font-semibold">{d.name}</p>
                        <p className="text-dark-muted">{d.value} pagos · {fmtMoney(d.total)}</p>
                      </div>
                    )
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {metodoData.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.fill }} />
                      <span className="text-dark-muted">{m.name}</span>
                    </div>
                    <span className="text-dark-text font-medium">{m.value} pagos</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Alumnos por sede — barra de progreso */}
      <Card title="Alumnos activos por sede" sub="Distribución actual">
        {isLoading ? <Sk className="h-24" /> : (
          <div className="flex gap-6 items-center">
            <div className="flex-1 space-y-3">
              {sedeData.map(s => (
                <div key={s.sede} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-dark-text font-medium">{s.sede}</span>
                      <span className="text-dark-text font-bold">{s.cant}</span>
                    </div>
                    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${totalActivos ? Math.round(s.cant / totalActivos * 100) : 0}%`, backgroundColor: s.fill }} />
                    </div>
                  </div>
                  <span className="text-xs text-dark-muted w-8 text-right">
                    {totalActivos ? Math.round(s.cant / totalActivos * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
