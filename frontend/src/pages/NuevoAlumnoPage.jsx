import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, DollarSign } from 'lucide-react'
import api from '../lib/api'
import clsx from 'clsx'
import { money } from '../lib/format'
import RegistrarPagoPanel from '../components/pagos/RegistrarPagoPanel'

const PASOS = ['Datos personales', 'Actividad y cuota', 'Confirmar']

const DISCIPLINAS = [
  { value: 'CF', label: 'Crossfit' },
  { value: 'HF', label: 'Heavy Funcional' },
  { value: 'HX', label: 'Hyrox' },
  { value: 'TN', label: 'Crossfit Teens' },
  { value: 'KD', label: 'Crossfit Kids' },
  { value: 'FB', label: 'FullBody' },
]

const FRECUENCIAS = {
  CF: [{ value: '2x', label: '2x semana' }, { value: '3x', label: '3x semana' }, { value: 'libre', label: 'Pase Libre' }],
  HF: [{ value: '2x', label: '2x semana' }, { value: '3x', label: '3x semana' }, { value: '5x', label: '5x semana' }],
  HX: [{ value: '3x', label: '3x semana (Mar/Jue/Sáb)' }],
  TN: [{ value: '3x', label: '3x semana' }],
  KD: [{ value: '3x', label: '3x semana' }],
  FB: [{ value: 'libre', label: 'Mensual' }],
}

const PERTENENCIA_OPTS = [
  { value: 'athlon', label: 'Athlon' },
  { value: 'day',    label: 'Day Gym (50/50)' },
  { value: 'otro',   label: 'Otro espacio' },
]

const TIPO_PRECIO_LABEL = { regular: 'Regular (1–10)', unlpam: 'UNLPam (1–10)', despues_10: 'Después del día 10' }

