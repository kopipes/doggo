import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { AuditEntry } from '@petreg/shared'

export default function AuditPage() {
  const { token } = useAuth()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res = await api.get<{ entries: AuditEntry[]; total: number }>(
      `/audit?page=${page}&limit=50`, token,
    )
    if (res.ok) { setEntries(res.data.entries); setTotal(res.data.total) }
    setLoading(false)
  }

  useEffect(() => { load() }, [page])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold t-text-primary">Audit Log</h1>
        <p className="text-xs t-text-muted mt-0.5">{total} entries total</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="ml-2 text-sm t-text-muted">Loading…</span>
        </div>
      ) : (
        <div className="rounded-xl border t-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b t-border t-table-header">
                  <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium t-text-muted uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y t-table-divider t-bg-surface">
                {entries.map((e) => (
                  <tr key={e.id} className="t-table-row transition-colors">
                    <td className="px-4 py-2.5 text-xs t-text-muted whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600 whitespace-nowrap">{e.action}</td>
                    <td className="px-4 py-2.5 text-xs t-text-secondary whitespace-nowrap hidden sm:table-cell">
                      {e.actor_id ? `#${e.actor_id} (${e.actor_role})` : e.actor_role ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs t-text-muted whitespace-nowrap hidden md:table-cell">
                      {e.entity} #{e.entity_id}
                    </td>
                    <td className="px-4 py-2.5 text-xs t-text-muted max-w-[200px] truncate hidden lg:table-cell">{e.detail ?? '—'}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center t-text-muted text-sm">No entries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs t-text-muted">Page {page}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border t-border text-xs t-text-secondary t-nav-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <button disabled={entries.length < 50} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border t-border text-xs t-text-secondary t-nav-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
