import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Save, Loader2, Plus } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { money } from '../../lib/format'
import { useDisciplinas } from '../../hooks/useDisciplinas'
import { useNegocio } from '../../hooks/useNegocio'

const TIPOS = [
  { val: 'hora',       label: 'Por hora' },
  { val: 'fijo',       label: 'Sueldo fijo' },
  { val: 'porcentaje', label: '% recaudación' },
  { val: 'mixto',      label: 'Horas + % recaudación' },
]

const COLORES = [
  '#22d3ee', '#ec4899', '#f59e0b', '#a78bfa',
  '#34d399', '#60a5fa', '#f97316', '#e879f9',
  '#fbbf24', '#f43f5e', '#6b7280', '#10b981',
]

const hoyMes = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ProfePanel({ profe, onClose, onSaved }) {
  const { sedeOptions } = useNegocio()
  const SEDES = [
    ...sedeOptions,
    { val: 'ambas',   label: 'Ambas sedes' },
    { val: 'general', label: 'General (gerencia)' },
  ]
  const isEdit = Boolean(profe)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [savingTarifa, setSavingTarifa] = useState(false)
  const [errorTarifa,  setErrorTarifa]  = useState('')
  const [okTarifa,     setOkTarifa]     = useState(false)
  const [discLiquidables, setDiscLiquidables] = useState(profe?.disciplinas_liquidables ?? [])

  const { discs } = useDisciplinas({ soloActivas: true })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: isEdit ? {
      nombre:           profe.nombre,
      color:            profe.color,
      sede:             profe.sede,
      tipo_liquidacion: profe.tipo_liquidacion,
      fecha_inicio:     profe.fecha_inicio,
      activo:           profe.activo,
      notas:            profe.notas || '',
    } : {
      nombre: '', color: '#22d3ee', sede: 'ambas',
      tipo_liquidacion: 'hora',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      activo: true, notas: '',
    }
  })

  // Tarifa del mes actual (edición)
  const vh = profe?.valor_mes_actual
  const [tarifa, setTarifa] = useState({
    mes:         hoyMes(),
    valor_hora:  vh?.valor_hora  ?? '',
    sueldo_fijo: vh?.sueldo_fijo ?? '',
    porcentaje:  vh?.porcentaje  ?? '',
    base:        vh?.base        ?? '',
  })

  const tipoLiq = watch('tipo_liquidacion')
  const colorSel = watch('color')
  const montoPorcentajePreview = (parseFloat(tarifa.porcentaje) || 0) * (parseFloat(tarifa.base) || 0) / 100

  async function onSubmit(data) {
    setSaving(true); setError('')
    try {
      const payload = { ...data, activo: data.activo, disciplinas_liquidables: discLiquidables }
      if (isEdit) {
        await api.patch(`/profes/${profe.id}/`, payload)
      } else {
        await api.post('/profes/', payload)
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

  async function guardarTarifa() {
    if (!profe) return
    setSavingTarifa(true); setErrorTarifa(''); setOkTarifa(false)
    try {
      await api.post(`/profes/${profe.id}/tarifa/`, {
        mes:         tarifa.mes,
        valor_hora:  tarifa.valor_hora  || null,
        sueldo_fijo: tarifa.sueldo_fijo || null,
        porcentaje:  tarifa.porcentaje  || null,
        base:        tarifa.base        || null,
      })
      setOkTarifa(true)
      setTimeout(() => setOkTarifa(false), 2000)
    } catch (e) {
      setErrorTarifa('Error al guardar tarifa.')
    } finally {
      setSavingTarifa(false)
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
          <div className="flex items-center gap-3">
            {colorSel && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: colorSel }}
              >
                {watch('nombre')?.slice(0, 2).toUpperCase() || '??'}
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-dark-text">
                {isEdit ? profe.nombre : 'Nuevo profe'}
              </h2>
              <p className="text-xs text-dark-muted">Datos y tarifa</p>
            </div>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Nombre */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Nombre *</label>
              <input
                {...register('nombre', { required: true })}
                placeholder="Ej: Mario"
                className={clsx('input w-full text-sm', errors.nombre && 'border-red-500')}
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c)}
                    className={clsx(
                      'w-7 h-7 rounded-lg transition-all',
                      colorSel === c ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-surface scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Sede + Tipo liquidación */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Sede</label>
                <select {...register('sede')} className="input w-full text-sm">
                  {SEDES.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Liquidación</label>
                <select {...register('tipo_liquidacion')} className="input w-full text-sm">
                  {TIPOS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Fecha inicio + Activo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Fecha inicio *</label>
                <input
                  type="date"
                  {...register('fecha_inicio', { required: true })}
                  className="input w-full text-sm"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('activo')} className="w-4 h-4 accent-green-500" />
                  <span className="text-sm text-dark-text">Activo</span>
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
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
            )}

            {/* ── Sección tarifa (solo en edición) ── */}
            {isEdit && (
              <div className="border-t border-dark-border pt-5 space-y-4">
                <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
                  Tarifa por mes
                </p>

                {/* Historial rápido */}
                {profe.valores_hora?.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {profe.valores_hora.slice(0, 6).map(v => (
                      <div key={v.id} className="flex justify-between text-xs text-dark-muted px-1">
                        <span>{v.mes.slice(5, 7)}/{v.mes.slice(0, 4)}</span>
                        <span className="text-dark-text font-medium">
                          {tipoLiq === 'hora'       && v.valor_hora  && `${money(v.valor_hora)}/h`}
                          {tipoLiq === 'fijo'       && v.sueldo_fijo && money(v.sueldo_fijo)}
                          {tipoLiq === 'porcentaje' && v.porcentaje  && `${v.porcentaje}% de ${money(v.base ?? 0)}`}
                          {tipoLiq === 'mixto'      && `${v.sueldo_fijo ? money(v.sueldo_fijo) : '$0'}${v.porcentaje ? ' + '+v.porcentaje+'% de '+money(v.base ?? 0) : ''}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mes selector */}
                <div>
                  <label className="block text-xs text-dark-muted font-medium mb-1.5">Mes</label>
                  <input
                    type="month"
                    value={tarifa.mes}
                    onChange={e => setTarifa(t => ({ ...t, mes: e.target.value }))}
                    className="input w-full text-sm"
                  />
                </div>

                {/* Disciplinas que cuentan como horas (solo hora / mixto) */}
                {(tipoLiq === 'hora' || tipoLiq === 'mixto') && (
                  <div>
                    <label className="block text-xs text-dark-muted font-medium mb-1.5">
                      Disciplinas que cuentan como horas
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {discs.map(d => {
                        const activo = discLiquidables.includes(d.codigo)
                        return (
                          <button
                            key={d.codigo}
                            type="button"
                            onClick={() => setDiscLiquidables(list =>
                              activo ? list.filter(c => c !== d.codigo) : [...list, d.codigo]
                            )}
                            className={clsx(
                              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                              activo
                                ? 'bg-violet-900/30 text-violet-300 border-violet-700/50'
                                : 'bg-dark-bg text-dark-muted border-dark-border hover:text-dark-text'
                            )}
                          >
                            {d.nombre}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-dark-muted mt-1.5">
                      Ninguna marcada = cuentan todas las disciplinas.
                    </p>
                  </div>
                )}

                {/* Valor según tipo */}
                {tipoLiq === 'hora' && (
                  <div>
                    <label className="block text-xs text-dark-muted font-medium mb-1.5">Valor por hora ($)</label>
                    <input
                      type="number" step="any" placeholder="0"
                      value={tarifa.valor_hora}
                      onChange={e => setTarifa(t => ({ ...t, valor_hora: e.target.value }))}
                      className="input w-full text-sm"
                    />
                  </div>
                )}
                {(tipoLiq === 'fijo' || tipoLiq === 'mixto') && (
                  <div>
                    <label className="block text-xs text-dark-muted font-medium mb-1.5">
                      {tipoLiq === 'mixto' ? 'Horas — monto fijo del mes ($)' : 'Sueldo fijo ($)'}
                    </label>
                    <input
                      type="number" step="any" placeholder="0"
                      value={tarifa.sueldo_fijo}
                      onChange={e => setTarifa(t => ({ ...t, sueldo_fijo: e.target.value }))}
                      className="input w-full text-sm"
                    />
                  </div>
                )}
                {(tipoLiq === 'porcentaje' || tipoLiq === 'mixto') && (
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-dark-muted font-medium mb-1.5">Porcentaje (%)</label>
                        <input
                          type="number" step="any" placeholder="50"
                          value={tarifa.porcentaje}
                          onChange={e => setTarifa(t => ({ ...t, porcentaje: e.target.value }))}
                          className="input w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-dark-muted font-medium mb-1.5">Base ($)</label>
                        <input
                          type="number" step="any" placeholder="0"
                          value={tarifa.base}
                          onChange={e => setTarifa(t => ({ ...t, base: e.target.value }))}
                          className="input w-full text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 px-1 text-xs">
                      <span className="text-dark-muted">
                        {tarifa.porcentaje || 0}% de {money(tarifa.base || 0)}
                      </span>
                      <span className="text-green-400 font-bold">= {money(montoPorcentajePreview)}</span>
                    </div>
                    {tipoLiq === 'mixto' && (
                      <div className="flex justify-between items-center mt-1 px-1 text-xs border-t border-dark-border pt-1.5">
                        <span className="text-dark-muted">Horas ({money(tarifa.sueldo_fijo || 0)}) + Porcentaje</span>
                        <span className="text-dark-text font-bold">
                          Total = {money((parseFloat(tarifa.sueldo_fijo) || 0) + montoPorcentajePreview)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {errorTarifa && (
                  <p className="text-xs text-red-400">{errorTarifa}</p>
                )}

                <button
                  type="button"
                  onClick={guardarTarifa}
                  disabled={savingTarifa}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors border',
                    okTarifa
                      ? 'bg-green-900/40 text-green-400 border-green-800/40'
                      : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-text/30'
                  )}
                >
                  {savingTarifa
                    ? <Loader2 size={14} className="animate-spin" />
                    : okTarifa ? '✓ Guardada' : <><Plus size={14} /> Guardar tarifa</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Guardar cambios' : 'Crear profe'}
          </button>
        </div>
      </div>
    </div>
  )
}
