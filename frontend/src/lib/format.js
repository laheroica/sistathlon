/**
 * Formatea un número con puntos como separador de miles (formato argentino).
 * Ej: 260500 → "$260.500"
 */
export function money(n) {
  return '$' + Math.round(Number(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formatea un número sin el signo $
 * Ej: 260500 → "260.500"
 */
export function num(n) {
  return Math.round(Number(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
