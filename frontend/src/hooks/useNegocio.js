import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import logoBlanco from '../assets/logo-blanco.png'
import logoNegro from '../assets/logo-negro.jpg'

// Paleta para asignar color a cada sede por orden (las 2 primeras conservan
// los colores históricos: 107 esmeralda, 24 celeste).
const SEDE_PALETTE = ['#10b981', '#38bdf8', '#6366f1', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6']

// Fallback de sedes cuando la API todavía no respondió (o instalación nueva).
const SEDES_FALLBACK = [
  { codigo: '107', nombre: 'Athlon 107', orden: 1, activa: true },
  { codigo: '24',  nombre: 'Athlon 24',  orden: 2, activa: true },
]

/**
 * Configuración del negocio (nombre, ciudad, logos) + sedes/sucursales.
 * Las sedes son dinámicas: se dan de alta desde Config del Negocio.
 * Con fallback a los valores por defecto mientras carga o si no hay datos.
 */
export function useNegocio() {
  const { data } = useQuery({
    queryKey: ['negocio-config'],
    queryFn: () => api.get('/config/negocio/').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: {},
  })

  const { data: sedesData } = useQuery({
    queryKey: ['config-sedes'],
    queryFn: () => api.get('/config/sedes/').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const cfg = data || {}
  const nombre = cfg.nombre || 'Athlon'
  const ciudad = cfg.ciudad || ''

  // Sedes activas ordenadas (con fallback mientras carga)
  const sedes = (sedesData && sedesData.length ? sedesData : SEDES_FALLBACK)
    .filter(s => s.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  // Color por código de sede (asignado por orden)
  const sedeColors = {}
  sedes.forEach((s, i) => { sedeColors[s.codigo] = SEDE_PALETTE[i % SEDE_PALETTE.length] })
  const sedeColor = (code) => sedeColors[code] || '#94a3b8'

  // Etiquetas {codigo: nombre} (+ 'general' para gastos compartidos)
  const sedeLabels = { general: 'General' }
  sedes.forEach(s => { sedeLabels[s.codigo] = s.nombre })
  const sedeLabel = (code) => sedeLabels[code] || code

  // Opciones listas para selects/filtros de sede
  const sedeOptions = sedes.map(s => ({ val: s.codigo, label: s.nombre, color: sedeColors[s.codigo] }))

  // Compat: nombre de las dos primeras sedes (varias vistas los usan directo)
  const sede1 = sedes[0]?.nombre || 'Athlon 107'
  const sede2 = sedes[1]?.nombre || 'Athlon 24'

  // Logo listo para el PDF: si hay uno configurado (data URI) va tal cual; si no,
  // el asset por defecto necesita el origin absoluto para cargar en la ventana de impresión.
  const logoPDF = cfg.logo_oscuro || `${window.location.origin}${logoNegro}`

  return {
    nombre,
    ciudad,
    sedes,
    sede1,
    sede2,
    sedeLabel,
    sedeLabels,
    sedeOptions,
    sedeColor,
    sedeColors,
    logoClaro: cfg.logo_claro || logoBlanco,   // para fondo oscuro (sistema)
    logoOscuro: cfg.logo_oscuro || logoNegro,  // para fondo claro (PDFs)
    // objeto listo para pasar a los generadores de PDF
    brandingPDF: { logoUrl: logoPDF, nombre, ciudad, sedeLabels, sedeCodes: sedes.map(s => s.codigo) },
  }
}
