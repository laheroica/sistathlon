import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Save, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { useNegocio } from '../../hooks/useNegocio'

const DISCIPLINAS = [
  { val: 'CF', label: 'CrossFit' },
  { val: 'HF', label: 'Heavy Funcional' },
  { val: 'HX', label: 'Hyrox' },
  { val: 'TN', label: 'Teens' },
  { val: 'KD', label: 'Kids' },
  { val: 'BP', label: 'Bonus Pack' },
]

const TIPOS = [
  { val: 'clase',    label: 'Clase suelta' },
  { val: 'semana',   label: 'Semana' },
  { val: 'quincena', label: 'Quincena' },
  { val: 'mes',      label: 'Mes completo' },
]

// Calcula fecha_fin según tipo a partir de fecha_inicio
function calcularFechaFin(fechaInicio, tipo) {
  if (!fechaInicio) return ''
  const d = new Date(fechaInicio + 'T12:00:00')
  if (tipo === 'clase')    d.setDate(d.getDate())        // mismo día
  if (tipo === 'semana')   d.setDate(d.getDate() + 6)
  if (tipo === 'quincena') d.setDate(d.getDate() + 13)
  if (tipo === 'mes')      d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function TemporalPanel({ temporal, onClose, onSaved }) {
  const { sedeOptions } = useNegocio()
  const isEdit = Boolean(temporal)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const hoy = new Date().toISOString().slice(0, 10)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: isEdit ? {
      nombre:      temporal.nombre,
      dni:         temporal.dni || '',
      celular:     temporal.celular || '',
      sede:        temporal.sede,
      disciplina:  temporal.disciplina,
      tipo:        temporal.tipo,
      fecha_inicio: temporal.fecha_inicio,
      fecha_fin:    temporal.fecha_fin || '',
      monto:       String(temporal.monto),
      pagado:      temporal.pagado,
      notas:       temporal.notas || '',
    } : {
      nombre: '', dni: '', celular: '',
      sede: '107', disciplina: 'CF', tipo: 'semana',
      fecha_inicio: hoy, fecha_fin: '',
      monto: '', pagado: false, notas: '',
    }
  })

  const watchTipo       = watch('tipo')
  const watchFechaInicio = watch('fecha_inicio')

  // Auto-calcular fecha_fin cuando cambia tipo o fecha_inicio
  useEffect(() => {
    if (!isEdit && watchFechaInicio && watchTipo) {
      setValue('fecha_fin', calcularFechaFin(watchFechaInicio, watchTipo))
    }
  }, [watchTipo, watchFechaInicio, isEdit])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const payload = {
        nombre:      data.nombre.trim(),
        dni:         data.dni.trim(),
        celular:     data.celular.trim(),
        sede:        data.sede,
        disciplina:  data.disciplina,
        tipo:        data.tipo,
        fecha_inicio: data.fecha_inicio,
        fecha_fin:    data.fecha_fin || null,
        monto:       parseFloat(data.monto) || 0,
        pagado:      data.pagado,
        notas:       data.notas.trim(),
      }
      if (isEdit) {
        await api.put(`/temporales/${temporal.id}/`, payload)
      } else {
        await api.post('/temporales/', payload)
      }
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
      <div className="w-full max-w-md bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">
              {isEdit ? 'Editar temporal' : 'Nuevo temporal'}
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">Clase suelta, semana, quincena o mes</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-4">

            {/* Nombre */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Nombre *</label>
              <input
                {...register('nombre', { required: true })}
                placeholder="Nombre completo"
                className={clsx('input w-full text-sm', errors.nombre && 'border-red-500')}
              />
            </div>

            {/* DNI + Celular */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">DNI</label>
                <input {...register('dni')} placeholder="Opcional" className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Celular</label>
                <input {...register('celular')} placeholder="Opcional" className="input w-full text-sm" />
              </div>
            </div>

            {/* Sede + Disciplina */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Sede</label>
                <select {...register('sede')} className="input w-full text-sm">
                  {sedeOptions.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Disciplina</label>
                <select {...register('disciplina')} className="input w-full text-sm">
                  {DISCIPLINAS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-2">Tipo de pase</label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map(t => (
                  <label
                    key={t.val}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm',
                      watch('tipo') === t.val
                        ? 'bg-sky-900/40 border-sky-700/50 text-sky-300'
                        : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                    )}
                  >
                    <input type="radio" value={t.val} {...register('tipo')} className="sr-only" />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Fecha inicio *</label>
                <input
                  type="date"
                  {...register('fecha_inicio', { required: true })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Fecha fin</label>
                <input
                  type="date"
                  {...register('fecha_fin')}
                  className="input w-full text-sm"
                />
              </div>
            </div>

            {/* Monto + Pagado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Monto ($) *</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  {...register('monto', { required: true })}
                  className={clsx('input w-full text-sm', errors.monto && 'border-red-500')}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('pagado')} className="w-4 h-4 accent-green-500" />
                  <span className="text-sm text-dark-text">Ya pagó</span>
                </label>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Notas</label>
              <textarea
                rows={2}
                placeholder="Observaciones..."
                {...register('notas')}
                className="input w-full text-sm resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Guardar cambios' : 'Registrar temporal'}
          </button>
        </div>
      </div>
    </div>
  )
}
