import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare, AlertTriangle, Clock, Users, History,
  Send, CheckCircle, ExternalLink, Search, ChevronDown,
  ChevronUp, RefreshCw, Settings, Copy, Check, Filter, UserSearch,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { useNegocio } from '../hooks/useNegocio'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy Func.', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus', FB: 'FullBody' }
const DISC_COLOR = { CF: '#6366f1', HF: '#22d3ee', HX: '#fbbf24', TN: '#a78bfa', KD: '#f472b6', BP: '#34d399', FB: '#fb923c' }

const TIPO_LABEL = {
  vence_pronto:     'Por vencer',
  cuota_vencida:    'Cuota vencida',
  activo_impago:    'Crítica',
  bienvenida:       'Bienvenida',
  reactivacion_1_3m:'Reactivación 1–3m',
  reactivacion_3_6m:'Reactivación 3–6m',
  reactivacion_6m:  'Reactivación +6m',
  cumpleanios:      'Cumpleaños',
  masivo:           'Masivo',
}

const TIPO_COLOR = {
  vence_pronto:    'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
  cuota_vencida:   'text-orange-400 bg-orange-900/30 border-orange-700/40',
  activo_impago:   'text-red-400 bg-red-900/30 border-red-700/40',
  bienvenida:      'text-green-400 bg-green-900/30 border-green-700/40',
  masivo:          'text-sky-400 bg-sky-900/30 border-sky-700/40',
}

// Genera link wa.me para número argentino
function waLink(celular, texto) {
  if (!celular) return '#'
  let num = celular.replace(/\D/g, '')
  if (num.startsWith('0')) num = '549' + num.slice(1)
  else if (num.startsWith('15')) num = '549' + num
  else if (!num.startsWith('54')) num = '549' + num
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function SedeTabs({ sede, setSede }) {
  const { sedeOptions } = useNegocio()
  return (
    <div className="flex gap-1 bg-dark-bg rounded-xl p-1 border border-dark-border">
      {[['', 'Ambas'], ...sedeOptions.map(s => [s.val, s.val])].map(([v, l]) => (
        <button key={v} onClick={() => setSede(v)}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            sede === v ? 'bg-indigo-700 text-white' : 'text-dark-muted hover:text-dark-text'
          )}>{l}</button>
      ))}
    </div>
  )
}

