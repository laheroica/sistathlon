import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, User, X } from 'lucide-react'
import api from '../../lib/api'

const DISC_BADGE = {
  CF: 'bg-blue-900 text-blue-200',
  HF: 'bg-green-900 text-green-200',
  HX: 'bg-yellow-900 text-yellow-200',
  TN: 'bg-purple-900 text-purple-200',
  KD: 'bg-pink-900 text-pink-200',
  BP: 'bg-sky-900 text-sky-200',
}
const DISC_LABEL = { CF: 'CF', HF: 'HF', HX: 'Hyrox', TN: 'Teens', KD: 'Kids', BP: 'Bonus' }

export default function CommandPalette({ open, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) { setSearch(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/alumnos/?search=${encodeURIComponent(search)}&page_size=10`)
        setResults(res.data.results || res.data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        open ? onClose() : null
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl z-50"
          >
            <Command className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
                <Search size={16} className="text-dark-muted flex-shrink-0" />
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Buscar alumno por nombre..."
                  className="flex-1 bg-transparent text-dark-text placeholder-dark-muted outline-none text-sm"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-dark-muted hover:text-dark-text">
                    <X size={14} />
                  </button>
                )}
                <kbd className="text-xs text-dark-muted bg-dark-border px-1.5 py-0.5 rounded font-mono">ESC</kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-80 overflow-y-auto p-2">
                {loading && (
                  <Command.Loading>
                    <div className="text-center py-6 text-dark-muted text-sm">Buscando...</div>
                  </Command.Loading>
                )}

                {!loading && search && results.length === 0 && (
                  <Command.Empty>
                    <div className="text-center py-6 text-dark-muted text-sm">No se encontró "{search}"</div>
                  </Command.Empty>
                )}

                {!loading && results.length > 0 && (
                  <Command.Group heading={
                    <span className="text-xs text-dark-muted uppercase tracking-wider px-2">
                      {results.length} alumno{results.length !== 1 ? 's' : ''}
                    </span>
                  }>
                    {results.map((alumno) => (
                      <Command.Item
                        key={alumno.id}
                        value={alumno.nombre_completo}
                        onSelect={() => { onSelect(alumno); onClose() }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                          text-dark-text hover:bg-dark-border/60 transition-colors
                          data-[selected=true]:bg-primary-dark/20 data-[selected=true]:text-white"
                      >
                        <div className="w-8 h-8 rounded-full bg-dark-border flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-dark-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{alumno.nombre_completo}</div>
                          <div className="text-xs text-dark-muted">{alumno.horario} · Sede {alumno.sede}</div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${DISC_BADGE[alumno.disciplina] || 'bg-dark-border text-dark-muted'}`}>
                          {DISC_LABEL[alumno.disciplina] || alumno.disciplina}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {!search && (
                  <div className="text-center py-8 text-dark-muted text-sm">
                    Escribí el nombre del alumno
                  </div>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
