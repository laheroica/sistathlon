export const HOY = new Date().toISOString().slice(0, 10)

const esMontoFijo = p => p.tipo_liquidacion === 'fijo' || p.tipo_liquidacion === 'mixto'

/**
 * Monto de un profe de monto fijo (fijo/mixto) prorrateado por sede.
 * Sin clases en la grilla (ej. sueldo del dueño) se reparte mitad por sede,
 * igual que los impuestos compartidos ÷2.
 */
function montoFijoProrrateado(p, sede, n, total) {
  if (total > 0) return p.monto_calculado * n / total
  return sede ? p.monto_calculado / 2 : p.monto_calculado
}

/** Monto acumulado hasta hoy para un profe, opcionalmente filtrado por sede. */
export function montoAcumulado(p, sede) {
  const clases   = p.clases ?? []
  const dadas    = clases.filter(c => c.fecha <= HOY)
  const totalMes = clases.length
  const n        = sede ? dadas.filter(c => c.sede === sede).length : dadas.length
  if (esMontoFijo(p)) return montoFijoProrrateado(p, sede, n, totalMes)
  if (n === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  return 0
}

/** Monto proyectado a fin de mes para un profe, opcionalmente filtrado por sede. */
export function montoProyectado(p, sede) {
  const clases = p.clases ?? []
  const total  = clases.length
  const n      = sede ? clases.filter(c => c.sede === sede).length : total
  if (esMontoFijo(p)) return montoFijoProrrateado(p, sede, n, total)
  if (n === 0 || total === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  return 0
}
