import { useEffect, useRef } from 'react'
import PdfViewer from './PdfViewer'

interface MediaModalProps {
  url: string
  label: string
  onClose: () => void
}

export default function MediaModal({ url, label, onClose }: MediaModalProps) {
  const isPdf = url.includes('.pdf') || url.includes('pdf')
  const isImage = /\.(jpe?g|png|webp)(\?|$)/i.test(url)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent scroll on body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl t-bg-surface border t-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b t-border shrink-0">
          <p className="text-sm font-medium t-text-primary truncate">{label}</p>
          <button
            onClick={onClose}
            className="t-text-muted hover:t-text-primary transition-colors ml-4 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isImage && (
            <img
              src={url}
              alt={label}
              className="max-w-full max-h-[70vh] mx-auto rounded-lg object-contain"
            />
          )}
          {!isImage && (
            <PdfViewer url={url} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t t-border shrink-0 flex justify-end">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
            </svg>
            Open in new tab
          </a>
        </div>
      </div>
    </div>
  )
}
