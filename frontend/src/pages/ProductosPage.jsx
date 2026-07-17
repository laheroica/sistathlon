import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Save, Loader2, Package, ShoppingCart, CreditCard, ChevronDown, ChevronUp, Pencil, Trash2, PackagePlus, Truck, Sliders, History } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'
import api from '../lib/api'
import { money } from '../lib/format'
import { useNegocio } from '../hooks/useNegocio'

const DEPOSITO = 'deposito'

const CATEGORIAS = [
  { val: 'indumentaria', label: 'Indumentaria' },
  { val: 'accesorio',    label: 'Accesorio' },
  { val: 'bebida',       label: 'Bebida' },
]

const METODOS = [
  { val: 'efectivo',         label: 'Efectivo' },
  { val: 'transferencia',    label: 'Transferencia' },
  { val: 'cuenta_corriente', label: 'Cuenta Corriente' },
]

const CAT_COLOR = {
  indumentaria: 'bg-blue-500/20 text-blue-300',
  accesorio:    'bg-purple-500/20 text-purple-300',
  bebida:       'bg-green-500/20 text-green-300',
}

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Ubicaciones de stock: depósito general + sucursales configuradas
function useUbicaciones() {
  const { sedeOptions } = useNegocio()
  return [{ val: DEPOSITO, label: 'Depósito' }, ...sedeOptions.map(s => ({ val: s.val, label: s.label }))]
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-dark-surface border border-dark-border rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="font-semibold text-dark-text">{title}</h2>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text"><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ── TAB 1: CATÁLOGO + STOCK ─────────────────────────────────────────────────────

function CatalogoTab() {
  const qc = useQueryClient()
  const ubicaciones = useUbicaciones()
  const [modal, setModal] = useState(null)       // 'new' | producto (editar)
  const [movModal, setMovModal] = useState(null) // 'ingreso' | 'envio' | 'ajuste'
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({ nombre: '', categoria: 'indumentaria', precio: '', activo: true })

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['productos'],
    queryFn: () => api.get('/productos/').then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (body) =>
      modal?.id ? api.patch(`/productos/${modal.id}/`, body) : api.post('/productos/', body),
    onSuccess: () => { qc.invalidateQueries(['productos']); setModal(null); setSaveError('') },
    onError: (err) => setSaveError(
      err?.response?.data ? JSON.stringify(err.response.data) : 'Error al guardar. Verificá la conexión.'
    ),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/productos/${id}/`).then(r => r.data ?? null),
    onSuccess: (data) => {
      qc.invalidateQueries(['productos'])
      if (data?.desactivado) toast.warning('El producto tiene ventas y no puede eliminarse. Se desactivó.')
      else toast.success('Producto eliminado.')
    },
    onError: () => toast.error('No se pudo eliminar el producto.'),
  })

  function openNew() {
    setSaveError('')
    setForm({ nombre: '', categoria: 'indumentaria', precio: '', activo: true })
    setModal('new')
  }
  function openEdit(p) {
    setSaveError('')
    setForm({ nombre: p.nombre, categoria: p.categoria, precio: p.precio, activo: p.activo })
    setModal(p)
  }
  function handleSave() {
    saveMut.mutate({ ...form, precio: parseFloat(form.precio) || 0 })
  }

  const agrupado = useMemo(() => {
    const groups = {}
    for (const cat of CATEGORIAS) groups[cat.val] = []
    for (const p of productos) if (groups[p.categoria]) groups[p.categoria].push(p)
    return groups
  }, [productos])

  if (isLoading) return <div className="text-dark-muted p-6 text-sm">Cargando...</div>

  return (
    <div>
      <div className="flex flex-wrap justify-end gap-2 mb-4">
        <button onClick={() => setMovModal('ingreso')} className="flex items-center gap-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 text-sm px-3 py-1.5 rounded-lg">
          <PackagePlus size={15} /> Ingreso
        </button>
        <button onClick={() => setMovModal('envio')} className="flex items-center gap-2 bg-sky-700/30 hover:bg-sky-700/50 text-sky-300 text-sm px-3 py-1.5 rounded-lg">
          <Truck size={15} /> Enviar a sucursal
        </button>
        <button onClick={() => setMovModal('ajuste')} className="flex items-center gap-2 bg-dark-border hover:bg-dark-surface text-dark-muted text-sm px-3 py-1.5 rounded-lg">
          <Sliders size={15} /> Ajuste
        </button>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm px-3 py-1.5 rounded-lg">
          <Plus size={15} /> Nuevo producto
        </button>
      </div>

      {CATEGORIAS.map(({ val, label }) => (
        <div key={val} className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">{label}</h3>
          {agrupado[val].length === 0
            ? <p className="text-dark-muted text-sm">Sin productos</p>
            : (
              <div className="grid gap-2">
                {agrupado[val].map(p => {
                  const stock = p.stock_ubic || {}
                  return (
                    <div key={p.id} className={clsx('flex items-center gap-3 bg-dark-card border border-dark-border rounded-lg px-3 py-2 flex-wrap', !p.activo && 'opacity-50')}>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', CAT_COLOR[p.categoria])}>{p.categoria_label}</span>
                      <span className="flex-1 text-sm text-dark-text min-w-[120px]">{p.nombre}</span>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono text-dark-text">{money(p.precio)}</div>
                        {p.costo != null && (
                          <div className="text-[11px] text-dark-muted">costo {money(p.costo)} · margen {money(p.margen)}</div>
                        )}
                      </div>
                      {/* Stock por ubicación */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {ubicaciones.map(u => {
                          const q = stock[u.val] || 0
                          return (
                            <span key={u.val} className={clsx(
                              'text-xs px-2 py-0.5 rounded-md border font-mono',
                              u.val === DEPOSITO ? 'border-amber-700/40 bg-amber-900/20 text-amber-300'
                                : q <= 2 ? 'border-red-800/40 bg-red-900/20 text-red-300'
                                : 'border-dark-border bg-dark-surface text-dark-text'
                            )}>
                              {u.val === DEPOSITO ? 'Dep' : u.label}: {q}
                            </span>
                          )
                        })}
                      </div>
                      <button onClick={() => openEdit(p)} className="text-dark-muted hover:text-dark-text shrink-0"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('¿Eliminar producto?')) deleteMut.mutate(p.id) }} className="text-dark-muted hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      ))}

      {(modal === 'new' || (modal && modal.id)) && (
        <Modal title={modal?.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-dark-muted mb-1">Nombre</label>
              <input className="input w-full" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Categoría</label>
              <select className="input w-full" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Precio de venta</label>
              <input type="number" className="input w-full" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            </div>
            <p className="text-xs text-dark-muted">El stock se maneja con Ingreso / Envío / Ajuste, no se carga acá.</p>
            <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
              Activo
            </label>
            {saveError && <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className="btn-ghost text-sm px-3 py-1.5">Cancelar</button>
              <button onClick={handleSave} disabled={saveMut.isPending} className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {movModal && (
        <MovimientoModal
          tipo={movModal}
          productos={productos}
          onClose={() => { setMovModal(null); qc.invalidateQueries(['productos']); qc.invalidateQueries(['movimientos']) }}
        />
      )}
    </div>
  )
}

// ── Modal: Ingreso / Envío / Ajuste ─────────────────────────────────────────────

function MovimientoModal({ tipo, productos, onClose }) {
  const { sedeOptions } = useNegocio()
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad]     = useState(1)
  const [fecha, setFecha]           = useState(hoy())
  const [destino, setDestino]       = useState(sedeOptions[0]?.val || '')
  const [costo, setCosto]           = useState('')
  const [proveedor, setProveedor]   = useState('')
  const [ajUbic, setAjUbic]         = useState(DEPOSITO)
  const [ajSentido, setAjSentido]   = useState('sumar')
  const [error, setError]           = useState('')

  const producto = productos.find(p => String(p.id) === String(productoId))
  const stockDeposito = producto?.stock_ubic?.[DEPOSITO] || 0

  const titulos = { ingreso: 'Ingreso de mercadería', envio: 'Enviar a sucursal', ajuste: 'Ajuste de stock' }

  const saveMut = useMutation({
    mutationFn: (body) => api.post('/productos/movimientos/', body),
    onSuccess: () => { toast.success('Movimiento registrado'); onClose() },
    onError: (err) => setError(err?.response?.data ? JSON.stringify(err.response.data) : 'Error al registrar.'),
  })

  function handleSave() {
    setError('')
    if (!productoId) return setError('Elegí un producto.')
    const cant = parseInt(cantidad) || 0
    if (cant <= 0) return setError('La cantidad debe ser mayor a 0.')

    const base = { producto: parseInt(productoId), cantidad: cant, fecha, tipo }
    let body = base
    if (tipo === 'ingreso') {
      body = { ...base, costo_unitario: costo ? parseFloat(costo) : null, proveedor }
    } else if (tipo === 'envio') {
      if (!destino) return setError('Elegí la sucursal destino.')
      if (cant > stockDeposito) return setError(`El depósito solo tiene ${stockDeposito}.`)
      body = { ...base, destino }
    } else if (tipo === 'ajuste') {
      body = ajSentido === 'sumar' ? { ...base, destino: ajUbic } : { ...base, origen: ajUbic }
    }
    saveMut.mutate(body)
  }

  const ubicaciones = [{ val: DEPOSITO, label: 'Depósito' }, ...sedeOptions.map(s => ({ val: s.val, label: s.label }))]

  return (
    <Modal title={titulos[tipo]} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-dark-muted mb-1">Producto</label>
          <select className="input w-full" value={productoId} onChange={e => setProductoId(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {CATEGORIAS.map(cat => (
              <optgroup key={cat.val} label={cat.label}>
                {productos.filter(p => p.categoria === cat.val && p.activo).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {producto && (
            <p className="text-[11px] text-dark-muted mt-1">
              Stock actual — {ubicaciones.map(u => `${u.val === DEPOSITO ? 'Dep' : u.label}: ${producto.stock_ubic?.[u.val] || 0}`).join(' · ')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-muted mb-1">Cantidad</label>
            <input type="number" min="1" className="input w-full" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-dark-muted mb-1">Fecha</label>
            <input type="date" className="input w-full" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>

        {tipo === 'ingreso' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-muted mb-1">Costo unitario (opcional)</label>
              <input type="number" className="input w-full" value={costo} onChange={e => setCosto(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Proveedor (opcional)</label>
              <input className="input w-full" value={proveedor} onChange={e => setProveedor(e.target.value)} />
            </div>
          </div>
        )}

        {tipo === 'envio' && (
          <div>
            <label className="block text-xs text-dark-muted mb-1">Sucursal destino</label>
            <select className="input w-full" value={destino} onChange={e => setDestino(e.target.value)}>
              {sedeOptions.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
            </select>
            <p className="text-[11px] text-dark-muted mt-1">Sale del depósito (disponible: {stockDeposito}).</p>
          </div>
        )}

        {tipo === 'ajuste' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-muted mb-1">Ubicación</label>
              <select className="input w-full" value={ajUbic} onChange={e => setAjUbic(e.target.value)}>
                {ubicaciones.map(u => <option key={u.val} value={u.val}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Sentido</label>
              <select className="input w-full" value={ajSentido} onChange={e => setAjSentido(e.target.value)}>
                <option value="sumar">Sumar (+)</option>
                <option value="restar">Restar (−)</option>
              </select>
            </div>
          </div>
        )}

        {tipo === 'ingreso' && <p className="text-xs text-emerald-400/80">Entra al depósito general.</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">Cancelar</button>
          <button onClick={handleSave} disabled={saveMut.isPending} className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Registrar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── TAB: MOVIMIENTOS (historial) ────────────────────────────────────────────────

const MOV_COLOR = {
  ingreso: 'bg-emerald-500/20 text-emerald-300',
  envio:   'bg-sky-500/20 text-sky-300',
  venta:   'bg-purple-500/20 text-purple-300',
  ajuste:  'bg-dark-border text-dark-muted',
}

function MovimientosTab() {
  const qc = useQueryClient()
  const { sedeLabel } = useNegocio()
  const [filtroTipo, setFiltroTipo] = useState('')

  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['movimientos', filtroTipo],
    queryFn: () => api.get(`/productos/movimientos/${filtroTipo ? '?tipo=' + filtroTipo : ''}`).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/productos/movimientos/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['movimientos']); qc.invalidateQueries(['productos']); toast.success('Movimiento anulado') },
    onError: () => toast.error('No se pudo anular.'),
  })

  const label = (u) => !u ? '—' : u === DEPOSITO ? 'Depósito' : sedeLabel(u)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <select className="input text-sm" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los movimientos</option>
          <option value="ingreso">Ingresos</option>
          <option value="envio">Envíos</option>
          <option value="venta">Ventas</option>
          <option value="ajuste">Ajustes</option>
        </select>
      </div>
      {isLoading ? <div className="text-dark-muted text-sm">Cargando...</div>
        : movimientos.length === 0 ? <div className="text-dark-muted text-sm">Sin movimientos.</div>
        : (
          <div className="space-y-1.5">
            {movimientos.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm flex-wrap">
                <span className="text-xs text-dark-muted w-20 shrink-0">{m.fecha}</span>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', MOV_COLOR[m.tipo])}>{m.tipo_label}</span>
                <span className="flex-1 text-dark-text min-w-[120px]">{m.cantidad}× {m.producto_nombre}</span>
                <span className="text-xs text-dark-muted shrink-0">{label(m.origen)} → {label(m.destino)}</span>
                {m.tipo === 'ingreso' && m.costo_unitario != null && (
                  <span className="text-xs text-dark-muted shrink-0">· costo {money(m.costo_unitario)}{m.proveedor ? ` · ${m.proveedor}` : ''}</span>
                )}
                {m.tipo !== 'venta' && (
                  <button onClick={() => { if (confirm('¿Anular este movimiento?')) deleteMut.mutate(m.id) }} className="text-dark-muted hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── TAB: VENTAS ──────────────────────────────────────────────────────────────────

function VentasTab() {
  const qc = useQueryClient()
  const { sedeOptions, sedeLabel } = useNegocio()
  const [showForm, setShowForm] = useState(false)
  const [filtroSede, setFiltroSede] = useState('')

  const hoyStr = hoy()
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [desde, setDesde] = useState(hace30)
  const [hasta, setHasta] = useState(hoyStr)

  const params = new URLSearchParams()
  if (filtroSede) params.set('sede', filtroSede)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)

  const { data: ventas = [], isLoading } = useQuery({
    queryKey: ['ventas', filtroSede, desde, hasta],
    queryFn: () => api.get(`/productos/ventas/?${params}`).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/productos/ventas/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['ventas']); qc.invalidateQueries(['productos']) },
  })

  const totalPeriodo = ventas.reduce((s, v) => s + parseFloat(v.total), 0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="date" className="input text-sm" value={desde} onChange={e => setDesde(e.target.value)} />
        <span className="text-dark-muted text-sm">→</span>
        <input type="date" className="input text-sm" value={hasta} onChange={e => setHasta(e.target.value)} />
        <select className="input text-sm" value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
          <option value="">Todas las sedes</option>
          {sedeOptions.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
        </select>
        <div className="flex-1" />
        <div className="text-sm text-dark-muted">
          {ventas.length} ventas · <span className="text-dark-text font-medium">{money(totalPeriodo)}</span>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm px-3 py-1.5 rounded-lg">
          <Plus size={15} /> Nueva venta
        </button>
      </div>

      {isLoading ? <div className="text-dark-muted text-sm">Cargando...</div>
        : ventas.length === 0 ? <div className="text-dark-muted text-sm">Sin ventas en el período.</div>
        : (
          <div className="space-y-2">
            {ventas.map(v => (
              <div key={v.id} className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dark-text">{v.alumno_nombre}</span>
                    <span className="text-xs text-dark-muted">{sedeLabel(v.sede)}</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', v.metodo_pago === 'cuenta_corriente' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300')}>
                      {v.metodo_label}
                    </span>
                  </div>
                  <div className="text-xs text-dark-muted mt-0.5">
                    {v.fecha} · {v.items.map(i => `${i.cantidad}× ${i.producto_nombre}`).join(', ')}
                  </div>
                </div>
                <div className="text-sm font-mono font-semibold text-dark-text whitespace-nowrap">{money(v.total)}</div>
                <button onClick={() => { if (confirm('¿Anular venta?')) deleteMut.mutate(v.id) }} className="text-dark-muted hover:text-red-400 mt-0.5">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      }

      {showForm && <NuevaVentaModal onClose={() => { setShowForm(false); qc.invalidateQueries(['ventas']) }} />}
    </div>
  )
}

// ── Modal: Nueva Venta ─────────────────────────────────────────────────────────

function NuevaVentaModal({ onClose }) {
  const qc = useQueryClient()
  const { sedeOptions } = useNegocio()

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-activos'],
    queryFn: () => api.get('/productos/?activo=true').then(r => r.data),
  })

  const [sede, setSede]             = useState(sedeOptions[0]?.val || '')
  const [esAlumno, setEsAlumno]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [alumnoSel, setAlumnoSel]   = useState(null)
  const [compradorExt, setCompradorExt] = useState('')
  const [metodo, setMetodo]         = useState('efectivo')
  const [items, setItems]           = useState([{ producto_id: '', cantidad: 1 }])
  const [notas, setNotas]           = useState('')
  const [fecha, setFecha]           = useState(hoy())
  const [error, setError]           = useState('')

  const { data: busqResultados = [] } = useQuery({
    queryKey: ['buscar-alumnos', busqueda],
    queryFn: () => busqueda.length >= 2
      ? api.get(`/alumnos/?search=${busqueda}&activo=true`).then(r => r.data.results || r.data)
      : Promise.resolve([]),
    enabled: busqueda.length >= 2,
  })

  function setItem(i, field, val) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = productos.find(p => String(p.id) === String(it.producto_id))
      return sum + (p ? parseFloat(p.precio) * (parseInt(it.cantidad) || 0) : 0)
    }, 0)
  }, [items, productos])

  const saveMut = useMutation({
    mutationFn: (body) => api.post('/productos/ventas/', body),
    onSuccess: () => {
      qc.invalidateQueries(['ventas'])
      qc.invalidateQueries(['productos'])
      qc.invalidateQueries(['productos-activos'])
      onClose()
    },
    onError: () => setError('Error al guardar. Verificá los datos.'),
  })

  function handleSave() {
    setError('')
    const itemsFiltrados = items.filter(it => it.producto_id)
    if (!itemsFiltrados.length) { setError('Agregá al menos un producto.'); return }
    if (esAlumno && !alumnoSel) { setError('Seleccioná un alumno.'); return }
    if (!esAlumno && !compradorExt.trim()) { setError('Ingresá el nombre del comprador.'); return }

    const payload = {
      fecha, sede,
      metodo_pago: metodo,
      total: total.toFixed(2),
      notas,
      alumno:           esAlumno ? alumnoSel.id : null,
      comprador_nombre: !esAlumno ? compradorExt : '',
      items_write: itemsFiltrados.map(it => {
        const p = productos.find(p => String(p.id) === String(it.producto_id))
        return { producto: parseInt(it.producto_id), cantidad: parseInt(it.cantidad) || 1, precio_unitario: p ? p.precio : 0 }
      }),
    }
    saveMut.mutate(payload)
  }

  return (
    <Modal title="Nueva venta" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-muted mb-1">Fecha</label>
            <input type="date" className="input w-full" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-dark-muted mb-1">Sede</label>
            <select className="input w-full" value={sede} onChange={e => setSede(e.target.value)}>
              {sedeOptions.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex gap-3 mb-2">
            <label className="flex items-center gap-1.5 text-sm text-dark-text cursor-pointer">
              <input type="radio" checked={esAlumno} onChange={() => { setEsAlumno(true); setMetodo('efectivo') }} />
              Alumno registrado
            </label>
            <label className="flex items-center gap-1.5 text-sm text-dark-text cursor-pointer">
              <input type="radio" checked={!esAlumno} onChange={() => { setEsAlumno(false); if (metodo === 'cuenta_corriente') setMetodo('efectivo') }} />
              Externo
            </label>
          </div>

          {esAlumno ? (
            alumnoSel ? (
              <div className="flex items-center gap-2 bg-dark-border rounded-lg px-3 py-2">
                <span className="text-sm text-dark-text flex-1">{alumnoSel.nombre} {alumnoSel.apellido}</span>
                <button onClick={() => { setAlumnoSel(null); setBusqueda('') }} className="text-dark-muted hover:text-dark-text"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input className="input w-full text-sm" placeholder="Buscar alumno..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                {busqResultados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {busqResultados.slice(0, 8).map(a => (
                      <button key={a.id} onClick={() => { setAlumnoSel(a); setBusqueda('') }} className="w-full text-left px-3 py-2 text-sm text-dark-text hover:bg-dark-border">
                        {a.nombre} {a.apellido} — Sede {a.sede}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <input className="input w-full text-sm" placeholder="Nombre del comprador" value={compradorExt} onChange={e => setCompradorExt(e.target.value)} />
          )}
        </div>

        <div>
          <label className="block text-xs text-dark-muted mb-1">Productos</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input flex-1 text-sm" value={it.producto_id} onChange={e => setItem(i, 'producto_id', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {CATEGORIAS.map(cat => (
                    <optgroup key={cat.val} label={cat.label}>
                      {productos.filter(p => p.categoria === cat.val).map(p => {
                        const stockSede = p.stock_ubic?.[sede] || 0
                        return (
                          <option key={p.id} value={p.id}>
                            {p.nombre} — {money(p.precio)} (acá: {stockSede})
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
                </select>
                <input type="number" min="1" className="input w-16 text-sm text-center" value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} />
                {items.length > 1 && (
                  <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-dark-muted hover:text-red-400"><X size={14} /></button>
                )}
              </div>
            ))}
            <button onClick={() => setItems(prev => [...prev, { producto_id: '', cantidad: 1 }])} className="text-xs text-primary-dark hover:text-primary flex items-center gap-1">
              <Plus size={12} /> Agregar producto
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center bg-dark-border rounded-lg px-3 py-2">
          <span className="text-sm text-dark-muted">Total</span>
          <span className="text-lg font-bold text-dark-text">{money(total)}</span>
        </div>

        <div>
          <label className="block text-xs text-dark-muted mb-1">Método de pago</label>
          <div className="flex gap-2">
            {METODOS.filter(m => esAlumno || m.val !== 'cuenta_corriente').map(m => (
              <button key={m.val} onClick={() => setMetodo(m.val)}
                className={clsx('flex-1 text-sm py-1.5 rounded-lg border transition-colors', metodo === m.val ? 'bg-primary-dark text-white border-primary-dark' : 'border-dark-border text-dark-muted hover:text-dark-text')}>
                {m.label}
              </button>
            ))}
          </div>
          {metodo === 'cuenta_corriente' && (
            <p className="text-xs text-amber-400 mt-1">La deuda se registrará en la cuenta corriente del alumno.</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-dark-muted mb-1">Notas (opcional)</label>
          <input className="input w-full text-sm" value={notas} onChange={e => setNotas(e.target.value)} />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">Cancelar</button>
          <button onClick={handleSave} disabled={saveMut.isPending} className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />} Confirmar venta
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── TAB: CUENTA CORRIENTE ────────────────────────────────────────────────────

function CtaCteTab() {
  const qc = useQueryClient()
  const { sedeLabel } = useNegocio()
  const [expanded, setExpanded]   = useState(null)
  const [pagoModal, setPagoModal] = useState(null)
  const [ventaModal, setVentaModal] = useState(null)  // id de venta para ver el detalle

  const { data: deudores = [], isLoading } = useQuery({
    queryKey: ['deudores'],
    queryFn: () => api.get('/productos/cuenta-corriente/deudores/').then(r => r.data),
  })

  const { data: movimientos, isFetching: loadingMovs } = useQuery({
    queryKey: ['cc-movimientos', expanded],
    queryFn: () => api.get(`/productos/cuenta-corriente/${expanded}/`).then(r => r.data),
    enabled: !!expanded,
  })

  const pagoMut = useMutation({
    mutationFn: ({ alumno_id, monto, descripcion }) =>
      api.post(`/productos/cuenta-corriente/${alumno_id}/pagar/`, { monto, descripcion }),
    onSuccess: () => {
      qc.invalidateQueries(['deudores'])
      qc.invalidateQueries(['cc-movimientos', expanded])
      setPagoModal(null)
    },
  })

  if (isLoading) return <div className="text-dark-muted text-sm">Cargando...</div>

  if (deudores.length === 0) return (
    <div className="text-center text-dark-muted text-sm py-12">Sin deudas pendientes en cuenta corriente.</div>
  )

  return (
    <div className="space-y-2">
      {deudores.map(d => (
        <div key={d.alumno_id} className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-dark-border/40 transition-colors" onClick={() => setExpanded(expanded === d.alumno_id ? null : d.alumno_id)}>
            <div className="flex-1">
              <span className="text-sm font-medium text-dark-text">{d.nombre}</span>
              <span className="text-xs text-dark-muted ml-2">{sedeLabel(d.sede)}</span>
            </div>
            <span className="text-sm font-bold text-amber-400">{money(d.saldo)}</span>
            {expanded === d.alumno_id ? <ChevronUp size={14} className="text-dark-muted" /> : <ChevronDown size={14} className="text-dark-muted" />}
          </button>

          {expanded === d.alumno_id && (
            <div className="border-t border-dark-border px-4 py-3">
              {loadingMovs ? <div className="text-dark-muted text-xs">Cargando movimientos...</div>
                : (
                  <div className="space-y-1 mb-3">
                    {(movimientos?.movimientos || []).map(m => (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <span className="text-dark-muted w-20">{m.fecha}</span>
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs', m.tipo === 'cargo' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300')}>{m.tipo_label}</span>
                        {m.venta ? (
                          <button onClick={() => setVentaModal(m.venta)} className="flex-1 text-left text-sky-400 hover:text-sky-300 truncate underline decoration-dotted underline-offset-2">
                            {m.descripcion} — ver detalle
                          </button>
                        ) : (
                          <span className="flex-1 text-dark-muted truncate">{m.descripcion}</span>
                        )}
                        <span className={clsx('font-mono font-medium', m.tipo === 'cargo' ? 'text-red-400' : 'text-green-400')}>
                          {m.tipo === 'cargo' ? '+' : '-'}{money(m.monto)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
              <button onClick={() => setPagoModal(d)} className="flex items-center gap-1.5 text-xs bg-green-700/30 hover:bg-green-700/50 text-green-300 px-3 py-1.5 rounded-lg">
                <CreditCard size={12} /> Registrar pago
              </button>
            </div>
          )}
        </div>
      ))}

      {pagoModal && (
        <PagoCtaCteModal
          deudor={pagoModal}
          onClose={() => setPagoModal(null)}
          onSave={({ monto, descripcion }) => pagoMut.mutate({ alumno_id: pagoModal.alumno_id, monto, descripcion })}
          isPending={pagoMut.isPending}
        />
      )}

      {ventaModal && <VentaDetalleModal ventaId={ventaModal} onClose={() => setVentaModal(null)} />}
    </div>
  )
}

// ── Modal: detalle de una venta (qué compró y cuándo) ───────────────────────────

function VentaDetalleModal({ ventaId, onClose }) {
  const { sedeLabel } = useNegocio()
  const { data: venta, isLoading, isError } = useQuery({
    queryKey: ['venta-detalle', ventaId],
    queryFn: () => api.get(`/productos/ventas/${ventaId}/`).then(r => r.data),
  })

  return (
    <Modal title={`Venta #${ventaId}`} onClose={onClose}>
      {isLoading ? <div className="text-dark-muted text-sm">Cargando...</div>
        : isError || !venta ? <div className="text-red-400 text-sm">No se pudo cargar la venta.</div>
        : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-muted">
              <span>Fecha: <span className="text-dark-text">{venta.fecha}</span></span>
              <span>Comprador: <span className="text-dark-text">{venta.alumno_nombre}</span></span>
              <span>Sede: <span className="text-dark-text">{sedeLabel(venta.sede)}</span></span>
              <span>Método: <span className="text-dark-text">{venta.metodo_label}</span></span>
            </div>
            <div className="border border-dark-border rounded-lg divide-y divide-dark-border">
              {(venta.items || []).map(it => (
                <div key={it.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-dark-text">{it.cantidad}× {it.producto_nombre}</span>
                  <span className="font-mono text-dark-text">{money(it.subtotal)}</span>
                </div>
              ))}
              {(venta.items || []).length === 0 && (
                <div className="px-3 py-2 text-dark-muted text-xs">Sin ítems.</div>
              )}
            </div>
            <div className="flex justify-between font-semibold text-dark-text">
              <span>Total</span><span className="font-mono">{money(venta.total)}</span>
            </div>
            {venta.notas && <p className="text-xs text-dark-muted">Notas: {venta.notas}</p>}
          </div>
        )
      }
    </Modal>
  )
}

