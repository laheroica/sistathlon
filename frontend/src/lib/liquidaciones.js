export const HOY = new Date().toISOString().slice(0, 10)

/** Monto acumulado hasta hoy para un profe, opcionalmente filtrado por sede. */
export function montoAcumulado(p, sede) {
  const clases   = p.clases ?? []
  const dadas    = clases.filter(c => c.fecha <= HOY)
  const totalMes = clases.length
  const n        = sede ? dadas.filter(c => c.sede === sede).length : dadas.length
  if (n === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  if (p.tipo_liquidacion === 'fijo') return totalMes > 0 ? p.monto_calculado * n / totalMes : 0
  return 0
}

/** Monto proyectado a fin de mes para un profe, opcionalmente filtrado por sede. */
export function montoProyectado(p, sede) {
  const clases = p.clases ?? []
  const total  = clases.length
  const n      = sede ? clases.filter(c => c.sede === sede).length : total
  if (n === 0 || total === 0) return 0
  if (p.tipo_liquidacion === 'hora') return n * p.valor_hora
  if (p.tipo_liquidacion === 'fijo') return p.monto_calculado * n / total
  return 0
}
