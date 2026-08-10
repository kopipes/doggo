import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { RunnerSummary } from '@petreg/shared'

const STATUS_BADGE: Record<string, string> = {
  pending:   't-badge-pending',
  submitted: 't-badge-submitted',
  verified:  't-badge-verified',
  rejected:  't-badge-rejected',
}

const DEBOUNCE_MS = 300

export default function RunnersPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [runners, setRunners] = useState<RunnerSummary[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRunners = useCallback(async (qVal: string, statusVal: string, pageVal: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    const params = new URLSearchParams({ page: String(pageVal), limit: '50' })
    if (qVal) params.set('q', qVal)
    if (statusVal) params.set('status', statusVal)
    try {
      const res = await api.get<{ runners: RunnerSummary[]; total: number }>(
        `/runners?${params}`, token, controller.signal,
      )
      if (res.ok) { setRunners(res.data.runners); setTotal(res.data.total) }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [token])

  useEffect(() => { fetchRunners(q, status, page) }, [page, status])

  function handleQChange(value: string) {
    setQ(value)
    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); fetchRunners(value, status, 1) }, DEBOUNCE_MS)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold t-text-primary">Runners</h1>
          <p className="text-xs t-text-muted mt-0.5">{total.toLocaleString()} total</p>
        </div>
      </div>

      {/* Search — stacks on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          {searching
            ? <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            : <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          }
          <input
            type="text"
            placeholder="Search name, email, ticket…"
            value={q}
            onChange={(e) => handleQChange(e.target.value)}
            className="t-input w-full border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            autoFocus
          />
          {q && (
            <button onClick={() => handleQChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 t-text-muted hover:t-text-primary">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="t-select border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Scrollable table */}
      <div className={`rounded-xl border t-border overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b t-border t-table-header">
                <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap">Ticket ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap">Bib</th>
                <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y t-table-divider t-bg-surface">
              {runners.map((r) => (
                <tr key={r.id} className="t-table-row cursor-pointer transition-colors active:opacity-70"
                  onClick={() => navigate(`/admin/runners/${r.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs t-text-muted whitespace-nowrap">{r.ticket_id}</td>
                  <td className="px-4 py-3 t-text-primary font-medium whitespace-nowrap">
                    {r.first_name}{r.last_name ? ` ${r.last_name}` : ''}
                  </td>
                  <td className="px-4 py-3 t-text-secondary hidden sm:table-cell max-w-[180px] truncate">{r.email}</td>
                  <td className="px-4 py-3 font-mono t-text-secondary whitespace-nowrap">{r.bib_number ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.submission_status] ?? ''}`}>
                      {r.submission_status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && runners.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center t-text-muted text-sm">
                  {q ? `No runners matching "${q}"` : 'No runners found'}
                </td></tr>
              )}
              {loading && runners.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 t-text-muted text-sm">
                    <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Loading…
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs t-text-muted">Page {page} · {runners.length} shown{total > 0 ? ` of ${total.toLocaleString()}` : ''}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border t-border text-xs t-text-secondary t-nav-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <button disabled={runners.length < 50 || loading} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border t-border text-xs t-text-secondary t-nav-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
