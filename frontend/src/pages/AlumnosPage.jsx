import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, UserPlus, MessageCircle, Instagram, ChevronDown, DollarSign, Send, CalendarCheck, Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import CommandPalette from '../components/ui/CommandPalette'
import FichaAlumnoPanel from '../components/alumnos/FichaAlumnoPanel'
import SlidePanel from '../components/ui/SlidePanel'
import { useDisciplinas } from '../hooks/useDisciplinas'
import { useNegocio } from '../hooks/useNegocio'

const TABS = [
  // "Al día" = todos los activos (el estado ya indica que están al corriente)
  { id: 'activo',   label: 'Al día',      estados: ['activo'],          color: 'text-green-400' },
  // "Impago" = mora (sin mínimo de días — los que el sistema marcó en mora)
  { id: 'mora',     label: 'Impago',      estados: ['mora'],            color: 'text-yellow-400' },
  { id: 'alejado',  label: 'Alejados',    estados: ['baja', 'alejado'], color: 'text-red-400' },
  { id: 'temporal', label: 'Temporales',  estados: ['temporal'],        color: 'text-sky-400' },
  { id: 'pormes',   label: 'Por mes',     estados: [],                  color: 'text-purple-400' },
]

// Genera opciones de meses: los últimos 4 + el actual
function mesesRecientes() {
  const opts = []
  const hoy = new Date()
  for (let i = -4; i <= 0; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    opts.push({
      value: format(d, 'yyyy-MM-dd'),
      label: format(d, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
    })
  }
  return opts.reverse() // más reciente primero
}

// Default al mes anterior si estamos en los primeros 10 días del mes
function mesPorDefecto() {
  const hoy = new Date()
  const ref = hoy.getDate() <= 10
    ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    : hoy
  return format(new Date(ref.getFullYear(), ref.getMonth(), 1), 'yyyy-MM-dd')
}

const RANGOS_DIAS = [
  { id: 'todos',  label: 'Todos',      min: 0,   max: 9999 },
  { id: 'r30',    label: '30-90 días', min: 30,  max: 90 },
  { id: 'r90',    label: '+90 días',   min: 91,  max: 9999 },
]

const DISC_ORDER = ['CF', 'HF', 'HX', 'TN', 'KD', 'FB']
const FREQ_ORDER = ['2x', '3x', '5x', 'libre']
const FREQ_LBL   = { '2x': '2×', '3x': '3×', '5x': '5×', libre: 'libre' }

const DISC_LABEL = { CF: 'CF', HF: 'HF', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus', FB: 'FullBody' }
const DISC_BADGE = {
  CF: 'bg-blue-900/70 text-blue-200',
  HF: 'bg-green-900/70 text-green-200',
  HX: 'bg-yellow-900/70 text-yellow-200',
  TN: 'bg-purple-900/70 text-purple-200',
  KD: 'bg-pink-900/70 text-pink-200',
  BP: 'bg-sky-900/70 text-sky-200',
  FB: 'bg-orange-900/70 text-orange-200',
}
const ESTADO_DOT = {
  activo: 'bg-green-400', mora: 'bg-yellow-400',
  baja: 'bg-orange-400', alejado: 'bg-red-400', temporal: 'bg-sky-400',
}

function agruparPorHorario(alumnos) {
  const grupos = {}
  for (const a of alumnos) {
    const key = a.horario || 'Sin horario'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(a)
  }
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
}

function agruparPagosPorHorario(pagos) {
  const grupos = {}
  for (const p of pagos) {
    const key = p.alumno_horario || 'Sin horario'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(p)
  }
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
}

// ─── Fila de pago (tab Por mes) ────────────────────────────────────────────────
const METODO_ICON = { efectivo: '💵', transferencia: '📲', debito: '💳' }

function PagoRow({ pago, badgeMap = DISC_BADGE, labelMap = DISC_LABEL }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-surface rounded-xl">
      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-dark-text text-sm">{pago.alumno_nombre}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded-md', badgeMap[pago.alumno_disciplina] || 'bg-gray-700 text-gray-200')}>
            {labelMap[pago.alumno_disciplina] || pago.alumno_disciplina}
          </span>
          <span className="text-xs text-dark-muted">{pago.alumno_frecuencia}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-green-400">
          {money(pago.monto)}
        </div>
        <div className="text-xs text-dark-muted">
          {METODO_ICON[pago.metodo]} {pago.fecha_pago}
        </div>
      </div>
    </div>
  )
}

function GrupoPorMes({ hora, pagos, badgeMap = DISC_BADGE, labelMap = DISC_LABEL }) {
  const [collapsed, setCollapsed] = useState(false)
  const total = pagos.reduce((s, p) => s + Number(p.monto), 0)

  const porDisc = pagos.reduce((acc, p) => {
    acc[p.alumno_disciplina] = (acc[p.alumno_disciplina] || 0) + 1
    return acc
  }, {})

  return (
    <div className="mb-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl
          text-sm font-semibold text-dark-text hover:bg-dark-border/30 transition-colors"
      >
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={14} className="text-dark-muted" />
        </motion.div>
        <span className="text-dark-muted font-mono text-xs w-12">{hora}</span>
        <div className="flex gap-1.5">
          {Object.entries(porDisc).map(([disc, count]) => (
            <span key={disc} className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded-md', badgeMap[disc] || 'bg-gray-700 text-gray-200')}>
              {labelMap[disc] || disc} {count}
            </span>
          ))}
        </div>
        <span className="ml-auto text-green-400 font-semibold text-xs">
          {money(total)}
        </span>
        <span className="text-dark-muted font-normal text-xs ml-2">{pagos.length} pagos</span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden mt-1 space-y-1 pl-2"
          >
            {pagos.map((p) => <PagoRow key={p.id} pago={p} badgeMap={badgeMap} labelMap={labelMap} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const MES_ACTUAL = new Date().toLocaleString('es-AR', { month: 'long' })

function abrirRecordatorio(e, alumno) {
  e.stopPropagation()
  const tel = alumno.celular?.replace(/\D/g, '')
  if (!tel) return
  const msg = encodeURIComponent(
    `Hola ${alumno.nombre}! 👋 Te escribimos desde Athlon para recordarte que tu cuota de ${MES_ACTUAL} está pendiente. Cualquier consulta o si necesitás coordinar el pago, avisanos. 💪`
  )
  window.open(`https://wa.me/54${tel}?text=${msg}`, '_blank')
}

const TEMPLATES_MSG = (a) => {
  const dias   = a.dias_sin_pago >= 9999 ? 'hace mucho tiempo' : `hace ${a.dias_sin_pago} días`
  const monto  = a.ultimo_pago ? `$${Number(a.ultimo_pago.monto).toLocaleString('es-AR')}` : ''
  const cuota  = a.cuota_actual ? `$${Number(a.cuota_actual).toLocaleString('es-AR')}` : ''
  return [
    {
      label: 'Cuota pendiente',
      texto: `Hola ${a.nombre}! 👋 Te escribimos desde Athlon para avisarte que tu cuota de ${MES_ACTUAL} figura pendiente${monto ? ` (último pago: ${monto})` : ''}. Cuando puedas acercate o avisanos y lo coordinamos. 💪`,
    },
    {
      label: 'Te extrañamos',
      texto: `Hola ${a.nombre}! 🙌 Hace un tiempo que no te vemos por Athlon y te extrañamos. ¿Cómo estás? Si querés retomar, estamos acá para ayudarte a encontrar el plan ideal. ¡Te esperamos!`,
    },
    {
      label: 'Volver a entrenar',
      texto: `Hola ${a.nombre}! 💪 Nos acordamos de vos y queremos saber cómo estás. Si tenés ganas de volver a entrenar tenemos opciones para adaptarnos a tu ritmo. ¡Avisanos!`,
    },
    {
      label: 'Personalizado',
      texto: '',
    },
  ]
}

function PanelMensaje({ alumno, open, onClose }) {
  const templates = alumno ? TEMPLATES_MSG(alumno) : []
  const [selIdx, setSelIdx] = useState(0)
  const [texto, setTexto] = useState('')

  useEffect(() => {
    if (!alumno) return
    const t = TEMPLATES_MSG(alumno)
    setSelIdx(0)
    setTexto(t[0].texto)
  }, [alumno])

  function seleccionarTemplate(idx) {
    setSelIdx(idx)
    setTexto(templates[idx].texto)
  }

  function enviarWA() {
    if (!alumno?.celular || !texto.trim()) return
    const tel = alumno.celular.replace(/\D/g, '')
    window.open(`https://wa.me/54${tel}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  if (!alumno) return null

  const diasLabel = alumno.dias_sin_pago >= 9999 ? 'Sin pago registrado' : `${alumno.dias_sin_pago} días sin pagar`
  const montoLabel = alumno.ultimo_pago ? `Último pago: $${Number(alumno.ultimo_pago.monto).toLocaleString('es-AR')} · ${alumno.ultimo_pago.fecha}` : 'Sin pagos'

  return (
    <SlidePanel open={open} onClose={onClose} title={`Mensaje a ${alumno.nombre_completo}`}>
      <div className="space-y-4 p-1">
        {/* Info del alumno */}
        <div className="bg-dark-bg rounded-xl border border-dark-border p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-muted">Estado</span>
            <span className={clsx('font-semibold', ESTADO_DOT[alumno.estado] && 'capitalize')}>{alumno.estado}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-muted">Días sin pago</span>
            <span className={clsx('font-semibold',
              alumno.dias_sin_pago >= 90 ? 'text-red-400' :
              alumno.dias_sin_pago >= 30 ? 'text-yellow-400' : 'text-green-400'
            )}>{diasLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-muted">Pago</span>
            <span className="text-dark-text">{montoLabel}</span>
          </div>
          {alumno.cuota_actual > 0 && (
            <div className="flex justify-between">
              <span className="text-dark-muted">Cuota</span>
              <span className="text-dark-text">${Number(alumno.cuota_actual).toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>

        {/* Selector de plantilla */}
        <div>
          <p className="text-xs text-dark-muted mb-2 font-medium uppercase tracking-wide">Elegí el mensaje</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t, i) => (
              <button key={i} type="button"
                onClick={() => seleccionarTemplate(i)}
                className={clsx(
                  'py-2 px-3 rounded-xl text-xs font-medium border transition-colors text-left',
                  selIdx === i
                    ? 'bg-indigo-700 border-indigo-500 text-white'
                    : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Texto del mensaje */}
        <div>
          <p className="text-xs text-dark-muted mb-1.5 font-medium uppercase tracking-wide">Texto del mensaje</p>
          <textarea
            rows={6}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="input w-full resize-none text-sm leading-relaxed"
            placeholder="Escribí tu mensaje..."
          />
        </div>

        {/* Botón enviar */}
        <button
          type="button"
          onClick={enviarWA}
          disabled={!texto.trim() || !alumno.celular}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3"
        >
          <MessageCircle size={16} />
          {alumno.celular ? 'Abrir WhatsApp' : 'Sin número de celular'}
        </button>
      </div>
    </SlidePanel>
  )
}

function AlumnoRow({ alumno, onPago, onMensaje, esImpago, badgeMap = DISC_BADGE, labelMap = DISC_LABEL }) {
  const ultimoPago = alumno.ultimo_pago

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 px-4 py-2.5 bg-dark-surface rounded-xl
        hover:bg-dark-border/40 transition-colors group cursor-pointer"
      onClick={() => onPago(alumno)}
    >
      {/* Estado dot */}
      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', ESTADO_DOT[alumno.estado])} />

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-dark-text text-sm truncate">{alumno.nombre_completo}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded-md', badgeMap[alumno.disciplina] || 'bg-gray-700 text-gray-200')}>
            {labelMap[alumno.disciplina] || alumno.disciplina}
          </span>
          <span className="text-xs text-dark-muted">{alumno.frecuencia}</span>
          {alumno.disciplina_2 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-purple-900/50 text-purple-200"
              title={`También hace ${labelMap[alumno.disciplina_2] || alumno.disciplina_2}${alumno.sede_2 ? ' en sede ' + alumno.sede_2 : ''}`}>
              +{labelMap[alumno.disciplina_2] || alumno.disciplina_2}
            </span>
          )}
          {alumno.bonus_pack && (
            <span className="text-xs bg-sky-900/70 text-sky-200 px-1.5 py-0.5 rounded-md">+Bonus</span>
          )}
        </div>
      </div>

      {/* Último pago */}
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-sm font-semibold text-dark-text">
          {ultimoPago ? money(ultimoPago.monto) : '—'}
        </div>
        <div className="text-xs text-dark-muted">
          {ultimoPago ? ultimoPago.fecha : 'Sin pago'}
        </div>
      </div>

      {/* Días sin pagar — solo si no es activo */}
      {alumno.estado !== 'activo' && (
        <div className="text-right shrink-0 hidden sm:block w-16">
          <div className={clsx(
            'text-sm font-bold',
            alumno.dias_sin_pago >= 90 ? 'text-red-400' :
            alumno.dias_sin_pago >= 30 ? 'text-yellow-400' : 'text-dark-muted'
          )}>
            {alumno.dias_sin_pago >= 9999 ? '∞' : `${alumno.dias_sin_pago}d`}
          </div>
          <div className="text-xs text-dark-muted">sin pagar</div>
        </div>
      )}

      {/* Botón de recordatorio — siempre visible en tab Impago */}
      {esImpago && alumno.celular && (
        <button
          onClick={(e) => abrirRecordatorio(e, alumno)}
          title="Enviar recordatorio por WhatsApp"
          className="p-1.5 rounded-lg bg-yellow-900/30 hover:bg-yellow-900/60 text-yellow-400 border border-yellow-800/40 transition-colors shrink-0"
        >
          <Send size={13} />
        </button>
      )}

      {/* Botón WhatsApp — siempre visible si tiene celular */}
      {alumno.celular && (
        <button
          onClick={(e) => { e.stopPropagation(); onMensaje(alumno) }}
          title="Enviar mensaje por WhatsApp"
          className="p-1.5 rounded-lg bg-green-900/20 hover:bg-green-900/50 text-green-400 border border-green-800/30 transition-colors shrink-0"
        >
          <MessageCircle size={14} />
        </button>
      )}

      {/* Acciones adicionales — aparecen al hover */}
      <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onPago(alumno) }}
          title="Registrar pago"
          className="p-1.5 rounded-lg hover:bg-green-900/40 text-green-400 transition-colors"
        >
          <DollarSign size={14} />
        </button>
        {alumno.instagram && (
          <a
            href={`https://instagram.com/${alumno.instagram.replace('@', '')}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-pink-900/40 text-pink-400 transition-colors"
            title="Instagram"
          >
            <Instagram size={14} />
          </a>
        )}
      </div>
    </motion.div>
  )
}

function GrupoHorario({ hora, alumnos, onPago, onMensaje, esImpago, badgeMap = DISC_BADGE, labelMap = DISC_LABEL }) {
  const [collapsed, setCollapsed] = useState(false)

  const porDisc = alumnos.reduce((acc, a) => {
    acc[a.disciplina] = (acc[a.disciplina] || 0) + 1
    return acc
  }, {})

  return (
    <div className="mb-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl
          text-sm font-semibold text-dark-text hover:bg-dark-border/30 transition-colors group"
      >
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={14} className="text-dark-muted" />
        </motion.div>
        <span className="text-dark-muted font-mono text-xs w-12">{hora}</span>
        <div className="flex gap-1.5">
          {Object.entries(porDisc).map(([disc, count]) => (
            <span key={disc} className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded-md', badgeMap[disc] || 'bg-gray-700 text-gray-200')}>
              {labelMap[disc] || disc} {count}
            </span>
          ))}
        </div>
        <span className="ml-auto text-dark-muted font-normal text-xs">{alumnos.length} alumnos</span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden mt-1 space-y-1 pl-2"
          >
            {alumnos.map((a) => (
              <AlumnoRow key={a.id} alumno={a} onPago={onPago} onMensaje={onMensaje} esImpago={esImpago} badgeMap={badgeMap} labelMap={labelMap} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const MESES_RECIENTES = mesesRecientes()

export default function AlumnosPage() {
  // Disciplinas dinámicas desde la API
  const { discs, labelMap: apiLabelMap, badgeMap: apiBadgeMap } = useDisciplinas()
  const { sedeOptions } = useNegocio()
  const labelMap = { ...DISC_LABEL, ...apiLabelMap }
  const badgeMap = { ...DISC_BADGE, ...apiBadgeMap }
  // Orden dinámico: usar el de la API si está disponible, sino el hardcodeado
  const discOrder = discs.length > 0 ? discs.map(d => d.codigo) : DISC_ORDER

  const [tabActiva, setTabActiva]   = useState('activo')
  const [busqueda, setBusqueda]     = useState('')
  const [sede, setSede]             = useState('')
  const [discFilter, setDiscFilter] = useState('')   // '' | 'CF' | 'HF' | …
  const [freqFilter, setFreqFilter] = useState('')   // '' | '2x' | '3x' | …
  const [rangoDias, setRangoDias]   = useState('todos')
  const [cmdOpen, setCmdOpen]       = useState(false)
  const [pagoAlumno, setPagoAlumno] = useState(null)
  const [msgAlumno, setMsgAlumno]   = useState(null)
  const [mesPago, setMesPago]       = useState(mesPorDefecto)

  const tabConfig = TABS.find((t) => t.id === tabActiva)
  const esPorMes  = tabActiva === 'pormes'

  // ── Query alumnos (tabs normales) — sin filtro disc en backend, todo client-side ──
  const { data, isLoading } = useQuery({
    queryKey: ['alumnos', tabActiva, sede],
    enabled: !esPorMes,
    queryFn: async () => {
      const results = await Promise.all(
        tabConfig.estados.map((est) => {
          const params = new URLSearchParams({ estado: est, page_size: 500 })
          if (sede) params.set('sede', sede)
          return api.get(`/alumnos/?${params}`).then((r) => r.data.results ?? r.data)
        })
      )
      return results.flat()
    },
  })

  // ── Query pagos por mes ────────────────────────────────────────────────────
  const { data: dataPagos, isLoading: isLoadingPagos } = useQuery({
    queryKey: ['pagos', 'pormes', mesPago, sede],
    enabled: esPorMes,
    queryFn: async () => {
      const params = new URLSearchParams({ mes: mesPago })
      if (sede) params.set('sede', sede)
      return api.get(`/pagos/?${params}`).then((r) => r.data.results ?? r.data)
    },
  })

  // Chips nivel 1: disciplinas disponibles con conteo (orden dinámico)
  const discsDisponibles = useMemo(() => {
    const map = {}
    ;(data || []).forEach(a => {
      map[a.disciplina] = (map[a.disciplina] || 0) + 1
      if (a.disciplina_2) map[a.disciplina_2] = (map[a.disciplina_2] || 0) + 1
    })
    // Primero los del orden conocido, luego cualquier extra no conocido
    const conocidas = discOrder.filter(d => map[d]).map(d => ({ disc: d, count: map[d] }))
    const extras = Object.keys(map).filter(d => !discOrder.includes(d)).map(d => ({ disc: d, count: map[d] }))
    return [...conocidas, ...extras]
  }, [data, discOrder])

  // Chips nivel 2: frecuencias dentro de la disciplina seleccionada
  const freqsDisponibles = useMemo(() => {
    if (!discFilter) return []
    const map = {}
    ;(data || []).forEach(a => {
      if (a.disciplina === discFilter && a.frecuencia) map[a.frecuencia] = (map[a.frecuencia] || 0) + 1
      else if (a.disciplina_2 === discFilter && a.frecuencia_2) map[a.frecuencia_2] = (map[a.frecuencia_2] || 0) + 1
    })
    return FREQ_ORDER.filter(f => map[f]).map(f => ({ freq: f, count: map[f] }))
  }, [data, discFilter])

  const rango = RANGOS_DIAS.find(r => r.id === rangoDias)
  const alumnos = (data || []).filter((a) => {
    if (busqueda && !`${a.nombre} ${a.apellido} ${a.celular || ''}`.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (discFilter) {
      const enPrincipal = a.disciplina === discFilter
      const enSegunda   = a.disciplina_2 === discFilter
      if (!enPrincipal && !enSegunda) return false
      // La frecuencia relevante depende de por cuál actividad matchea
      if (freqFilter) {
        const freqOk = (enPrincipal && a.frecuencia === freqFilter) || (enSegunda && a.frecuencia_2 === freqFilter)
        if (!freqOk) return false
      }
    } else if (freqFilter && a.frecuencia !== freqFilter) {
      return false
    }
    if (tabConfig.maxDias !== undefined && a.dias_sin_pago > tabConfig.maxDias) return false
    if (tabConfig.minDias !== undefined && a.dias_sin_pago < tabConfig.minDias) return false
    if (rangoDias !== 'todos' && (a.dias_sin_pago < rango.min || a.dias_sin_pago > rango.max)) return false
    return true
  })
  const grupos = agruparPorHorario(alumnos)

  // Filtrado y agrupación de pagos
  const pagos = (dataPagos || []).filter((p) => {
    if (busqueda && !p.alumno_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })
  const gruposPagos = agruparPagosPorHorario(pagos)
  const totalPagos  = pagos.reduce((s, p) => s + Number(p.monto), 0)

  const abrirPago    = useCallback((alumno) => setPagoAlumno(alumno), [])
  const abrirMensaje = useCallback((alumno) => setMsgAlumno(alumno), [])

  function exportarCSV() {
    const filas = esPorMes ? pagos : alumnos
    if (!filas.length) return

    const encabezado = esPorMes
      ? ['Nombre', 'Disciplina', 'Frecuencia', 'Horario', 'Sede', 'Monto', 'Método', 'Fecha pago']
      : ['Nombre', 'Disciplina', 'Frecuencia', 'Horario', 'Sede', 'Celular', 'Estado', 'Días sin pagar', 'Último pago']

    const rows = esPorMes
      ? pagos.map(p => [
          p.alumno_nombre,
          p.alumno_disciplina,
          p.alumno_frecuencia,
          p.alumno_horario,
          p.alumno_sede,
          p.monto,
          p.metodo,
          p.fecha_pago,
        ])
      : alumnos.map(a => [
          a.nombre_completo,
          a.disciplina,
          a.frecuencia,
          a.horario,
          a.sede,
          a.celular || '',
          a.estado,
          a.dias_sin_pago >= 9999 ? 'Sin pago' : a.dias_sin_pago,
          a.ultimo_pago?.fecha || '',
        ])

    const csv = [encabezado, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `alumnos_${tabActiva}_${sede || 'ambas'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Ctrl+K abre el command palette
  useState(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Alumnos</h1>
            <p className="text-sm text-dark-muted mt-0.5">
              {esPorMes
                ? (isLoadingPagos ? 'Cargando...' : `${pagos.length} pagos · ${money(totalPagos)}`)
                : (isLoading ? 'Cargando...' : `${alumnos.length} en ${tabConfig.label.toLowerCase()}`)
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Buscar por Ctrl+K */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-border
                text-dark-muted hover:text-dark-text hover:border-primary-dark/50 transition-all text-sm"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Buscar alumno</span>
              <kbd className="text-xs bg-dark-border px-1.5 py-0.5 rounded font-mono ml-1">⌘K</kbd>
            </button>
            <button
              onClick={exportarCSV}
              title="Exportar lista filtrada"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-border
                text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-all text-sm"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <Link to="/alumnos/nuevo" className="btn-primary flex items-center gap-2">
              <UserPlus size={16} />
              <span className="hidden sm:inline">Nuevo</span>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-dark-surface rounded-xl p-1 border border-dark-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setTabActiva(tab.id); setRangoDias('todos'); setDiscFilter(''); setFreqFilter('') }}
              className={clsx(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150 relative',
                tabActiva === tab.id
                  ? 'bg-dark-border text-dark-text shadow-sm'
                  : 'text-dark-muted hover:text-dark-text'
              )}
            >
              {tabActiva === tab.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 bg-dark-border rounded-lg"
                  style={{ zIndex: -1 }}
                />
              )}
              <span className={clsx(tabActiva === tab.id && tab.color)}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Selector de mes — solo para tab Por mes */}
        {esPorMes && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck size={14} className="text-purple-400" />
              <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Mes a consultar</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {MESES_RECIENTES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMesPago(m.value)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                    mesPago === m.value
                      ? 'bg-purple-900/50 border-purple-600 text-purple-200'
                      : 'border-dark-border text-dark-muted hover:border-purple-700 hover:text-dark-text'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-filtro por días sin pagar — solo para impago y alejados */}
        {(tabActiva === 'mora' || tabActiva === 'alejado') && (
          <div className="flex gap-1.5 mb-4">
            {RANGOS_DIAS.map(r => (
              <button
                key={r.id}
                onClick={() => setRangoDias(r.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  rangoDias === r.id
                    ? 'bg-yellow-900/40 border-yellow-700 text-yellow-300'
                    : 'border-dark-border text-dark-muted hover:border-dark-text'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Filtros rápidos */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              className="input pl-8 h-9 text-sm w-52"
              placeholder="Filtrar en esta lista..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <select className="input h-9 text-sm w-36" value={sede} onChange={(e) => setSede(e.target.value)}>
            <option value="">Ambas sedes</option>
            {sedeOptions.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
          </select>
          {(sede || discFilter || freqFilter || busqueda) && (
            <button
              onClick={() => { setSede(''); setDiscFilter(''); setFreqFilter(''); setBusqueda('') }}
              className="text-xs text-dark-muted hover:text-red-400 transition-colors px-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Nivel 1: Disciplina */}
        {!esPorMes && discsDisponibles.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button
              onClick={() => { setDiscFilter(''); setFreqFilter('') }}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                !discFilter ? 'bg-indigo-700 border-indigo-600 text-white' : 'bg-dark-surface border-dark-border text-dark-muted hover:text-dark-text'
              )}
            >
              Todos
            </button>
            {discsDisponibles.map(({ disc, count }) => (
              <button
                key={disc}
                onClick={() => { setDiscFilter(disc); setFreqFilter('') }}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  discFilter === disc ? 'bg-indigo-700 border-indigo-600 text-white' : 'bg-dark-surface border-dark-border text-dark-muted hover:text-dark-text'
                )}
              >
                {disc} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Nivel 2: Frecuencia (solo si hay disciplina seleccionada y más de una opción) */}
        {!esPorMes && discFilter && freqsDisponibles.length > 1 && (
          <div className="flex gap-1.5 mb-4 flex-wrap pl-1">
            <button
              onClick={() => setFreqFilter('')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                !freqFilter ? 'bg-teal-700 border-teal-600 text-white' : 'bg-dark-surface border-dark-border text-dark-muted hover:text-dark-text'
              )}
            >
              Todas
            </button>
            {freqsDisponibles.map(({ freq, count }) => (
              <button
                key={freq}
                onClick={() => setFreqFilter(freq)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  freqFilter === freq ? 'bg-teal-700 border-teal-600 text-white' : 'bg-dark-surface border-dark-border text-dark-muted hover:text-dark-text'
                )}
              >
                {FREQ_LBL[freq] ?? freq} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        )}
        {!esPorMes && (discFilter || freqFilter) && <div className="mb-3" />}


        {/* Lista — tab Por mes */}
        {esPorMes ? (
          isLoadingPagos ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-14 bg-dark-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : gruposPagos.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <div className="text-4xl mb-3">🗓️</div>
              <p className="font-medium text-dark-text">No hay pagos registrados para ese mes</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={'pormes' + mesPago + sede}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Totalizador */}
                <div className="flex items-center justify-between px-4 py-3 mb-3 bg-dark-surface rounded-xl border border-dark-border">
                  <span className="text-sm text-dark-muted">{pagos.length} pagos registrados</span>
                  <span className="text-lg font-bold text-green-400">{money(totalPagos)}</span>
                </div>
                {gruposPagos.map(([hora, pagoGrupo]) => (
                  <GrupoPorMes key={hora} hora={hora} pagos={pagoGrupo} badgeMap={badgeMap} labelMap={labelMap} />
                ))}
              </motion.div>
            </AnimatePresence>
          )
        ) : (
          /* Lista — tabs normales */
          isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-14 bg-dark-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : grupos.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <div className="text-4xl mb-3">
                {tabActiva === 'activo' ? '🎉' : '🔍'}
              </div>
              <p className="font-medium text-dark-text">
                No hay alumnos en esta categoría
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tabActiva + sede + discFilter}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {grupos.map(([hora, alumnosGrupo]) => (
                  <GrupoHorario key={hora} hora={hora} alumnos={alumnosGrupo} onPago={abrirPago} onMensaje={abrirMensaje} esImpago={tabActiva === 'mora'} badgeMap={badgeMap} labelMap={labelMap} />
                ))}
              </motion.div>
            </AnimatePresence>
          )
        )}
      </div>

      {/* Command Palette — buscar cualquier alumno */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onSelect={(alumno) => { setPagoAlumno(alumno) }}
      />

      {/* Ficha de alumno: datos + horario/disciplina + pago */}
      <FichaAlumnoPanel
        alumno={pagoAlumno}
        open={!!pagoAlumno}
        onClose={() => setPagoAlumno(null)}
      />

      {/* Panel de mensajes WhatsApp */}
      <PanelMensaje
        alumno={msgAlumno}
        open={!!msgAlumno}
        onClose={() => setMsgAlumno(null)}
      />
    </>
  )
}
