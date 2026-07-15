export const HOY = new Date().toISOString().slice(0, 10)

const esMontoFijo = p => p.tipo_liquidacion === 'fijo' || p.tipo_liquidacion === 'mixto'

/**
 * Fracción del monto que corresponde a una sede para un profe de monto fijo
 * SIN clases en la grilla (ej. sueldo del dueño), según su sede configurada:
 *  - un código de sede → todo a esa sede
 *  - 'general'         → todo al bucket general
 *  - 'ambas' (u otro)  → repartido en partes iguales entre las sucursales
 * `codes` es la lista de códigos de sede vigentes (default 107/24).
 */
function fraccionFijaSinClases(profeSede, sede, codes) {
  if (!sede) return 1                                   // total (ambas)
  if (profeSede === 'general') return sede === 'general' ? 1 : 0
  if (codes.includes(profeSede)) return sede === profeSede ? 1 : 0
  return codes.includes(sede) ? 1 / codes.length : 0    // 'ambas'
}

/** Monto de un profe de monto fijo/mixto atribuido a una sede. */
function montoFijo(p, sede, incluir, codes) {
  const clases = p.clases ?? []
  const totalMes = clases.length
  if (totalMes > 0) {
    const n = clases.filter(c => incluir(c) && (!sede || c.sede === sede)).length
    return p.monto_calculado * n / totalMes
  }
  return p.monto_calculado * fraccionFijaSinClases(p.sede, sede, codes)
}

/** Monto acumulado hasta hoy para un profe, opcionalmente filtrado por sede. */
export function montoAcumulado(p, sede, codes = ['107', '24']) {
  if (esMontoFijo(p)) return montoFijo(p, sede, c => c.fecha <= HOY, codes)
  const dadas = (p.clases ?? []).filter(c => c.fecha <= HOY)
  const n = sede ? dadas.filter(c => c.sede === sede).length : dadas.length
  if (n === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  return 0
}

/** Monto proyectado a fin de mes para un profe, opcionalmente filtrado por sede. */
export function montoProyectado(p, sede, codes = ['107', '24']) {
  if (esMontoFijo(p)) return montoFijo(p, sede, () => true, codes)
  const clases = p.clases ?? []
  const total  = clases.length
  const n      = sede ? clases.filter(c => c.sede === sede).length : total
  if (n === 0 || total === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  return 0
}
