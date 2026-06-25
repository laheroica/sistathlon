import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

/**
 * Hook que devuelve el catálogo dinámico de disciplinas desde la API.
 *
 * @param {object}  opts
 * @param {boolean} opts.soloActivas  Si es true, filtra solo las disciplinas activas
 *
 * Retorna:
 *   discs       – array completo (o filtrado)
 *   labelMap    – { CF: 'CrossFit', HF: 'Heavy Funcional', … }
 *   badgeMap    – { CF: 'bg-blue-900/70 text-blue-200', … }
 *   colorMap    – { CF: '#3b82f6', … }
 *   frecMap     – { CF: ['2x','3x','libre'], … }
 *   isLoading
 *   isError
 */
export function useDisciplinas({ soloActivas = false } = {}) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['disciplinas'],
    queryFn:  () => api.get('/disciplinas/').then(r => r.data),
    staleTime: 5 * 60 * 1000,   // 5 min en caché
    placeholderData: [],
  })

  const discs = soloActivas ? data.filter(d => d.activo) : data

  const labelMap = Object.fromEntries(discs.map(d => [d.codigo, d.nombre]))
  const badgeMap = Object.fromEntries(discs.map(d => [d.codigo, d.color_badge]))
  const colorMap = Object.fromEntries(discs.map(d => [d.codigo, d.color_hex]))
  const frecMap  = Object.fromEntries(discs.map(d => [d.codigo, d.frecuencias]))

  return { discs, labelMap, badgeMap, colorMap, frecMap, isLoading, isError }
}