export default function NuevoAlumnoPage() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', celular: '', email: '', instagram: '',
    fecha_nacimiento: '', sede: '', fecha_inicio: new Date().toISOString().split('T')[0],
    disciplina: '', frecuencia: '', tipo_precio: 'regular', horario: '', bonus_pack: false, notas: '',
    cuota_actual: 0, pertenencia: 'athlon', porcentaje_athlon: 100, precio_especial: false, motivo_precio_especial: '',
  })
  const [cuotaInfo, setCuotaInfo]     = useState(null)
  const [calculando, setCalculando]   = useState(false)
  const [errorCuota, setErrorCuota]   = useState('')
  const [alumnoCreado, setAlumnoCreado] = useState(null)   // alumno recién guardado
  const [abrirPago, setAbrirPago]     = useState(false)    // abrir panel de pago post-alta

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function calcular() {
    if (!form.disciplina || !form.frecuencia) return
    setCalculando(true)
    setErrorCuota('')
    try {
      const params = new URLSearchParams({
        disciplina:   form.disciplina,
        frecuencia:   form.frecuencia,
        tipo_precio:  form.tipo_precio,
        fecha_inicio: form.fecha_inicio,
        bonus_pack:   form.bonus_pack,
      })
      const { data } = await api.get(`/alumnos/calcular-cuota/?${params}`)
      setCuotaInfo(data)
      setForm(prev => ({ ...prev, cuota_actual: data.cuota }))
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo calcular la cuota'
      setErrorCuota(msg)
    } finally {
      setCalculando(false)
    }
  }

  const mutation = useMutation({
    mutationFn: (data) => api.post('/alumnos/nuevo/', data).then((r) => r.data),
  })

  function siguiente() {
    // Solo auto-calcula si NO hay precio especial ingresado manualmente
    if (paso === 1 && form.disciplina && form.frecuencia && !form.precio_especial) calcular()
    setPaso((p) => Math.min(p + 1, 2))
  }

  function anterior() {
    setPaso((p) => Math.max(p - 1, 0))
  }

  function handleSubmit(conPago = false) {
    mutation.mutate(form, {
      onSuccess: (data) => {
        if (conPago) {
          setAlumnoCreado({
            id:              data.id,
            nombre_completo: `${form.nombre} ${form.apellido}`,
            nombre:          form.nombre,
            disciplina:      form.disciplina,
            frecuencia:      form.frecuencia,
            sede:            form.sede,
            cuota_actual:    form.cuota_actual,
            celular:         form.celular,
            estado:          'activo',
          })
          setAbrirPago(true)
        } else {
          navigate('/alumnos')
        }
      },
    })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-dark-text">Nuevo alumno</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {PASOS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
              i < paso ? 'bg-green-600 text-white' : i === paso ? 'bg-primary-dark text-white' : 'bg-dark-border text-dark-muted'
            )}>
              {i < paso ? <Check size={14} /> : i + 1}
            </div>
            <span className={clsx('text-sm', i === paso ? 'text-dark-text font-medium' : 'text-dark-muted')}>
              {label}
            </span>
            {i < PASOS.length - 1 && <div className="flex-1 h-px bg-dark-border w-8" />}
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        {/* Paso 1 */}
        {paso === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted mb-1">Nombre *</label>
                <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Apellido *</label>
                <input className="input" value={form.apellido} onChange={(e) => set('apellido', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted mb-1">DNI *</label>
                <input className="input" value={form.dni} onChange={(e) => set('dni', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Celular *</label>
                <input className="input" type="tel" value={form.celular} onChange={(e) => set('celular', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted mb-1">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Instagram</label>
                <input className="input" placeholder="@usuario" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted mb-1">Sede *</label>
                <select className="input" value={form.sede} onChange={(e) => set('sede', e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  <option value="107">Athlon 107</option>
                  <option value="24">Athlon 24</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Fecha de inicio *</label>
                <input className="input" type="date" value={form.fecha_inicio} onChange={(e) => set('fecha_inicio', e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Fecha de nacimiento</label>
              <input className="input w-48" type="date" value={form.fecha_nacimiento} onChange={(e) => set('fecha_nacimiento', e.target.value)} />
            </div>
          </>
        )}

        {/* Paso 2 */}
        {paso === 1 && (
          <>
            {/* Pertenencia */}
            <div>
              <label className="block text-xs text-dark-muted mb-1">Pertenencia</label>
              <div className="flex gap-2">
                {PERTENENCIA_OPTS.map(({ value, label }) => (
                  <button
                    key={value} type="button"
                    onClick={() => {
                      set('pertenencia', value)
                      set('porcentaje_athlon', value === 'day' ? 50 : 100)
                    }}
                    className={clsx(
                      'flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-colors',
                      form.pertenencia === value
                        ? 'border-primary-dark bg-primary-dark/20 text-primary-dark'
                        : 'border-dark-border text-dark-muted hover:border-dark-text'
                    )}
                  >{label}</button>
                ))}
              </div>
              {form.pertenencia === 'otro' && (
                <div className="mt-2">
                  <label className="block text-xs text-dark-muted mb-1">% que queda en Athlon</label>
                  <input
                    type="number" min="0" max="100"
                    className="input w-32 text-sm"
                    value={form.porcentaje_athlon}
                    onChange={e => set('porcentaje_athlon', parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-dark-muted mb-1">Tipo de precio</label>
              <div className="flex gap-2">
                {Object.entries(TIPO_PRECIO_LABEL).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set('tipo_precio', val)}
                    className={clsx(
                      'flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                      form.tipo_precio === val
                        ? 'border-primary-dark bg-primary-dark/20 text-primary-dark'
                        : 'border-dark-border text-dark-muted hover:border-dark-text'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-dark-muted mb-1">Disciplina *</label>
              <div className="grid grid-cols-3 gap-2">
                {DISCIPLINAS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      set('disciplina', value)
                      const opts = FRECUENCIAS[value] || []
                      set('frecuencia', opts.length === 1 ? opts[0].value : '')
                    }}
                    className={clsx(
                      'py-2 px-3 rounded-lg text-sm border transition-colors',
                      form.disciplina === value
                        ? 'border-primary-dark bg-primary-dark/20 text-primary-dark font-medium'
                        : 'border-dark-border text-dark-muted hover:border-dark-text'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {form.disciplina && (
              <div>
                <label className="block text-xs text-dark-muted mb-1">Frecuencia *</label>
                <div className="flex gap-2 flex-wrap">
                  {(FRECUENCIAS[form.disciplina] || []).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('frecuencia', value)}
                      className={clsx(
                        'py-2 px-4 rounded-lg text-sm border transition-colors',
                        form.frecuencia === value
                          ? 'border-primary-dark bg-primary-dark/20 text-primary-dark font-medium'
                          : 'border-dark-border text-dark-muted hover:border-dark-text'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted mb-1">Horario preferido</label>
                <input className="input" placeholder="ej: 8hs" value={form.horario} onChange={(e) => set('horario', e.target.value)} />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-500"
                    checked={form.bonus_pack}
                    onChange={(e) => set('bonus_pack', e.target.checked)}
                  />
                  <span className="text-sm text-dark-text">Bonus Pack (+$15.000)</span>
                </label>
              </div>
            </div>

            {/* Precio especial */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-yellow-500"
                  checked={form.precio_especial}
                  onChange={e => set('precio_especial', e.target.checked)}
                />
                <span className="text-sm text-dark-text">Precio especial</span>
              </label>
              {form.precio_especial && (
                <div className="bg-yellow-950/30 border border-yellow-700/40 rounded-xl p-3 space-y-2">
                  <div>
                    <label className="block text-xs text-yellow-400/80 mb-1">Monto personalizado *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm">$</span>
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        placeholder="0"
                        className="input pl-7 text-sm font-bold"
                        value={form.cuota_actual || ''}
                        onChange={e => set('cuota_actual', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-yellow-400/80 mb-1">Motivo</label>
                    <input
                      className="input text-sm"
                      placeholder="ej: familiar, convenio, promo..."
                      value={form.motivo_precio_especial}
                      onChange={e => set('motivo_precio_especial', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Calculadora de cuota */}
            {cuotaInfo && (
              <div className="bg-dark-bg rounded-lg p-4 border border-dark-border space-y-1">
                <p className="text-xs text-dark-muted">Cuota calculada</p>
                {!cuotaInfo.precios_del_mes && (
                  <p className="text-xs text-yellow-400">
                    ⚠️ Usando precios de {cuotaInfo.mes_precios} — no hay precios cargados para este mes
                  </p>
                )}
                {cuotaInfo.proporcional && (
                  <p className="text-xs text-sky-400">
                    ⚡ Proporcional: {cuotaInfo.proporcional.formula}
                  </p>
                )}
                <p className="text-2xl font-bold text-dark-text">
                  {money(cuotaInfo.cuota)}
                </p>
                {cuotaInfo.bonus_pack_incluido && (
                  <p className="text-xs text-dark-muted">Incluye Bonus Pack +$15.000</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={calcular}
              disabled={!form.disciplina || !form.frecuencia || calculando}
              className="btn-primary w-full"
            >
              {calculando ? 'Calculando...' : 'Calcular cuota'}
            </button>
            {errorCuota && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
                {errorCuota}
              </p>
            )}

            <div>
              <label className="block text-xs text-dark-muted mb-1">Notas</label>
              <textarea className="input resize-none h-20" value={form.notas} onChange={(e) => set('notas', e.target.value)} />
            </div>
          </>
        )}

        {/* Paso 3 — Resumen */}
        {paso === 2 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-dark-text mb-3">Resumen del nuevo alumno</h2>
            {[
              ['Nombre', `${form.nombre} ${form.apellido}`],
              ['DNI', form.dni],
              ['Celular', form.celular],
              ['Email', form.email || '—'],
              ['Instagram', form.instagram || '—'],
              ['Sede', form.sede === '107' ? 'Athlon 107' : 'Athlon 24'],
              ['Fecha inicio', form.fecha_inicio],
              ['Disciplina', form.disciplina],
              ['Frecuencia', form.frecuencia],
              ['Tipo precio', TIPO_PRECIO_LABEL[form.tipo_precio]],
              ['Bonus Pack', form.bonus_pack ? 'Sí' : 'No'],
              ['Pertenencia', PERTENENCIA_OPTS.find(p => p.value === form.pertenencia)?.label || form.pertenencia],
              ['Precio especial', form.precio_especial ? `Sí (${form.motivo_precio_especial || '—'})` : 'No'],
              ['Horario', form.horario || '—'],
              ['Cuota', money(form.cuota_actual)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-dark-border/50 text-sm">
                <span className="text-dark-muted">{label}</span>
                <span className="text-dark-text font-medium">{value}</span>
              </div>
            ))}
            {mutation.error && (
              <p className="text-red-400 text-sm mt-2">
                {mutation.error.response?.data?.detail || 'Error al guardar.'}
              </p>
            )}
          </div>
        )}

        {/* Navegación */}
        <div className="flex justify-between pt-2">
          <button onClick={anterior} disabled={paso === 0} className="btn-ghost flex items-center gap-2">
            <ArrowLeft size={16} /> Anterior
          </button>
          {paso < 2 ? (
            <button onClick={siguiente} className="btn-primary flex items-center gap-2">
              Siguiente <ArrowRight size={16} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleSubmit(false)}
                disabled={mutation.isPending}
                className="btn-ghost border border-dark-border flex items-center gap-2"
              >
                {mutation.isPending ? 'Guardando...' : <><Check size={16} /> Solo guardar</>}
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={mutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {mutation.isPending
                  ? 'Guardando...'
                  : <><DollarSign size={16} /> Guardar y registrar pago</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel de pago — se abre automáticamente si eligieron "Guardar y registrar pago" */}
      <RegistrarPagoPanel
        alumno={alumnoCreado}
        open={abrirPago}
        onClose={() => {
          setAbrirPago(false)
          navigate('/alumnos')
        }}
      />
    </div>
  )
}
