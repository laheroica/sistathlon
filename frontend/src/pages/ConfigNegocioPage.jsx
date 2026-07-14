import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, Loader2, Upload, Building2, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'

// Lee un archivo de imagen y lo reduce a un data URI (máx ~360px de alto) para
// que el logo pese poco al guardarlo en la base.
function fileADataURI(file, maxH = 360) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const escala = Math.min(1, maxH / img.height)
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        // PNG para conservar transparencia
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function LogoField({ label, hint, fondo, value, onChange }) {
  const inputRef = useRef(null)
  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const uri = await fileADataURI(file)
    onChange(uri)
  }
  return (
    <div>
      <label className="block text-xs text-dark-muted font-medium mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <div className={clsx('w-40 h-16 rounded-xl border border-dark-border flex items-center justify-center overflow-hidden', fondo)}>
          {value
            ? <img src={value} alt="logo" className="max-h-14 max-w-[150px] object-contain" />
            : <span className="text-xs text-dark-muted">Sin logo</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-dark-muted hover:text-dark-text transition-colors">
            <Upload size={13} /> Subir imagen
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')}
              className="text-xs text-dark-muted hover:text-red-400 transition-colors">Quitar</button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>
      {hint && <p className="text-xs text-dark-muted mt-1.5">{hint}</p>}
    </div>
  )
}

// ── ABM de sedes / sucursales ──────────────────────────────────────────────────

