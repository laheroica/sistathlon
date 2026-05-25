import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Save, Loader2, AlertTriangle, Ban } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy Funcional', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus Pack' }

export default function ModificacionPanel({ horario, fecha, semanaISO, sede, modificacion, profes, onClose, onSaved }) {
  const isEdit = Boolean(modificacion)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [cancelada, setCancelada] = useState(modificacion?.cancelada ?? false)

  const { register, handleSubmit } = useForm({
    defaultValues: {
      profe_real: modificacion?.profe_real ?? horario.profe ?? '',
      motivo:     modificacion?.motivo ?? '',
      nota:       modificacion?.nota   ?? '',
    }
  })

  const fechaLabel = (() => {
    const [y, m, d] = fecha.split('-')
    return `${d}/${m}/${y}`
  })()

  async function onSubmit(data) {
    setSaving(true); setError('')
    try {
      const payload = {
        semana_inicio:     semanaISO,
        sede,
        fecha,
        hora:              horario.hora,
        disciplina:        horario.disciplina,
        profe_planificado: horario.profe ?? null,
        profe_real:        cancelada ? null : (data.profe_real || null),
        cancelada,
        motivo:            data.motivo.trim(),
        nota:              data.nota.trim(),
      }
      if (isEdit) {
        await api.put(`/horarios/real/${modificacion.id}/`, payload)
      } else {
        await api.post('/horarios/real/', payload)
      }
      onSaved()
    } catch (e) {
      console.error('HorarioReal error:', e.response?.status, e.response?.data)
      const msg = e.response?.data
      if (msg && typeof msg === 'object') {
        const parts = Object.entries(msg).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        setError(parts.join(' | ') || 'Error al guardar.')
      } else if (typeof msg === 'string') {
        setError(msg)
      } else {
        setError(`Error ${e.response?.status ?? ''} al guardar.`)
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="w-full max-w-sm bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <AlertTriangle size={14} className="text-yellow-400"/>
              <h2 className="text-base font-bold text-dark-text">Modificar clase</h2>
            </div>
            <p className="text-xs text-dark-muted">
              {fechaLabel} — {horario.hora_str} {DISC_LABEL[horario.disciplina] || horario.disciplina}
            </p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18}/>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Info original */}
            <div className="bg-dark-bg rounded-xl px-4 py-3 text-xs space-y-1">
              <p className="text-dark-muted font-medium uppercase tracking-wider mb-2">Clase original</p>
              <div className="flex justify-between">
                <span className="text-dark-muted">Profe planificado</span>
                <span className="text-dark-text font-medium">{horario.profe_nombre || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Disciplina</span>
                <span className="text-dark-text">{DISC_LABEL[horario.disciplina]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Horario</span>
                <span className="text-dark-text">{horario.hora_str}</span>
              </div>
            </div>

            {/* Toggle: Clase suspendida */}
            <button
              type="button"
              onClick={() => setCancelada(v => !v)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left',
                cancelada
                  ? 'bg-red-900/30 border-red-700/50 text-red-300'
                  : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
              )}
            >
              <Ban size={16} className={cancelada ? 'text-red-400' : 'text-dark-muted'}/>
              <div>
                <p className="text-sm font-semibold">{cancelada ? 'Clase suspendida' : 'Suspender clase'}</p>
                <p className="text-xs opacity-70">{cancelada ? 'La clase no se dictó este día' : 'Marcar que la clase no se dictó'}</p>
              </div>
              <div className={clsx(
                'ml-auto w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
                cancelada ? 'bg-red-600' : 'bg-dark-border'
              )}>
                <div className={clsx(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  cancelada ? 'translate-x-5' : 'translate-x-0.5'
                )}/>
              </div>
            </button>

            {/* Profe real (solo si no está cancelada) */}
            {!cancelada && (
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">
                  Profe que da la clase
                </label>
                <select {...register('profe_real')} className="input w-full text-sm">
                  <option value="">Sin cambio / Sin asignar</option>
                  {profes.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Motivo */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Motivo</label>
              <input
                {...register('motivo')}
                placeholder={cancelada ? 'Ej: No hubo clase, feriado, etc.' : 'Ej: Barbi no puede...'}
                className="input w-full text-sm"
              />
            </div>

            {/* Nota */}
            {!cancelada && (
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Nota adicional</label>
                <textarea
                  rows={2}
                  {...register('nota')}
                  placeholder="Observaciones..."
                  className="input w-full text-sm resize-none"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
            )}
          </div>
        </form>

        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className={clsx(
              'w-full flex items-center justify-center gap-2 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm',
              cancelada ? 'bg-red-700 hover:bg-red-600' : 'bg-yellow-700 hover:bg-yellow-600'
            )}
          >
            {saving ? <Loader2 size={16} className="animate-spin"/> : cancelada ? <Ban size={16}/> : <Save size={16}/>}
            {isEdit ? (cancelada ? 'Marcar como suspendida' : 'Actualizar modificación') : (cancelada ? 'Suspender clase' : 'Guardar modificación')}
          </button>
        </div>
      </div>
    </div>
  )
}
