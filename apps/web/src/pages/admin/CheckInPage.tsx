import { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'

interface CheckInResult {
  id: number
  first_name: string
  last_name: string
  ticket_id: string
  ticket_name: string | null
  bib_number: string
  submission_status: string
  checked_in: number
  checked_in_at: string | null
}

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']

export default function CheckInPage() {
  const { token } = useAuth()
  const [bib, setBib] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handlePad(key: string) {
    if (key === '⌫') {
      const next = bib.slice(0, -1)
      setBib(next)
      setResult(null)
      setError('')
      setCheckedIn(false)
      return
    }
    if (key === '✓') {
      doLookup(bib)
      return
    }
    if (bib.length >= 4) return
    const next = bib + key
    setBib(next)
    setResult(null)
    setError('')
    setCheckedIn(false)
    if (next.length === 4) doLookup(next)
  }

  async function doLookup(bibValue: string) {
    if (!/^\d{4}$/.test(bibValue)) return
    setError('')
    setResult(null)
    setCheckedIn(false)
    setLoading(true)
    try {
      const res = await api.get<CheckInResult>(`/checkin/lookup?bib=${bibValue}`, token)
      if (!res.ok) { setError((res as any).error); return }
      setResult(res.data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function doCheckIn() {
    if (!result) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post<CheckInResult>(`/checkin/${result.id}`, {}, token)
      if (!res.ok) {
        setError((res as any).error)
        return
      }
      setResult(res.data)
      setCheckedIn(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setBib('')
    setResult(null)
    setError('')
    setCheckedIn(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const alreadyCheckedIn = result?.checked_in === 1 && !checkedIn

  return (
    <div className="max-w-sm mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold t-text-primary">Check-In</h1>
        <p className="text-xs t-text-muted mt-0.5">Enter bib number to check in a runner</p>
      </div>

      {/* BIB display */}
      <div className="t-card border t-border rounded-2xl p-4 text-center">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={bib}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4)
            setBib(v)
            setResult(null)
            setError('')
            setCheckedIn(false)
            if (v.length === 4) doLookup(v)
          }}
          placeholder="——"
          className="text-5xl font-mono font-bold tracking-widest t-text-primary bg-transparent border-none outline-none text-center w-32"
          maxLength={4}
          autoFocus
        />
        <p className="text-xs t-text-muted mt-1">BIB number</p>
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {PAD_KEYS.map(k => (
          <button
            key={k}
            onClick={() => handlePad(k)}
            disabled={loading}
            className={`py-4 rounded-xl text-lg font-semibold transition-colors border disabled:opacity-40 ${
              k === '✓'
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600'
                : k === '⌫'
                ? 't-card t-border t-text-muted hover:t-text-primary t-nav-hover'
                : 't-card t-border t-text-primary t-nav-hover'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-center text-sm t-text-muted animate-pulse">Looking up…</p>
      )}

      {/* Error */}
      {error && (
        <div className="t-card border border-red-500/30 rounded-2xl p-4 text-center">
          <p className="text-sm text-red-500 font-medium">{error}</p>
          <button onClick={reset} className="mt-3 text-xs t-text-muted underline">Try again</button>
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div className={`t-card border rounded-2xl p-4 space-y-3 ${
          checkedIn ? 'border-emerald-500/40' : alreadyCheckedIn ? 'border-amber-500/40' : 't-border'
        }`}>
          {/* Runner info */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold t-text-primary text-base">
                {result.first_name} {result.last_name}
              </p>
              <p className="text-xs t-text-muted mt-0.5">{result.ticket_id}</p>
              {result.ticket_name && (
                <p className="text-xs t-text-muted">{result.ticket_name}</p>
              )}
            </div>
            <span className="text-2xl font-mono font-bold t-text-primary shrink-0">
              #{result.bib_number}
            </span>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              result.submission_status === 'verified'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : result.submission_status === 'submitted'
                ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                : result.submission_status === 'rejected'
                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                : 'bg-zinc-500/10 t-text-muted border t-border'
            }`}>
              {result.submission_status}
            </span>
          </div>

          {/* Already checked in warning */}
          {alreadyCheckedIn && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
              <p className="text-sm text-amber-600 font-medium">Already checked in</p>
              {result.checked_in_at && (
                <p className="text-xs text-amber-600/70 mt-0.5">
                  {new Date(result.checked_in_at + 'Z').toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Success */}
          {checkedIn && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
              <p className="text-lg">✓</p>
              <p className="text-sm text-emerald-600 font-semibold">Checked in!</p>
            </div>
          )}

          {/* Check-in button — only shown if not yet checked in */}
          {!alreadyCheckedIn && !checkedIn && (
            <button
              onClick={doCheckIn}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking in…' : 'Check In'}
            </button>
          )}

          <button
            onClick={reset}
            className="w-full py-2 rounded-xl border t-border text-xs t-text-muted t-nav-hover transition-colors"
          >
            Next runner
          </button>
        </div>
      )}
    </div>
  )
}
