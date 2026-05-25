import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Plus, Pencil, Trash2, Power } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import ProfePanel from '../components/profes/ProfePanel'

const TIPO_LABEL = { hora: 'Por hora', porcentaje: '% recaudación', fijo: 'Sueldo fijo' }
const SEDE_LABEL = { '107': 'Athlon 107', '24': 'Athlon 24', ambas: 'Ambas sedes' }

export default function ProfesPage() {
  const [soloActivos, setSoloActivos] = useState(true)
  const [panel, setPanel] = useState(null)
  const qc = useQueryClient()

  const { data: profes = [], isLoading } = useQuery({
    queryKey: ['profes', soloActivos],
    queryFn: () => api.get('/profes/', {
      params: soloActivos ? { activo: 'true' } : {}
    }).then(r => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['profes'] })
  }

  async function toggleActivo(p) {
    await api.patch(`/profes/${p.id}/`, { activo: !p.activo })
    invalidate()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este profe? Se perderán sus tarifas históricas.')) return
    await api.delete(`/profes/${id}/`)
    invalidate()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-900/40 flex items-center justify-center">
            <UserPlus size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Profes</h1>
            <p className="text-xs text-dark-muted">{profes.length} {soloActivos ? 'activos' : 'en total'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoloActivos(v => !v)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-lg border transition-colors',
              soloActivos
                ? 'bg-green-900/30 text-green-400 border-green-800/40'
                : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
            )}
          >
            {soloActivos ? 'Mostrando activos' : 'Mostrar todos'}
          </button>
          <button
            onClick={() => setPanel('nuevo')}
            className="flex items-center gap-2 bg-primary-dark hover:bg-primary-dark/80 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> Nuevo profe
          </button>
        </div>
      </div>

      {/* Grid de cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-dark-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : profes.length === 0 ? (
        <div className="text-center py-20">
          <UserPlus size={32} className="text-dark-border mx-auto mb-3" />
          <p className="text-dark-muted text-sm">No hay profes registrados</p>
          <button onClick={() => setPanel('nuevo')} className="mt-3 text-xs text-violet-400 hover:underline">
            Agregar el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profes.map(p => (
            <ProfeCard
              key={p.id}
              profe={p}
              onEdit={() => setPanel({ profe: p })}
              onDelete={() => eliminar(p.id)}
              onToggle={() => toggleActivo(p)}
            />
          ))}
        </div>
      )}

      {/* Panel */}
      {panel && (
        <ProfePanel
          profe={panel?.profe ?? null}
          onClose={() => setPanel(null)}
          onSaved={() => { invalidate(); setPanel(null) }}
        />
      )}
    </div>
  )
}

// ── Card de profe ─────────────────────────────────────────────────────────────
function ProfeCard({ profe: p, onEdit, onDelete, onToggle }) {
  const vh = p.valor_mes_actual

  function tarifaLabel() {
    if (!vh) return 'Sin tarifa cargada'
    if (p.tipo_liquidacion === 'hora'       && vh.valor_hora)  return `${money(vh.valor_hora)} / hora`
    if (p.tipo_liquidacion === 'fijo'       && vh.sueldo_fijo) return `${money(vh.sueldo_fijo)} fijo`
    if (p.tipo_liquidacion === 'porcentaje' && vh.porcentaje)  return `${vh.porcentaje}% de recaudación`
    return 'Sin tarifa cargada'
  }

  return (
    <div className={clsx('card flex flex-col gap-4', !p.activo && 'opacity-60')}>
      {/* Top: color + nombre + acciones */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: p.color }}
          >
            {p.nombre.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-dark-text">{p.nombre}</p>
            <p className="text-xs text-dark-muted">{SEDE_LABEL[p.sede]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            title={p.activo ? 'Desactivar' : 'Activar'}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              p.activo
                ? 'text-green-400 hover:bg-green-900/20'
                : 'text-dark-border hover:text-green-400 hover:bg-green-900/20'
            )}
          >
            <Power size={14} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-dark-muted hover:text-blue-400 hover:bg-blue-900/20 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Tipo liquidación */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-dark-muted bg-dark-border px-2 py-1 rounded-lg">
          {TIPO_LABEL[p.tipo_liquidacion]}
        </span>
        {!p.activo && (
          <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded-lg">Inactivo</span>
        )}
      </div>

      {/* Tarifa */}
      <div className="border-t border-dark-border pt-3">
        <p className="text-xs text-dark-muted mb-0.5">Tarifa actual</p>
        <p className={clsx(
          'text-base font-bold',
          vh ? 'text-dark-text' : 'text-dark-border italic text-sm font-normal'
        )}>
          {tarifaLabel()}
        </p>
        {vh?.mes && (
          <p className="text-xs text-dark-muted mt-0.5">
            {vh.mes.slice(5, 7)}/{vh.mes.slice(0, 4)}
          </p>
        )}
      </div>

      {/* Notas */}
      {p.notas && (
        <p className="text-xs text-dark-muted italic border-t border-dark-border pt-2 truncate">
          {p.notas}
        </p>
      )}
    </div>
  )
}
