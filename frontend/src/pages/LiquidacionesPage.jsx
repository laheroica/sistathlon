import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, ChevronLeft, ChevronRight, CheckCircle, Clock,
  Banknote, Eye, RefreshCw, TrendingUp, Lock, History, ArrowLeft
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import LiquidacionPanel from '../components/liquidaciones/LiquidacionPanel'
import CierreMesPanel   from '../components/liquidaciones/CierreMesPanel'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TIPO_LABEL = { hora: 'Por hora', fijo: 'Sueldo fijo', porcentaje: 'Porcentaje' }
const TIPO_COLOR = {
  hora:       'text-blue-400 bg-blue-900/30',
  fijo:       'text-green-400 bg-green-900/30',
  porcentaje: 'text-purple-400 bg-purple-900/30',
}

const SEDES = [
  { val: '', label: 'Ambas' },
  { val: '107', label: 'Athlon 107' },
  { val: '24',  label: 'Athlon 24' },
]

const HOY = new Date().toISOString().slice(0, 10)

function mesStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function mesLabel(str) {
  const [y, m] = str.split('-').map(Number)
  return `${MESES_ES[m - 1]} ${y}`
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

function montoAcumulado(p, sede) {
  const clases   = p.clases ?? []
  const dadas    = clases.filter(c => c.fecha <= HOY)
  const totalMes = clases.length
  const n        = sede ? dadas.filter(c => c.sede === sede).length : dadas.length
  if (n === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  if (p.tipo_liquidacion === 'fijo') return totalMes > 0 ? p.monto_calculado * n / totalMes : 0
  return 0
}

function montoProyectado(p, sede) {
  const clases = p.clases ?? []
  const total  = clases.length
  const n      = sede ? clases.filter(c => c.sede === sede).length : total
  if (n === 0 || total === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  if (p.tipo_liquidacion === 'fijo') return p.monto_calculado * n / total
  return 0
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LiquidacionesPage() {
  const hoy = new Date()
  const [year,  setYear]   = useState(hoy.getFullYear())
  const [month, setMonth]  = useState(hoy.getMonth() + 1)
  const [sede,  setSede]   = useState('')
  const [panel, setPanel]  = useState(null)
  const [cierre, setCierre] = useState(false)
  const [vista, setVista]  = useState('mes') // 'mes' | 'historial'

  const qc  = useQueryClient()
  const mes = mesStr(year, month)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['liquidaciones-preview', mes],
    queryFn:  () => api.get('/liquidaciones/preview/', { params: { mes } }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const historialQ = useQuery({
    queryKey: ['liquidaciones-meses-cerrados'],
    queryFn:  () => api.get('/liquidaciones/meses-cerrados/').then(r => r.data),
    staleTime: 0,
    enabled: vista === 'historial',
  })

  function navMes(delta) {
    let m = month + delta, y = year
    if (m > 12) { m = 1;  y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  const todosLos = data?.profes ?? []

  const profes = useMemo(() => {
    if (!sede) return todosLos
    return todosLos.filter(p =>
      (p.clases ?? []).some(c => c.sede === sede && c.fecha <= HOY)
    )
  }, [todosLos, sede])

  const pendientes  = profes.filter(p => !p.confirmada)
  const confirmadas = profes.filter(p => p.confirmada && !p.pagada)
  const pagadas     = profes.filter(p => p.pagada)

  const acum107   = useMemo(() => todosLos.reduce((s, p) => s + montoAcumulado(p, '107'), 0), [todosLos])
  const acum24    = useMemo(() => todosLos.reduce((s, p) => s + montoAcumulado(p, '24'),  0), [todosLos])
  const acumTotal = acum107 + acum24
  const proy107   = useMemo(() => todosLos.reduce((s, p) => s + montoProyectado(p, '107'), 0), [todosLos])
  const proy24    = useMemo(() => todosLos.reduce((s, p) => s + montoProyectado(p, '24'),  0), [todosLos])
  const proyTotal = proy107 + proy24

  // ¿El mes actual ya está cerrado?
  const mesCerrado = todosLos.length > 0 && todosLos.every(p => p.confirmada)

  // ── Vista historial ───────────────────────────────────────────────────────

  if (vista === 'historial') {
    return <HistorialView
      historial={historialQ.data ?? []}
      isLoading={historialQ.isLoading}
      onVolver={() => setVista('mes')}
    />
  }

  // ── Vista mes ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-900/30 flex items-center justify-center">
            <DollarSign size={18} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Liquidaciones</h1>
            <p className="text-xs text-dark-muted">Acumulado hasta hoy · cierre a fin de mes</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mes */}
          <div className="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-xl px-3 py-1.5">
            <button onClick={() => navMes(-1)} className="text-dark-muted hover:text-dark-text p-1">
              <ChevronLeft size={15}/>
            </button>
            <span className="text-sm font-semibold text-dark-text min-w-[130px] text-center">
              {MESES_ES[month - 1]} {year}
            </span>
            <button onClick={() => navMes(1)} className="text-dark-muted hover:text-dark-text p-1">
              <ChevronRight size={15}/>
            </button>
          </div>

          {/* Sede */}
          <div className="flex gap-1">
            {SEDES.map(s => (
              <button key={s.val} onClick={() => setSede(s.val)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  sede === s.val
                    ? 'bg-green-900/30 text-green-400 border-green-800/40'
                    : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
                )}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Historial */}
          <button onClick={() => setVista('historial')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dark-border bg-dark-surface text-dark-muted hover:text-dark-text text-xs font-medium transition-colors">
            <History size={13}/> Historial
          </button>

          {/* Recalcular */}
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dark-border bg-dark-surface text-dark-muted hover:text-dark-text text-xs font-medium transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''}/>
            Recalcular
          </button>

          {/* Cerrar mes */}
          {!mesCerrado && todosLos.length > 0 && (
            <button onClick={() => setCierre(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-800/40 bg-green-900/20 text-green-400 hover:bg-green-900/30 text-xs font-semibold transition-colors">
              <Lock size={13}/> Cerrar mes
            </button>
          )}

          {/* Mes cerrado badge */}
          {mesCerrado && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-800/40 bg-green-900/20 text-green-400 text-xs font-semibold">
              <Lock size={13}/> Mes cerrado
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card py-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-dark-muted mb-1">Acumulado hasta hoy</p>
            <p className="text-xl font-bold text-green-400">{money(acumTotal)}</p>
            {proyTotal > acumTotal && (
              <p className="text-xs text-dark-muted mt-1 flex items-center gap-1">
                <TrendingUp size={11}/> Proyección: {money(proyTotal)}
              </p>
            )}
          </div>
          <div className="card py-3">
            <p className="text-xs text-dark-muted mb-1">Acumulado <span className="text-indigo-400 font-semibold">A107</span></p>
            <p className="text-lg font-bold text-indigo-400">{money(acum107)}</p>
            {proy107 > acum107 && (
              <p className="text-xs text-dark-muted mt-1 flex items-center gap-1">
                <TrendingUp size={10}/> {money(proy107)} fin de mes
              </p>
            )}
          </div>
          <div className="card py-3">
            <p className="text-xs text-dark-muted mb-1">Acumulado <span className="text-cyan-400 font-semibold">A24</span></p>
            <p className="text-lg font-bold text-cyan-400">{money(acum24)}</p>
            {proy24 > acum24 && (
              <p className="text-xs text-dark-muted mt-1 flex items-center gap-1">
                <TrendingUp size={10}/> {money(proy24)} fin de mes
              </p>
            )}
          </div>
          <div className="card py-3">
            <p className="text-xs text-dark-muted mb-1">Confirmadas / Pagadas</p>
            <p className="text-lg font-bold text-dark-text">
              {data.confirmadas} <span className="text-dark-muted text-sm font-normal">/ {data.pagadas} pag.</span>
            </p>
            <p className="text-xs text-dark-muted mt-1">{profes.length} profes</p>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-dark-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : profes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-dark-muted text-sm">
            {todosLos.length === 0
              ? `No hay clases registradas en ${MESES_ES[month-1]} ${year}`
              : `Ningún profe tiene clases en A${sede} este mes`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendientes.length > 0 && (
            <>
              <p className="text-xs text-dark-muted uppercase tracking-wider font-semibold px-1 pt-1">Pendientes de confirmar</p>
              {pendientes.map(p => <ProfeRow key={p.profe_id} profe={p} sede={sede} onVer={() => setPanel(p)} />)}
            </>
          )}
          {confirmadas.length > 0 && (
            <>
              <p className="text-xs text-dark-muted uppercase tracking-wider font-semibold px-1 pt-3">Confirmadas — pendientes de pago</p>
              {confirmadas.map(p => <ProfeRow key={p.profe_id} profe={p} sede={sede} onVer={() => setPanel(p)} />)}
            </>
          )}
          {pagadas.length > 0 && (
            <>
              <p className="text-xs text-dark-muted uppercase tracking-wider font-semibold px-1 pt-3">Pagadas</p>
              {pagadas.map(p => <ProfeRow key={p.profe_id} profe={p} sede={sede} onVer={() => setPanel(p)} />)}
            </>
          )}
        </div>
      )}

      {panel && (
        <LiquidacionPanel
          profe={panel}
          mes={mes}
          mesLabel={`${MESES_ES[month - 1]} ${year}`}
          onClose={() => setPanel(null)}
          onSaved={() => { refetch(); setPanel(null) }}
        />
      )}

      {cierre && (
        <CierreMesPanel
          profes={todosLos}
          mes={mes}
          mesLabel={`${MESES_ES[month - 1]} ${year}`}
          onClose={() => setCierre(false)}
          onCerrado={() => {
            setCierre(false)
            refetch()
            qc.invalidateQueries({ queryKey: ['liquidaciones-meses-cerrados'] })
          }}
        />
      )}
    </div>
  )
}

// ── Fila de profe ─────────────────────────────────────────────────────────────
function ProfeRow({ profe: p, sede, onVer }) {
  const clases      = p.clases ?? []
  const dadas       = clases.filter(c => c.fecha <= HOY)
  const proyectadas = clases.filter(c => c.fecha >  HOY)

  const d107 = dadas.filter(c => c.sede === '107').length
  const d24  = dadas.filter(c => c.sede === '24').length

  const acum107   = montoAcumulado(p, '107')
  const acum24    = montoAcumulado(p, '24')
  const acumTotal = acum107 + acum24

  const proy107   = montoProyectado(p, '107')
  const proy24    = montoProyectado(p, '24')
  const proyTotal = proy107 + proy24

  const mostrarAmbas = !sede

  return (
    <div
      className="card py-3 px-4 hover:border-indigo-700/30 transition-colors cursor-pointer group"
      onClick={onVer}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm mt-0.5"
          style={{ backgroundColor: p.profe_color || '#6b7280' }}
        >
          {p.profe_nombre.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-dark-text">{p.profe_nombre}</p>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', TIPO_COLOR[p.tipo_liquidacion])}>
              {TIPO_LABEL[p.tipo_liquidacion]}
            </span>
            {p.pagada ? (
              <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 px-2 py-0.5 rounded-lg">
                <Banknote size={11}/> Pagada
              </span>
            ) : p.confirmada ? (
              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/30 px-2 py-0.5 rounded-lg">
                <CheckCircle size={11}/> Confirmada
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-dark-muted bg-dark-bg border border-dark-border px-2 py-0.5 rounded-lg">
                <Clock size={11}/> Pendiente
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {mostrarAmbas ? (
              <>
                {d107 > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-indigo-400 font-semibold">A107</span>
                    <span className="text-dark-muted">{d107}h</span>
                    <span className="text-indigo-400 font-bold">{money(acum107)}</span>
                  </div>
                )}
                {d24 > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-cyan-400 font-semibold">A24</span>
                    <span className="text-dark-muted">{d24}h</span>
                    <span className="text-cyan-400 font-bold">{money(acum24)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <span className={clsx('font-semibold', sede === '107' ? 'text-indigo-400' : 'text-cyan-400')}>
                  A{sede}
                </span>
                <span className="text-dark-muted">{sede === '107' ? d107 : d24}h</span>
                <span className={clsx('font-bold', sede === '107' ? 'text-indigo-400' : 'text-cyan-400')}>
                  {money(sede === '107' ? acum107 : acum24)}
                </span>
              </div>
            )}
            {proyectadas.length > 0 && (
              <span className="text-xs text-dark-muted">· {proyectadas.length}h a dar</span>
            )}
          </div>

          {proyTotal > acumTotal && (
            <p className="text-xs text-dark-muted mt-1">
              Proyección fin de mes:
              {mostrarAmbas && proy107 > 0 && (
                <span className="ml-1 text-indigo-400/60">A107 {money(proy107)}</span>
              )}
              {mostrarAmbas && proy24 > 0 && (
                <span className="ml-1 text-cyan-400/60">A24 {money(proy24)}</span>
              )}
              <span className="ml-1 font-semibold text-dark-text/50">{money(proyTotal)}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-base font-bold text-dark-text">{money(acumTotal)}</p>
            {p.confirmada && (
              <p className="text-xs text-green-400">Confirmado: {money(p.monto_final)}</p>
            )}
          </div>
          <Eye size={15} className="opacity-0 group-hover:opacity-100 transition-opacity text-dark-muted"/>
        </div>
      </div>
    </div>
  )
}

// ── Vista historial ───────────────────────────────────────────────────────────
function HistorialView({ historial, isLoading, onVolver }) {
  const [mesDet, setMesDet] = useState(null)

  const detQ = useQuery({
    queryKey: ['liquidaciones-cierre', mesDet],
    queryFn:  () => api.get(`/liquidaciones/cierre/${mesDet}/`).then(r => r.data),
    enabled:  Boolean(mesDet),
    staleTime: 0,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={mesDet ? () => setMesDet(null) : onVolver}
          className="flex items-center gap-1.5 text-dark-muted hover:text-dark-text text-sm transition-colors">
          <ArrowLeft size={15}/> {mesDet ? mesLabel(mesDet) : 'Volver'}
        </button>
        <div className="flex items-center gap-3 ml-2">
          <div className="w-9 h-9 rounded-xl bg-green-900/30 flex items-center justify-center">
            {mesDet ? <Lock size={18} className="text-green-400"/> : <History size={18} className="text-green-400"/>}
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">
              {mesDet ? `Cierre — ${mesLabel(mesDet)}` : 'Historial de cierres'}
            </h1>
            <p className="text-xs text-dark-muted">Liquidaciones confirmadas</p>
          </div>
        </div>
      </div>

      {/* Lista de meses o detalle */}
      {!mesDet ? (
        isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-dark-surface rounded-xl animate-pulse"/>)}
          </div>
        ) : historial.length === 0 ? (
          <div className="card text-center py-12">
            <Lock size={28} className="text-dark-border mx-auto mb-3"/>
            <p className="text-dark-muted text-sm">Todavía no hay meses cerrados</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden divide-y divide-dark-border">
            {historial.map(m => (
              <button key={m.mes} onClick={() => setMesDet(m.mes)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-dark-surface/50 transition-colors text-left">
                <div className="flex items-center gap-3 flex-1">
                  <Lock size={14} className="text-green-400 flex-shrink-0"/>
                  <div>
                    <p className="text-sm font-semibold text-dark-text">{mesLabel(m.mes)}</p>
                    <p className="text-xs text-dark-muted">{m.total_profes} profes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-green-400">{money(m.monto_total)}</p>
                  <p className="text-xs text-dark-muted">{m.pagadas}/{m.total_profes} pagadas</p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        // Detalle del mes
        detQ.isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-dark-surface rounded-xl animate-pulse"/>)}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Total */}
            <div className="card py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-dark-muted">Total pagado</p>
                <p className="text-xl font-bold text-green-400">
                  {money((detQ.data ?? []).reduce((s, l) => s + parseFloat(l.monto_final), 0))}
                </p>
              </div>
            </div>
            {/* Profes */}
            {(detQ.data ?? []).map(liq => (
              <div key={liq.id} className="card py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: liq.profe_color || '#6b7280' }}>
                    {liq.profe_nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-dark-text">{liq.profe_nombre}</p>
                    <p className="text-xs text-dark-muted">
                      {liq.clases_dadas} clases ·{' '}
                      <span className={clsx(TIPO_COLOR[liq.tipo_liquidacion], 'px-1 rounded text-xs')}>
                        {TIPO_LABEL[liq.tipo_liquidacion]}
                      </span>
                      {liq.notas && <span className="ml-2 italic">{liq.notas}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-dark-text">{money(liq.monto_final)}</p>
                    {liq.pagada ? (
                      <p className="text-xs text-yellow-400 flex items-center gap-1 justify-end">
                        <Banknote size={10}/> Pagada
                      </p>
                    ) : (
                      <p className="text-xs text-dark-muted">Pendiente pago</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
