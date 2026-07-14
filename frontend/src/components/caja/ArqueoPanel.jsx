import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  X, Plus, ChevronDown, ChevronUp, Save, Loader2
} from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { money, num } from '../../lib/format'
import { useNegocio } from '../../hooks/useNegocio'

const DENOMINACIONES = [
  { campo: 'cant_20000', valor: 20000 },
  { campo: 'cant_10000', valor: 10000 },
  { campo: 'cant_2000',  valor: 2000  },
  { campo: 'cant_1000',  valor: 1000  },
  { campo: 'cant_500',   valor: 500   },
  { campo: 'cant_200',   valor: 200   },
  { campo: 'cant_100',   valor: 100   },
]

export default function ArqueoPanel({ arqueo, defaultMes, onClose, onSaved }) {
  const { sedeOptions } = useNegocio()
  const isEdit = Boolean(arqueo)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [mostrarBilletes, setMostrarBilletes] = useState(false)

  // Fecha por defecto: hoy o fecha del arqueo
  const hoy = new Date().toISOString().slice(0, 10)

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: isEdit ? {
      fecha:         arqueo.fecha,
      sede:          arqueo.sede,
      saldo_inicial: String(arqueo.saldo_inicial),
      queda_en_caja: String(arqueo.queda_en_caja ?? 0),
      notas:         arqueo.notas || '',
      movimientos:   arqueo.movimientos.map(m => ({
        descripcion: m.descripcion,
        importe:     String(m.importe),
      })),
      cant_20000: arqueo.cant_20000,
      cant_10000: arqueo.cant_10000,
      cant_5000:  arqueo.cant_5000,
      cant_2000:  arqueo.cant_2000,
      cant_1000:  arqueo.cant_1000,
      cant_500:   arqueo.cant_500,
      cant_200:   arqueo.cant_200,
      cant_100:   arqueo.cant_100,
      cant_50:    arqueo.cant_50,
      cant_20:    arqueo.cant_20,
      cant_10:    arqueo.cant_10,
    } : {
      fecha:         hoy,
      sede:          '107',
      saldo_inicial: '0',
      queda_en_caja: '0',
      notas:         '',
      movimientos:   [],
      cant_20000: 0, cant_10000: 0, cant_2000: 0,
      cant_1000: 0, cant_500: 0, cant_200: 0, cant_100: 0,
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'movimientos' })

  // Calcular total de billetes en tiempo real
  const watchBilletes = watch(DENOMINACIONES.map(d => d.campo))
  const totalBilletes = DENOMINACIONES.reduce((sum, d, i) => {
    return sum + (parseInt(watchBilletes[i] || 0, 10) * d.valor)
  }, 0)

  const watchMovs = watch('movimientos')
  const totalIngresos = watchMovs?.reduce((s, m) => {
    const v = parseFloat(m.importe || 0)
    return s + (v > 0 ? v : 0)
  }, 0) || 0
  const totalEgresos = watchMovs?.reduce((s, m) => {
    const v = parseFloat(m.importe || 0)
    return s + (v < 0 ? Math.abs(v) : 0)
  }, 0) || 0
  const saldoInicial  = parseFloat(watch('saldo_inicial')  || 0)
  const quedaEnCaja   = parseFloat(watch('queda_en_caja')  || 0)
  // Lo que debería contar = saldo_inicial + ingresos netos − queda_en_caja
  const esperadoConteo = saldoInicial + totalIngresos - totalEgresos - quedaEnCaja
  const diferencia     = totalBilletes - esperadoConteo

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const payload = {
        fecha:         data.fecha,
        sede:          data.sede,
        saldo_inicial: parseFloat(data.saldo_inicial)  || 0,
        queda_en_caja: parseFloat(data.queda_en_caja)  || 0,
        notas:         data.notas,
        movimientos:  data.movimientos.map((m) => ({
          descripcion: m.descripcion,
          importe:     parseFloat(m.importe) || 0,
        })),
        ...Object.fromEntries(
          DENOMINACIONES.map(d => [d.campo, parseInt(data[d.campo] || 0, 10)])
        ),
      }
      if (isEdit) {
        await api.put(`/caja/arqueos/${arqueo.id}/`, payload)
      } else {
        await api.post('/caja/arqueos/', payload)
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

  // Cerrar con Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">
              {isEdit ? 'Editar arqueo' : 'Nuevo arqueo'}
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">
              Registrá movimientos e ingresá el conteo de billetes
            </p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Fecha + sede */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Fecha</label>
                <input
                  type="date"
                  {...register('fecha', { required: true })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Sede</label>
                <select {...register('sede')} className="input w-full text-sm">
                  {sedeOptions.map(s => (
                    <option key={s.val} value={s.val}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Saldo inicial */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Saldo inicial en caja ($)</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                {...register('saldo_inicial')}
                className="input w-full text-sm"
              />
            </div>

            {/* Movimientos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-dark-muted font-medium uppercase tracking-wider">
                  Movimientos
                </label>
              </div>

              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <input
                      placeholder="Descripción (opcional)"
                      {...register(`movimientos.${idx}.descripcion`)}
                      className="input flex-1 text-sm py-2"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Importe"
                      title="Positivo = ingreso, negativo = egreso"
                      {...register(`movimientos.${idx}.importe`, { required: true })}
                      className="input w-28 text-sm py-2"
                    />
                    <button
                      type="button"
                      onClick={() => append({ descripcion: '', importe: '' })}
                      className="p-2 text-dark-muted hover:text-orange-400 transition-colors mt-0.5"
                      title="Agregar fila"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}

                {/* Botón inicial si no hay filas */}
                {fields.length === 0 && (
                  <button
                    type="button"
                    onClick={() => append({ descripcion: '', importe: '' })}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 border border-dashed border-dark-border rounded-xl py-3 transition-colors"
                  >
                    <Plus size={13} /> Agregar movimiento
                  </button>
                )}

                {/* Subtotales */}
                {fields.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-dark-border flex justify-between text-xs">
                    <span className="text-green-400">Ingresos: {money(totalIngresos)}</span>
                    <span className="text-red-400">Egresos: {money(totalEgresos)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Conteo de billetes (colapsable) */}
            <div className="border border-dark-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setMostrarBilletes(b => !b)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-dark-muted hover:text-dark-text transition-colors"
              >
                <span>Conteo de billetes</span>
                <div className="flex items-center gap-2">
                  {totalBilletes > 0 && (
                    <span className="text-xs text-dark-text font-bold">{money(totalBilletes)}</span>
                  )}
                  {mostrarBilletes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {mostrarBilletes && (
                <div className="px-4 pb-4 pt-1 border-t border-dark-border space-y-2">
                  {DENOMINACIONES.map(({ campo, valor }) => {
                    const cant = parseInt(watch(campo) || 0, 10)
                    const sub  = cant * valor
                    return (
                      <div key={campo} className="flex items-center gap-3">
                        <label className="text-xs text-dark-muted w-16 text-right">
                          ${num(valor)}
                        </label>
                        <input
                          type="number"
                          min="0"
                          {...register(campo, { valueAsNumber: true })}
                          className="input w-20 text-sm py-1.5 text-center"
                        />
                        <span className="text-xs text-dark-muted flex-1 text-right">
                          {sub > 0 ? money(sub) : '—'}
                        </span>
                      </div>
                    )
                  })}

                  {/* Total billetes + verificación */}
                  <div className="mt-3 pt-3 border-t border-dark-border space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-muted">Total conteo</span>
                      <span className="font-bold text-dark-text">{money(totalBilletes)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-dark-muted">
                      <span>Esperado (si cuadra)</span>
                      <span>{money(esperadoConteo)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-dark-border">
                      <span className="text-dark-muted">Diferencia</span>
                      <span className={clsx(
                        'font-semibold',
                        diferencia === 0 ? 'text-green-400' :
                        diferencia > 0  ? 'text-blue-400' : 'text-red-400'
                      )}>
                        {diferencia === 0 ? '✓ Cuadra' : (diferencia > 0 ? '+' : '') + money(diferencia)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Queda en caja */}
            <div className="border border-dark-border rounded-xl px-4 py-3 bg-dark-bg/40">
              <label className="block text-xs text-dark-muted font-medium mb-1.5">
                💰 Queda en caja
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  {...register('queda_en_caja')}
                  className="input w-full pl-7 text-sm"
                />
              </div>
              <p className="text-xs text-dark-muted mt-1.5">
                El conteo de billetes debería ser{' '}
                <span className="text-dark-text font-semibold">{money(esperadoConteo)}</span>
                {' '}para que cuadre.
              </p>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Notas</label>
              <textarea
                rows={2}
                placeholder="Observaciones del arqueo..."
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
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Guardar cambios' : 'Crear arqueo'}
          </button>
        </div>
      </div>
    </div>
  )
}
