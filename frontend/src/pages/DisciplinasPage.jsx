import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Plus, Pencil, Trash2, X, Save, Loader2,
  GripVertical, ChevronUp, ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { toast } from 'sonner'

// ── Paleta de colores disponibles ─────────────────────────────────────────────
const COLOR_PRESETS = [
  { badge: 'bg-blue-900/70 text-blue-200',    hex: '#3b82f6', label: 'Azul' },
  { badge: 'bg-green-900/70 text-green-200',  hex: '#22c55e', label: 'Verde' },
  { badge: 'bg-yellow-900/70 text-yellow-200',hex: '#eab308', label: 'Amarillo' },
  { badge: 'bg-orange-900/70 text-orange-200',hex: '#f97316', label: 'Naranja' },
  { badge: 'bg-purple-900/70 text-purple-200',hex: '#a855f7', label: 'Violeta' },
  { badge: 'bg-pink-900/70 text-pink-200',    hex: '#ec4899', label: 'Rosa' },
  { badge: 'bg-sky-900/70 text-sky-200',      hex: '#0ea5e9', label: 'Celeste' },
  { badge: 'bg-red-900/70 text-red-200',      hex: '#ef4444', label: 'Rojo' },
  { badge: 'bg-indigo-900/70 text-indigo-200',hex: '#6366f1', label: 'Índigo' },
  { badge: 'bg-teal-900/70 text-teal-200',    hex: '#14b8a6', label: 'Verde agua' },
  { badge: 'bg-lime-900/70 text-lime-200',    hex: '#84cc16', label: 'Lima' },
  { badge: 'bg-gray-700 text-gray-200',       hex: '#6b7280', label: 'Gris' },
]

// Frecuencias estándar para selección rápida
const FREC_STD = ['2x', '3x', '5x', 'libre']
const FREC_LABEL = { '2x': '2× semana', '3x': '3× semana', '5x': '5× semana', libre: 'Pase Libre' }

// ── Form vacío ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  codigo: '', nombre: '', frecuencias: [], color_badge: COLOR_PRESETS[0].badge,
  color_hex: COLOR_PRESETS[0].hex, orden: 0, activo: true,
}

