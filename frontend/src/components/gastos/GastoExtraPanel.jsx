import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { money } from '../../lib/format'

const SEDES = [
  { val: '107', label: 'Athlon 107' },
  { val: '24',  label: 'Athlon 24' },
]

function hoy() { return new Date().toISOString().slice(0, 10) }

export default function GastoExtraPanel({ extra, mes, onClose, onSaved }) {
  const isEdit = Boolean(extra)

  const [sede,     setSede]     = useState(extra?.sede     ?? '107')
  const [concepto, setConcepto] = useState(extra?.concepto ?? '')
  const [precioU,  setPrecioU]  = useState(extra?.precio_unitario ?? '')
  const [cantidad, setCantidad] = useState(extra?.cantidad  ?? 1)
  const [fecha,    setFecha]    = useState(extra?.fecha     ?? hoy())
  const [notas,    setNotas]    = useState(extra?.notas     ?? '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const total = (parseFloat(precioU || 0) * parseFloat(cantidad || 1))

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!concepto.trim()) { setError('Ingresá un concepto'); return }
    if (!precioU || parseFloat(precioU) <= 0) { setError('Ingresá un precio unitario válido'); return }
    setSaving(true); setError('')

    const payload = {
      mes: `${mes}-01`,
      sede,
      concepto: concepto.trim(),
      precio_unitario: parseFloat(precioU),
      cantidad: parseFloat(cantidad) || 1,
      fecha,
      notas,
    }

    try {
      if (isEdit) {
        await api.put(`/caja/gastos/extras/${extra.id}/`, payload)
      } else {
        await api.post('/caja/gastos/extras/', payload)
      }
      onSaved()
    } catch (e) {
      const msg = e.response?.data
      setError(typeof msg === 'object' ? Object.values(msg).flat()[0] : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="w-full max-w-sm bg-dark-surface border-l border-dark-border flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">
              {isEdit ? 'Editar gasto extra' : 'Nuevo gasto extra'}
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">Con precio unitario y cantidad</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Sede */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-2">Sede</label>
            <div className="flex gap-2">
              {SEDES.map(s => (
                <label key={s.val} className="flex-1">
                  <input type="radio" value={s.val} checked={sede === s.val}
                    onChange={() => setSede(s.val)} className="sr-only"/>
                  <div className={clsx(
                    'text-center py-2 rounded-xl border cursor-pointer text-sm font-medium transition-colors',
                    sede === s.val
                      ? 'bg-indigo-700 border-indigo-600 text-white'
                      : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                  )}>
                    {s.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Concepto *</label>
            <input
              type="text"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              placeholder="Ej: Compra escobas, Reparación pared..."
              className="input w-full text-sm"
              autoFocus
            />
          </div>

          {/* Precio unitario + Cantidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Precio unitario *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={precioU}
                  onChange={e => setPrecioU(e.target.value)}
                  placeholder="0"
                  className="input w-full pl-7 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Cantidad</label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
          </div>

          {/* Total calculado */}
          {total > 0 && (
            <div className="bg-dark-bg rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-dark-muted">Total</span>
              <span className="text-base font-bold text-orange-400">{money(total)}</span>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="input w-full text-sm"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Notas</label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Opcional"
              className="input w-full text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-orange-800 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            {isEdit ? 'Guardar cambios' : 'Agregar gasto extra'}
          </button>
        </div>
      </div>
    </div>
  )
}
