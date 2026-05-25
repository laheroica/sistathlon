import { useState } from 'react'
import { X, Save, CheckCircle, Banknote, Loader2, AlertTriangle, Clock } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { money } from '../../lib/format'

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus' }
const DISC_COLOR = { CF: '#3b82f6', HF: '#22c55e', HX: '#eab308', TN: '#a855f7', KD: '#ec4899', BP: '#0ea5e9' }

const HOY = new Date().toISOString().slice(0, 10)   // 'YYYY-MM-DD'

export default function LiquidacionPanel({ profe: p, mes, mesLabel, onClose, onSaved }) {
  const clases       = p.clases ?? []
  const dadas        = clases.filter(c => c.fecha <= HOY)
  const proyectadas  = clases.filter(c => c.fecha >  HOY)

  // Montos reales (solo clases dadas)
  const montoDado = p.tipo_liquidacion === 'hora'
    ? Math.round(dadas.length * p.valor_hora)
    : p.tipo_liquidacion === 'fijo'
      ? Math.round(p.sueldo_fijo)
      : 0  // porcentaje: manual

  const [montoFinal, setMontoFinal] = useState(String(p.monto_final ?? montoDado))
  const [notas, setNotas]           = useState(p.notas ?? '')
  const [saving, setSaving]         = useState(false)
  const [error,  setError]          = useState('')

  const montoNum = parseFloat(String(montoFinal).replace(/\./g, '').replace(',', '.')) || 0

  // Desglose sedes — solo dadas
  const d107 = dadas.filter(c => c.sede === '107').length
  const d24  = dadas.filter(c => c.sede === '24').length
  const p107 = proyectadas.filter(c => c.sede === '107').length
  const p24  = proyectadas.filter(c => c.sede === '24').length

  // Agrupar por fecha
  function agruparPorFecha(lista) {
    const acc = {}
    lista.forEach(c => { acc[c.fecha] = acc[c.fecha] || []; acc[c.fecha].push(c) })
    return acc
  }
  const porFechaDadas       = agruparPorFecha(dadas)
  const porFechaProyectadas = agruparPorFecha(proyectadas)
  const fechasDadas         = Object.keys(porFechaDadas).sort()
  const fechasProyectadas   = Object.keys(porFechaProyectadas).sort()

  async function guardar(confirmar = false) {
    setSaving(true); setError('')
    try {
      await api.post('/liquidaciones/guardar/', {
        profe_id:        p.profe_id,
        mes,
        clases_dadas:    dadas.length,
        valor_hora:      p.valor_hora,
        sueldo_fijo:     p.sueldo_fijo,
        porcentaje:      p.porcentaje,
        monto_calculado: montoDado,
        monto_final:     montoNum,
        notas:           notas.trim(),
        confirmar,
      })
      onSaved()
    } catch {
      setError('Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function marcarPagada() {
    if (!p.liquidacion_id) return
    setSaving(true); setError('')
    try {
      await api.post(`/liquidaciones/${p.liquidacion_id}/pagar/`, {})
      onSaved()
    } catch {
      setError('Error al marcar como pagada.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="w-full max-w-md bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: p.profe_color || '#6b7280' }}
            >
              {p.profe_nombre.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-dark-text">{p.profe_nombre}</h2>
              <p className="text-xs text-dark-muted">
                {mesLabel} · <span className="text-dark-text font-medium">{dadas.length}h dadas</span>
                {proyectadas.length > 0 && <span className="text-dark-border"> · {proyectadas.length}h a dar</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Resumen tarifa */}
          <div className="bg-dark-bg rounded-xl px-4 py-3 text-xs space-y-1.5">
            <p className="text-dark-muted font-semibold uppercase tracking-wider mb-2">Tarifa del mes</p>

            {p.tipo_liquidacion === 'hora' && (
              <div className="flex justify-between">
                <span className="text-dark-muted">Valor por clase</span>
                <span className="text-dark-text font-semibold">{money(p.valor_hora)}</span>
              </div>
            )}
            {p.tipo_liquidacion === 'fijo' && (
              <div className="flex justify-between">
                <span className="text-dark-muted">Sueldo fijo</span>
                <span className="text-dark-text font-semibold">{money(p.sueldo_fijo)}</span>
              </div>
            )}
            {p.tipo_liquidacion === 'porcentaje' && (
              <div className="flex justify-between">
                <span className="text-dark-muted">Porcentaje</span>
                <span className="text-dark-text font-semibold">{p.porcentaje}%</span>
              </div>
            )}

            {/* Desglose dadas */}
            <div className="border-t border-dark-border pt-1.5 mt-1 space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-dark-text">Clases dadas</span>
                <span className="text-dark-text">{dadas.length}h</span>
              </div>
              {d107 > 0 && <div className="flex justify-between"><span className="text-indigo-400">↳ Athlon 107</span><span className="text-indigo-300">{d107}h</span></div>}
              {d24  > 0 && <div className="flex justify-between"><span className="text-cyan-400">↳ Athlon 24</span><span className="text-cyan-300">{d24}h</span></div>}
            </div>

            {/* Proyectadas */}
            {proyectadas.length > 0 && (
              <div className="border-t border-dark-border/50 pt-1.5 mt-1 space-y-1 opacity-50">
                <div className="flex justify-between">
                  <span className="text-dark-muted flex items-center gap-1"><Clock size={10}/> A dar</span>
                  <span className="text-dark-muted">{proyectadas.length}h</span>
                </div>
                {p107 > 0 && <div className="flex justify-between"><span className="text-indigo-400/60">↳ Athlon 107</span><span className="text-indigo-300/60">{p107}h</span></div>}
                {p24  > 0 && <div className="flex justify-between"><span className="text-cyan-400/60">↳ Athlon 24</span><span className="text-cyan-300/60">{p24}h</span></div>}
              </div>
            )}

            {/* Monto calculado sobre dadas */}
            <div className="border-t border-dark-border pt-1.5 mt-1 space-y-1">
              <div className="flex justify-between">
                <span className="text-dark-muted">Devengado ({dadas.length}h)</span>
                <span className="text-green-400 font-bold">{money(montoDado)}</span>
              </div>
              {proyectadas.length > 0 && p.tipo_liquidacion === 'hora' && (
                <div className="flex justify-between opacity-50">
                  <span className="text-dark-muted">Proyección total ({clases.length}h)</span>
                  <span className="text-dark-muted">{money(p.monto_calculado)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Monto final */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">
              Monto final a pagar
              {p.tipo_liquidacion === 'porcentaje' && (
                <span className="ml-2 text-purple-400">(calculá el % sobre la recaudación)</span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
              <input
                type="number"
                value={montoFinal}
                onChange={e => setMontoFinal(e.target.value)}
                className="input w-full text-sm pl-7"
                disabled={p.pagada}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Notas</label>
            <textarea
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones, bonos, descuentos..."
              className="input w-full text-sm resize-none"
              disabled={p.pagada}
            />
          </div>

          {/* Clases dadas */}
          {fechasDadas.length > 0 && (
            <ClasesList titulo="Clases dadas" porFecha={porFechaDadas} fechas={fechasDadas} proyectada={false} />
          )}

          {/* Clases a dar */}
          {fechasProyectadas.length > 0 && (
            <ClasesList titulo="A dar" porFecha={porFechaProyectadas} fechas={fechasProyectadas} proyectada={true} />
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0 space-y-2">
          {p.pagada ? (
            <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm font-semibold py-2">
              <Banknote size={16}/> Pagada{p.fecha_pago ? ` el ${p.fecha_pago}` : ''}
            </div>
          ) : (
            <>
              {!p.confirmada && (
                <button
                  onClick={() => guardar(false)}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-dark-bg hover:bg-dark-border border border-dark-border disabled:opacity-50 text-dark-text font-medium py-2 rounded-xl transition-colors text-sm"
                >
                  {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
                  Guardar borrador
                </button>
              )}
              {!p.confirmada && (
                <button
                  onClick={() => guardar(true)}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {saving ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle size={15}/>}
                  Confirmar · {money(montoNum)}
                </button>
              )}
              {p.confirmada && !p.pagada && (
                <>
                  <button
                    onClick={() => guardar(true)}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-dark-bg hover:bg-dark-border border border-dark-border disabled:opacity-50 text-dark-text font-medium py-2 rounded-xl transition-colors text-sm"
                  >
                    <Save size={15}/> Actualizar monto / notas
                  </button>
                  <button
                    onClick={marcarPagada}
                    disabled={saving || !p.liquidacion_id}
                    className="w-full flex items-center justify-center gap-2 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin"/> : <Banknote size={15}/>}
                    Marcar como pagada
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lista de clases agrupadas por fecha ───────────────────────────────────────
function ClasesList({ titulo, porFecha, fechas, proyectada }) {
  return (
    <div className={clsx(proyectada && 'opacity-50')}>
      <p className={clsx(
        'text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5',
        proyectada ? 'text-dark-text' : 'text-dark-muted'
      )}>
        {proyectada && <Clock size={11}/>}
        {proyectada ? 'Proyectadas' : titulo}
      </p>
      <div className="space-y-3">
        {fechas.map(fecha => {
          const [y, m, d] = fecha.split('-')
          const clasesDelDia = porFecha[fecha]
          const h107dia = clasesDelDia.filter(c => c.sede === '107').length
          const h24dia  = clasesDelDia.filter(c => c.sede === '24').length
          return (
            <div key={fecha}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium text-dark-muted">
                  {d}/{m}/{y}
                </p>
                <span className="text-xs text-dark-muted">
                  ({clasesDelDia.length}h
                  {h107dia > 0 && h24dia > 0
                    ? ` — ${h107dia}h A107 · ${h24dia}h A24`
                    : h107dia > 0 ? ' · A107' : ' · A24'}
                  )
                </span>
              </div>
              <div className="space-y-1">
                {clasesDelDia.map((c, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border',
                      c.es_modificacion
                        ? 'bg-yellow-900/20 border-yellow-800/30'
                        : proyectada
                          ? 'bg-dark-bg/50 border-dark-border/40'
                          : 'bg-dark-bg border-dark-border'
                    )}
                  >
                    <span className="text-dark-muted w-10 flex-shrink-0">{c.hora}</span>
                    <span
                      className="px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                      style={{
                        color: DISC_COLOR[c.disciplina],
                        backgroundColor: (DISC_COLOR[c.disciplina] || '#6b7280') + '25'
                      }}
                    >
                      {DISC_LABEL[c.disciplina] || c.disciplina}
                    </span>
                    <span className={clsx(
                      'text-xs flex-shrink-0 font-medium',
                      c.sede === '107' ? 'text-indigo-400' : 'text-cyan-400'
                    )}>
                      {c.sede === '107' ? 'A107' : 'A24'}
                    </span>
                    {c.es_modificacion && (
                      <span className="ml-auto text-yellow-500 flex items-center gap-1 flex-shrink-0">
                        <AlertTriangle size={10}/> reemplazo
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
