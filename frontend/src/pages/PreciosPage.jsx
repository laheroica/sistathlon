import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, ChevronLeft, ChevronRight, Copy, Save, Check } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { toast } from 'sonner'
import { useDisciplinas } from '../hooks/useDisciplinas'

const FREC_LABEL = {
  '2x': '2x semana', '3x': '3x semana',
  '5x': '5x semana', 'libre': 'Pase Libre',
}

// Filas de combos — disciplina='COMBO', frecuencia='combo1'…'combo5'
const COMBO_ROWS = [
  { frecuencia: 'combo1', label: 'Combo 1' },
  { frecuencia: 'combo2', label: 'Combo 2' },
  { frecuencia: 'combo3', label: 'Combo 3' },
  { frecuencia: 'combo4', label: 'Combo 4' },
  { frecuencia: 'combo5', label: 'Combo 5' },
]

const TIPOS = [
  { value: 'regular',    label: 'Regular (1–10)' },
  { value: 'unlpam',     label: 'UNLPam' },
  { value: 'despues_10', label: 'Después del 10' },
]

function mesStr(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}`
}

function mesLabel(anio, mes) {
  const d = new Date(anio, mes - 1, 1)
  return d.toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Componente celda editable
// ---------------------------------------------------------------------------

function CeldaPrecio({ valor, onChange, guardando }) {
  const [edit, setEdit] = useState(false)
  const [local, setLocal] = useState(valor ?? '')

  useEffect(() => { setLocal(valor ?? '') }, [valor])

  function confirmar() {
    setEdit(false)
    const num = parseFloat(local)
    if (!isNaN(num) && num >= 0) onChange(num)
    else setLocal(valor ?? '')
  }

  if (edit) {
    return (
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-dark-muted text-xs">$</span>
        <input
          autoFocus
          type="number" step="1000" min="0"
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={confirmar}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEdit(false) }}
          className="w-full pl-5 pr-1 py-1.5 bg-dark-bg border border-indigo-500 rounded-lg text-sm text-dark-text outline-none"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEdit(true)}
      disabled={guardando}
      className={clsx(
        'w-full text-right px-3 py-1.5 rounded-lg text-sm transition-colors border',
        valor != null
          ? 'text-dark-text border-dark-border hover:border-indigo-500/50 hover:bg-dark-bg'
          : 'text-dark-muted/40 border-dashed border-dark-border/40 hover:border-indigo-500/40'
      )}
    >
      {valor != null ? `$${Number(valor).toLocaleString('es-AR')}` : '—'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function PreciosPage() {
  const hoy    = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)

  // Disciplinas dinámicas
  const { discs } = useDisciplinas()
  // Genera combinaciones disc × frec dinámicamente
  const COMBOS = discs.flatMap(d =>
    (d.frecuencias || []).map(frec => ({
      disciplina: d.codigo,
      discLabel:  d.nombre,
      frecuencia: frec,
    }))
  )
  const [cambios, setCambios]   = useState({})   // key: "disc|frec|tipo" → precio
  const [guardando, setGuardando] = useState(false)
  const [guardados, setGuardados] = useState(false)
  const qc = useQueryClient()

  const { data: precios = [], isLoading } = useQuery({
    queryKey: ['precios', anio, mes],
    queryFn: () => api.get('/precios/', { params: { mes: mesStr(anio, mes) } }).then(r => r.data),
  })

  // Mapa de precios cargados: "disc|frec|tipo" → precio
  const preciosMap = {}
  for (const p of precios) {
    preciosMap[`${p.disciplina}|${p.frecuencia}|${p.tipo}`] = p.precio
  }

  function getPrecio(disc, frec, tipo) {
    const key = `${disc}|${frec}|${tipo}`
    if (key in cambios) return cambios[key]
    const v = preciosMap[key]
    return v != null ? parseFloat(v) : null
  }

  function setCambio(disc, frec, tipo, valor) {
    setCambios(prev => ({ ...prev, [`${disc}|${frec}|${tipo}`]: valor }))
    setGuardados(false)
  }

  async function guardarTodo() {
    if (Object.keys(cambios).length === 0) return
    setGuardando(true)
    try {
      const mesDate = `${mesStr(anio, mes)}-01`
      for (const [key, precio] of Object.entries(cambios)) {
        const [disciplina, frecuencia, tipo] = key.split('|')
        await api.post('/precios/guardar/', { mes: mesDate, disciplina, frecuencia, tipo, precio })
      }
      setCambios({})
      setGuardados(true)
      qc.invalidateQueries({ queryKey: ['precios'] })
      toast.success(`Precios de ${mesLabel(anio, mes)} guardados`)
      setTimeout(() => setGuardados(false), 2000)
    } catch {
      toast.error('Error al guardar precios')
    } finally {
      setGuardando(false)
    }
  }

  async function copiarMesAnterior() {
    const mesAnterior = mes === 1
      ? `${anio - 1}-12-01`
      : `${anio}-${String(mes - 1).padStart(2, '0')}-01`
    const mesDestino = `${mesStr(anio, mes)}-01`

    try {
      await api.post('/precios/copiar/', { mes_origen: mesAnterior, mes_destino: mesDestino })
      qc.invalidateQueries({ queryKey: ['precios'] })
      setCambios({})
      toast.success(`Precios copiados del mes anterior`)
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al copiar precios'
      toast.error(msg)
    }
  }

  function navMes(dir) {
    let nm = mes + dir
    let na = anio
    if (nm > 12) { nm = 1; na++ }
    if (nm < 1)  { nm = 12; na-- }
    setMes(nm); setAnio(na)
    setCambios({})
  }

  const hayCambios = Object.keys(cambios).length > 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <DollarSign size={22} className="text-indigo-400" />
            Tabla de precios
          </h1>
          <p className="text-sm text-dark-muted mt-0.5">Hacé clic en cualquier precio para editarlo</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegador de mes */}
          <div className="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-xl px-2 py-1">
            <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-dark-text w-36 text-center">{mesLabel(anio, mes)}</span>
            <button onClick={() => navMes(1)} className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Copiar mes anterior */}
          <button onClick={copiarMesAnterior}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors">
            <Copy size={14} />
            Copiar mes anterior
          </button>

          {/* Guardar */}
          {hayCambios && (
            <button onClick={guardarTodo} disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-60">
              {guardados ? <Check size={14} /> : <Save size={14} />}
              {guardando ? 'Guardando...' : guardados ? 'Guardado' : `Guardar (${Object.keys(cambios).length})`}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-dark-muted animate-pulse text-sm">Cargando precios...</div>
      ) : (
        <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-bg">
                <th className="text-left px-4 py-3 text-xs font-semibold text-dark-muted w-36">Disciplina</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-dark-muted w-28">Frecuencia</th>
                {TIPOS.map(t => (
                  <th key={t.value} className="text-center px-3 py-3 text-xs font-semibold text-dark-muted">
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMBOS.map(({ disciplina, discLabel, frecuencia }, i) => {
                const esPrimeroDisc = i === 0 || COMBOS[i - 1].disciplina !== disciplina
                return (
                  <tr key={`${disciplina}-${frecuencia}`}
                    className={clsx(
                      'border-b border-dark-border/50 transition-colors hover:bg-dark-bg/40',
                      esPrimeroDisc && i > 0 && 'border-t-2 border-t-dark-border'
                    )}>
                    <td className="px-4 py-2.5">
                      {esPrimeroDisc ? (
                        <span className="text-sm font-medium text-dark-text">{discLabel}</span>
                      ) : (
                        <span className="text-xs text-dark-muted pl-2">↳</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-dark-muted">{FREC_LABEL[frecuencia] || frecuencia}</span>
                    </td>
                    {TIPOS.map(({ value: tipo }) => (
                      <td key={tipo} className="px-3 py-2">
                        <CeldaPrecio
                          valor={getPrecio(disciplina, frecuencia, tipo)}
                          onChange={v => setCambio(disciplina, frecuencia, tipo, v)}
                          guardando={guardando}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}

              {/* ── Sección Combos ──────────────────────────────── */}
              <tr className="border-t-2 border-dark-border bg-dark-bg/60">
                <td colSpan={2 + TIPOS.length} className="px-4 py-2">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    Combos
                  </span>
                  <span className="text-xs text-dark-muted ml-2">(Hyrox + otra disciplina)</span>
                </td>
              </tr>
              {COMBO_ROWS.map((row) => (
                <tr key={row.frecuencia}
                  className="border-b border-dark-border/50 transition-colors hover:bg-dark-bg/40">
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-dark-text">{row.label}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-dark-muted">—</span>
                  </td>
                  {TIPOS.map(({ value: tipo }) => (
                    <td key={tipo} className="px-3 py-2">
                      <CeldaPrecio
                        valor={getPrecio('COMBO', row.frecuencia, tipo)}
                        onChange={v => setCambio('COMBO', row.frecuencia, tipo, v)}
                        guardando={guardando}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {precios.length === 0 && Object.keys(cambios).length === 0 && (
            <div className="text-center py-12 text-dark-muted">
              <DollarSign size={36} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium text-dark-text">Sin precios cargados para {mesLabel(anio, mes)}</p>
              <p className="text-sm mt-1">Usá <strong>Copiar mes anterior</strong> para traer los precios, o editá las celdas.</p>
            </div>
          )}
        </div>
      )}

      {hayCambios && (
        <div className="mt-4 flex justify-end">
          <button onClick={guardarTodo} disabled={guardando}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-60">
            <Save size={14} />
            {guardando ? 'Guardando...' : `Guardar ${Object.keys(cambios).length} cambio${Object.keys(cambios).length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
