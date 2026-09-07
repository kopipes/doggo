import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { DogGalleryItem } from '@petreg/shared'
import MediaModal from '../../components/MediaModal'

const STATUS_BADGE: Record<string, string> = {
  pending:   't-badge-pending',
  submitted: 't-badge-submitted',
  verified:  't-badge-verified',
  rejected:  't-badge-rejected',
}

const DEBOUNCE_MS = 300

export default function DogGalleryPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<DogGalleryItem[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [modalUrl, setModalUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchGallery = useCallback(async (qVal: string, statusVal: string, pageVal: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    const params = new URLSearchParams({ page: String(pageVal), limit: '20' })
    if (qVal) params.set('q', qVal)
    if (statusVal) params.set('status', statusVal)
    try {
      const res = await api.get<{ runners: DogGalleryItem[]; total: number }>(
        `/runners/gallery?${params}`, token, controller.signal,
      )
      if (res.ok) { setItems(res.data.runners); setTotal(res.data.total) }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [token])

  useEffect(() => { fetchGallery(q, status, page) }, [page, status])

  function handleQChange(value: string) {
    setQ(value)
    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); fetchGallery(value, status, 1) }, DEBOUNCE_MS)
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div>
      {modalUrl && <MediaModal url={modalUrl} label="Dog Photo" onClose={() => setModalUrl(null)} />}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold t-text-primary">Dog Gallery</h1>
          <p className="text-xs t-text-muted mt-0.5">{total.toLocaleString()} doggies with photos</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          {searching
            ? <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            : <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          }
          <input type="text" placeholder="Search name, email, ticket, bib, dog name…" value={q}
            onChange={(e) => handleQChange(e.target.value)}
            className="t-input w-full border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"/>
          {q && (
            <button onClick={() => handleQChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 t-text-muted hover:t-text-primary">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="t-select border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="checked_in">Checked In</option>
        </select>
      </div>

      {/* Gallery grid */}
      <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {items.length === 0 && !loading ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto t-text-muted opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M6.633 10.25H3.75a.75.75 0 00-.75.75v6a.75.75 0 00.75.75h2.883"/>
            </svg>
            <p className="text-sm t-text-muted mt-3">No doggies found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((r) => (
              <div key={r.id} className="t-card border t-border rounded-2xl overflow-hidden group">
                {/* Photo — thumbnail in grid, full image on click */}
                <button
                  onClick={() => r.photo_url && setModalUrl(r.photo_url)}
                  className="block w-full aspect-square t-bg-raised focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {r.photo_thumb_url || r.photo_url ? (
                    <img src={r.photo_thumb_url ?? r.photo_url!} alt={`${r.first_name}'s dog`} loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 t-text-muted opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z"/>
                      </svg>
                    </div>
                  )}
                </button>

                {/* Info */}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold t-text-primary truncate">
                      {r.first_name}{r.last_name ? ` ${r.last_name}` : ''}
                    </p>
                    {r.bib_number && (
                      <span className="font-mono text-xs font-bold text-blue-500 shrink-0">#{r.bib_number}</span>
                    )}
                  </div>
                  {r.ticket_name && (
                    <p className="text-xs t-text-muted truncate">🐕 {r.ticket_name}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[r.submission_status] ?? ''}`}>
                      {r.submission_status}
                    </span>
                    {r.checked_in === 1 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        In
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/admin/runners/${r.id}`)}
                    className="w-full text-[11px] text-blue-500 hover:text-blue-400 pt-1 transition-colors"
                  >
                    View details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-5">
        <p className="text-xs t-text-muted">Page {page} of {totalPages} · {items.length} shown{total > 0 ? ` of ${total.toLocaleString()}` : ''}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border t-border text-xs t-text-secondary t-nav-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border t-border text-xs t-text-secondary t-nav-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
