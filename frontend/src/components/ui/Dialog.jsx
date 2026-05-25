import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export function Dialog({ open, onOpenChange, children }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RadixDialog.Root>
  )
}

export function DialogTrigger({ children, asChild }) {
  return <RadixDialog.Trigger asChild={asChild}>{children}</RadixDialog.Trigger>
}

export function DialogContent({ children, title, description, wide = false }) {
  return (
    <RadixDialog.Portal>
      <AnimatePresence>
        <RadixDialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
              bg-dark-surface border border-dark-border rounded-2xl shadow-2xl
              ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}
              max-h-[90vh] overflow-y-auto p-6`}
          >
            {title && (
              <div className="mb-4">
                <RadixDialog.Title className="text-lg font-bold text-dark-text">
                  {title}
                </RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="text-sm text-dark-muted mt-0.5">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
            )}
            {children}
            <RadixDialog.Close asChild>
              <button className="absolute top-4 right-4 text-dark-muted hover:text-dark-text transition-colors rounded-lg p-1 hover:bg-dark-border">
                <X size={16} />
              </button>
            </RadixDialog.Close>
          </motion.div>
        </RadixDialog.Content>
      </AnimatePresence>
    </RadixDialog.Portal>
  )
}
