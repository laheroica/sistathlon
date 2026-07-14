import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DollarSign, Calendar, CreditCard, Check, Trash2, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import SlidePanel from '../ui/SlidePanel'
import api from '../../lib/api'
import clsx from 'clsx'
import { money } from '../../lib/format'
import { useDisciplinas } from '../../hooks/useDisciplinas'
import { useNegocio } from '../../hooks/useNegocio'

// ─── Fallbacks (por si la API tarda) ──────────────────────────────────────────
const DISC_LABEL_FB  = { CF: 'CrossFit', HF: 'Heavy Func.', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus', FB: 'FullBody' }
const DISC_BADGE_FB  = {
  CF: 'bg-blue-900/70 text-blue-200', HF: 'bg-green-900/70 text-green-200',
  HX: 'bg-yellow-900/70 text-yellow-200', TN: 'bg-purple-900/70 text-purple-200',
  KD: 'bg-pink-900/70 text-pink-200', BP: 'bg-sky-900/70 text-sky-200',
  FB: 'bg-orange-900/70 text-orange-200',
}
const ESTADO_COLOR = {
  activo: 'text-green-400', mora: 'text-yellow-400',
  baja: 'text-orange-400', alejado: 'text-red-400', temporal: 'text-sky-400',
}
const FREQ_LABEL = { '2x': '2×/sem', '3x': '3×/sem', '5x': '5×/sem', libre: 'Libre' }
const HORARIOS   = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
const COMBO_OPTS = [
  { value: '',         label: 'Sin combo' },
  { value: 'hyrox_cf', label: '+ Hyrox' },
  { value: 'hyrox_hf', label: '+ Hyrox (HF)' },
]

function mesOptions() {
  const opts = []
  const hoy  = new Date()
  for (let i = -1; i <= 2; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    opts.push({
      value: format(d, 'yyyy-MM-dd'),
      label: format(d, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
    })
  }
  return opts
}

const pagoSchema = z.object({
  mes:        z.string().min(1),
  monto:      z.coerce.number().positive('Ingresá un monto válido'),
  fecha_pago: z.string().min(1),
  metodo:     z.enum(['efectivo', 'transferencia', 'debito']),
  notas:      z.string().optional(),
})

// ─── Campo editable inline ─────────────────────────────────────────────────────
function CampoEditable({ label, value, onSave, type = 'text', placeholder = '' }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState(value ?? '')

  useEffect(() => { setLocal(value ?? '') }, [value])

  function confirmar() {
    setEditing(false)
    if (local !== (value ?? '')) onSave(local)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={e => setLocal(e.target.value)}
        onBlur={confirmar}
        onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') { setLocal(value ?? ''); setEditing(false) } }}
        className="input text-sm py-1 h-8"
      />
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-sm text-dark-text hover:text-indigo-300 text-left truncate transition-colors w-full"
      title="Clic para editar"
    >
      {value || <span className="text-dark-muted/50 italic">{placeholder || `Sin ${label.toLowerCase()}`}</span>}
    </button>
  )
}

// ─── Selector de chip ──────────────────────────────────────────────────────────
function ChipSelector({ options, value, onChange, renderLabel, className = '' }) {
  return (
    <div className={clsx('flex flex-wrap gap-1.5', className)}>
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const lbl = typeof opt === 'string' ? opt : opt.label
        const active = value === val
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
              active
                ? 'bg-primary-dark border-primary-dark text-white'
                : 'border-dark-border text-dark-muted hover:border-primary-dark/50 hover:text-dark-text'
            )}
          >
            {renderLabel ? renderLabel(val, lbl) : lbl}
          </button>
        )
      })}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function FichaAlumnoPanel({ alumno: alumnoInit, open, onClose }) {
  const qc   = useQueryClient()
  const { sedeOptions, sedeLabel } = useNegocio()
  const meses = mesOptions()

  // Disciplinas dinámicas
  const { labelMap: apiLabelMap, badgeMap: apiBadgeMap, frecMap } = useDisciplinas()
  const DISC_LABEL = { ...DISC_LABEL_FB, ...apiLabelMap }
  const DISC_BADGE = { ...DISC_BADGE_FB, ...apiBadgeMap }
  // Frecuencias dinámicas (fallback a las hardcodeadas para compatibilidad)
  const FRECUENCIAS_FB = { CF: ['2x','3x','libre'], HF: ['2x','3x','5x'], HX: ['3x'], TN: ['3x'], KD: ['3x'], BP: ['libre'], FB: ['2x','3x','5x'] }
  const FRECUENCIAS = Object.keys(frecMap).length > 0 ? frecMap : FRECUENCIAS_FB

  // Estado local del alumno (para reflejar cambios inmediatos en la UI)
  const [alumno, setAlumno] = useState(alumnoInit)
  useEffect(() => { setAlumno(alumnoInit) }, [alumnoInit])

  // Cambios pendientes de actividad (disciplina, frecuencia, horario, combo)
  const [pendiente, setPendiente] = useState({})
  useEffect(() => { setPendiente({}) }, [alumnoInit])
  const hayPendiente = Object.keys(pendiente).length > 0
  function setPend(field, value) {
    setPendiente(prev => ({ ...prev, [field]: value }))
    setAlumno(prev => ({ ...prev, [field]: value }))  // reflejo visual inmediato
  }

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      mes:        format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      fecha_pago: format(new Date(), 'yyyy-MM-dd'),
      metodo:     'efectivo',
      monto:      '',
      notas:      '',
    },
  })

  useEffect(() => {
    if (alumnoInit) {
      reset({
        mes:        format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        fecha_pago: format(new Date(), 'yyyy-MM-dd'),
        metodo:     'efectivo',
        monto:      alumnoInit.ultimo_pago?.monto || alumnoInit.cuota_actual || '',
        notas:      '',
      })
    }
  }, [alumnoInit, reset])

  // Horarios disponibles según sede + disciplina (+ combo Hyrox si aplica)
  const isCombo = !!(alumno?.combo)
  const disciplinasHorario = [alumno?.disciplina].filter(Boolean)
  if (alumno?.combo === 'hyrox_cf' || alumno?.combo === 'hyrox_hf') disciplinasHorario.push('HX')
  const { data: horariosDisponibles } = useQuery({
    queryKey: ['horarios-disponibles', alumno?.sede, disciplinasHorario, isCombo],
    queryFn: () => {
      const params = new URLSearchParams()
      if (alumno?.sede) params.append('sede', alumno.sede)
      disciplinasHorario.forEach(d => params.append('disciplina', d))
      if (isCombo) params.append('grouped', 'true')
      return api.get(`/horarios/disponibles/?${params}`).then(r => r.data)
    },
    enabled: !!alumno?.sede && !!alumno?.disciplina,
  })
  // horariosGrid: string[] (sin combo) o [{disciplina, horas[]}] (con combo)
  const horariosGrid = horariosDisponibles ?? HORARIOS

  // Precios de combos para sugerencia rápida en el form de pago
  const mesParaPrecios = format(startOfMonth(new Date()), 'yyyy-MM')
  const { data: comboPrices = [] } = useQuery({
    queryKey: ['precios-combo', mesParaPrecios],
    queryFn: () => api.get(`/precios/?mes=${mesParaPrecios}`)
      .then(r => r.data.filter(p => p.disciplina === 'COMBO' && p.tipo === 'regular')),
    enabled: isCombo,
    staleTime: 5 * 60 * 1000,
  })

  // PATCH campo del alumno
  const patchAlumno = useMutation({
    mutationFn: (data) => api.patch(`/alumnos/${alumno.id}/`, data),
    onSuccess: (res) => {
      setAlumno(prev => ({ ...prev, ...res.data }))
      setPendiente({})
      qc.invalidateQueries({ queryKey: ['alumnos'] })
      toast.success('Guardado')
    },
    onError: (err) => {
      const data = err.response?.data
      const msg = typeof data === 'string'
        ? data
        : data?.detail || Object.values(data || {})[0]?.[0] || 'Error al guardar'
      toast.error(msg)
    },
  })

  // Historial de pagos del alumno
  const { data: pagosData, refetch: refetchPagos } = useQuery({
    queryKey: ['pagos-alumno', alumnoInit?.id],
    enabled: !!alumnoInit?.id && open,
    queryFn: () => api.get(`/pagos/?alumno=${alumnoInit.id}`).then(r => r.data),
  })
  const pagosAlumno = Array.isArray(pagosData) ? pagosData : (pagosData?.results ?? [])

  // Eliminar pago
  const [confirmDelete, setConfirmDelete] = useState(null)  // id del pago a confirmar
  const deletePago = useMutation({
    mutationFn: (id) => api.delete(`/pagos/${id}/`),
    onSuccess: () => {
      toast.success('Pago eliminado')
      setConfirmDelete(null)
      refetchPagos()
      qc.invalidateQueries({ queryKey: ['alumnos'] })
    },
    onError: () => toast.error('No se pudo eliminar el pago'),
  })

  // Registrar pago
  const pagoMutation = useMutation({
    mutationFn: (data) => api.post('/pagos/', { alumno: alumno.id, ...data }),
    onSuccess: () => {
      toast.success(`Pago registrado — ${alumno.nombre_completo}`)
      qc.invalidateQueries({ queryKey: ['alumnos'] })
      onClose()
    },
    onError: (err) => {
      const msg = err.response?.data?.non_field_errors?.[0]
        || err.response?.data?.detail
        || 'Error al registrar el pago'
      toast.error(msg)
    },
  })

  if (!alumno) return null

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={alumno.nombre_completo}
      subtitle={`Sede ${sedeLabel(alumno.sede)}`}
    >
      <form onSubmit={handleSubmit(d => pagoMutation.mutate(d))} className="space-y-5">

        {/* ── BLOQUE 0: Datos personales ──────────────────────────────── */}
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-3">
            Datos del alumno <span className="font-normal normal-case text-dark-muted/60">(clic para editar)</span>
          </p>
          {[
            { label: 'Nombre',    field: 'nombre',    type: 'text',  placeholder: 'Nombre' },
            { label: 'Apellido',  field: 'apellido',  type: 'text',  placeholder: 'Apellido' },
            { label: 'DNI',       field: 'dni',       type: 'text',  placeholder: 'Sin DNI' },
            { label: 'Celular',   field: 'celular',   type: 'tel',   placeholder: 'Ej: 2954123456' },
            { label: 'Email',     field: 'email',     type: 'email', placeholder: 'Sin email' },
            { label: 'Instagram', field: 'instagram', type: 'text',  placeholder: '@usuario' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field} className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-dark-muted w-20 shrink-0">{label}</span>
              <div className="flex-1 min-w-0">
                <CampoEditable
                  label={label}
                  value={alumno[field]}
                  type={type}
                  placeholder={placeholder}
                  onSave={(val) => patchAlumno.mutate({ [field]: val })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── BLOQUE 1: Confirmar actividad ───────────────────────────── */}
        <div className="card space-y-4">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            Confirmar actividad
          </p>

          {/* Sede */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Sede</p>
            <ChipSelector
              options={sedeOptions.map(s => ({ value: s.val, label: s.label }))}
              value={alumno.sede}
              onChange={(v) => setPend('sede', v)}
            />
          </div>

          {/* Estado */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Estado</p>
            <ChipSelector
              options={[
                { value: 'activo',   label: 'Activo' },
                { value: 'mora',     label: 'Impago' },
                { value: 'temporal', label: 'Temporal' },
                { value: 'alejado',  label: 'Alejado' },
                { value: 'baja',     label: 'Baja' },
              ]}
              value={alumno.estado}
              onChange={(v) => setPend('estado', v)}
              renderLabel={(val, lbl) => (
                <span className={clsx(alumno.estado === val && ESTADO_COLOR[val])}>{lbl}</span>
              )}
            />
          </div>

          {/* Disciplina */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Disciplina</p>
            <ChipSelector
              options={Object.entries(DISC_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              value={alumno.disciplina}
              onChange={(v) => { setPend('disciplina', v); setPend('frecuencia', FRECUENCIAS[v]?.[0] || '') }}
              renderLabel={(val, lbl) => (
                <span className={clsx(alumno.disciplina === val && DISC_BADGE[val], 'rounded px-1')}>
                  {lbl}
                </span>
              )}
            />
          </div>

          {/* Pertenencia (solo para FB y HX) */}
          {['FB','HX'].includes(alumno.disciplina) && (
            <div>
              <p className="text-xs text-dark-muted mb-1.5">Pertenencia / Split</p>
              <ChipSelector
                options={[
                  { value: 'athlon', label: 'Athlon (100%)' },
                  { value: 'day',    label: 'Day (50/50)' },
                  { value: 'otro',   label: 'Otro' },
                ]}
                value={alumno.pertenencia || 'athlon'}
                onChange={(v) => {
                  setPend('pertenencia', v)
                  if (v === 'day') setPend('porcentaje_athlon', 50)
                  if (v === 'athlon') setPend('porcentaje_athlon', 100)
                }}
              />
              {(alumno.pertenencia === 'otro') && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-dark-muted">% Athlon:</span>
                  <input
                    type="number" min="0" max="100"
                    className="input w-20 text-sm py-1"
                    value={alumno.porcentaje_athlon ?? 100}
                    onChange={e => setPend('porcentaje_athlon', parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Combo (solo para CF y HF) */}
          {['CF','HF'].includes(alumno.disciplina) && (
            <div>
              <p className="text-xs text-dark-muted mb-1.5">Combo</p>
              <ChipSelector
                options={COMBO_OPTS.filter(o => o.value === '' || o.value.includes(alumno.disciplina.toLowerCase()))}
                value={alumno.combo || ''}
                onChange={(v) => setPend('combo', v)}
              />
            </div>
          )}

          {/* Frecuencia */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Frecuencia</p>
            <ChipSelector
              options={(FRECUENCIAS[alumno.disciplina] || ['2x','3x']).map(f => ({ value: f, label: FREQ_LABEL[f] }))}
              value={alumno.frecuencia}
              onChange={(v) => setPend('frecuencia', v)}
            />
          </div>

          {/* Horario */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Horario</p>
            {isCombo && Array.isArray(horariosGrid) && horariosGrid[0]?.disciplina ? (
              // Modo combo: cada disciplina tiene su propio selector de horario
              <div className="space-y-4">
                {horariosGrid.map(grupo => {
                  // La disciplina principal guarda en `horario`; la combo en `horario_combo`
                  const esDiscPrincipal = grupo.disciplina === alumno.disciplina
                  const field    = esDiscPrincipal ? 'horario' : 'horario_combo'
                  const selected = esDiscPrincipal ? alumno.horario : alumno.horario_combo
                  return (
                    <div key={grupo.disciplina}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={clsx(
                          'inline-block px-2 py-0.5 rounded text-xs font-medium',
                          DISC_BADGE[grupo.disciplina] || 'bg-gray-700 text-gray-300'
                        )}>
                          {DISC_LABEL[grupo.disciplina] || grupo.disciplina}
                        </span>
                        {selected && (
                          <span className="text-xs text-dark-muted font-mono">{selected}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {grupo.horas.map(h => (
                          <button
                            key={`${grupo.disciplina}-${h}`}
                            type="button"
                            onClick={() => setPend(field, h)}
                            className={clsx(
                              'py-1.5 rounded-lg text-xs font-mono font-medium border transition-all',
                              selected === h
                                ? 'bg-primary-dark border-primary-dark text-white'
                                : 'border-dark-border text-dark-muted hover:border-primary-dark/50'
                            )}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Modo normal: lista plana de horas
              <div className="grid grid-cols-4 gap-1.5">
                {(Array.isArray(horariosGrid) ? horariosGrid : HORARIOS).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setPend('horario', h)}
                    className={clsx(
                      'py-1.5 rounded-lg text-xs font-mono font-medium border transition-all',
                      alumno.horario === h
                        ? 'bg-primary-dark border-primary-dark text-white'
                        : 'border-dark-border text-dark-muted hover:border-primary-dark/50'
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Botón guardar actividad */}
          {hayPendiente && (
            <button
              type="button"
              onClick={() => patchAlumno.mutate(pendiente)}
              disabled={patchAlumno.isPending}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              <Check size={15} />
              {patchAlumno.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
        </div>

        {/* ── BLOQUE 2: Registrar pago ────────────────────────────────── */}
        <div className="card space-y-4">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            Registrar pago{watch('mes') ? ` — ${format(new Date(watch('mes') + 'T12:00:00'), 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}` : ''}
          </p>

          {/* Último pago */}
          {alumno.ultimo_pago && (
            <div className="flex items-center justify-between text-xs bg-dark-bg rounded-lg px-3 py-2">
              <span className="text-dark-muted">Último pago</span>
              <span className="text-dark-text font-medium">
                {money(alumno.ultimo_pago.monto)} · {alumno.ultimo_pago.fecha}
              </span>
            </div>
          )}

          {/* Mes */}
          <div>
            <label className="block text-xs text-dark-muted mb-1.5">
              <span className="flex items-center gap-1"><Calendar size={11} /> Mes</span>
            </label>
            <select {...register('mes')} className="input text-sm">
              {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Precio sugerido combo */}
          {isCombo && comboPrices.length > 0 && (
            <div>
              <label className="block text-xs text-dark-muted mb-1.5">
                Precio combo <span className="text-dark-border">(clic para aplicar)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[...comboPrices]
                  .sort((a, b) => a.frecuencia.localeCompare(b.frecuencia))
                  .map(p => (
                    <button
                      key={p.frecuencia}
                      type="button"
                      onClick={() => setValue('monto', parseFloat(p.precio))}
                      className="px-3 py-1.5 rounded-lg border border-dark-border text-xs
                        text-dark-muted hover:border-indigo-500 hover:text-dark-text
                        hover:bg-indigo-900/20 transition-colors bg-dark-bg font-medium"
                    >
                      {p.frecuencia.replace('combo', 'Combo ')} · ${Number(p.precio).toLocaleString('es-AR')}
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {/* Monto + Fecha en fila */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-muted mb-1.5">
                <span className="flex items-center gap-1"><DollarSign size={11} /> Monto</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
                <input {...register('monto')} type="number" step="1" placeholder="50000" className="input pl-7 text-sm" />
              </div>
              {errors.monto && <p className="text-red-400 text-xs mt-1">{errors.monto.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1.5">
                <span className="flex items-center gap-1"><Calendar size={11} /> Fecha</span>
              </label>
              <input {...register('fecha_pago')} type="date" className="input text-sm" />
            </div>
          </div>

          {/* Método */}
          <div>
            <label className="block text-xs text-dark-muted mb-1.5">
              <span className="flex items-center gap-1"><CreditCard size={11} /> Método</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'efectivo',      label: '💵 Efectivo' },
                { value: 'transferencia', label: '📲 Transf.' },
                { value: 'debito',        label: '💳 Débito' },
              ].map(({ value, label }) => (
                <label key={value} className="cursor-pointer">
                  <input {...register('metodo')} type="radio" value={value} className="sr-only peer" />
                  <div className="text-center text-xs py-2 rounded-xl border border-dark-border
                    text-dark-muted transition-all
                    peer-checked:bg-primary-dark peer-checked:text-white peer-checked:border-primary-dark
                    hover:border-primary-dark/50">
                    {label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Comentarios */}
          <div>
            <label className="block text-xs text-dark-muted mb-1.5">
              Comentarios <span className="text-dark-border">(opcional)</span>
            </label>
            <textarea
              {...register('notas')}
              rows={2}
              placeholder="Escribir comentario..."
              className="input text-sm resize-none w-full"
            />
          </div>
        </div>

        {/* ── BLOQUE 3: Historial de pagos ────────────────────────────── */}
        {pagosAlumno.length > 0 && (
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
              Pagos registrados
            </p>
            {pagosAlumno.slice(0, 8).map((p) => {
              const mesLabel = p.mes
                ? new Date(p.mes + 'T12:00:00').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
                    .replace(/^\w/, c => c.toUpperCase())
                : '—'
              const isConfirming = confirmDelete === p.id

              return (
                <div key={p.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    isConfirming ? 'border-red-700/60 bg-red-950/30' : 'border-dark-border bg-dark-bg'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-dark-text">{mesLabel}</span>
                      <span className="text-xs text-dark-muted">
                        {p.metodo === 'efectivo' ? '💵' : p.metodo === 'transferencia' ? '📲' : '💳'}
                        {' '}{p.fecha_pago}
                      </span>
                    </div>
                    {p.notas && <p className="text-xs text-dark-muted/70 mt-0.5 truncate">{p.notas}</p>}
                  </div>
                  <span className="text-sm font-bold text-green-400 shrink-0">
                    ${Number(p.monto).toLocaleString('es-AR')}
                  </span>

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle size={11} /> ¿Eliminar?
                      </span>
                      <button
                        type="button"
                        onClick={() => deletePago.mutate(p.id)}
                        disabled={deletePago.isPending}
                        className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium transition-colors"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 rounded-lg border border-dark-border text-dark-muted hover:text-dark-text text-xs transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(p.id)}
                      className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0"
                      title="Eliminar pago"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Botón confirmar ─────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={pagoMutation.isPending}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base"
        >
          <Check size={18} />
          {pagoMutation.isPending ? 'Guardando...' : 'Confirmar pago'}
        </button>

      </form>
    </SlidePanel>
  )
}
