import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Grid, Ban } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import HorarioPanel from '../components/horarios/HorarioPanel'
import ModificacionPanel from '../components/horarios/ModificacionPanel'
import { useDisciplinas } from '../hooks/useDisciplinas'
import { useNegocio } from '../hooks/useNegocio'

const DIAS_SEMANA = [
  { val: 'lun', label: 'Lunes',     dow: 1 },
  { val: 'mar', label: 'Martes',    dow: 2 },
  { val: 'mie', label: 'Miércoles', dow: 3 },
  { val: 'jue', label: 'Jueves',    dow: 4 },
  { val: 'vie', label: 'Viernes',   dow: 5 },
  { val: 'sab', label: 'Sábado',    dow: 6 },
]

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

// Fallbacks en caso de que la API no haya cargado aún
const DISC_LABEL_FB = { CF: 'CrossFit', HF: 'Heavy', HX: 'Hyrox', FB: 'FullBody', TN: 'Teens', KD: 'Kids', BP: 'Bonus' }
const DISC_COLOR_FB = { CF: '#3b82f6', HF: '#22c55e', HX: '#eab308', FB: '#f97316', TN: '#a855f7', KD: '#ec4899', BP: '#0ea5e9' }
const DISC_ORDER_FB = { CF: 0, HX: 1, FB: 2, HF: 3, TN: 4, KD: 5, BP: 6 }

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function lunesDe(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function fmtCorto(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function fmtSemana(lunes) {
  const sab = addDays(lunes, 5)
  return `${fmtCorto(lunes)} al ${fmtCorto(sab)}`
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HorariosPage() {
  const { sedeOptions } = useNegocio()
  const [vista,  setVista]  = useState('semana')   // 'semana' | 'maestra'
  const [sede,   setSede]   = useState(sedeOptions[0]?.val || '107')
  // Si la sede seleccionada no existe entre las configuradas, caer a la primera
  useEffect(() => {
    if (sedeOptions.length && !sedeOptions.some(s => s.val === sede)) {
      setSede(sedeOptions[0].val)
    }
  }, [sedeOptions, sede])
  const [lunes,  setLunes]  = useState(() => lunesDe(new Date()))
  const [panel,  setPanel]  = useState(null)
  const [modPanel, setModPanel] = useState(null)  // { horario, fecha } | null

  // Disciplinas dinámicas
  const { discs, labelMap: apiLabelMap, colorMap: apiColorMap } = useDisciplinas()
  const DISC_LABEL = { ...DISC_LABEL_FB, ...apiLabelMap }
  const DISC_COLOR = { ...DISC_COLOR_FB, ...apiColorMap }
  // Orden dinámico: construir mapa desde el campo `orden` de la API
  const DISC_ORDER = discs.length > 0
    ? Object.fromEntries(discs.map(d => [d.codigo, d.orden]))
    : DISC_ORDER_FB

  function sortDisc(a, b) {
    return (DISC_ORDER[a.disciplina] ?? 99) - (DISC_ORDER[b.disciplina] ?? 99)
  }
  const qc = useQueryClient()

  const semanaISO = toISO(lunes)

  const { data: horarios = [], isLoading } = useQuery({
    queryKey: ['horarios-maestro', sede, vista === 'semana' ? semanaISO : null],
    queryFn: () => {
      const params = { sede, activo: 'true' }
      if (vista === 'semana') params.fecha = semanaISO
      return api.get('/horarios/maestro/', { params }).then(r => r.data)
    },
  })

  const { data: modificaciones = [] } = useQuery({
    queryKey: ['horarios-real', semanaISO, sede],
    queryFn: () => api.get('/horarios/real/', { params: { semana: semanaISO, sede } }).then(r => r.data),
    enabled: vista === 'semana',
  })

  const { data: profes = [] } = useQuery({
    queryKey: ['profes', true],
    queryFn: () => api.get('/profes/', { params: { activo: 'true' } }).then(r => r.data),
  })

  // Franjas horarias únicas ordenadas
  const horasUnicas = useMemo(
    () => [...new Set(horarios.map(h => h.hora_str))].sort(),
    [horarios]
  )

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['horarios-maestro'] })
    qc.invalidateQueries({ queryKey: ['horarios-real'] })
  }

  async function eliminarMaestro(id) {
    if (!confirm('¿Eliminar esta clase de la grilla maestra?')) return
    await api.delete(`/horarios/maestro/${id}/`)
    invalidate()
  }

  async function eliminarMod(id) {
    if (!confirm('¿Eliminar esta modificación?')) return
    await api.delete(`/horarios/real/${id}/`)
    invalidate()
  }

  function navSemana(delta) {
    setLunes(d => addDays(d, delta * 7))
  }

  function modDe(horario, fecha) {
    return modificaciones.find(m =>
      m.fecha       === fecha           &&
      m.hora        === horario.hora    &&
      m.disciplina  === horario.disciplina
    )
  }

  // ── Detección cruce de mes ────────────────────────────────────────────────
  const fechasDeSemana = DIAS_SEMANA.map((_, i) => addDays(lunes, i))

  const infoCruceMes = useMemo(() => {
    const porMes = {}
    fechasDeSemana.forEach((f, i) => {
      const k = f.getMonth()
      if (!porMes[k]) porMes[k] = { nombre: MESES_ES[k], año: f.getFullYear(), dias: 0, primerIdx: i }
      porMes[k].dias++
    })
    const meses = Object.values(porMes)
    return { meses, entreMeses: meses.length > 1 }
  }, [semanaISO])

  // índice donde cambia el mes (primer día del mes nuevo)
  const idxCambioMes = useMemo(() => {
    for (let i = 1; i < fechasDeSemana.length; i++) {
      if (fechasDeSemana[i].getMonth() !== fechasDeSemana[i - 1].getMonth()) return i
    }
    return -1
  }, [semanaISO])

  // ── Grid por franja horaria (común a ambas vistas) ────────────────────────
  function GridHoraria({ children }) {
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {children}
        </div>
      </div>
    )
  }

  function HeaderDias({ conFecha }) {
    return (
      <div className="grid gap-1.5 mb-1" style={{ gridTemplateColumns: '3rem repeat(6, 1fr)' }}>
        <div />
        {DIAS_SEMANA.map((dia, i) => {
          const fecha = addDays(lunes, i)
          const esCambioMes = conFecha && i === idxCambioMes
          const esMesB      = conFecha && idxCambioMes > -1 && i >= idxCambioMes
          return (
            <div
              key={dia.val}
              className={clsx(
                'text-center py-2 rounded-lg relative',
                esMesB ? 'bg-indigo-950/60 border border-indigo-800/30' : 'bg-dark-surface'
              )}
            >
              {/* Indicador de nuevo mes */}
              {esCambioMes && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-400" />
              )}
              <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider leading-none">
                {dia.label.slice(0, 3)}
              </p>
              {conFecha ? (
                <>
                  <p className={clsx(
                    'text-base font-bold mt-0.5 leading-none',
                    esMesB ? 'text-indigo-300' : 'text-dark-text'
                  )}>
                    {fecha.getDate()}
                  </p>
                  <p className={clsx(
                    'text-xs mt-0.5 font-medium',
                    esMesB ? 'text-indigo-400' : 'text-dark-muted'
                  )}>
                    {MESES_CORTO[fecha.getMonth()]}
                  </p>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-900/40 flex items-center justify-center">
            <Calendar size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Horarios</h1>
            <p className="text-xs text-dark-muted">
              {vista === 'semana' ? `Semana del ${fmtSemana(lunes)}` : 'Grilla maestra'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Vista */}
          <div className="flex rounded-xl overflow-hidden border border-dark-border">
            <button
              onClick={() => setVista('semana')}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
                vista === 'semana' ? 'bg-indigo-700 text-white' : 'bg-dark-surface text-dark-muted hover:text-dark-text')}
            >
              <Calendar size={13} /> Semana
            </button>
            <button
              onClick={() => setVista('maestra')}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
                vista === 'maestra' ? 'bg-indigo-700 text-white' : 'bg-dark-surface text-dark-muted hover:text-dark-text')}
            >
              <Grid size={13} /> Grilla maestra
            </button>
          </div>

          {/* Nav semana */}
          {vista === 'semana' && (
            <div className="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-xl px-2 py-1">
              <button onClick={() => navSemana(-1)} className="text-dark-muted hover:text-dark-text p-1"><ChevronLeft size={15}/></button>
              <span className="text-xs text-dark-text font-medium px-1 min-w-[110px] text-center">{fmtSemana(lunes)}</span>
              <button onClick={() => navSemana(1)} className="text-dark-muted hover:text-dark-text p-1"><ChevronRight size={15}/></button>
            </div>
          )}

          {/* Sede */}
          <div className="flex gap-1">
            {sedeOptions.map(s => (
              <button key={s.val} onClick={() => setSede(s.val)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  sede === s.val ? 'bg-indigo-900/40 text-indigo-400 border-indigo-800/40' : 'bg-dark-surface text-dark-muted border-dark-border hover:text-dark-text'
                )}
              >{s.label}</button>
            ))}
          </div>

          {vista === 'maestra' && (
            <button onClick={() => setPanel('nuevo')}
              className="flex items-center gap-2 bg-primary-dark hover:bg-primary-dark/80 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              <Plus size={15}/> Agregar clase
            </button>
          )}
        </div>
      </div>

      {/* ── VISTA SEMANA ─────────────────────────────────────────────────── */}
      {vista === 'semana' && (
        <>
          {/* Banner cruce de mes */}
          {infoCruceMes.entreMeses && (
            <div className="flex items-center gap-3 bg-indigo-950/60 border border-indigo-800/40 rounded-xl px-4 py-3">
              <Calendar size={15} className="text-indigo-400 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-300">Semana entre meses</p>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {infoCruceMes.meses.map((m, idx) => (
                    <span key={m.nombre}>
                      {idx > 0 && <span className="text-indigo-600 mx-1.5">·</span>}
                      <span className="font-semibold text-indigo-200 capitalize">{m.nombre}</span>
                      <span className="ml-1">{m.dias} día{m.dias > 1 ? 's' : ''}</span>
                    </span>
                  ))}
                </p>
              </div>
              <p className="text-xs text-indigo-500 flex-shrink-0">Revisar liquidación</p>
            </div>
          )}

          {modificaciones.length > 0 ? (
            <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-800/30 rounded-xl px-4 py-2.5">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0"/>
              <p className="text-xs text-yellow-400 flex-1">
                {modificaciones.length} modificación{modificaciones.length > 1 ? 'es' : ''} esta semana
              </p>
              <p className="text-xs text-yellow-600">Solo afectan esta semana</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5">
              <Pencil size={13} className="text-dark-muted flex-shrink-0"/>
              <p className="text-xs text-dark-muted">
                Usá el <span className="text-yellow-400 font-medium">✏️ lápiz</span> sobre cada clase para registrar cambios puntuales — solo afectan el día que elegís.
              </p>
            </div>
          )}

          <GridHoraria>
            <HeaderDias conFecha />
            {horasUnicas.map(hora => (
              <div key={hora} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '3rem repeat(6, 1fr)' }}>
                {/* Etiqueta hora */}
                <div className="flex items-start justify-center pt-2">
                  <span className="text-xs font-bold text-dark-muted">{hora}</span>
                </div>
                {/* Celdas por día */}
                {DIAS_SEMANA.map((dia, i) => {
                  const fecha   = toISO(addDays(lunes, i))
                  const esMesB  = idxCambioMes > -1 && i >= idxCambioMes
                  const clases  = horarios.filter(h => h.hora_str === hora && h.dia === dia.val).sort(sortDisc)
                  return (
                    <div key={dia.val} className="space-y-1">
                      {clases.length === 0 ? (
                        <div className={clsx(
                          'h-10 rounded-lg border border-dashed',
                          esMesB ? 'border-indigo-800/30 bg-indigo-950/20' : 'border-dark-border/20'
                        )} />
                      ) : (
                        clases.map(h => {
                          const mod = modDe(h, fecha)
                          return (
                            <ClaseCardCompacta
                              key={h.id}
                              horario={h}
                              modificacion={mod}
                              mesBorder={esMesB}
                              discLabel={DISC_LABEL}
                              discColor={DISC_COLOR}
                              onModificar={() => setModPanel({ horario: h, fecha, mod })}
                              onEliminarMod={() => eliminarMod(mod.id)}
                            />
                          )
                        })
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </GridHoraria>
        </>
      )}

      {/* ── VISTA MAESTRA ─────────────────────────────────────────────────── */}
      {vista === 'maestra' && (
        <>
          {/* Aviso permanencia */}
          <div className="flex items-start gap-3 bg-orange-950/40 border border-orange-800/40 rounded-xl px-4 py-3">
            <AlertTriangle size={15} className="text-orange-400 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-xs font-semibold text-orange-300">Los cambios aquí son permanentes</p>
              <p className="text-xs text-orange-400/80 mt-0.5">
                Cualquier modificación a la grilla maestra se refleja en <span className="font-semibold">todas las semanas</span>.
                Para cambios puntuales de un día específico, usá el lápiz <span className="font-semibold">✏️ en la Vista Semana</span>.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid gap-1.5" style={{ gridTemplateColumns: '3rem repeat(6, 1fr)' }}>
                  <div className="h-10 bg-dark-surface/50 rounded animate-pulse"/>
                  {[...Array(6)].map((_, j) => <div key={j} className="h-10 bg-dark-surface rounded-xl animate-pulse"/>)}
                </div>
              ))}
            </div>
          ) : (
            <>
              <GridHoraria>
                <HeaderDias />
                {horasUnicas.map(hora => (
                  <div key={hora} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '3rem repeat(6, 1fr)' }}>
                    {/* Etiqueta hora */}
                    <div className="flex items-start justify-center pt-2">
                      <span className="text-xs font-bold text-dark-muted">{hora}</span>
                    </div>
                    {/* Celdas por día */}
                    {DIAS_SEMANA.map(dia => {
                      const clases = horarios.filter(h => h.hora_str === hora && h.dia === dia.val).sort(sortDisc)
                      return (
                        <div key={dia.val} className="space-y-1">
                          {clases.length === 0 ? (
                            <div
                              className="h-10 rounded-lg border border-dashed border-dark-border/20 hover:border-indigo-700/30 transition-colors cursor-pointer"
                              onClick={() => setPanel({ defaultDia: dia.val })}
                            />
                          ) : (
                            clases.map(h => (
                              <ClaseCardCompacta
                                key={h.id}
                                horario={h}
                                modoMaestra
                                discLabel={DISC_LABEL}
                                discColor={DISC_COLOR}
                                onEdit={() => setPanel({ horario: h })}
                                onDelete={() => eliminarMaestro(h.id)}
                              />
                            ))
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </GridHoraria>

              {/* Resumen disciplinas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {Object.entries(
                  horarios.reduce((acc, h) => { acc[h.disciplina] = (acc[h.disciplina]||0)+1; return acc }, {})
                ).map(([disc, count]) => (
                  <div key={disc} className="card flex items-center gap-3 py-3">
                    <div className="w-2 h-6 rounded-full" style={{ backgroundColor: DISC_COLOR[disc]||'#6b7280' }}/>
                    <div>
                      <p className="text-sm font-bold text-dark-text">{count}</p>
                      <p className="text-xs text-dark-muted">{DISC_LABEL[disc]||disc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Panels */}
      {panel && (
        <HorarioPanel
          horario={panel?.horario ?? null}
          defaultDia={panel?.defaultDia ?? null}
          defaultSede={sede}
          profes={profes}
          onClose={() => setPanel(null)}
          onSaved={() => { invalidate(); setPanel(null) }}
        />
      )}
      {modPanel && (
        <ModificacionPanel
          horario={modPanel.horario}
          fecha={modPanel.fecha}
          semanaISO={semanaISO}
          sede={sede}
          modificacion={modPanel.mod ?? null}
          profes={profes}
          onClose={() => setModPanel(null)}
          onSaved={() => { invalidate(); setModPanel(null) }}
        />
      )}
    </div>
  )
}

// ── Card compacta ─────────────────────────────────────────────────────────────
function ClaseCardCompacta({ horario: h, modificacion: mod, modoMaestra, mesBorder, discLabel = DISC_LABEL_FB, discColor = DISC_COLOR_FB, onEdit, onDelete, onModificar, onEliminarMod }) {
  const color = discColor[h.disciplina] || '#6b7280'
  const esCancelada = mod?.cancelada === true
  const profeNombre = esCancelada ? null : (mod?.profe_real_nombre ?? h.profe_nombre)
  const hayCambio   = mod && !esCancelada && (mod.profe_real !== h.profe)

  if (esCancelada) {
    return (
      <div
        className="rounded-lg border border-red-900/40 bg-red-950/20 px-2 py-1.5 group transition-colors relative opacity-60"
        style={{ borderLeftColor: '#ef4444', borderLeftWidth: 3 }}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <Ban size={10} className="text-red-400 flex-shrink-0"/>
            <span className="text-xs font-semibold text-red-400 line-through">
              {discLabel[h.disciplina] || h.disciplina}
            </span>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEliminarMod} className="p-0.5 rounded text-dark-muted hover:text-red-400" title="Quitar suspensión"><Trash2 size={10}/></button>
            <button onClick={onModificar}   className="p-0.5 rounded text-dark-muted hover:text-yellow-400" title="Editar"><Pencil size={10}/></button>
          </div>
        </div>
        {mod?.motivo && (
          <p className="text-xs text-red-500/70 italic mt-0.5 truncate">{mod.motivo}</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'rounded-lg border px-2 py-1.5 group transition-colors relative',
        hayCambio
          ? 'border-yellow-700/50 bg-yellow-900/10'
          : mesBorder
            ? 'border-indigo-800/40 bg-indigo-950/30 hover:border-indigo-600/50'
            : 'border-dark-border bg-dark-surface hover:border-indigo-700/30'
      )}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      {/* Disciplina + acciones */}
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-xs font-semibold px-1 rounded leading-tight"
          style={{ color, backgroundColor: color + '25' }}
        >
          {discLabel[h.disciplina] || h.disciplina}
        </span>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {modoMaestra ? (
            <>
              <button onClick={onEdit}   className="p-0.5 rounded text-dark-muted hover:text-blue-400"><Pencil size={10}/></button>
              <button onClick={onDelete} className="p-0.5 rounded text-dark-muted hover:text-red-400"><Trash2 size={10}/></button>
            </>
          ) : (
            <>
              {mod && <button onClick={onEliminarMod} className="p-0.5 rounded text-dark-muted hover:text-red-400" title="Quitar modificación"><Trash2 size={10}/></button>}
              <button onClick={onModificar} className="p-0.5 rounded text-dark-muted hover:text-yellow-400" title="Modificar"><Pencil size={10}/></button>
            </>
          )}
        </div>
      </div>

      {/* Profe + cupos */}
      <div className="flex items-center gap-1 mt-1">
        {profeNombre ? (
          <>
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center text-white"
              style={{ backgroundColor: hayCambio ? '#eab308' : (h.profe_color || '#6b7280'), fontSize: 7 }}
            >
              {profeNombre.slice(0, 1)}
            </div>
            <span className={clsx('text-xs truncate', hayCambio ? 'text-yellow-400' : 'text-dark-muted')}>
              {profeNombre}
            </span>
          </>
        ) : (
          <span className="text-xs text-dark-border italic">—</span>
        )}
        <span className="text-xs text-dark-muted ml-auto flex-shrink-0">{h.capacidad_max}p</span>
      </div>

      {mod?.motivo && (
        <p className="text-xs text-yellow-500/70 italic mt-0.5 truncate">{mod.motivo}</p>
      )}
    </div>
  )
}
