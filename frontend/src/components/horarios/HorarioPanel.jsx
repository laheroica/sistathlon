import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Save, Loader2, CalendarClock } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'

const DIAS = [
  { val: 'lun', label: 'Lunes' },
  { val: 'mar', label: 'Martes' },
  { val: 'mie', label: 'Miércoles' },
  { val: 'jue', label: 'Jueves' },
  { val: 'vie', label: 'Viernes' },
  { val: 'sab', label: 'Sábado' },
]

const DISCIPLINAS = [
  { val: 'CF', label: 'CrossFit' },
  { val: 'HF', label: 'Heavy Funcional' },
  { val: 'HX', label: 'Hyrox' },
  { val: 'TN', label: 'Teens' },
  { val: 'KD', label: 'Kids' },
  { val: 'BP', label: 'Bonus Pack' },
]

const SEDES = [
  { val: '107', label: 'Athlon 107' },
  { val: '24',  label: 'Athlon 24' },
]

function toISO(d) { return d.toISOString().slice(0, 10) }

function proximoLunes() {
  const hoy = new Date()
  const dow = hoy.getDay()                     // 0=dom … 6=sab
  const dias = dow === 0 ? 1 : 8 - dow        // días hasta el próximo lunes
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() + dias)
  return toISO(lunes)
}

export default function HorarioPanel({ horario, defaultDia, defaultSede, profes, onClose, onSaved }) {
  const isEdit = Boolean(horario)

  const hoy   = toISO(new Date())
  const lunes = proximoLunes()

  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [fechaDesde,  setFechaDesde]  = useState(isEdit ? lunes : hoy)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: isEdit ? {
      sede:          horario.sede,
      dia:           horario.dia,
      hora:          horario.hora_str,
      disciplina:    horario.disciplina,
      profe:         horario.profe ?? '',
      capacidad_max: horario.capacidad_max,
      activo:        horario.activo,
    } : {
      sede:          defaultSede ?? '107',
      dia:           defaultDia  ?? 'lun',
      hora:          '07:00',
      disciplina:    'CF',
      profe:         '',
      capacidad_max: 21,
      activo:        true,
    }
  })

  const sedeVal = watch('sede')
  const diaVal  = watch('dia')

  async function onSubmit(data) {
    setSaving(true); setError('')
    try {
      const payload = {
        ...data,
        profe:         data.profe || null,
        capacidad_max: parseInt(data.capacidad_max) || 21,
        fecha_desde:   fechaDesde,
      }

      // Siempre POST: el backend hace update_or_create, nunca falla por unique
      await api.post('/horarios/maestro/', payload)
      onSaved()
    } catch (e) {
      const msg = e.response?.data
      if (typeof msg === 'object') {
        const first = Object.values(msg).flat()[0]
        setError(typeof first === 'string' ? first : 'Error al guardar.')
      } else {
        setError('Error al guardar.')
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
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">
              {isEdit ? 'Editar clase' : 'Nueva clase'}
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">Grilla maestra</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-4">

            {/* Sede */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-2">Sede</label>
              <div className="flex gap-2">
                {SEDES.map(s => (
                  <label key={s.val} className="flex-1">
                    <input type="radio" value={s.val} {...register('sede')} className="sr-only" />
                    <div className={clsx(
                      'text-center py-2 rounded-xl border cursor-pointer text-sm font-medium transition-colors',
                      sedeVal === s.val
                        ? 'bg-indigo-700 border-indigo-600 text-white'
                        : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                    )}>
                      {s.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Día */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-2">Día</label>
              <div className="grid grid-cols-3 gap-2">
                {DIAS.map(d => (
                  <label key={d.val}>
                    <input type="radio" value={d.val} {...register('dia')} className="sr-only" />
                    <div className={clsx(
                      'text-center py-2 rounded-xl border cursor-pointer text-xs font-medium transition-colors',
                      diaVal === d.val
                        ? 'bg-indigo-700 border-indigo-600 text-white'
                        : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                    )}>
                      {d.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Hora */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Horario *</label>
              <input
                type="time"
                {...register('hora', { required: true })}
                className={clsx('input w-full text-sm', errors.hora && 'border-red-500')}
              />
            </div>

            {/* Disciplina */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-2">Disciplina</label>
              <select {...register('disciplina')} className="input w-full text-sm">
                {DISCIPLINAS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
              </select>
            </div>

            {/* Profe */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Profe</label>
              <select {...register('profe')} className="input w-full text-sm">
                <option value="">Sin asignar</option>
                {profes.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Capacidad + Activo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Capacidad máx.</label>
                <input type="number" min="1" {...register('capacidad_max')} className="input w-full text-sm" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('activo')} className="w-4 h-4 accent-indigo-500" />
                  <span className="text-sm text-dark-text">Activo</span>
                </label>
              </div>
            </div>

            {/* Vigente desde */}
            <div className="border-t border-dark-border pt-4">
              <label className="block text-xs text-dark-muted font-medium mb-2 flex items-center gap-1.5">
                <CalendarClock size={12}/>
                Vigente desde
              </label>
              {/* Atajos rápidos */}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFechaDesde(hoy)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    fechaDesde === hoy
                      ? 'bg-indigo-700 border-indigo-600 text-white'
                      : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                  )}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setFechaDesde(lunes)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    fechaDesde === lunes
                      ? 'bg-indigo-700 border-indigo-600 text-white'
                      : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                  )}
                >
                  Próximo lunes
                </button>
              </div>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                className="input w-full text-sm"
              />
              <p className="text-xs text-dark-muted mt-1.5">
                {isEdit
                  ? 'Se crea una nueva versión — las liquidaciones anteriores no cambian.'
                  : 'Fecha a partir de la cual esta clase aparece en el calendario.'}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Guardar nueva versión' : 'Agregar clase'}
          </button>
        </div>
      </div>
    </div>
  )
}
