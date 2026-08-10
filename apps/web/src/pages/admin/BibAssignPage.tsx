import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'

export default function BibAssignPage() {
  const { token } = useAuth()
  const [ticketId, setTicketId] = useState('')
  const [bib, setBib] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const res = await api.post('/bibs/assign', { ticket_id: ticketId.toUpperCase(), bib_number: bib }, token)
      if (!res.ok) { setMessage({ type: 'err', text: (res as any).error }); return }
      setMessage({ type: 'ok', text: `Bib ${bib} assigned to ${ticketId.toUpperCase()}` })
      setTicketId('')
      setBib('')
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm">
      <div className="mb-6">
        <h1 className="text-xl font-bold t-text-primary">Bib Assignment</h1>
        <p className="text-sm t-text-muted mt-0.5">Assign a 4-digit bib number to a runner</p>
      </div>

      <div className="t-card border rounded-2xl p-6">
        {message && (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 mb-5 text-sm ${
            message.type === 'ok'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
              : 'bg-red-500/10 border border-red-500/20 text-red-600'
          }`}>
            {message.type === 'ok'
              ? <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              : <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
            }
            {message.text}
          </div>
        )}

        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-1.5">Ticket ID</label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value.toUpperCase())}
              placeholder="e.g. XUNU55EMM5GF2"
              className="t-input w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              required autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-1.5">Bib Number</label>
            <input
              type="text" inputMode="numeric" pattern="\d{4}" maxLength={4}
              value={bib}
              onChange={(e) => setBib(e.target.value.replace(/\D/g, ''))}
              placeholder="0001"
              className="t-input w-full border rounded-xl px-4 py-3 text-2xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              required
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Assigning…' : 'Assign Bib'}
          </button>
        </form>
      </div>
    </div>
  )
}
