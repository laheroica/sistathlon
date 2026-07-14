import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import logoBlanco from '../assets/logo-blanco.png'
import logoNegro from '../assets/logo-negro.jpg'

/**
 * Configuración del negocio (nombre, ciudad, logos). Con fallback a los valores
 * de Athlon por defecto. Los logos configurados vienen como data URI base64;
 * si no hay, se usa el asset por defecto.
 */
export function useNegocio() {
  const { data } = useQuery({
    queryKey: ['negocio-config'],
    queryFn: () => api.get('/config/negocio/').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: {},
  })

  const cfg = data || {}
  const nombre = cfg.nombre || 'Athlon'
  const ciudad = cfg.ciudad || ''
  const sede1 = cfg.nombre_sede1 || 'Athlon 107'
  const sede2 = cfg.nombre_sede2 || 'Athlon 24'

  // Etiqueta visible de una sede a partir de su código interno
  const sedeLabel = (code) =>
    code === '107' ? sede1 : code === '24' ? sede2 : code === 'general' ? 'General' : code
  const sedeLabels = { '107': sede1, '24': sede2, general: 'General' }
  // Opciones listas para selects/filtros de sede
  const sedeOptions = [{ val: '107', label: sede1 }, { val: '24', label: sede2 }]

  // Logo listo para el PDF: si hay uno configurado (data URI) va tal cual; si no,
  // el asset por defecto necesita el origin absoluto para cargar en la ventana de impresión.
  const logoPDF = cfg.logo_oscuro || `${window.location.origin}${logoNegro}`

  return {
    nombre,
    ciudad,
    sede1,
    sede2,
    sedeLabel,
    sedeLabels,
    sedeOptions,
    logoClaro: cfg.logo_claro || logoBlanco,   // para fondo oscuro (sistema)
    logoOscuro: cfg.logo_oscuro || logoNegro,  // para fondo claro (PDFs)
    // objeto listo para pasar a los generadores de PDF
    brandingPDF: { logoUrl: logoPDF, nombre, ciudad, sedeLabels },
  }
}