function SedeRow({ sede, onError }) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState(sede.nombre)
  useEffect(() => { setNombre(sede.nombre) }, [sede.nombre])
  const refetch = () => qc.invalidateQueries({ queryKey: ['config-sedes'] })

  async function guardarNombre() {
    const val = nombre.trim()
    if (!val || val === sede.nombre) { setNombre(sede.nombre); return }
    await api.patch(`/config/sedes/${sede.id}/`, { nombre: val })
    refetch()
  }
  async function toggleActiva() {
    onError('')
    await api.patch(`/config/sedes/${sede.id}/`, { activa: !sede.activa })
    refetch()
  }
  async function eliminar() {
    onError('')
    if (!window.confirm(`¿Eliminar la sede "${sede.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/config/sedes/${sede.id}/`)
      refetch()
    } catch (e) {
      onError(e.response?.data?.detail
        || (e.response?.status === 403 ? 'Solo el superadministrador puede eliminar sedes.' : 'Error al eliminar la sede.'))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-dark-muted w-12 flex-shrink-0">{sede.codigo}</span>
      <input
        className={clsx('input flex-1 text-sm', !sede.activa && 'opacity-50')}
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        onBlur={guardarNombre}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <button type="button" onClick={toggleActiva}
        className={clsx('text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex-shrink-0',
          sede.activa
            ? 'border-dark-border text-dark-muted hover:text-amber-400'
            : 'border-green-800/40 text-green-400 hover:text-green-300')}>
        {sede.activa ? 'Desactivar' : 'Activar'}
      </button>
      <button type="button" onClick={eliminar} title="Eliminar sede (solo si no tiene datos)"
        className="text-dark-muted hover:text-red-400 transition-colors flex-shrink-0 p-1.5">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function SedesManager() {
  const qc = useQueryClient()
  const { data: sedes = [], isLoading } = useQuery({
    queryKey: ['config-sedes'],
    queryFn: () => api.get('/config/sedes/').then(r => r.data),
  })
  const [nuevo, setNuevo] = useState({ codigo: '', nombre: '' })
  const [err, setErr] = useState('')
  const [verInactivas, setVerInactivas] = useState(false)

  const activas   = sedes.filter(s => s.activa)
  const inactivas = sedes.filter(s => !s.activa)

  async function agregar() {
    setErr('')
    const codigo = nuevo.codigo.trim()
    const nombre = nuevo.nombre.trim()
    if (!codigo || !nombre) { setErr('Completá código y nombre.'); return }
    try {
      await api.post('/config/sedes/', { codigo, nombre, orden: sedes.length + 1 })
      setNuevo({ codigo: '', nombre: '' })
      qc.invalidateQueries({ queryKey: ['config-sedes'] })
    } catch (e) {
      setErr(e.response?.status === 403
        ? 'Solo el superadministrador puede agregar sedes.'
        : (e.response?.data?.codigo ? 'Ese código de sede ya existe.' : 'Error al agregar la sede.'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-dark-muted">
        <Building2 size={14} /> Sucursales / sedes
      </div>
      {isLoading ? (
        <div className="h-16 bg-dark-bg rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-2">
          {activas.map(s => <SedeRow key={s.id} sede={s} onError={setErr} />)}

          {inactivas.length > 0 && (
            <button type="button" onClick={() => setVerInactivas(v => !v)}
              className="text-xs text-dark-muted hover:text-dark-text transition-colors">
              {verInactivas ? 'Ocultar' : 'Ver'} inactivas ({inactivas.length})
            </button>
          )}
          {verInactivas && inactivas.map(s => <SedeRow key={s.id} sede={s} onError={setErr} />)}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input className="input w-20 text-sm" placeholder="Código"
          value={nuevo.codigo} onChange={e => setNuevo(n => ({ ...n, codigo: e.target.value }))} />
        <input className="input flex-1 text-sm" placeholder="Nombre de la nueva sede"
          value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && agregar()} />
        <button type="button" onClick={agregar}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-dark-muted hover:text-dark-text transition-colors flex-shrink-0">
          <Plus size={13} /> Agregar
        </button>
      </div>
      <p className="text-[11px] text-dark-muted leading-relaxed">
        El <span className="font-mono">código</span> es un identificador interno corto y estable (ej: 107). No lo cambies después de crearlo.
        Para dejar de usar una sede, desactivala — así no se pierden sus datos históricos.
      </p>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}

export default function ConfigNegocioPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['negocio-config'],
    queryFn: () => api.get('/config/negocio/').then(r => r.data),
    staleTime: 0,
  })

  const [form, setForm] = useState({ nombre: '', ciudad: '', logo_claro: '', logo_oscuro: '' })
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (data) setForm({
      nombre: data.nombre || '', ciudad: data.ciudad || '',
      logo_claro: data.logo_claro || '', logo_oscuro: data.logo_oscuro || '',
    })
  }, [data])

  async function guardar() {
    setSaving(true); setError(''); setOk(false)
    try {
      await api.patch('/config/negocio/', form)
      qc.invalidateQueries({ queryKey: ['negocio-config'] })
      setOk(true); setTimeout(() => setOk(false), 2500)
    } catch (e) {
      setError(e.response?.status === 403
        ? 'Solo el superadministrador puede cambiar la configuración.'
        : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-900/40 flex items-center justify-center">
          <Settings size={18} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dark-text">Configuración del negocio</h1>
          <p className="text-xs text-dark-muted">Nombre, ciudad y logos que usa todo el sistema y los PDFs</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-dark-surface rounded-2xl animate-pulse" />
      ) : (
        <div className="card space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Nombre del negocio</label>
              <input className="input w-full text-sm" value={form.nombre}
                onChange={e => set('nombre', e.target.value)} placeholder="Ej: Athlon" />
            </div>
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Ciudad / ubicación</label>
              <input className="input w-full text-sm" value={form.ciudad}
                onChange={e => set('ciudad', e.target.value)} placeholder="Ej: General Pico, La Pampa" />
            </div>
          </div>

          <div className="border-t border-dark-border pt-4">
            <SedesManager />
          </div>

          <div className="border-t border-dark-border pt-4 flex items-center gap-2 text-xs text-dark-muted">
            <Building2 size={14} /> Logos (opcional — si no cargás, se usa el de Athlon por defecto)
          </div>

          <LogoField
            label="Logo para el sistema (fondo oscuro)"
            hint="Se ve en la barra lateral y el login. Ideal un logo claro/blanco con fondo transparente."
            fondo="bg-dark-bg"
            value={form.logo_claro}
            onChange={v => set('logo_claro', v)}
          />
          <LogoField
            label="Logo para los PDFs (fondo claro)"
            hint="Se ve arriba en los informes y liquidaciones. Ideal un logo oscuro/negro."
            fondo="bg-white"
            value={form.logo_oscuro}
            onChange={v => set('logo_oscuro', v)}
          />

          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex items-center gap-3">
            <button onClick={guardar} disabled={saving}
              className="flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 px-5 rounded-xl transition-colors text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar cambios
            </button>
            {ok && <span className="text-sm text-green-400 font-medium">✓ Guardado</span>}
          </div>
        </div>
      )}
    </div>
  )
}
