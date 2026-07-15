import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Receipt, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Split, RefreshCw,
  ChevronDown, ChevronUp, UserPlus
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import { HOY, montoAcumulado } from '../lib/liquidaciones'
import GastoFijoPanel from '../components/gastos/GastoFijoPanel'
import GastoExtraPanel from '../components/gastos/GastoExtraPanel'
import { useNegocio } from '../hooks/useNegocio'

// ── Definición de conceptos ───────────────────────────────────────────────────

const GRUPOS = [
  {
    id: 'generales', label: 'Alquiler',
    conceptos: [
      { val: 'alquiler',  label: 'Alquiler' },
      { val: 'seguro',    label: 'Seguro' },
    ],
  },
  {
    id: 'limpieza', label: 'Limpieza',
    conceptos: [
      { val: 'limpieza', label: 'Limpieza', multi: true },
    ],
  },
  {
    id: 'municipales', label: 'Impuestos Municipales',
    conceptos: [
      { val: 'municipal',  label: 'Imp. Municipal' },
      { val: 'salubridad', label: 'Salubridad e Higiene' },
    ],
  },
  {
    id: 'servicios', label: 'Servicios',
    conceptos: [
      { val: 'electrico', label: 'Corpico Eléctrico' },
      { val: 'internet',  label: 'Corpico Internet' },
    ],
  },
  {
    id: 'compartidos', label: 'Impuestos compartidos ÷2 por sede',
    compartido: true,
    conceptos: [
      { val: 'mono_deni',   label: 'Monotributo Deni',    compartido: true },
      { val: 'mono_alvaro', label: 'Monotributo Álvaro',  compartido: true },
      // Mario ya no se carga: solo se muestra en meses que ya tienen datos (legacy)
      { val: 'mono_mario',  label: 'Monotributo Mario',   compartido: true, legacy: true },
      { val: 'iibb_deni',   label: 'IIBB Deni',           compartido: true },
      { val: 'iibb_alvaro', label: 'IIBB Álvaro',         compartido: true },
      { val: 'iibb_mario',  label: 'IIBB Mario',          compartido: true },
    ],
  },
]

const GENERAL_COLOR = '#f59e0b'

