import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive, Plus, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, DollarSign, Scale,
  Pencil, Trash2, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import ArqueoPanel from '../components/caja/ArqueoPanel'
import { money } from '../lib/format'
import { useNegocio } from '../hooks/useNegocio'

function mesLabel(yyyy, mm) {
  const d = new Date(yyyy, mm - 1, 1)
  return d.toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

export default function CajaPage() {
  const { sedeOptions } = useNegocio()
  const SEDES = [{ val: '', label: 'Ambas sedes' }, ...sedeOptions]
  const hoy        = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)
  const [sede, setSede] = useState('')
  const [panel, setPanel] = useState(null) // null | 'nuevo' | { arqueo }

  const qc = useQueryClient()
  const mesStr = `${anio}-${String(mes).padStart(2, '0')}`

  const resumenQ = useQuery({
    queryKey: ['caja-resumen', mesStr, sede],
    queryFn: () => api.get('/caja/resumen/', { params: { mes: mesStr, sede } }).then(r => r.data),
  })

  const arqueosQ = useQuery({
    queryKey: ['caja-arqueos', mesStr, sede],
    queryFn: () => api.get('/caja/arqueos/', { params: { mes: mesStr, sede } }).then(r => r.data),
  })

  function navMes(delta) {
    let m = mes + delta
    let a = anio
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    setMes(m); setAnio(a)
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['caja-resumen'] })
    qc.invalidateQueries({ queryKey: ['caja-arqueos'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  async function eliminarArqueo(id) {
    if (!confirm('¿Eliminar este arqueo?')) return
    await api.delete(`/caja/arqueos/${id}/`)
    invalidate()
  }

  const resumen  = resumenQ.data
  const arqueos  = arqueosQ.data ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-900/40 flex items-center justify-center">
            <Archive size={18} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Caja</h1>
            <p className="text-xs text-dark-muted">Movimientos y arqueos</p>
          </div>
        </div>
        <button
          onClick={() => setPanel('nuevo')}
          className="flex items-center gap-2 bg-primary-dark hover:bg-primary-dark/80 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} />
          Nuevo arqueo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Navegación de mes */}
        <div className="flex items-center gap-2 bg-dark-surface border border-dark-border rounded-xl px-3 py-2">
          <button onClick={() => navMes(-1)} className="text-dark-muted hover:text-dark-text transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-dark-text min-w-[130px] text-center">
            {mesLabel(anio, mes)}
          </span>
          <button onClick={() => navMes(1)} className="text-dark-muted hover:text-dark-text transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Sede */}
        <div className="flex gap-1.5">
          {SEDES.map(s => (
            <button
              key={s.val}
              onClick={() => setSede(s.val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                sede === s.val
                  ? 'bg-orange-900/40 text-orange-400 border-orange-800/40'
                  : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCaja
            icon={DollarSign}
            label="Cuotas cobradas"
            value={money(resumen.ingresos_cuotas)}
            sub={`${resumen.cant_cuotas} pagos`}
            color="text-green-400"
            bg="bg-green-900/40"
          />
          <KpiCaja
            icon={ArrowUpCircle}
            label="Ventas y cobros"
            value={money((resumen.ingresos_productos || 0) + (resumen.ingresos_cta_corriente || 0))}
            sub={`Productos${resumen.ingresos_cta_corriente ? ' + cta. cte.' : ''}`}
            color="text-emerald-400"
            bg="bg-emerald-900/40"
          />
          <KpiCaja
            icon={ArrowUpCircle}
            label="Ingresos extra"
            value={money(resumen.ingresos_caja)}
            sub="Movimientos de caja"
            color="text-blue-400"
            bg="bg-blue-900/40"
          />
          <KpiCaja
            icon={ArrowDownCircle}
            label="Egresos"
            value={money(resumen.egresos_caja)}
            sub="Gastos registrados"
            color="text-red-400"
            bg="bg-red-900/40"
          />
          <KpiCaja
            icon={Scale}
            label="Balance neto"
            value={money(resumen.balance)}
            sub="Cuotas + ventas + ingresos − egresos"
            color={resumen.balance >= 0 ? 'text-green-400' : 'text-red-400'}
            bg={resumen.balance >= 0 ? 'bg-green-900/40' : 'bg-red-900/40'}
          />
        </div>
      )}

      {/* Lista de arqueos */}
      <div className="card space-y-0 p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            Arqueos — {mesLabel(anio, mes)}
          </p>
          <span className="text-xs text-dark-muted">{arqueos.length} registros</span>
        </div>

        {arqueosQ.isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-dark-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : arqueos.length === 0 ? (
          <div className="py-14 text-center">
            <Archive size={28} className="text-dark-border mx-auto mb-3" />
            <p className="text-sm text-dark-muted">No hay arqueos este mes</p>
            <button
              onClick={() => setPanel('nuevo')}
              className="mt-3 text-xs text-orange-400 hover:underline"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {arqueos.map(a => (
              <ArqueoRow
                key={a.id}
                arqueo={a}
                onEdit={() => setPanel({ arqueo: a })}
                onDelete={() => eliminarArqueo(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel lateral */}
      {panel && (
        <ArqueoPanel
          arqueo={panel?.arqueo ?? null}
          defaultMes={mesStr}
          onClose={() => setPanel(null)}
          onSaved={() => { invalidate(); setPanel(null) }}
        />
      )}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCaja({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="card flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-dark-muted uppercase tracking-wider font-medium truncate">{label}</p>
        <p className={clsx('text-xl font-bold leading-tight mt-0.5', color)}>{value}</p>
        {sub && <p className="text-xs text-dark-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Fila de arqueo ────────────────────────────────────────────────────────────
function ArqueoRow({ arqueo, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const saldo_esperado = arqueo.saldo_inicial + arqueo.total_ingresos - arqueo.total_egresos
  const diferencia     = Math.round(arqueo.total_billetes - saldo_esperado)
  const tiene_billetes = arqueo.total_billetes > 0

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-dark-surface/50 transition-colors text-left"
      >
        {/* Fecha + sede */}
        <div className="w-28 flex-shrink-0">
          <p className="text-sm font-semibold text-dark-text">
            {new Date(arqueo.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
          </p>
          <p className="text-xs text-dark-muted">Athlon {arqueo.sede}</p>
        </div>

        {/* Movimientos resumen */}
        <div className="flex-1 flex items-center gap-4 text-sm">
          {arqueo.total_ingresos > 0 && (
            <span className="text-green-400 font-medium">+{money(arqueo.total_ingresos)}</span>
          )}
          {arqueo.total_egresos > 0 && (
            <span className="text-red-400 font-medium">−{money(arqueo.total_egresos)}</span>
          )}
          {arqueo.movimientos.length > 0 && (
            <span className="text-dark-muted text-xs">{arqueo.movimientos.length} mov.</span>
          )}
          {arqueo.notas && (
            <span className="text-dark-muted text-xs truncate max-w-[200px]">{arqueo.notas}</span>
          )}
        </div>

        {/* Diferencia de conteo */}
        {tiene_billetes && (
          <div className={clsx(
            'text-xs font-semibold px-2 py-0.5 rounded-lg',
            diferencia === 0 ? 'text-green-400 bg-green-900/30' :
            diferencia > 0  ? 'text-blue-400 bg-blue-900/30' :
                              'text-red-400 bg-red-900/30'
          )}>
            {diferencia === 0 ? 'Cuadra' : diferencia > 0 ? `+${money(diferencia)}` : money(diferencia)}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-dark-muted hover:text-blue-400 hover:bg-blue-900/20 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </button>

      {/* Detalle expandible */}
      {open && arqueo.movimientos.length > 0 && (
        <div className="px-8 pb-4 space-y-1.5">
          {arqueo.movimientos.map(m => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-dark-muted">{m.descripcion}</span>
              <span className={clsx('font-medium', m.importe >= 0 ? 'text-green-400' : 'text-red-400')}>
                {m.importe >= 0 ? '+' : ''}{money(m.importe)}
              </span>
            </div>
          ))}
          {tiene_billetes && (
            <div className="pt-2 mt-2 border-t border-dark-border flex justify-between text-xs text-dark-muted">
              <span>Conteo de billetes</span>
              <span className="font-semibold text-dark-text">{money(arqueo.total_billetes)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
