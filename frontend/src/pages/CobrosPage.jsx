import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, X, Save, Loader2, CheckCircle, Clock, AlertCircle, ArrowRightLeft, Download } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'

const METODOS = [
  { val: 'efectivo',       label: 'Efectivo' },
  { val: 'transferencia',  label: 'Transfer' },
  { val: 'debito',         label: 'Débito' },
]

const DISC_LABEL = { CF: 'CrossFit', HF: 'Heavy Func.', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus Pack', FB: 'FullBody' }
const PERT_COLOR = { athlon: '', day: 'text-purple-400', otro: 'text-yellow-400' }

const DISC_ORDER = ['CF', 'HF', 'HX', 'TN', 'KD', 'FB']
const FREQ_ORDER = ['2x', '3x', '5x', 'libre']
const FREQ_LBL   = { '2x': '2×', '3x': '3×', '5x': '5×', libre: 'libre' }

function mesActual() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function mesLabel(mes) {
  const [y, m] = mes.split('-')
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${nombres[parseInt(m) - 1]} ${y}`
}

// ── Payment Panel ─────────────────────────────────────────────────────────────
function PagoPanel({ alumno, mes, onClose, onSaved }) {
  const yaExiste = Boolean(alumno.pago)
  const [monto,     setMonto]     = useState(yaExiste ? String(alumno.pago.monto) : String(alumno.monto_sugerido || ''))
  const [metodo,    setMetodo]    = useState(yaExiste ? alumno.pago.metodo : 'efectivo')
  const [mixto,     setMixto]     = useState(yaExiste ? Boolean(alumno.pago.monto_2) : false)
  const [monto2,    setMonto2]    = useState(yaExiste ? String(alumno.pago.monto_2 || '') : '')
  const [metodo2,   setMetodo2]   = useState(yaExiste ? (alumno.pago.metodo_2 || 'transferencia') : 'transferencia')
  const [notas,     setNotas]     = useState(yaExiste ? (alumno.pago.notas || '') : '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const totalCobrado = (parseFloat(monto) || 0) + (mixto ? (parseFloat(monto2) || 0) : 0)
  const deuda = Math.max(0, (alumno.monto_sugerido || 0) - totalCobrado)

  const [y, m] = mes.split('-')
  const mesFecha = `${y}-${m}-01`

  async function guardar() {
    setSaving(true); setError('')
    try {
      const payload = {
        alumno: alumno.alumno_id,
        mes:    mesFecha,
        monto:  parseFloat(monto) || 0,
        metodo,
        monto_sugerido: alumno.monto_sugerido || null,
        monto_2:  mixto && monto2 ? parseFloat(monto2) : null,
        metodo_2: mixto && monto2 ? metodo2 : null,
        deuda,
        notas: notas || null,
        fecha_pago: new Date().toISOString().slice(0, 10),
      }
      if (yaExiste) {
        await api.patch(`/pagos/${alumno.pago.id}/`, payload)
      } else {
        await api.post('/pagos/', payload)
      }
      onSaved()
    } catch (e) {
      const msg = e.response?.data
      if (typeof msg === 'object') {
        const vals = Object.values(msg).flat()
        setError(typeof vals[0] === 'string' ? vals[0] : 'Error al guardar.')
      } else {
        setError('Error al guardar.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">
              {yaExiste ? 'Editar pago' : 'Registrar pago'}
            </h2>
            <p className="text-xs text-dark-muted">{alumno.apellido}, {alumno.nombre} — {mesLabel(mes)}</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Info alumno */}
          <div className="bg-dark-bg rounded-xl border border-dark-border p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-dark-muted">Disciplina</span>
              <span className="text-dark-text">{DISC_LABEL[alumno.disciplina]} · {alumno.frecuencia}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-muted">Monto sugerido</span>
              <span className="text-green-400 font-semibold">{money(alumno.monto_sugerido || 0)}</span>
            </div>
            {alumno.precio_especial && (
              <div className="text-xs text-yellow-400">⚡ Precio especial: {alumno.motivo_precio_especial}</div>
            )}
          </div>

          {/* Monto principal */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Monto cobrado *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted">$</span>
              <input
                type="number" min="0" step="100"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                className="input w-full pl-7"
              />
            </div>
          </div>

          {/* Método */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-2">Método</label>
            <div className="flex gap-2">
              {METODOS.map(m => (
                <button
                  key={m.val} type="button"
                  onClick={() => setMetodo(m.val)}
                  className={clsx(
                    'flex-1 py-2 rounded-xl border text-xs font-medium transition-colors',
                    metodo === m.val
                      ? 'bg-indigo-700 border-indigo-600 text-white'
                      : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                  )}
                >{m.label}</button>
              ))}
            </div>
          </div>

          {/* Toggle pago mixto */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={mixto} onChange={e => setMixto(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
            <span className="text-sm text-dark-text">Pago mixto (2 métodos)</span>
          </label>

          {mixto && (
            <>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-1.5">Monto 2</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted">$</span>
                  <input
                    type="number" min="0" step="100"
                    value={monto2}
                    onChange={e => setMonto2(e.target.value)}
                    className="input w-full pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-dark-muted font-medium mb-2">Método 2</label>
                <div className="flex gap-2">
                  {METODOS.map(m => (
                    <button
                      key={m.val} type="button"
                      onClick={() => setMetodo2(m.val)}
                      className={clsx(
                        'flex-1 py-2 rounded-xl border text-xs font-medium transition-colors',
                        metodo2 === m.val
                          ? 'bg-indigo-700 border-indigo-600 text-white'
                          : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                      )}
                    >{m.label}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Deuda calculada */}
          {deuda > 0 && (
            <div className="flex items-center justify-between bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
              <span className="text-xs text-red-300">Queda pendiente</span>
              <span className="text-red-400 font-bold">{money(deuda)}</span>
            </div>
          )}
          {deuda === 0 && parseFloat(monto) > 0 && (
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle size={14} /> Pago completo
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-1.5">Notas</label>
            <input
              type="text" value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Opcional"
              className="input w-full text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={guardar} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {yaExiste ? 'Actualizar pago' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Day Liquidation Tab ───────────────────────────────────────────────────────
function LiquidacionDayTab({ mes }) {
  const { data, isLoading } = useQuery({
    queryKey: ['liq-day', mes],
    queryFn: () => api.get(`/pagos/liquidacion-day/?mes=${mes}`).then(r => r.data),
  })

  if (isLoading) return <div className="text-center py-10 text-dark-muted">Cargando...</div>
  if (!data || !data.grupos?.length) return (
    <div className="text-center py-10 text-dark-muted">No hay pagos de alumnos externos en {mesLabel(mes)}</div>
  )

  return (
    <div className="space-y-4">
      {/* Totales */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-surface rounded-xl p-4 border border-dark-border text-center">
          <p className="text-xs text-dark-muted mb-1">Total cobrado</p>
          <p className="text-lg font-bold text-dark-text">{money(data.total_cobrado)}</p>
        </div>
        <div className="bg-dark-surface rounded-xl p-4 border border-dark-border text-center">
          <p className="text-xs text-dark-muted mb-1">Queda en Athlon</p>
          <p className="text-lg font-bold text-green-400">{money(data.total_athlon)}</p>
        </div>
        <div className="bg-dark-surface rounded-xl p-4 border border-dark-border text-center">
          <p className="text-xs text-dark-muted mb-1">A transferir</p>
          <p className="text-lg font-bold text-purple-400">{money(data.total_transferir)}</p>
        </div>
      </div>

      {data.grupos.map(g => (
        <div key={g.pertenencia} className="bg-dark-surface rounded-xl border border-dark-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-bg">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={14} className="text-purple-400" />
              <span className="font-semibold text-dark-text">{g.nombre_espacio}</span>
            </div>
            <div className="text-xs text-dark-muted">
              Transferir: <span className="text-purple-400 font-bold">{money(g.monto_transferir)}</span>
            </div>
          </div>
          <div className="divide-y divide-dark-border">
            {g.alumnos.map(a => (
              <div key={a.alumno_id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="text-dark-text">{a.nombre}</span>
                  <span className="text-dark-muted ml-2 text-xs">{DISC_LABEL[a.disciplina]}</span>
                </div>
                <div className="text-right">
                  <div className="text-dark-text">{money(a.cobrado)}</div>
                  <div className="text-xs text-purple-400">→ {money(a.monto_transferir)} a {g.nombre_espacio}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CobrosPage() {
  const qc = useQueryClient()
  const [mes, setMes] = useState(mesActual)
  const [tab, setTab] = useState('todos')
  const [sedeFilter, setSedeFilter] = useState('')
  const [discFilter, setDiscFilter] = useState('')
  const [freqFilter, setFreqFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cobros-resumen', mes],
    queryFn: () => api.get(`/pagos/resumen/?mes=${mes}`).then(r => r.data),
  })

  const alumnos = data?.alumnos ?? []
  const statsGlobal = data?.stats ?? {}

  const alumnosFiltradosSede = useMemo(() => {
    if (!sedeFilter) return alumnos
    return alumnos.filter(a => a.sede === sedeFilter)
  }, [alumnos, sedeFilter])

  const stats = useMemo(() => {
    if (!sedeFilter) return statsGlobal
    const list = alumnosFiltradosSede
    const pagados = list.filter(a => a.pago).length
    return {
      total: list.length,
      pagados,
      pendientes: list.filter(a => !a.pago).length,
      total_cobrado: list.reduce((s, a) => s + (a.pago ? (a.pago.monto + (a.pago.monto_2 || 0)) : 0), 0),
      total_deuda: list.reduce((s, a) => s + (a.pago?.deuda || 0), 0),
    }
  }, [alumnosFiltradosSede, sedeFilter, statsGlobal])

  const discsDisponibles = useMemo(() => {
    const map = {}
    alumnosFiltradosSede.forEach(a => { map[a.disciplina] = (map[a.disciplina] || 0) + 1 })
    return DISC_ORDER.filter(d => map[d]).map(d => ({ disc: d, count: map[d] }))
  }, [alumnosFiltradosSede])

  const freqsDisponibles = useMemo(() => {
    if (!discFilter) return []
    const map = {}
    alumnosFiltradosSede.filter(a => a.disciplina === discFilter)
      .forEach(a => { map[a.frecuencia] = (map[a.frecuencia] || 0) + 1 })
    return FREQ_ORDER.filter(f => map[f]).map(f => ({ freq: f, count: map[f] }))
  }, [alumnosFiltradosSede, discFilter])

  const filtrados = useMemo(() => {
    let list = alumnosFiltradosSede
    if (discFilter) list = list.filter(a => a.disciplina === discFilter)
    if (freqFilter) list = list.filter(a => a.frecuencia === freqFilter)
    if (tab === 'pendientes') return list.filter(a => !a.pago && a.estado !== 'baja')
    if (tab === 'pagados')    return list.filter(a => a.pago)
    if (tab === 'deuda')      return list.filter(a => a.pago?.deuda > 0)
    if (tab === 'day')        return list.filter(a => a.pertenencia !== 'athlon')
    return list
  }, [alumnosFiltradosSede, tab, discFilter, freqFilter])

  function exportarCSV() {
    if (!filtrados.length) return
    const encabezado = ['Nombre', 'Apellido', 'Sede', 'Disciplina', 'Frecuencia', 'Horario', 'Estado pago', 'Monto cobrado', 'Método', 'Deuda', 'Cuota sugerida']
    const rows = filtrados.map(a => [
      a.nombre,
      a.apellido,
      a.sede,
      a.disciplina,
      a.frecuencia,
      a.horario,
      a.pago ? 'Pagado' : 'Pendiente',
      a.pago ? (a.pago.monto + (a.pago.monto_2 || 0)) : '',
      a.pago ? a.pago.metodo : '',
      a.pago?.deuda || 0,
      a.monto_sugerido || '',
    ])
    const csv = [encabezado, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cobros_${mes}_${sedeFilter || 'ambas'}_${tab}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onSaved() {
    qc.invalidateQueries({ queryKey: ['cobros-resumen', mes] })
    setSelected(null)
  }

  const TABS = [
    { key: 'todos',       label: 'Todos',     count: stats.total },
    { key: 'pendientes',  label: 'Pendientes', count: stats.pendientes },
    { key: 'pagados',     label: 'Pagados',   count: stats.pagados },
    { key: 'deuda',       label: 'Con deuda', count: null },
    { key: 'day',         label: 'Externos',  count: null },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Cobros</h1>
          <p className="text-sm text-dark-muted mt-0.5">Registro de cuotas mensuales</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sedeFilter}
            onChange={e => { setSedeFilter(e.target.value); setDiscFilter(''); setFreqFilter('') }}
            className="input text-sm px-3 py-2"
          >
            <option value="">Ambas sedes</option>
            <option value="107">Athlon 107</option>
            <option value="24">Athlon 24</option>
          </select>
          <input
            type="month" value={mes}
            onChange={e => setMes(e.target.value)}
            className="input text-sm px-3 py-2"
          />
          <button
            onClick={exportarCSV}
            title="Exportar lista filtrada"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-border
              text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-all text-sm"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-dark-surface rounded-xl p-3 border border-dark-border text-center">
            <p className="text-xs text-dark-muted mb-1">Pagados</p>
            <p className="text-xl font-bold text-green-400">{stats.pagados}/{stats.total}</p>
          </div>
          <div className="bg-dark-surface rounded-xl p-3 border border-dark-border text-center">
            <p className="text-xs text-dark-muted mb-1">Total cobrado</p>
            <p className="text-xl font-bold text-dark-text">{money(stats.total_cobrado)}</p>
          </div>
          <div className="bg-dark-surface rounded-xl p-3 border border-dark-border text-center">
            <p className="text-xs text-dark-muted mb-1">Pendientes</p>
            <p className="text-xl font-bold text-yellow-400">{stats.pendientes}</p>
          </div>
          <div className="bg-dark-surface rounded-xl p-3 border border-dark-border text-center">
            <p className="text-xs text-dark-muted mb-1">Deuda total</p>
            <p className="text-xl font-bold text-red-400">{money(stats.total_deuda)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              tab === t.key
                ? 'bg-indigo-700 border-indigo-600 text-white'
                : 'bg-dark-surface border-dark-border text-dark-muted hover:text-dark-text'
            )}
          >
            {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Nivel 1: Disciplina */}
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
          <button key={disc}
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

      {/* Nivel 2: Frecuencia (solo si disc seleccionada y hay más de una opción) */}
      {discFilter && freqsDisponibles.length > 1 && (
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
            <button key={freq}
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
      {!(discFilter && freqsDisponibles.length > 1) && <div className="mb-4" />}

      {/* Day Liquidation Tab */}
      {tab === 'day' ? (
        <LiquidacionDayTab mes={mes} />
      ) : (
        <>
          {isLoading && <div className="text-center py-10 text-dark-muted">Cargando...</div>}

          {!isLoading && filtrados.length === 0 && (
            <div className="text-center py-10 text-dark-muted">No hay alumnos en esta sección</div>
          )}

          <div className="space-y-2">
            {filtrados.map(a => {
              const pagado = Boolean(a.pago)
              const conDeuda = a.pago?.deuda > 0
              const totalCobrado = a.pago ? (a.pago.monto + (a.pago.monto_2 || 0)) : 0

              return (
                <div
                  key={a.alumno_id}
                  onClick={() => setSelected(a)}
                  className={clsx(
                    'bg-dark-surface rounded-xl border p-3 flex items-center gap-3 cursor-pointer hover:border-indigo-600 transition-colors',
                    pagado && !conDeuda ? 'border-green-800/40' : conDeuda ? 'border-red-800/40' : 'border-dark-border'
                  )}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {pagado && !conDeuda
                      ? <CheckCircle size={18} className="text-green-400" />
                      : conDeuda
                        ? <AlertCircle size={18} className="text-red-400" />
                        : <Clock size={18} className="text-dark-muted" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-dark-text">
                        {a.apellido}, {a.nombre}
                      </span>
                      {a.pertenencia !== 'athlon' && (
                        <span className={clsx('text-xs font-medium', PERT_COLOR[a.pertenencia])}>
                          [{a.pertenencia === 'day' ? 'Day' : 'Externo'}]
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-dark-muted">
                      {DISC_LABEL[a.disciplina]} · {a.frecuencia} · A{a.sede} · {a.horario || '—'}
                    </div>
                  </div>

                  {/* Monto */}
                  <div className="text-right flex-shrink-0">
                    {pagado ? (
                      <>
                        <div className={clsx('text-sm font-bold', conDeuda ? 'text-red-400' : 'text-green-400')}>
                          {money(totalCobrado)}
                        </div>
                        {conDeuda && <div className="text-xs text-red-400">Debe {money(a.pago.deuda)}</div>}
                        {!conDeuda && <div className="text-xs text-dark-muted">{a.pago.metodo}{a.pago.metodo_2 ? ` + ${a.pago.metodo_2}` : ''}</div>}
                      </>
                    ) : (
                      <div className="text-sm font-medium text-dark-muted">{money(a.monto_sugerido || 0)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Payment panel */}
      {selected && (
        <PagoPanel
          alumno={selected}
          mes={mes}
          onClose={() => setSelected(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
