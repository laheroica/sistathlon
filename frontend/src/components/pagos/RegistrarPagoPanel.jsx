import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { DollarSign, Calendar, CreditCard, User, Plus, Trash2 } from 'lucide-react'
import SlidePanel from '../ui/SlidePanel'
import api from '../../lib/api'

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy Funcional', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus' }
const DISC_BADGE = {
  CF: 'bg-blue-900/60 text-blue-300',
  HF: 'bg-green-900/60 text-green-300',
  HX: 'bg-yellow-900/60 text-yellow-300',
  TN: 'bg-purple-900/60 text-purple-300',
  KD: 'bg-pink-900/60 text-pink-300',
  BP: 'bg-sky-900/60 text-sky-300',
}
const ESTADO_COLOR = {
  activo: 'text-green-400', mora: 'text-yellow-400',
  baja: 'text-orange-400', alejado: 'text-red-400', temporal: 'text-sky-400',
}

// Genera opciones de mes: 5 meses atrás hasta 2 adelante
function mesOptions() {
  const opts = []
  const hoy = new Date()
  for (let i = -5; i <= 2; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    opts.push({
      value: format(d, 'yyyy-MM-dd'),
      label: format(d, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
    })
  }
  return opts
}

const MESES = mesOptions()
const MES_ACTUAL = format(startOfMonth(new Date()), 'yyyy-MM-dd')

function filaVacia(monto = '') {
  return { mes: MES_ACTUAL, monto }
}

export default function RegistrarPagoPanel({ alumno, open, onClose }) {
  const qc = useQueryClient()

  const [filas, setFilas]       = useState([filaVacia()])
  const [fechaPago, setFechaPago] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [metodo, setMetodo]     = useState('efectivo')
  const [notas: nota, setNota]         = useState('')

  // Resetear cuando cambia el alumno o se abre el panel
  useEffect(() => {
    if (alumno && open) {
      setFilas([filaVacia(alumno.cuota_actual || '')])
      setFechaPago(format(new Date(), 'yyyy-MM-dd'))
      setMetodo('efectivo')
      setNota('')
    }
  }, [alumno, open])

  function setFila(i, field, val) {
    setFilas(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f))
  }

  function agregarFila() {
    // Propone el mes anterior al último seleccionado
    const ultimo = filas[filas.length - 1]?.mes || MES_ACTUAL
    const d = new Date(ultimo)
    const anterior = format(new Date(d.getFullYear(), d.getMonth() - 1, 1), 'yyyy-MM-dd')
    setFilas(prev => [...prev, { mes: anterior, monto: alumno?.cuota_actual || '' }])
  }

  function quitarFila(i) {
    setFilas(prev => prev.filter((_, idx) => idx !== i))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const resultados = []
      for (const fila of filas) {
        if (!fila.monto || parseFloat(fila.monto) <= 0) continue
        const r = await api.post('/pagos/', {
          alumno:     alumno.id,
          mes:        fila.mes,
          monto:      parseFloat(fila.monto),
          fecha_pago: fechaPago,
          metodo,
          notas: nota,
        })
        resultados.push(r.data)
      }
      return resultados
    },
    onSuccess: (data) => {
      const n = data.length
      toast.success(
        n === 1
          ? `Pago registrado para ${alumno.nombre_completo}`
          : `${n} pagos registrados para ${alumno.nombre_completo}`,
        { description: 'El historial se actualizó correctamente.' }
      )
      qc.invalidateQueries({ queryKey: ['alumnos'] })
      qc.invalidateQueries({ queryKey: ['pagos'] })
      onClose()
    },
    onError: (err) => {
      const data = err.response?.data
      let msg = 'Error al registrar el pago'
      if (data) {
        if (data.non_field_errors) msg = data.non_field_errors[0]
        else if (data.detail) msg = data.detail
        else {
          // field-level errors
          const firstField = Object.keys(data)[0]
          if (firstField) msg = `${firstField}: ${[].concat(data[firstField])[0]}`
        }
      }
      toast.error(msg)
    },
  })

  const totalMonto = filas.reduce((s, f) => s + (parseFloat(f.monto) || 0), 0)
  const puedeGuardar = filas.length > 0 && filas.every(f => f.mes && parseFloat(f.monto) > 0)

  if (!alumno) return null

  return (
    <SlidePanel open={open} onClose={onClose} title="Registrar pago" subtitle={alumno.nombre_completo}>

      {/* Ficha del alumno */}
      <div className="card mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-dark-border flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-dark-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-dark-text">{alumno.nombre_completo}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DISC_BADGE[alumno.disciplina]}`}>
              {DISC_LABEL[alumno.disciplina]}
            </span>
            <span className="text-xs text-dark-muted">{alumno.frecuencia} · Sede {alumno.sede}</span>
            {alumno.cuota_actual > 0 && (
              <span className="text-xs text-green-400 font-medium">
                Cuota: ${Number(alumno.cuota_actual).toLocaleString('es-AR')}
              </span>
            )}
          </div>
        </div>
        <span className={`text-sm font-semibold ${ESTADO_COLOR[alumno.estado]}`}>
          {alumno.estado}
        </span>
      </div>

      <div className="space-y-5">

        {/* Filas de mes + monto */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-dark-muted flex items-center gap-1.5">
              <Calendar size={13} /> Mes(es) a registrar
            </label>
            {filas.length < 4 && (
              <button type="button" onClick={agregarFila}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                <Plus size={13} /> Agregar mes
              </button>
            )}
          </div>

          <div className="space-y-2">
            {filas.map((fila, i) => (
              <div key={i} className="flex items-center gap-2 bg-dark-bg rounded-xl border border-dark-border px-3 py-2.5">
                {/* Mes */}
                <select
                  value={fila.mes}
                  onChange={e => setFila(i, 'mes', e.target.value)}
                  className="input text-sm flex-1 min-w-0"
                >
                  {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>

                {/* Monto */}
                <div className="relative w-32 flex-shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
                  <input
                    type="number" step="1" min="0"
                    value={fila.monto}
                    onChange={e => setFila(i, 'monto', e.target.value)}
                    placeholder="Monto"
                    className="input pl-6 text-sm w-full"
                  />
                </div>

                {/* Quitar */}
                {filas.length > 1 && (
                  <button type="button" onClick={() => quitarFila(i)}
                    className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-900/20 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Total si son varios meses */}
          {filas.length > 1 && totalMonto > 0 && (
            <p className="text-right text-sm text-dark-muted mt-2">
              Total: <span className="font-bold text-dark-text">${totalMonto.toLocaleString('es-AR')}</span>
            </p>
          )}
        </div>

        {/* Fecha de pago */}
        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} /> Fecha de pago
          </label>
          <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className="input" />
        </div>

        {/* Método */}
        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1.5 flex items-center gap-1.5">
            <CreditCard size={13} /> Método de pago
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'efectivo',      label: '💵 Efectivo' },
              { value: 'transferencia', label: '📲 Transf.' },
              { value: 'debito',        label: '💳 Débito' },
            ].map(({ value, label }) => (
              <button key={value} type="button"
                onClick={() => setMetodo(value)}
                className={`text-center text-sm py-2 px-3 rounded-xl border transition-all ${
                  metodo === value
                    ? 'bg-indigo-700 text-white border-indigo-600'
                    : 'border-dark-border text-dark-muted hover:border-indigo-500/50 hover:text-dark-text'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Nota */}
        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1.5">Nota (opcional)</label>
          <input type="text" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ej: pagó en 2 partes, adeudaba desde enero..."
            className="input" />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 btn-ghost border border-dark-border">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!puedeGuardar || mutation.isPending}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {mutation.isPending
              ? 'Guardando...'
              : filas.length > 1
                ? `Registrar ${filas.length} pagos`
                : 'Registrar pago'}
          </button>
        </div>
      </div>
    </SlidePanel>
  )
}