// ── Panel lateral para crear / editar ─────────────────────────────────────────
function DiscipPanel({ disc, onClose, onSaved }) {
  const isEdit = Boolean(disc?.id)
  const [form, setForm] = useState(isEdit ? { ...disc } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [customFrec, setCustomFrec] = useState('')

  // Sincronizar cuando cambia el objeto disc (edit de otro registro)
  useEffect(() => {
    setForm(isEdit ? { ...disc } : { ...EMPTY_FORM })
    setError('')
  }, [disc])

  // Seleccionar color del preset
  function selectColor(preset) {
    setForm(f => ({ ...f, color_badge: preset.badge, color_hex: preset.hex }))
  }

  // Toggle frecuencia estándar
  function toggleFrec(frec) {
    setForm(f => {
      const current = f.frecuencias || []
      return {
        ...f,
        frecuencias: current.includes(frec)
          ? current.filter(x => x !== frec)
          : [...current, frec],
      }
    })
  }

  // Agregar frecuencia personalizada
  function addCustomFrec() {
    const val = customFrec.trim().toLowerCase()
    if (!val) return
    setForm(f => {
      if (f.frecuencias.includes(val)) return f
      return { ...f, frecuencias: [...f.frecuencias, val] }
    })
    setCustomFrec('')
  }

  function removeFrec(frec) {
    setForm(f => ({ ...f, frecuencias: f.frecuencias.filter(x => x !== frec) }))
  }

  async function handleSave() {
    setError('')
    if (!form.codigo.trim()) { setError('El código es obligatorio.'); return }
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
      }
      if (isEdit) {
        await api.put(`/disciplinas/${disc.id}/`, payload)
      } else {
        await api.post('/disciplinas/', payload)
      }
      onSaved()
    } catch (e) {
      const data = e.response?.data
      const msg = typeof data === 'object'
        ? Object.values(data).flat()[0]
        : 'Error al guardar'
      setError(typeof msg === 'string' ? msg : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Cerrar con Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const colorActual = COLOR_PRESETS.find(c => c.badge === form.color_badge) || null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark-text">
              {isEdit ? 'Editar disciplina' : 'Nueva disciplina'}
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">
              {isEdit ? `Editando ${disc.codigo}` : 'Completá los datos de la nueva disciplina'}
            </p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text p-1 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Código y nombre */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Código</label>
              <input
                className="input w-full text-sm uppercase"
                placeholder="CF"
                maxLength={10}
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                disabled={isEdit}  // no cambiar el código si ya existe
              />
              {isEdit && <p className="text-xs text-dark-muted/60 mt-1">No editable</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Nombre</label>
              <input
                className="input w-full text-sm"
                placeholder="CrossFit"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
          </div>

          {/* Frecuencias */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-2">
              Frecuencias disponibles
            </label>

            {/* Estándar */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FREC_STD.map(f => {
                const active = form.frecuencias.includes(f)
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFrec(f)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      active
                        ? 'bg-primary-dark border-primary-dark text-white'
                        : 'border-dark-border text-dark-muted hover:border-primary-dark/50'
                    )}
                  >
                    {FREC_LABEL[f]}
                  </button>
                )
              })}
            </div>

            {/* Frecuencias seleccionadas que no están en el standard */}
            {form.frecuencias.filter(f => !FREC_STD.includes(f)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.frecuencias.filter(f => !FREC_STD.includes(f)).map(f => (
                  <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-dark-border text-xs text-dark-text">
                    {f}
                    <button type="button" onClick={() => removeFrec(f)} className="text-dark-muted hover:text-red-400">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Agregar personalizada */}
            <div className="flex gap-2">
              <input
                className="input flex-1 text-xs py-1.5"
                placeholder="Otra (ej: 4x, semana)"
                value={customFrec}
                onChange={e => setCustomFrec(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomFrec() } }}
              />
              <button
                type="button"
                onClick={addCustomFrec}
                className="px-2 py-1 text-xs bg-dark-border text-dark-muted hover:text-dark-text rounded-lg transition-colors"
              >
                + Agregar
              </button>
            </div>

            {form.frecuencias.length === 0 && (
              <p className="text-xs text-dark-muted/60 mt-1.5 italic">
                Sin frecuencias — el alumno no tendrá opciones al asignarse esta disciplina.
              </p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-dark-muted font-medium mb-2">Color</label>
            {/* Preview del color actual */}
            <div className="flex items-center gap-2 mb-3">
              <span className={clsx('px-3 py-1 rounded-full text-xs font-semibold', form.color_badge)}>
                {form.codigo || 'Preview'}
              </span>
              <span className="text-xs text-dark-muted">{colorActual?.label || 'Personalizado'}</span>
            </div>
            {/* Paleta */}
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(preset => {
                const selected = form.color_badge === preset.badge
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => selectColor(preset)}
                    title={preset.label}
                    className={clsx(
                      'w-8 h-8 rounded-lg transition-all border-2',
                      selected ? 'border-white scale-110' : 'border-transparent hover:border-dark-muted/50'
                    )}
                    style={{ backgroundColor: preset.hex }}
                  />
                )
              })}
            </div>
          </div>

          {/* Orden y activo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">
                Orden (para ordenar lista)
              </label>
              <input
                type="number"
                min="0"
                className="input w-full text-sm"
                value={form.orden}
                onChange={e => setForm(f => ({ ...f, orden: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-muted font-medium mb-1.5">Estado</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={clsx(
                  'w-full py-2 rounded-xl text-sm font-medium transition-colors border',
                  form.activo
                    ? 'bg-green-900/30 border-green-700/50 text-green-400'
                    : 'bg-dark-border border-dark-border text-dark-muted'
                )}
              >
                {form.activo ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Guardar cambios' : 'Crear disciplina'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function DisciplinasPage() {
  const qc = useQueryClient()
  const [panel, setPanel] = useState(null)  // null | {} (nueva) | { disc } (editar)

  const { data: disciplinas = [], isLoading } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: () => api.get('/disciplinas/').then(r => r.data),
    staleTime: 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/disciplinas/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disciplinas'] })
      toast.success('Disciplina eliminada')
    },
    onError: () => toast.error('No se pudo eliminar'),
  })

  // Cambiar orden rápido con flechas
  const ordenMut = useMutation({
    mutationFn: ({ id, orden }) => api.patch(`/disciplinas/${id}/`, { orden }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disciplinas'] }),
  })

  async function handleDelete(disc) {
    if (!confirm(`¿Eliminar la disciplina "${disc.nombre}" (${disc.codigo})? Esta acción no se puede deshacer.`)) return
    deleteMut.mutate(disc.id)
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['disciplinas'] })
    setPanel(null)
    toast.success(panel?.disc ? 'Disciplina actualizada' : 'Disciplina creada')
  }

  function moverOrden(disc, delta) {
    ordenMut.mutate({ id: disc.id, orden: Math.max(0, disc.orden + delta) })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-900/40 flex items-center justify-center">
            <BookOpen size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Disciplinas</h1>
            <p className="text-xs text-dark-muted">
              Administrá las disciplinas disponibles en el sistema
            </p>
          </div>
        </div>
        <button
          onClick={() => setPanel({ disc: null })}
          className="flex items-center gap-2 bg-primary-dark hover:bg-primary-dark/80 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} />
          Nueva disciplina
        </button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-dark-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : disciplinas.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={32} className="text-dark-muted mx-auto mb-3" />
          <p className="text-dark-muted">No hay disciplinas configuradas.</p>
          <button
            onClick={() => setPanel({ disc: null })}
            className="mt-4 text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            + Agregar la primera
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left text-xs text-dark-muted font-medium px-5 py-3 uppercase tracking-wider">
                  Código / Nombre
                </th>
                <th className="text-left text-xs text-dark-muted font-medium px-4 py-3 uppercase tracking-wider hidden sm:table-cell">
                  Frecuencias
                </th>
                <th className="text-center text-xs text-dark-muted font-medium px-4 py-3 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-center text-xs text-dark-muted font-medium px-4 py-3 uppercase tracking-wider">
                  Orden
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {disciplinas.map((disc, idx) => (
                <tr
                  key={disc.id}
                  className={clsx(
                    'border-b border-dark-border/50 transition-colors hover:bg-dark-bg/30',
                    !disc.activo && 'opacity-50'
                  )}
                >
                  {/* Código + nombre */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', disc.color_badge)}>
                        {disc.codigo}
                      </span>
                      <div>
                        <p className="font-medium text-dark-text">{disc.nombre}</p>
                      </div>
                    </div>
                  </td>

                  {/* Frecuencias */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(disc.frecuencias || []).map(f => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded bg-dark-border text-xs text-dark-muted"
                        >
                          {f}
                        </span>
                      ))}
                      {(disc.frecuencias || []).length === 0 && (
                        <span className="text-xs text-dark-muted/60 italic">—</span>
                      )}
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      disc.activo
                        ? 'bg-green-900/40 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    )}>
                      {disc.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>

                  {/* Orden */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => moverOrden(disc, -1)}
                        disabled={disc.orden === 0}
                        className="p-0.5 text-dark-muted hover:text-dark-text disabled:opacity-20 transition-colors"
                        title="Subir"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <span className="text-xs text-dark-muted w-4 text-center">{disc.orden}</span>
                      <button
                        onClick={() => moverOrden(disc, 1)}
                        className="p-0.5 text-dark-muted hover:text-dark-text transition-colors"
                        title="Bajar"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setPanel({ disc })}
                        className="p-1.5 text-dark-muted hover:text-indigo-400 transition-colors rounded-lg hover:bg-indigo-900/20"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(disc)}
                        className="p-1.5 text-dark-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info aclaratoria */}
      <div className="card bg-dark-bg/40 border-dark-border/50">
        <p className="text-xs text-dark-muted leading-relaxed">
          <span className="font-semibold text-dark-text">Nota:</span> Las disciplinas activas aparecen en los menús de alta de alumnos, horarios y precios.
          Las inactivas quedan ocultas pero sus datos históricos se conservan.
          El código no se puede modificar una vez creado porque identifica alumnos, horarios y precios existentes.
        </p>
      </div>

      {/* Panel lateral */}
      {panel !== null && (
        <DiscipPanel
          disc={panel.disc}
          onClose={() => setPanel(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
