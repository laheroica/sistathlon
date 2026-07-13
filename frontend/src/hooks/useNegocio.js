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

  // Logo listo para el PDF: si hay uno configurado (data URI) va tal cual; si no,
  // el asset por defecto necesita el origin absoluto para cargar en la ventana de impresión.
  const logoPDF = cfg.logo_oscuro || `${window.location.origin}${logoNegro}`

  return {
    nombre,
    ciudad,
    logoClaro: cfg.logo_claro || logoBlanco,   // para fondo oscuro (sistema)
    logoOscuro: cfg.logo_oscuro || logoNegro,  // para fondo claro (PDFs)
    // objeto listo para pasar a los generadores de PDF
    brandingPDF: { logoUrl: logoPDF, nombre, ciudad },
  }
}
