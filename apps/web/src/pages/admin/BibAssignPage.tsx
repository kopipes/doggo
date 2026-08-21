import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'

type Mode = 'auto' | 'suggest' | 'manual'

type AvailableData = {
  total_available: number
  total_taken: number
  range: { min: number; max: number }
  suggestions: string[]
  next: string | null
}

type Message = { type: 'ok' | 'err'; text: string }

export default function BibAssignPage() {
  const { token } = useAuth()
  const [mode, setMode] = useState<Mode>('auto')
  const [ticketId, setTicketId] = useState('')
  const [bib, setBib] = useState('')
  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(false)

  // Available data
  const [available, setAvailable] = useState<AvailableData | null>(null)
  const [loadingAvailable, setLoadingAvailable] = useState(false)

  // Manual mode: real-time conflict check
  const [bibCheck, setBibCheck] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchAvailable() {
    setLoadingAvailable(true)
    try {
      const res = await api.get<AvailableData>('/bibs/available', token)
      if (res.ok) setAvailable(res.data)
    } finally {
      setLoadingAvailable(false)
    }
  }

  useEffect(() => {
    fetchAvailable()
  }, [])

  // Reset bib selection when mode changes
  useEffect(() => {
    setBib('')
    setBibCheck('idle')
    setMessage(null)
  }, [mode])

  // Real-time bib conflict check for manual mode
  function handleBibInput(val: string) {
    const clean = val.replace(/\D/g, '').slice(0, 4)
    setBib(clean)
    setBibCheck('idle')
    if (checkTimer.current) clearTimeout(checkTimer.current)
    if (clean.length === 4) {
      setBibCheck('checking')
      checkTimer.current = setTimeout(async () => {
        try {
          const checkRes = await api.get<{ available: boolean }>(`/bibs/check/${clean}`, token)
          if ((checkRes as any).ok) {
            setBibCheck((checkRes as any).data.available ? 'ok' : 'taken')
          } else {
            setBibCheck('idle')
          }
        } catch {
          setBibCheck('idle')
        }
      }, 400)
    }
  }

  async function handleAssign(bibToAssign: string) {
    if (!ticketId.trim()) {
      setMessage({ type: 'err', text: 'Please enter a Ticket ID first' })
      return
    }
    setMessage(null)
    setLoading(true)
    try {
      const res = await api.post('/bibs/assign', { ticket_id: ticketId.toUpperCase(), bib_number: bibToAssign }, token)
      if (!res.ok) {
        setMessage({ type: 'err', text: (res as any).error })
        return
      }
      setMessage({ type: 'ok', text: `Bib ${bibToAssign} assigned to ${ticketId.toUpperCase()}` })
      setTicketId('')
      setBib('')
      setBibCheck('idle')
      fetchAvailable() // refresh available count
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const isOutOfRange = bib.length === 4 && (Number(bib) < 1000 || Number(bib) > 1750)

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <h1 className="text-xl font-bold t-text-primary">Bib Assignment</h1>
        <p className="text-sm t-text-muted mt-0.5">Assign bib numbers 1000–1750</p>
      </div>

      {/* Stats bar */}
      {available && (
        <div className="flex items-center gap-3 t-card border t-border rounded-2xl px-4 py-3 mb-5">
          <div className="flex-1 text-center">
            <p className="text-lg font-bold t-text-primary">{available.total_available}</p>
            <p className="text-xs t-text-muted">Available</p>
          </div>
          <div className="w-px h-8 bg-current opacity-10"/>
          <div className="flex-1 text-center">
            <p className="text-lg font-bold t-text-primary">{available.total_taken}</p>
            <p className="text-xs t-text-muted">Assigned</p>
          </div>
          <div className="w-px h-8 bg-current opacity-10"/>
          <div className="flex-1 text-center">
            <p className="text-lg font-bold t-text-primary">751</p>
            <p className="text-xs t-text-muted">Total range</p>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 t-card border t-border rounded-2xl mb-5">
        {([
          { id: 'auto', label: 'Auto', desc: 'Next available' },
          { id: 'suggest', label: 'Suggest', desc: 'Pick from 5' },
          { id: 'manual', label: 'Manual', desc: 'Enter number' },
        ] as { id: Mode; label: string; desc: string }[]).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              mode === m.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 't-text-muted hover:t-text-primary'
            }`}
          >
            <span className="block">{m.label}</span>
            <span className={`block font-normal mt-0.5 ${mode === m.id ? 'text-blue-200' : 'opacity-50'}`}>{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4 text-sm ${
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

      <div className="t-card border t-border rounded-2xl p-5 space-y-4">
        {/* Ticket ID — always shown */}
        <div>
          <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-1.5">Ticket ID</label>
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value.toUpperCase())}
            placeholder="e.g. XUNU55EMM5GF2"
            className="t-input w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            autoFocus
          />
        </div>

        {/* AUTO MODE */}
        {mode === 'auto' && (
          <div>
            <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-2">Next Available Bib</label>
            {loadingAvailable ? (
              <div className="flex items-center justify-center py-6 t-text-muted text-sm">Loading…</div>
            ) : available?.next ? (
              <>
                <div className="flex items-center justify-center py-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-3">
                  <span className="text-4xl font-mono font-bold text-blue-500 tracking-widest">{available.next}</span>
                </div>
                <button
                  onClick={() => handleAssign(available.next!)}
                  disabled={loading || !ticketId.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {loading ? 'Assigning…' : `Assign Bib ${available.next}`}
                </button>
              </>
            ) : (
              <div className="text-center py-4 text-sm text-red-500">No bibs available in range 1000–1750</div>
            )}
          </div>
        )}

        {/* SUGGEST MODE */}
        {mode === 'suggest' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium t-text-muted uppercase tracking-wide">Pick a Bib</label>
              <button
                onClick={fetchAvailable}
                disabled={loadingAvailable}
                className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <svg className={`w-3 h-3 ${loadingAvailable ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Refresh
              </button>
            </div>
            {loadingAvailable ? (
              <div className="flex items-center justify-center py-6 t-text-muted text-sm">Loading…</div>
            ) : available?.suggestions.length ? (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {available.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setBib(s)}
                    className={`py-3 rounded-xl font-mono font-bold text-sm transition-all border ${
                      bib === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 't-card t-border t-text-primary hover:border-blue-500/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-red-500">No bibs available</div>
            )}
            {bib && (
              <button
                onClick={() => handleAssign(bib)}
                disabled={loading || !ticketId.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {loading ? 'Assigning…' : `Assign Bib ${bib}`}
              </button>
            )}
          </div>
        )}

        {/* MANUAL MODE */}
        {mode === 'manual' && (
          <div>
            <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-1.5">
              Bib Number <span className="normal-case font-normal">(1000–1750)</span>
            </label>
            <div className="relative mb-1">
              <input
                type="text" inputMode="numeric" maxLength={4}
                value={bib}
                onChange={(e) => handleBibInput(e.target.value)}
                placeholder="1000"
                className={`t-input w-full border rounded-xl px-4 py-3 text-2xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 transition-colors ${
                  bibCheck === 'ok' ? 'border-emerald-500 focus:ring-emerald-500/40' :
                  bibCheck === 'taken' ? 'border-red-500 focus:ring-red-500/40' :
                  'focus:ring-blue-500/40'
                }`}
              />
              {bib.length === 4 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {bibCheck === 'checking' && (
                    <svg className="w-4 h-4 animate-spin t-text-muted" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  )}
                  {bibCheck === 'ok' && (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  )}
                  {bibCheck === 'taken' && (
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  )}
                </div>
              )}
            </div>
            {isOutOfRange && (
              <p className="text-xs text-amber-500 mb-2">Outside range 1000–1750. Still allowed but not recommended.</p>
            )}
            {bibCheck === 'taken' && (
              <p className="text-xs text-red-500 mb-2">This bib is already assigned to another runner.</p>
            )}
            {bibCheck === 'ok' && (
              <p className="text-xs text-emerald-500 mb-2">Available.</p>
            )}
            <button
              onClick={() => handleAssign(bib)}
              disabled={loading || !ticketId.trim() || bib.length !== 4 || bibCheck === 'taken'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-1"
            >
              {loading ? 'Assigning…' : 'Assign Bib'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
