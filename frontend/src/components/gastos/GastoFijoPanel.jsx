import { useState, useEffect } from 'react'
import { X, Save, Loader2, Split } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'

const SEDES = [
  { val: '107', label: 'Athlon 107' },
  { val: '24',  label: 'Athlon 24' },
]

function hoy() { return new Date().toISOString().slice(0, 10) }

export default function GastoFijoPanel({ concepto, gasto, mes, onClose, onSaved }) {
  const isEdit = Boolean(gasto)
  const [sede,    setSede]    = useState(gasto?.sede    ?? '107')
  const [importe, setImporte] = useState(gasto ? String(parseFloat(gasto.importe)) : '')
  const [fecha,   setFecha]   = useState(gasto?.fecha   ?? hoy())
  const [notas,   setNotas]   = useState(gasto?.notas   ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const esCompartido = concepto.compartido && !isEdit

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!importe || parseFloat(importe) <= 0) { setError('Ingresá un importe válido'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await api.patch(`/caja/gastos/fijos/${gasto.id}/`, { importe, fecha, notas, sede })
      } else {
        await api.post('/caja/gastos/fijos/crear/', {
          concepto: concepto.val,
          mes,
          sede: esCompartido ? undefined : sede,
          importe,
          fecha,
          notas,
        })
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar')
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
              {isEdit ? `Editar — ${concepto.label}` : concepto.label}
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">
              {esCompartido
                ? 'Se divide automáticamente entre ambas sedes'
                : isEdit ? 'Modificar importe, fecha o notas' : 'Gasto fijo mensual'}
            </p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Banner compartido */}
          {esCompartido && (
            <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-3">
              <Split size={14} className="text-amber-400 mt-0.5 flex-shrink-0"/>
              <p className="text-xs text-amber-300">
                El importe ingresado se divide en dos: <strong>mitad para A107</strong> y <strong>mitad para A24</strong>.
              </p>
            </div>
          )}

          {/* Sede (solo para no-compartidos) */}
          {!esCompartido && (
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
          )}

          {/* Importe */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">
              Importe {esCompartido ? 'total (se divide ÷2)' : ''}*
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={importe}
                onChange={e => setImporte(e.target.value)}
                placeholder="0"
                className="input w-full pl-7 text-sm"
                autoFocus
              />
            </div>
            {esCompartido && importe > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                → ${(parseFloat(importe || 0) / 2).toLocaleString('es-AR')} por sede
              </p>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Fecha de pago</label>
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
            className="w-full flex items-center justify-center gap-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            {isEdit ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}