function PagoCtaCteModal({ deudor, onClose, onSave, isPending }) {
  const [monto, setMonto]             = useState('')
  const [descripcion, setDescripcion] = useState('Pago cuenta corriente')

  return (
    <Modal title={`Pago — ${deudor.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-dark-muted">Deuda actual: <span className="text-amber-400 font-semibold">{money(deudor.saldo)}</span></p>
        <div>
          <label className="block text-xs text-dark-muted mb-1">Monto abonado</label>
          <input type="number" className="input w-full" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="block text-xs text-dark-muted mb-1">Descripción</label>
          <input className="input w-full text-sm" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">Cancelar</button>
          <button onClick={() => onSave({ monto: parseFloat(monto), descripcion })} disabled={isPending || !monto}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Registrar pago
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'ventas',      label: 'Ventas',        icon: ShoppingCart },
  { id: 'catalogo',    label: 'Catálogo',      icon: Package },
  { id: 'movimientos', label: 'Movimientos',   icon: History },
  { id: 'ctacte',      label: 'Cta. Corriente', icon: CreditCard },
]

export default function ProductosPage() {
  const [tab, setTab] = useState('ventas')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-dark-text mb-4">Productos</h1>

      <div className="flex gap-1 mb-6 bg-dark-surface border border-dark-border rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', tab === id ? 'bg-primary-dark text-white' : 'text-dark-muted hover:text-dark-text')}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'ventas'      && <VentasTab />}
      {tab === 'catalogo'    && <CatalogoTab />}
      {tab === 'movimientos' && <MovimientosTab />}
      {tab === 'ctacte'      && <CtaCteTab />}
    </div>
  )
}
