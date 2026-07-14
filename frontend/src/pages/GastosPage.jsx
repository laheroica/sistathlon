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

// Etiqueta + color del chip de sede
function sedeBadge(sd) {
  if (sd === '107') return { label: 'A107', cls: 'text-indigo-400 bg-indigo-900/30' }
  if (sd === '24')  return { label: 'A24',  cls: 'text-cyan-400 bg-cyan-900/30' }
  return { label: 'Gral', cls: 'text-amber-400 bg-amber-900/30' }
}

function mesStr(y, m) { return `${y}-${String(m).padStart(2, '0')}` }
function mesLabel(y, m) {
  return new Date(y, m - 1, 1)
    .toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

export default function GastosPage() {
  const { sedeOptions } = useNegocio()
  const SEDES = [{ val: '', label: 'Todas' }, ...sedeOptions, { val: 'general', label: 'General' }]
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

  // Total fijos por sede (cada compartido contribuye su mitad a cada una)
  const total107      = useMemo(() => sumImporte(fijos, '107'),     [fijos])
  const total24       = useMemo(() => sumImporte(fijos, '24'),      [fijos])
  const totalGeneral  = useMemo(() => sumImporte(fijos, 'general'), [fijos])

  const extras107     = useMemo(() => sumTotal(extrasAll, '107'),     [extrasAll])
  const extras24      = useMemo(() => sumTotal(extrasAll, '24'),      [extrasAll])
  const extrasGeneral = useMemo(() => sumTotal(extrasAll, 'general'), [extrasAll])
  const totalExtras   = extras.reduce((s, g) => s + g.total, 0)   // suma de los visibles (respeta filtro)

  // Acumulado hasta hoy pagado/a pagar a los profes, por sede
  const profes107     = useMemo(() => todosProfes.reduce((s, p) => s + montoAcumulado(p, '107'),     0), [todosProfes])
  const profes24      = useMemo(() => todosProfes.reduce((s, p) => s + montoAcumulado(p, '24'),      0), [todosProfes])
  const profesGeneral = useMemo(() => todosProfes.reduce((s, p) => s + montoAcumulado(p, 'general'), 0), [todosProfes])
  const totalProfes   = profes107 + profes24 + profesGeneral
  const totalProfesFiltrado = sede
    ? (sede === '107' ? profes107 : sede === '24' ? profes24 : profesGeneral)
    : totalProfes
  const profesConHoras = useMemo(
    () => todosProfes
      .filter(p =>
        (p.clases ?? []).some(c => c.fecha <= HOY && (!sede || c.sede === sede)) ||
        montoAcumulado(p, sede) > 0   // fijos/mixtos sin clases (ej. sueldo del dueño)
      )
      .sort((a, b) => a.profe_nombre.localeCompare(b.profe_nombre)),
    [todosProfes, sede]
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
      <div className="grid grid-cols-[1fr_repeat(3,minmax(64px,90px))] gap-x-2 sm:gap-x-3 gap-y-1.5 items-center overflow-x-auto">
        {/* Headers */}
        <div/>
        <p className="text-xs font-semibold text-indigo-400 text-right">A107</p>
        <p className="text-xs font-semibold text-cyan-400 text-right">A24</p>
        <p className="text-xs font-semibold text-amber-400 text-right">Gral</p>

        {/* Fijos */}
        <p className="text-xs text-dark-muted">Gastos fijos</p>
        <p className="text-sm font-bold text-red-400 text-right">{money(total107)}</p>
        <p className="text-sm font-bold text-red-400 text-right">{money(total24)}</p>
        <p className="text-sm font-bold text-red-400 text-right">{money(totalGeneral)}</p>

        {/* Extras */}
        <p className="text-xs text-dark-muted">Gastos extras</p>
        <p className="text-sm font-bold text-orange-400 text-right">{money(extras107)}</p>
        <p className="text-sm font-bold text-orange-400 text-right">{money(extras24)}</p>
        <p className="text-sm font-bold text-orange-400 text-right">{money(extrasGeneral)}</p>

        {/* Profes */}
        <p className="text-xs text-dark-muted">Profes</p>
        <p className="text-sm font-bold text-purple-400 text-right">{money(profes107)}</p>
        <p className="text-sm font-bold text-purple-400 text-right">{money(profes24)}</p>
        <p className="text-sm font-bold text-purple-400 text-right">{money(profesGeneral)}</p>

        {/* Separador */}
        <div className="col-span-4 border-t border-dark-border my-0.5"/>

        {/* Total */}
        <p className="text-xs font-semibold text-dark-text">Total egresos</p>
        <p className="text-base font-bold text-dark-text text-right">{money(total107 + extras107 + profes107)}</p>
        <p className="text-base font-bold text-dark-text text-right">{money(total24  + extras24  + profes24)}</p>
        <p className="text-base font-bold text-dark-text text-right">{money(totalGeneral + extrasGeneral + profesGeneral)}</p>
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
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', sedeBadge(ex.sede).cls)}>
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
              const p107 = montoAcumulado(p, '107')
              const p24  = montoAcumulado(p, '24')
              const pGen = montoAcumulado(p, 'general')
              const totalFila = sede
                ? (sede === '107' ? p107 : sede === '24' ? p24 : pGen)
                : p107 + p24 + pGen
              return (
                <div key={p.profe_id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: p.profe_color || '#6b7280' }}
                  >
                    {p.profe_nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-dark-text font-medium truncate">{p.profe_nombre}</span>
                  {(!sede || sede === '107') && p107 > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-indigo-400 font-semibold">A107</span>
                      <span className="text-indigo-400 font-bold">{money(p107)}</span>
                    </div>
                  )}
                  {(!sede || sede === '24') && p24 > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-cyan-400 font-semibold">A24</span>
                      <span className="text-cyan-400 font-bold">{money(p24)}</span>
                    </div>
                  )}
                  {(!sede || sede === 'general') && pGen > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-amber-400 font-semibold">Gral</span>
                      <span className="text-amber-400 font-bold">{money(pGen)}</span>
                    </div>
                  )}
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
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', sedeBadge(g.sede).cls)}>
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
