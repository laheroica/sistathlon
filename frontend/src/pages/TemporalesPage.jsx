import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Pencil, Trash2, CheckCircle, Circle, AlertTriangle, Phone } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import TemporalPanel from '../components/temporales/TemporalPanel'

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy Func.', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus' }
const TIPO_LABEL = { clase: 'Clase suelta', semana: 'Semana', quincena: 'Quincena', mes: 'Mes completo' }

const SEDES = [
  { val: '',    label: 'Ambas' },
  { val: '107', label: 'Athlon 107' },
  { val: '24',  label: 'Athlon 24' },
]

const ESTADOS = [
  { val: 'activo',  label: 'Activos',  color: 'text-green-400',  bg: 'bg-green-900/40',  border: 'border-green-800/40' },
  { val: 'vencido', label: 'Vencidos', color: 'text-red-400',    bg: 'bg-red-900/40',    border: 'border-red-800/40' },
  { val: 'todos',   label: 'Todos',    color: 'text-dark-muted', bg: 'bg-dark-surface',  border: 'border-dark-border' },
]

export default function TemporalesPage() {
  const [sede,   setSede]   = useState('')
  const [estado, setEstado] = useState('activo')
  const [panel,  setPanel]  = useState(null) // null | 'nuevo' | { temporal }

  const qc = useQueryClient()

  const { data: temporales = [], isLoading } = useQuery({
    queryKey: ['temporales', estado, sede],
    queryFn: () => api.get('/temporales/', { params: { estado, sede: sede || undefined } }).then(r => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['temporales'] })
  }

  async function togglePagado(t) {
    await api.patch(`/temporales/${t.id}/`, { pagado: !t.pagado })
    invalidate()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este temporal?')) return
    await api.delete(`/temporales/${id}/`)
    invalidate()
  }

  function abrirWhatsApp(t) {
    if (!t.celular) return
    const cel = t.celular.replace(/\D/g, '')
    const texto = encodeURIComponent(
      `Hola ${t.nombre.split(' ')[0]}! Te escribimos desde Athlon para recordarte que tu pase ${TIPO_LABEL[t.tipo]?.toLowerCase()} vence el ${formatFecha(t.fecha_fin)}. ¡Esperamos verte pronto!`
    )
    window.open(`https://wa.me/549${cel}?text=${texto}`, '_blank')
  }

  const pagados   = temporales.filter(t => t.pagado).length
  const impagos   = temporales.filter(t => !t.pagado).length
  const porVencer = temporales.filter(t => !t.vencido && t.dias_restantes !== null && t.dias_restantes <= 2).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-900/40 flex items-center justify-center">
            <Clock size={18} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Temporales</h1>
            <p className="text-xs text-dark-muted">Clases sueltas, semanas y pases</p>
          </div>
        </div>
        <button
          onClick={() => setPanel('nuevo')}
          className="flex items-center gap-2 bg-primary-dark hover:bg-primary-dark/80 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} /> Nuevo temporal
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-dark-text">{temporales.length}</p>
          <p className="text-xs text-dark-muted mt-0.5">Total</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-green-400">{pagados}</p>
          <p className="text-xs text-dark-muted mt-0.5">Pagados</p>
        </div>
        <div className="card text-center py-3">
          <p className={clsx('text-2xl font-bold', impagos > 0 ? 'text-yellow-400' : 'text-dark-muted')}>{impagos}</p>
          <p className="text-xs text-dark-muted mt-0.5">Sin cobrar</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Estado */}
        <div className="flex gap-1.5">
          {ESTADOS.map(e => (
            <button
              key={e.val}
              onClick={() => setEstado(e.val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                estado === e.val ? `${e.bg} ${e.color} ${e.border}` : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
              )}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* Sede */}
        <div className="flex gap-1.5 ml-auto">
          {SEDES.map(s => (
            <button
              key={s.val}
              onClick={() => setSede(s.val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                sede === s.val
                  ? 'bg-sky-900/40 text-sky-400 border-sky-800/40'
                  : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerta por vencer */}
      {porVencer > 0 && estado === 'activo' && (
        <div className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-400">
            {porVencer} {porVencer === 1 ? 'temporal vence' : 'temporales vencen'} en los próximos 2 días
          </p>
        </div>
      )}

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            {ESTADOS.find(e => e.val === estado)?.label}
          </p>
          <span className="text-xs text-dark-muted">{temporales.length} registros</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-dark-surface rounded-xl animate-pulse" />)}
          </div>
        ) : temporales.length === 0 ? (
          <div className="py-14 text-center">
            <Clock size={28} className="text-dark-border mx-auto mb-3" />
            <p className="text-sm text-dark-muted">No hay temporales {estado !== 'todos' ? ESTADOS.find(e=>e.val===estado)?.label.toLowerCase() : ''}</p>
            <button onClick={() => setPanel('nuevo')} className="mt-3 text-xs text-sky-400 hover:underline">
              Registrar el primero
            </button>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {temporales.map(t => (
              <TemporalRow
                key={t.id}
                temporal={t}
                onEdit={() => setPanel({ temporal: t })}
                onDelete={() => eliminar(t.id)}
                onTogglePagado={() => togglePagado(t)}
                onWhatsApp={() => abrirWhatsApp(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel */}
      {panel && (
        <TemporalPanel
          temporal={panel?.temporal ?? null}
          onClose={() => setPanel(null)}
          onSaved={() => { invalidate(); setPanel(null) }}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFecha(f) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

// ── Fila de temporal ──────────────────────────────────────────────────────────
function TemporalRow({ temporal: t, onEdit, onDelete, onTogglePagado, onWhatsApp }) {
  const diasLabel = () => {
    if (t.dias_restantes === null) return null
    if (t.vencido) return { text: `Venció hace ${Math.abs(t.dias_restantes)} días`, color: 'text-red-400 bg-red-900/20' }
    if (t.dias_restantes === 0) return { text: 'Vence hoy', color: 'text-orange-400 bg-orange-900/20' }
    if (t.dias_restantes === 1) return { text: 'Vence mañana', color: 'text-yellow-400 bg-yellow-900/20' }
    return { text: `${t.dias_restantes} días`, color: 'text-sky-400 bg-sky-900/20' }
  }

  const badge = diasLabel()

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-dark-surface/40 transition-colors">
      {/* Toggle pagado */}
      <button onClick={onTogglePagado} className="flex-shrink-0 transition-colors">
        {t.pagado
          ? <CheckCircle size={20} className="text-green-400" />
          : <Circle size={20} className="text-dark-border hover:text-dark-muted" />
        }
      </button>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={clsx('text-sm font-semibold', t.pagado ? 'text-dark-muted line-through' : 'text-dark-text')}>
            {t.nombre}
          </p>
          <span className="text-xs text-dark-muted bg-dark-border px-2 py-0.5 rounded-md">
            {DISC_LABEL[t.disciplina] || t.disciplina}
          </span>
          <span className="text-xs text-dark-muted">
            {TIPO_LABEL[t.tipo]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-dark-muted flex-wrap">
          <span>Athlon {t.sede}</span>
          {t.fecha_inicio && <span>{formatFecha(t.fecha_inicio)} → {formatFecha(t.fecha_fin)}</span>}
          {t.notas && <span className="truncate max-w-[180px] italic">{t.notas}</span>}
        </div>
      </div>

      {/* Monto */}
      <div className="text-sm font-bold text-green-400 flex-shrink-0">
        {money(t.monto)}
      </div>

      {/* Badge días */}
      {badge && (
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-lg flex-shrink-0', badge.color)}>
          {badge.text}
        </span>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {t.celular && (
          <button onClick={onWhatsApp} className="p-1.5 rounded-lg text-dark-muted hover:text-green-400 hover:bg-green-900/20 transition-colors" title="WhatsApp">
            <Phone size={13} />
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg text-dark-muted hover:text-blue-400 hover:bg-blue-900/20 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