function mesStr(y, m) { return `${y}-${String(m).padStart(2, '0')}` }
function mesLabel(y, m) {
  return new Date(y, m - 1, 1)
    .toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

export default function GastosPage() {
  const { sedeOptions, sedeColor } = useNegocio()
  const SEDES = [{ val: '', label: 'Todas' }, ...sedeOptions, { val: 'general', label: 'General' }]
  const codes = sedeOptions.map(o => o.val)
  // Columnas de la vista por sede: cada sucursal + General
  const cols  = [...sedeOptions.map(o => ({ val: o.val, label: o.val, color: o.color })),
                 { val: 'general', label: 'Gral', color: GENERAL_COLOR }]
  // Etiqueta + color del chip de sede (dinámico)
  const sedeBadge = (sd) => sd === 'general'
    ? { label: 'Gral', color: GENERAL_COLOR }
    : { label: sd, color: sedeColor(sd) }
  const hoy = new Date()
  const [year,  setYear]  = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth() + 1)
  const [sede,  setSede]  = useState('')
  const [panelFijo,  setPanelFijo]  = useState(null) // { concepto, edit? }
  const [panelExtra, setPanelExtra] = useState(null) // null | 'nuevo' | {extra}

  const qc  = useQueryClient()
  const mes = mesStr(year, month)

  function navMes(d) {
    let m = month + d, y = year
    if (m < 1)  { m = 12; y-- }
    if (m > 12) { m = 1;  y++ }
    setMonth(m); setYear(y)
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['gastos-fijos'] })
    qc.invalidateQueries({ queryKey: ['gastos-extras'] })
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  const fijosQ = useQuery({
    queryKey: ['gastos-fijos', mes],
    queryFn: () => api.get('/caja/gastos/fijos/', { params: { mes } }).then(r => r.data),
    staleTime: 0,
  })

  const extrasQ = useQuery({
    queryKey: ['gastos-extras', mes],
    queryFn: () => api.get('/caja/gastos/extras/', { params: { mes } }).then(r => r.data),
    staleTime: 0,
  })

  const profesQ = useQuery({
    queryKey: ['liquidaciones-preview', mes],
    queryFn: () => api.get('/liquidaciones/preview/', { params: { mes } }).then(r => r.data),
    staleTime: 0,
  })

  const fijos      = fijosQ.data  ?? []
  const extrasAll  = extrasQ.data ?? []
  const extras     = sede ? extrasAll.filter(g => g.sede === sede) : extrasAll
  const todosProfes = profesQ.data?.profes ?? []

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const sumImporte = (arr, sd) => arr.filter(g => g.sede === sd).reduce((s, g) => s + parseFloat(g.importe), 0)
  const sumTotal   = (arr, sd) => arr.filter(g => g.sede === sd).reduce((s, g) => s + g.total, 0)

  // Totales por sede (cada compartido contribuye su parte a cada una).
  // fijosPorSede/extrasPorSede/profesPorSede: {codigoSede|'general': monto}
  const fijosPorSede  = useMemo(() => Object.fromEntries(cols.map(c => [c.val, sumImporte(fijos, c.val)])),     [fijos, cols])
  const extrasPorSede = useMemo(() => Object.fromEntries(cols.map(c => [c.val, sumTotal(extrasAll, c.val)])),   [extrasAll, cols])
  const profesPorSede = useMemo(() => Object.fromEntries(cols.map(c => [c.val, todosProfes.reduce((s, p) => s + montoAcumulado(p, c.val, codes), 0)])), [todosProfes, cols, codes])
  const totalExtras   = extras.reduce((s, g) => s + g.total, 0)   // suma de los visibles (respeta filtro)

  const totalProfes         = cols.reduce((s, c) => s + profesPorSede[c.val], 0)
  const totalProfesFiltrado = sede ? (profesPorSede[sede] || 0) : totalProfes
  const profesConHoras = useMemo(
    () => todosProfes
      .filter(p =>
        (p.clases ?? []).some(c => c.fecha <= HOY && (!sede || c.sede === sede)) ||
        montoAcumulado(p, sede, codes) > 0   // fijos/mixtos sin clases (ej. sueldo del dueño)
      )
      .sort((a, b) => a.profe_nombre.localeCompare(b.profe_nombre)),
    [todosProfes, sede, codes]
  )

  // ── Delete helpers ────────────────────────────────────────────────────────────

  async function deleteFijo(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await api.delete(`/caja/gastos/fijos/${id}/`)
    invalidate()
  }

  async function deleteExtra(id) {
    if (!confirm('¿Eliminar este gasto extra?')) return
    await api.delete(`/caja/gastos/extras/${id}/`)
    invalidate()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-900/30 flex items-center justify-center">
            <Receipt size={18} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Gastos</h1>
            <p className="text-xs text-dark-muted">Fijos mensuales y extras</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mes */}
          <div className="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-xl px-3 py-1.5">
            <button onClick={() => navMes(-1)} className="text-dark-muted hover:text-dark-text p-1">
              <ChevronLeft size={15}/>
            </button>
            <span className="text-sm font-semibold text-dark-text min-w-[130px] text-center">
              {mesLabel(year, month)}
            </span>
            <button onClick={() => navMes(1)} className="text-dark-muted hover:text-dark-text p-1">
              <ChevronRight size={15}/>
            </button>
          </div>

          {/* Sede */}
          <div className="flex gap-1">
            {SEDES.map(s => (
              <button
                key={s.val}
                onClick={() => setSede(s.val)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  sede === s.val
                    ? 'bg-red-900/30 text-red-400 border-red-800/40'
                    : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-x-2 sm:gap-x-3 gap-y-1.5 items-center overflow-x-auto"
        style={{ gridTemplateColumns: `1fr repeat(${cols.length}, minmax(64px,90px))` }}>
        {/* Headers */}
        <div/>
        {cols.map(c => (
          <p key={c.val} className="text-xs font-semibold text-right" style={{ color: c.color }}>{c.label}</p>
        ))}

        {/* Fijos */}
        <p className="text-xs text-dark-muted">Gastos fijos</p>
        {cols.map(c => <p key={c.val} className="text-sm font-bold text-red-400 text-right">{money(fijosPorSede[c.val])}</p>)}

        {/* Extras */}
        <p className="text-xs text-dark-muted">Gastos extras</p>
        {cols.map(c => <p key={c.val} className="text-sm font-bold text-orange-400 text-right">{money(extrasPorSede[c.val])}</p>)}

        {/* Profes */}
        <p className="text-xs text-dark-muted">Profes</p>
        {cols.map(c => <p key={c.val} className="text-sm font-bold text-purple-400 text-right">{money(profesPorSede[c.val])}</p>)}

        {/* Separador */}
        <div className="border-t border-dark-border my-0.5" style={{ gridColumn: '1 / -1' }}/>

        {/* Total */}
        <p className="text-xs font-semibold text-dark-text">Total egresos</p>
        {cols.map(c => (
          <p key={c.val} className="text-base font-bold text-dark-text text-right">
            {money(fijosPorSede[c.val] + extrasPorSede[c.val] + profesPorSede[c.val])}
          </p>
        ))}
      </div>

      {/* ── Gastos Fijos ────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Gastos Fijos</p>
          {fijosQ.isFetching && <RefreshCw size={12} className="animate-spin text-dark-muted"/>}
        </div>

        <div className="divide-y divide-dark-border">
          {GRUPOS.map(grupo => (
            <GrupoFijos
              key={grupo.id}
              grupo={grupo}
              fijos={fijos}
              sede={sede}
              mes={mes}
              onAdd={concepto => setPanelFijo({ concepto })}
              onEdit={(concepto, gasto) => setPanelFijo({ concepto, gasto })}
              onDelete={deleteFijo}
            />
          ))}
        </div>
      </div>

      {/* ── Gastos Extras ───────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Gastos Extras</p>
            {totalExtras > 0 && (
              <span className="text-sm font-bold text-orange-400">{money(totalExtras)}</span>
            )}
          </div>
          <button
            onClick={() => setPanelExtra('nuevo')}
            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-medium"
          >
            <Plus size={13}/> Agregar extra
          </button>
        </div>

        {extras.length === 0 ? (
          <div className="py-8 text-center text-sm text-dark-muted">
            No hay gastos extras este mes
          </div>
        ) : (
          <>
            {/* Header tabla */}
            <div className="grid grid-cols-[1fr_100px_60px_100px_60px_40px] gap-2 px-5 py-2 text-xs text-dark-muted border-b border-dark-border bg-dark-bg/50">
              <span>Concepto</span>
              <span className="text-right">P. unitario</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Total</span>
              <span className="text-center">Sede</span>
              <span/>
            </div>
            <div className="divide-y divide-dark-border">
              {extras.map(ex => (
                <div key={ex.id} className="grid grid-cols-[1fr_100px_60px_100px_60px_40px] gap-2 px-5 py-3 items-center text-sm hover:bg-dark-surface/40 group">
                  <span className="text-dark-text font-medium truncate">{ex.concepto}</span>
                  <span className="text-dark-muted text-right">{money(ex.precio_unitario)}</span>
                  <span className="text-dark-muted text-right">×{parseFloat(ex.cantidad)}</span>
                  <span className="text-orange-400 font-semibold text-right">{money(ex.total)}</span>
                  <span className="text-center">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ color: sedeBadge(ex.sede).color, backgroundColor: sedeBadge(ex.sede).color + '22' }}>
                      {sedeBadge(ex.sede).label}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button onClick={() => setPanelExtra(ex)} className="p-1 text-dark-muted hover:text-blue-400">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => deleteExtra(ex.id)} className="p-1 text-dark-muted hover:text-red-400">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Profes ───────────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus size={14} className="text-purple-400"/>
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Profes</p>
            {totalProfesFiltrado > 0 && (
              <span className="text-sm font-bold text-purple-400">{money(totalProfesFiltrado)}</span>
            )}
            {profesQ.isFetching && <RefreshCw size={12} className="animate-spin text-dark-muted"/>}
          </div>
          <Link
            to="/liquidaciones"
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            Ver liquidaciones
          </Link>
        </div>

        {profesConHoras.length === 0 ? (
          <div className="py-8 text-center text-sm text-dark-muted">
            Ningún profe tiene clases registradas este mes
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {profesConHoras.map(p => {
              const montos = cols.map(c => ({ ...c, monto: montoAcumulado(p, c.val, codes) }))
              const totalFila = sede
                ? montoAcumulado(p, sede, codes)
                : montos.reduce((s, m) => s + m.monto, 0)
              return (
                <div key={p.profe_id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: p.profe_color || '#6b7280' }}
                  >
                    {p.profe_nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-dark-text font-medium truncate">{p.profe_nombre}</span>
                  {montos.filter(m => (!sede || sede === m.val) && m.monto > 0).map(m => (
                    <div key={m.val} className="flex items-center gap-1.5 text-xs" style={{ color: m.color }}>
                      <span className="font-semibold">{m.label}</span>
                      <span className="font-bold">{money(m.monto)}</span>
                    </div>
                  ))}
                  <span className="text-sm font-bold text-purple-400 w-24 text-right">{money(totalFila)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Panel gasto fijo */}
      {panelFijo && (
        <GastoFijoPanel
          concepto={panelFijo.concepto}
          gasto={panelFijo.gasto ?? null}
          mes={mes}
          onClose={() => setPanelFijo(null)}
          onSaved={() => { invalidate(); setPanelFijo(null) }}
        />
      )}

      {/* Panel gasto extra */}
      {panelExtra && (
        <GastoExtraPanel
          extra={panelExtra === 'nuevo' ? null : panelExtra}
          mes={mes}
          onClose={() => setPanelExtra(null)}
          onSaved={() => { invalidate(); setPanelExtra(null) }}
        />
      )}
    </div>
  )
}

// ── Sub-componente: grupo de gastos fijos (colapsable) ────────────────────────

function GrupoFijos({ grupo, fijos, sede, mes, onAdd, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  const totalGrupo = grupo.conceptos.reduce((sum, c) => {
    const registros = fijos.filter(g => g.concepto === c.val)
    const visibles  = sede ? registros.filter(g => g.sede === sede) : registros
    return sum + visibles.reduce((s, g) => s + parseFloat(g.importe), 0)
  }, 0)

  return (
    <div>
      {/* Cabecera colapsable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 bg-dark-bg/60 flex items-center gap-2 hover:bg-dark-bg/80 transition-colors"
      >
        <span className="text-xs font-semibold text-dark-text uppercase tracking-wider">
          {grupo.label}
        </span>
        {grupo.compartido && (
          <span className="flex items-center gap-0.5 text-xs text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded">
            <Split size={10}/> ÷2
          </span>
        )}
        {totalGrupo > 0 && (
          <span className="text-sm font-bold text-red-400 ml-2">{money(totalGrupo)}</span>
        )}
        <span className="ml-auto text-dark-muted">
          {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </span>
      </button>

      {/* Contenido expandible */}
      {open && (
        <div className="divide-y divide-dark-border/50">
          {grupo.conceptos.map(c => {
            const registros  = fijos.filter(g => g.concepto === c.val)
            const visibles   = sede ? registros.filter(g => g.sede === sede) : registros
            const totalVisual = c.compartido && !sede
              ? registros.reduce((s, g) => s + parseFloat(g.importe), 0)
              : visibles.reduce((s, g) => s + parseFloat(g.importe), 0)

            // Conceptos "legacy" (ej. Mario): solo se muestran si el mes tiene datos
            if (c.legacy && registros.length === 0) return null

            return (
              <div key={c.val} className="px-5 py-3">
                {/* Fila principal */}
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-dark-text font-medium">{c.label}</span>

                  {totalVisual > 0 ? (
                    <span className="text-sm font-bold text-red-400">{money(totalVisual)}</span>
                  ) : (
                    <span className="text-xs text-dark-muted">Sin registrar</span>
                  )}

                  {c.compartido && totalVisual > 0 && !sede && (
                    <span className="text-xs text-dark-muted">({money(totalVisual / 2)} c/u)</span>
                  )}

                  {!c.legacy && (
                    <button
                      onClick={() => onAdd(c)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-900/40 hover:border-red-800/60 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={11}/> {c.multi ? 'Agregar' : visibles.length > 0 ? 'Otro' : 'Registrar'}
                    </button>
                  )}
                </div>

                {/* Lista de registros */}
                {visibles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {visibles.map(g => (
                      <div key={g.id} className="flex items-center gap-2 text-xs text-dark-muted group">
                        <span className="text-dark-muted">{g.fecha}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{ color: sedeBadge(g.sede).color, backgroundColor: sedeBadge(g.sede).color + '22' }}>
                          {sedeBadge(g.sede).label}
                        </span>
                        <span className="font-semibold text-dark-text">{money(g.importe)}</span>
                        {g.notas && <span className="italic truncate max-w-[140px]">{g.notas}</span>}
                        <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-1 transition-all">
                          <button onClick={() => onEdit(c, g)} className="p-0.5 hover:text-blue-400"><Pencil size={11}/></button>
                          <button onClick={() => onDelete(g.id)} className="p-0.5 hover:text-red-400"><Trash2 size={11}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
