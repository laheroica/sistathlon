import { useState } from 'react'
import { X, Lock, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { money } from '../../lib/format'

const HOY = new Date().toISOString().slice(0, 10)

export default function CierreMesPanel({ profes, mes, mesLabel, onClose, onCerrado }) {
  // Estado editable por profe: { [profe_id]: { monto_final, notas } }
  const [ajustes, setAjustes] = useState(() => {
    const init = {}
    profes.forEach(p => {
      // montoAcumulado (dadas) como base del cierre
      const clases   = p.clases ?? []
      const dadas    = clases.filter(c => c.fecha <= HOY)
      const totalMes = clases.length
      const n        = dadas.length
      let monto = 0
      if (p.tipo_liquidacion === 'hora') monto = n * p.valor_hora
      else if (p.tipo_liquidacion === 'fijo') monto = totalMes > 0 ? p.monto_calculado * n / totalMes : 0
      init[p.profe_id] = { monto_final: Math.round(monto), notas: p.notas || '' }
    })
    return init
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const totalCierre = Object.values(ajustes).reduce((s, a) => s + (parseFloat(a.monto_final) || 0), 0)

  function setMonto(pid, val) {
    setAjustes(prev => ({ ...prev, [pid]: { ...prev[pid], monto_final: val } }))
  }
  function setNotas(pid, val) {
    setAjustes(prev => ({ ...prev, [pid]: { ...prev[pid], notas: val } }))
  }

  async function handleCerrar() {
    setSaving(true)
    setError('')
    try {
      await api.post('/liquidaciones/cerrar-mes/', {
        mes,
        ajustes: profes.map(p => ({
          profe_id:    p.profe_id,
          monto_final: parseFloat(ajustes[p.profe_id]?.monto_final) || 0,
          notas:       ajustes[p.profe_id]?.notas || '',
        })),
      })
      onCerrado()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al cerrar el mes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-dark-surface border-l border-dark-border flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-green-400" />
            <div>
              <h2 className="text-base font-bold text-dark-text">Cerrar mes</h2>
              <p className="text-xs text-dark-muted mt-0.5">{mesLabel} — confirma y congela los montos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18} />
          </button>
        </div>

        {/* Aviso */}
        <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-3 flex-shrink-0">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Los montos se calcularon en base a las clases <strong>dadas hasta hoy</strong>.
            Podés ajustar cualquier importe antes de confirmar.
          </p>
        </div>

        {/* Lista de profes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {profes.map(p => {
            const aj = ajustes[p.profe_id] ?? {}
            const clases = p.clases ?? []
            const dadas  = clases.filter(c => c.fecha <= HOY)
            const d107   = dadas.filter(c => c.sede === '107').length
            const d24    = dadas.filter(c => c.sede === '24').length

            return (
              <div key={p.profe_id} className="bg-dark-bg border border-dark-border rounded-xl p-4 space-y-3">
                {/* Nombre + tipo + horas */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: p.profe_color || '#6b7280' }}
                  >
                    {p.profe_nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-dark-text">{p.profe_nombre}</span>
                  <span className="text-xs text-dark-muted">
                    {d107 > 0 && <span className="text-indigo-400 mr-1">A107 {d107}h</span>}
                    {d24  > 0 && <span className="text-cyan-400">A24 {d24}h</span>}
                  </span>
                </div>

                {/* Monto final editable */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-dark-muted w-20 flex-shrink-0">Monto final</label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={aj.monto_final ?? ''}
                      onChange={e => setMonto(p.profe_id, e.target.value)}
                      className="input w-full pl-7 text-sm py-2"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-dark-muted w-20 flex-shrink-0">Notas</label>
                  <input
                    type="text"
                    value={aj.notas ?? ''}
                    onChange={e => setNotas(p.profe_id, e.target.value)}
                    placeholder="Opcional"
                    className="input flex-1 text-sm py-2"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0 space-y-3">
          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-muted">Total a pagar</span>
            <span className="text-xl font-bold text-green-400">{money(totalCierre)}</span>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleCerrar}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving
              ? <Loader2 size={16} className="animate-spin" />
              : <CheckCircle size={16} />
            }
            Confirmar cierre de {mesLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
