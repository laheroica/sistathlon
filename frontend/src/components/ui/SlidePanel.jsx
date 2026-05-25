import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function SlidePanel({ open, onClose, title, subtitle, children, width = 'max-w-lg' }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 35 }}
            className={`fixed right-0 top-0 h-full ${width} w-full bg-dark-surface
              border-l border-dark-border shadow-2xl z-50 flex flex-col`}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-dark-border flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-dark-text">{title}</h2>
                {subtitle && <p className="text-sm text-dark-muted mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="text-dark-muted hover:text-dark-text transition-colors p-1 rounded-lg hover:bg-dark-border ml-4"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
