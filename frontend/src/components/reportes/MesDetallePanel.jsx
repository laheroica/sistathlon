import { useQuery } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { money } from '../../lib/format'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function mesLabel(mesKey) {
  const [y, m] = (mesKey || '').split('-').map(Number)
  return `${MESES_ES[m - 1]} ${y}`
}

// Celda de monto: muestra vacío cuando es 0 para no ensuciar
function Monto({ v, className }) {
  return (
    <td className={clsx('py-1.5 px-2 text-right tabular-nums whitespace-nowrap', className)}>
      {v ? money(v) : <span className="text-dark-border">—</span>}
    </td>
  )
}

// Fila de 4 valores (107 / 24 / general / total)
function Fila({ label, b, bold, indent, color }) {
  return (
    <tr className={clsx(bold && 'font-semibold')}>
      <td className={clsx('py-1.5 px-2 text-dark-text', indent && 'pl-5')}>{label}</td>
      <Monto v={b['107']} className={color} />
      <Monto v={b['24']} className={color} />
      <Monto v={b.general} className={color} />
      <Monto v={b.total} className={clsx('font-bold', color)} />
    </tr>
  )
}

export default function MesDetallePanel({ mesKey, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mes-detalle', mesKey],
    queryFn: () => api.get('/reportes/mes-detalle/', { params: { mes: mesKey } }).then(r => r.data),
    enabled: Boolean(mesKey),
    staleTime: 0,
  })

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">Detalle — {mesLabel(mesKey)}</h2>
            <p className="text-xs text-dark-muted">Ingresos, egresos y resultado por sede</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-dark-muted">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-sm text-red-400 text-center py-16">No se pudo cargar el detalle.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-dark-surface">
                <tr className="text-xs text-dark-muted border-b border-dark-border">
                  <th className="text-left font-medium py-2 px-2">Concepto</th>
                  <th className="text-right font-medium py-2 px-2 text-indigo-400">A107</th>
                  <th className="text-right font-medium py-2 px-2 text-cyan-400">A24</th>
                  <th className="text-right font-medium py-2 px-2 text-amber-400">Gral</th>
                  <th className="text-right font-medium py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* INGRESOS */}
                <tr className="bg-dark-bg/50">
                  <td colSpan={5} className="py-1.5 px-2 text-xs font-semibold text-green-400 uppercase tracking-wider">Ingresos</td>
                </tr>
                <Fila label="Cuotas cobradas" b={data.ingresos} color="text-green-400" />

                {/* EGRESOS */}
                <tr className="bg-dark-bg/50">
                  <td colSpan={5} className="py-1.5 px-2 pt-3 text-xs font-semibold text-red-400 uppercase tracking-wider">Egresos</td>
                </tr>

                {/* Profes */}
                <tr><td colSpan={5} className="pt-2 px-2 text-xs text-dark-muted">Profes</td></tr>
                {data.profes.map((p, i) => <Fila key={'p' + i} label={p.nombre} b={p} indent />)}
                {data.profes.length === 0 && (
                  <tr><td colSpan={5} className="pl-5 px-2 py-1 text-xs text-dark-border">Sin liquidaciones confirmadas</td></tr>
                )}
                <Fila label="Subtotal profes" b={data.totales.profes} bold color="text-purple-400" />

                {/* Gastos fijos */}
                <tr><td colSpan={5} className="pt-2 px-2 text-xs text-dark-muted">Gastos fijos</td></tr>
                {data.fijos.map((f, i) => <Fila key={'f' + i} label={f.label} b={f} indent />)}
                {data.fijos.length === 0 && (
                  <tr><td colSpan={5} className="pl-5 px-2 py-1 text-xs text-dark-border">Sin gastos fijos</td></tr>
                )}
                <Fila label="Subtotal fijos" b={data.totales.fijos} bold color="text-red-400" />

                {/* Gastos extras */}
                <tr><td colSpan={5} className="pt-2 px-2 text-xs text-dark-muted">Gastos extras</td></tr>
                {data.extras.map((e, i) => {
                  const b = { '107': 0, '24': 0, general: 0, total: e.importe }
                  b[e.sede] = e.importe
                  return <Fila key={'e' + i} label={e.concepto} b={b} indent />
                })}
                {data.extras.length === 0 && (
                  <tr><td colSpan={5} className="pl-5 px-2 py-1 text-xs text-dark-border">Sin gastos extras</td></tr>
                )}
                <Fila label="Subtotal extras" b={data.totales.extras} bold color="text-orange-400" />

                {/* Total egresos */}
                <tr className="border-t border-dark-border">
                  <td className="py-2 px-2 font-bold text-dark-text">Total egresos</td>
                  <Monto v={data.totales.egresos['107']} className="font-bold text-red-400" />
                  <Monto v={data.totales.egresos['24']} className="font-bold text-red-400" />
                  <Monto v={data.totales.egresos.general} className="font-bold text-red-400" />
                  <Monto v={data.totales.egresos.total} className="font-bold text-red-400" />
                </tr>

                {/* RESULTADO */}
                <tr className="border-t-2 border-dark-border">
                  <td className="py-2.5 px-2 font-bold text-dark-text uppercase text-xs tracking-wider">Resultado del mes</td>
                  {['107', '24', 'general', 'total'].map(k => (
                    <td key={k} className={clsx(
                      'py-2.5 px-2 text-right tabular-nums font-bold whitespace-nowrap',
                      data.resultado[k] >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {money(data.resultado[k])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
