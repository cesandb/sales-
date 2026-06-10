import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    // Prevent body scroll while modal open
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — slides up from bottom on mobile, centered on desktop */}
      <div className={`
        relative bg-gray-900 border-t sm:border border-gray-700 shadow-2xl w-full
        rounded-t-2xl sm:rounded-2xl
        max-h-[92vh] sm:max-h-[90vh]
        flex flex-col
        ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}
      `}>
        {/* Handle bar (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h2 className="font-bold text-white text-base sm:text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