function CopyBtn({ texto }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={handleCopy} title="Copiar mensaje"
      className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

function AlumnoRow({ alumno, tipo, onRegistrar, onDesmarcar, enviados }) {
  const [expand, setExpand] = useState(false)
  const yaEnviado = enviados.has(alumno.id) || alumno.ya_enviado
  const link = waLink(alumno.celular, alumno.mensaje)

  return (
    <div className={clsx(
      'rounded-xl border transition-all',
      yaEnviado ? 'border-green-700/30 bg-green-950/20' : 'border-dark-border bg-dark-surface'
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: DISC_COLOR[alumno.disciplina] + '33', color: DISC_COLOR[alumno.disciplina] }}>
          {alumno.nombre[0]}{alumno.apellido[0]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-text truncate">
            {alumno.nombre} {alumno.apellido}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-dark-muted">{alumno.celular || 'Sin celular'}</span>
            <span className="text-xs" style={{ color: DISC_COLOR[alumno.disciplina] }}>
              {DISC_LABEL[alumno.disciplina]}
            </span>
            <span className="text-xs text-dark-muted">Sede {alumno.sede}</span>
            {alumno.dias_sin_pagar > 0 && (
              <span className="text-xs text-orange-400">{alumno.dias_sin_pagar}d sin pagar</span>
            )}
            {alumno.fecha_inicio && (
              <span className="text-xs text-dark-muted">
                Ingresó {new Date(alumno.fecha_inicio).toLocaleDateString('es-AR')}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpand(e => !e)}
            className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors">
            {expand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <CopyBtn texto={alumno.mensaje} />
          {alumno.celular && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              onClick={() => !yaEnviado && onRegistrar(alumno)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-700 hover:bg-green-600 text-white transition-colors">
              <ExternalLink size={12} />
              WA
            </a>
          )}
          {yaEnviado ? (
            <button onClick={() => onDesmarcar(alumno)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-green-400 hover:text-red-400 hover:bg-red-900/20 transition-colors border border-green-800/40 hover:border-red-800/40">
              <CheckCircle size={12} />
              Enviado
            </button>
          ) : (
            <button onClick={() => onRegistrar(alumno)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-dark-muted hover:text-green-400 hover:bg-green-900/20 transition-colors border border-dark-border">
              <CheckCircle size={12} />
              Marcar
            </button>
          )}
        </div>
      </div>

      {/* Mensaje expandido */}
      {expand && (
        <div className="px-4 pb-3 pt-0">
          <div className="bg-dark-bg rounded-lg p-3 text-sm text-dark-text whitespace-pre-wrap border border-dark-border">
            {alumno.mensaje}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Deudores
// ---------------------------------------------------------------------------

function TabDeudores({ sede }) {
  const [enviados, setEnviados] = useState(new Set())
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['msg-deudores', sede],
    queryFn: () => api.get('/mensajes/deudores/', { params: sede ? { sede } : {} }).then(r => r.data),
  })

  async function registrar(alumno) {
    await api.post('/mensajes/registrar/', {
      alumno_id: alumno.id, tipo: alumno.tipo, canal: 'whatsapp', texto: alumno.mensaje,
    })
    setEnviados(prev => new Set([...prev, alumno.id]))
  }

  async function desmarcar(alumno) {
    await api.post('/mensajes/desmarcar/', { alumno_id: alumno.id, tipo: alumno.tipo })
    setEnviados(prev => { const s = new Set(prev); s.delete(alumno.id); return s })
    refetch()
  }

  async function registrarTodo(grupo) {
    const pendientes = grupo.filter(a => !enviados.has(a.id) && !a.ya_enviado)
    for (const a of pendientes) await registrar(a)
    qc.invalidateQueries({ queryKey: ['msg-historial'] })
  }

  async function desmarcarTodo(grupo) {
    const marcados = grupo.filter(a => enviados.has(a.id) || a.ya_enviado)
    await api.post('/mensajes/desmarcar/', {
      items: marcados.map(a => ({ alumno_id: a.id, tipo: a.tipo })),
    })
    setEnviados(new Set())
    refetch()
    qc.invalidateQueries({ queryKey: ['msg-historial'] })
  }

  if (isLoading) return <div className="text-dark-muted text-sm p-6 animate-pulse">Cargando deudores...</div>

  const { grupos = {}, mes = '', total = 0 } = data || {}
  const secciones = [
    { key: 'vence_pronto',  label: 'Por vencer (días 1–5)',   icon: Clock,          color: 'text-yellow-400' },
    { key: 'cuota_vencida', label: 'Cuota vencida',           icon: AlertTriangle,  color: 'text-orange-400' },
    { key: 'activo_impago', label: 'Crítica (+35 días)',       icon: AlertTriangle,  color: 'text-red-400'    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-dark-text">Deudores — {mes}</h2>
          <p className="text-xs text-dark-muted mt-0.5">{total} alumnos sin pagar este mes</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {secciones.map(({ key, label, icon: Icon, color }) => {
        const lista = grupos[key] || []
        if (!lista.length) return null
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon size={14} className={color} />
                <span className="text-sm font-medium text-dark-text">{label}</span>
                <span className="text-xs text-dark-muted">({lista.length})</span>
              </div>
              <div className="flex items-center gap-3">
                {lista.some(a => enviados.has(a.id) || a.ya_enviado) && (
                  <button onClick={() => desmarcarTodo(lista)}
                    className="text-xs text-dark-muted hover:text-red-400 transition-colors flex items-center gap-1">
                    <CheckCircle size={12} /> Desmarcar todos
                  </button>
                )}
                <button onClick={() => registrarTodo(lista)}
                  className="text-xs text-dark-muted hover:text-green-400 transition-colors flex items-center gap-1">
                  <CheckCircle size={12} /> Marcar todos
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {lista.map(a => (
                <AlumnoRow key={a.id} alumno={a} tipo={key} onRegistrar={registrar} onDesmarcar={desmarcar} enviados={enviados} />
              ))}
            </div>
          </div>
        )
      })}

      {total === 0 && (
        <div className="text-center py-16 text-dark-muted">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-500 opacity-60" />
          <p className="font-medium text-dark-text">¡Todos al día!</p>
          <p className="text-sm mt-1">No hay deudores este mes.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Bienvenidas
// ---------------------------------------------------------------------------

function TabBienvenidas({ sede }) {
  const [enviados, setEnviados] = useState(new Set())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['msg-bienvenidas', sede],
    queryFn: () => api.get('/mensajes/bienvenidas/', { params: sede ? { sede } : {} }).then(r => r.data),
  })

  async function registrar(alumno) {
    await api.post('/mensajes/registrar/', {
      alumno_id: alumno.id, tipo: 'bienvenida', canal: 'whatsapp', texto: alumno.mensaje,
    })
    setEnviados(prev => new Set([...prev, alumno.id]))
  }

  async function desmarcar(alumno) {
    await api.post('/mensajes/desmarcar/', { alumno_id: alumno.id, tipo: 'bienvenida' })
    setEnviados(prev => { const s = new Set(prev); s.delete(alumno.id); return s })
    refetch()
  }

  if (isLoading) return <div className="text-dark-muted text-sm p-6 animate-pulse">Cargando...</div>

  const alumnos = data?.alumnos || []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Bienvenidas — últimos 30 días</h2>
        <p className="text-xs text-dark-muted mt-0.5">{alumnos.length} alumnos nuevos</p>
      </div>
      {alumnos.length === 0 ? (
        <div className="text-center py-16 text-dark-muted">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>No hay alumnos nuevos en los últimos 30 días</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alumnos.map(a => (
            <AlumnoRow key={a.id} alumno={a} tipo="bienvenida" onRegistrar={registrar} onDesmarcar={desmarcar} enviados={enviados} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Masivos
// ---------------------------------------------------------------------------

function TabMasivos() {
  const { sedeOptions } = useNegocio()
  const [sede, setSede] = useState('')
  const [disciplina, setDisc] = useState('')
  const [texto, setTexto] = useState('Hola {nombre}! 👋 Te escribimos desde Athlon. ')
  const [buscando, setBuscando] = useState(false)
  const [candidatos, setCandidatos] = useState(null)
  const [enviados, setEnviados] = useState(new Set())

  const DISCS = [
    { val: '', label: 'Todas las disciplinas' },
    { val: 'CF', label: 'CrossFit' },
    { val: 'HF', label: 'Heavy Funcional' },
    { val: 'HX', label: 'Hyrox' },
    { val: 'TN', label: 'Teens' },
    { val: 'KD', label: 'Kids' },
  ]

  async function buscar() {
    setBuscando(true)
    try {
      const r = await api.get('/mensajes/masivos/candidatos/', {
        params: { sede, disciplina, texto },
      })
      setCandidatos(r.data)
    } finally {
      setBuscando(false)
    }
  }

  async function registrarTodo() {
    if (!candidatos) return
    const pendientes = candidatos.alumnos.filter(a => !enviados.has(a.id))
    await api.post('/mensajes/registrar-bulk/', {
      mensajes: pendientes.map(a => ({
        alumno_id: a.id,
        tipo: 'masivo',
        canal: 'whatsapp',
        texto: a.mensaje,
      })),
    })
    setEnviados(new Set(candidatos.alumnos.map(a => a.id)))
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Mensajes masivos</h2>
        <p className="text-xs text-dark-muted mt-0.5">Enviá un comunicado a un grupo de alumnos</p>
      </div>

      {/* Filtros */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dark-muted mb-1 block">Sede</label>
            <select value={sede} onChange={e => setSede(e.target.value)} className="input text-sm w-full">
              <option value="">Ambas sedes</option>
              {sedeOptions.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-dark-muted mb-1 block">Disciplina</label>
            <select value={disciplina} onChange={e => setDisc(e.target.value)} className="input text-sm w-full">
              {DISCS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-dark-muted mb-1 block">
            Mensaje <span className="text-dark-muted/60">(podés usar {'{nombre}'} y {'{sede}'})</span>
          </label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={4}
            className="input text-sm w-full resize-none"
            placeholder="Escribí el mensaje acá..."
          />
        </div>

        <button onClick={buscar} disabled={buscando || !texto.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <Filter size={14} />
          {buscando ? 'Buscando...' : 'Ver destinatarios'}
        </button>
      </div>

      {/* Resultado */}
      {candidatos && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-dark-text font-medium">{candidatos.total} destinatarios</p>
            <button onClick={registrarTodo}
              className="text-xs text-dark-muted hover:text-green-400 flex items-center gap-1 transition-colors">
              <CheckCircle size={12} /> Marcar todos como enviados
            </button>
          </div>
          <div className="space-y-2">
            {candidatos.alumnos.map(a => (
              <AlumnoRow key={a.id} alumno={a} tipo="masivo"
                onRegistrar={al => setEnviados(prev => new Set([...prev, al.id]))}
                enviados={enviados} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Historial
// ---------------------------------------------------------------------------

function TabHistorial({ sede }) {
  const [page, setPage]     = useState(1)
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo]     = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['msg-historial', page, buscar, tipo, sede],
    queryFn: () => api.get('/mensajes/historial/', {
      params: { page, page_size: 50, buscar, tipo, sede },
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  })

  const mensajes  = data?.mensajes  || []
  const total     = data?.total     || 0
  const totalPags = Math.ceil(total / 50)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input value={buscar} onChange={e => { setBuscar(e.target.value); setPage(1) }}
            placeholder="Buscar alumno..." className="input pl-8 text-sm w-full" />
        </div>
        <select value={tipo} onChange={e => { setTipo(e.target.value); setPage(1) }}
          className="input text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-dark-muted">{total} mensajes enviados</p>

      {isLoading ? (
        <div className="text-dark-muted text-sm animate-pulse">Cargando...</div>
      ) : mensajes.length === 0 ? (
        <div className="text-center py-16 text-dark-muted">
          <History size={40} className="mx-auto mb-3 opacity-40" />
          <p>Sin mensajes registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mensajes.map(m => (
            <div key={m.id} className="bg-dark-surface rounded-xl border border-dark-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dark-text">{m.alumno_nombre}</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border', TIPO_COLOR[m.tipo] || 'text-dark-muted bg-dark-bg border-dark-border')}>
                      {TIPO_LABEL[m.tipo] || m.tipo_display}
                    </span>
                    <span className="text-xs text-dark-muted">Sede {m.sede}</span>
                  </div>
                  <p className="text-xs text-dark-muted mt-1 line-clamp-2">{m.texto}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-dark-muted">{m.fecha_hora}</p>
                  {m.enviado_por && <p className="text-xs text-dark-muted/60">{m.enviado_por}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPags > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-40">
            Anterior
          </button>
          <span className="text-xs text-dark-muted">{page} / {totalPags}</span>
          <button onClick={() => setPage(p => Math.min(totalPags, p + 1))} disabled={page === totalPags}
            className="px-3 py-1.5 rounded-lg text-xs border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-40">
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Templates
// ---------------------------------------------------------------------------

function TabTemplates() {
  const [editando, setEditando] = useState(null)
  const [texto, setTexto]       = useState('')
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk]             = useState(null)
  const qc = useQueryClient()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['msg-templates'],
    queryFn: () => api.get('/mensajes/templates/').then(r => r.data),
  })

  function editar(t) {
    setEditando(t.tipo)
    setTexto(t.texto)
    setOk(null)
  }

  async function guardar() {
    setGuardando(true)
    try {
      await api.put('/mensajes/templates/', { tipo: editando, texto })
      setOk(editando)
      setEditando(null)
      qc.invalidateQueries({ queryKey: ['msg-templates'] })
    } finally {
      setGuardando(false)
    }
  }

  if (isLoading) return <div className="text-dark-muted text-sm animate-pulse p-4">Cargando templates...</div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Templates de mensajes</h2>
        <p className="text-xs text-dark-muted mt-0.5">Editá el texto base de cada tipo. Variables disponibles: {'{nombre}'}, {'{mes}'}, {'{dias}'}, {'{sede}'}, {'{disciplina}'}</p>
      </div>
      {templates.map(t => (
        <div key={t.tipo} className="bg-dark-surface rounded-2xl border border-dark-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-dark-text">{t.tipo_display}</span>
              {!t.en_db && <span className="text-xs text-dark-muted bg-dark-bg px-2 py-0.5 rounded-full border border-dark-border">default</span>}
              {ok === t.tipo && <span className="text-xs text-green-400 flex items-center gap-1"><Check size={11} /> Guardado</span>}
            </div>
            <button onClick={() => editando === t.tipo ? setEditando(null) : editar(t)}
              className="text-xs text-dark-muted hover:text-dark-text flex items-center gap-1 transition-colors">
              <Settings size={12} /> {editando === t.tipo ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {editando === t.tipo ? (
            <div className="space-y-2">
              <textarea value={texto} onChange={e => setTexto(e.target.value)}
                rows={4} className="input text-sm w-full resize-none" />
              <button onClick={guardar} disabled={guardando}
                className="btn-primary text-sm px-4 py-1.5">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-dark-muted whitespace-pre-wrap">{t.texto}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Directo (buscar alumno y mandar mensaje)
// ---------------------------------------------------------------------------

const TEMPLATES_RAPIDOS = [
  { tipo: 'cuota_vencida',    label: 'Cuota vencida' },
  { tipo: 'vence_pronto',     label: 'Por vencer' },
  { tipo: 'activo_impago',    label: 'Crítica' },
  { tipo: 'bienvenida',       label: 'Bienvenida' },
  { tipo: 'reactivacion_1_3m',label: 'Reactivación' },
  { tipo: 'cumpleanios',      label: 'Cumpleaños 🎂' },
]

function TabDirecto() {
  const [busqueda, setBusqueda]     = useState('')
  const [alumnoSel, setAlumnoSel]   = useState(null)
  const [tipoSel, setTipoSel]       = useState('')
  const [texto, setTexto]           = useState('')
  const [enviado, setEnviado]       = useState(false)
  const [marcando, setMarcando]     = useState(false)
  const inputRef = useRef(null)

  // Búsqueda con debounce
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['msg-buscar-alumno', query],
    enabled: query.length >= 2,
    queryFn: () =>
      api.get('/alumnos/', { params: { search: query, page_size: 10 } })
        .then(r => r.data.results ?? r.data),
  })

  // Cargar templates al elegir alumno
  const { data: templates = [] } = useQuery({
    queryKey: ['msg-templates'],
    queryFn: () => api.get('/mensajes/templates/').then(r => r.data),
  })

  function seleccionarAlumno(a) {
    setAlumnoSel(a)
    setBusqueda('')
    setQuery('')
    setTipoSel('')
    setTexto('')
    setEnviado(false)
  }

  function elegirTipo(tipo) {
    setTipoSel(tipo)
    setEnviado(false)
    const tpl = templates.find(t => t.tipo === tipo)
    if (tpl && alumnoSel) {
      // Render simple de variables
      const nombre = alumnoSel.nombre?.split(' ')[0] || alumnoSel.nombre
      const disc_map = { CF:'CrossFit', HF:'Heavy Funcional', HX:'Hyrox', TN:'Teens', KD:'Kids', FB:'FullBody' }
      setTexto(
        tpl.texto
          .replace(/{nombre}/g, nombre)
          .replace(/{sede}/g, `Athlon ${alumnoSel.sede}`)
          .replace(/{disciplina}/g, disc_map[alumnoSel.disciplina] || alumnoSel.disciplina)
          .replace(/{dias}/g, '5')
          .replace(/{mes}/g, new Date().toLocaleString('es-AR', { month: 'long' }))
      )
    }
  }

  async function marcarEnviado() {
    if (!alumnoSel || !texto.trim()) return
    setMarcando(true)
    try {
      await api.post('/mensajes/registrar/', {
        alumno_id: alumnoSel.id,
        tipo: tipoSel || 'masivo',
        canal: 'whatsapp',
        texto,
      })
      setEnviado(true)
    } finally {
      setMarcando(false)
    }
  }

  const mostrarResultados = query.length >= 2 && !alumnoSel

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Mensaje directo</h2>
        <p className="text-xs text-dark-muted mt-0.5">Buscá cualquier alumno y mandále un mensaje</p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
        <input
          ref={inputRef}
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setAlumnoSel(null) }}
          placeholder="Buscar alumno por nombre o apellido..."
          className="input pl-9 w-full"
          autoComplete="off"
        />
        {isFetching && (
          <RefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted animate-spin" />
        )}

        {/* Dropdown resultados */}
        {mostrarResultados && resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-xl shadow-xl z-20 overflow-hidden">
            {resultados.map(a => (
              <button key={a.id} onClick={() => seleccionarAlumno(a)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-border/50 transition-colors text-left">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: DISC_COLOR[a.disciplina] + '33', color: DISC_COLOR[a.disciplina] }}>
                  {a.nombre?.[0]}{a.apellido?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-text truncate">{a.nombre_completo}</p>
                  <p className="text-xs text-dark-muted">{DISC_LABEL[a.disciplina]} · Sede {a.sede} · {a.celular || 'Sin celular'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {mostrarResultados && !isFetching && resultados.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-xl shadow-xl z-20 px-4 py-3 text-sm text-dark-muted">
            No se encontraron alumnos
          </div>
        )}
      </div>

      {/* Alumno seleccionado */}
      {alumnoSel && (
        <div className="space-y-4">
          {/* Chip del alumno */}
          <div className="flex items-center gap-3 bg-dark-surface border border-indigo-700/40 rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: DISC_COLOR[alumnoSel.disciplina] + '33', color: DISC_COLOR[alumnoSel.disciplina] }}>
              {alumnoSel.nombre?.[0]}{alumnoSel.apellido?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dark-text">{alumnoSel.nombre_completo}</p>
              <p className="text-xs text-dark-muted">{DISC_LABEL[alumnoSel.disciplina]} · Sede {alumnoSel.sede} · {alumnoSel.celular || 'Sin celular'}</p>
            </div>
            <button onClick={() => { setAlumnoSel(null); setBusqueda(''); setTimeout(() => inputRef.current?.focus(), 50) }}
              className="text-xs text-dark-muted hover:text-dark-text transition-colors px-2">
              Cambiar
            </button>
          </div>

          {/* Templates rápidos */}
          <div>
            <p className="text-xs text-dark-muted mb-2">Tipo de mensaje</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES_RAPIDOS.map(({ tipo, label }) => (
                <button key={tipo} onClick={() => elegirTipo(tipo)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    tipoSel === tipo
                      ? 'bg-indigo-700 border-indigo-600 text-white'
                      : 'border-dark-border text-dark-muted hover:border-indigo-500/50 hover:text-dark-text'
                  )}>
                  {label}
                </button>
              ))}
              <button onClick={() => { setTipoSel('masivo'); setTexto('') }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  tipoSel === 'masivo'
                    ? 'bg-indigo-700 border-indigo-600 text-white'
                    : 'border-dark-border text-dark-muted hover:border-indigo-500/50 hover:text-dark-text'
                )}>
                ✏️ Personalizado
              </button>
            </div>
          </div>

          {/* Texto del mensaje */}
          {(tipoSel) && (
            <div>
              <p className="text-xs text-dark-muted mb-1.5">Mensaje</p>
              <textarea
                value={texto}
                onChange={e => { setTexto(e.target.value); setEnviado(false) }}
                rows={4}
                className="input text-sm w-full resize-none"
                placeholder="Escribí el mensaje..."
              />
            </div>
          )}

          {/* Botones de acción */}
          {tipoSel && texto.trim() && (
            <div className="flex gap-2">
              {alumnoSel.celular ? (
                <a href={waLink(alumnoSel.celular, texto)} target="_blank" rel="noopener noreferrer"
                  onClick={() => !enviado && marcarEnviado()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors">
                  <ExternalLink size={15} />
                  Abrir WhatsApp
                </a>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-border text-dark-muted text-sm cursor-not-allowed">
                  Sin número de celular
                </div>
              )}
              {enviado ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-900/30 border border-green-700/40 text-green-400 text-sm">
                  <CheckCircle size={15} /> Registrado
                </div>
              ) : (
                <button onClick={marcarEnviado} disabled={marcando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dark-border text-dark-muted hover:text-green-400 hover:border-green-700/40 text-sm transition-colors disabled:opacity-50">
                  <CheckCircle size={15} />
                  {marcando ? 'Guardando...' : 'Marcar enviado'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!alumnoSel && query.length < 2 && (
        <div className="text-center py-16 text-dark-muted">
          <UserSearch size={40} className="mx-auto mb-3 opacity-30" />
          <p>Escribí al menos 2 letras para buscar</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'deudores',    label: 'Deudores',    icon: AlertTriangle },
  { key: 'bienvenidas', label: 'Bienvenidas', icon: Users         },
  { key: 'directo',     label: 'Directo',     icon: UserSearch    },
  { key: 'masivos',     label: 'Masivos',     icon: Send          },
  { key: 'historial',   label: 'Historial',   icon: History       },
  { key: 'templates',   label: 'Templates',   icon: Settings      },
]

export default function MensajesPage() {
  const [tab, setTab]   = useState('deudores')
  const [sede, setSede] = useState('')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <MessageSquare size={22} className="text-indigo-400" />
            Mensajes
          </h1>
          <p className="text-sm text-dark-muted mt-0.5">WhatsApp — links directos</p>
        </div>
        {tab !== 'masivos' && tab !== 'templates' && tab !== 'directo' && (
          <SedeTabs sede={sede} setSede={setSede} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-surface rounded-2xl p-1 border border-dark-border mb-6 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
              tab === key
                ? 'bg-indigo-700 text-white'
                : 'text-dark-muted hover:text-dark-text hover:bg-dark-border'
            )}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'deudores'    && <TabDeudores    sede={sede} />}
      {tab === 'bienvenidas' && <TabBienvenidas sede={sede} />}
      {tab === 'directo'     && <TabDirecto />}
      {tab === 'masivos'     && <TabMasivos />}
      {tab === 'historial'   && <TabHistorial   sede={sede} />}
      {tab === 'templates'   && <TabTemplates />}
    </div>
  )
}
