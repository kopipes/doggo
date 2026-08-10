import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import PdfViewer from '../components/PdfViewer'
import { useTheme } from '../hooks/useTheme'

interface CrewResult {
  first_name: string
  last_name: string
  email: string
  ticket_id: string
  ticket_name: string | null
  bib_number: string
  submission_status: string
  cert_urls: string[]
  dog_photo_url: string | null
}

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 p-2 rounded-xl t-card border t-border t-text-muted hover:t-text-primary transition-colors shadow-sm"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
        </svg>
      )}
    </button>
  )
}

export default function CrewPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [bib, setBib] = useState('')
  const [result, setResult] = useState<CrewResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function doLookup(bibValue: string) {
    if (!/^\d{4}$/.test(bibValue)) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await api.get<CrewResult>(`/crew/lookup?bib=${bibValue}&token=${token}`)
      if (!res.ok) { setError((res as any).error); return }
      setResult(res.data)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handlePad(key: string) {
    if (key === '⌫') { setBib(b => b.slice(0, -1)); setError('') }
    else if (key === '✓') { doLookup(bib) }
    else {
      if (bib.length >= 4) return
      const next = bib + key
      setBib(next)
      if (next.length === 4) doLookup(next)
    }
  }

  function handleKeyboard(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setBib(val)
    if (val.length === 4) doLookup(val)
  }

  function reset() {
    setResult(null)
    setBib('')
    setError('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  if (!token) {
    return (
      <div className="min-h-screen t-bg-base flex items-center justify-center">
        <ThemeToggle />
        <p className="text-red-500 text-sm">Invalid crew link — token missing.</p>
      </div>
    )
  }

  const statusColor = result
    ? result.submission_status === 'verified'  ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
    : result.submission_status === 'submitted' ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
    : 'bg-amber-500/20 text-amber-600 border-amber-500/30'
    : ''

  return (
    <div className="min-h-screen t-bg-base flex flex-col items-center px-4 py-8">
      <ThemeToggle />

      {/* INPUT MODE */}
      {!result && (
        <>
          <div className="text-center mb-6">
            <img src="/logo.png" alt="DogReg" className="h-24 mx-auto mb-3 object-contain" />
            <p className="t-text-muted text-xs mt-0.5">Race Day Crew Verification</p>
          </div>

          <div className="w-full max-w-xs mb-4">
            <p className="text-xs t-text-muted uppercase tracking-wide text-center mb-2">Enter Bib Number</p>

            {/* Digit display */}
            <div className="flex justify-center gap-3 mb-1" onClick={() => inputRef.current?.focus()}>
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-14 h-16 flex items-center justify-center rounded-xl border-2 text-3xl font-mono font-bold transition-colors ${
                  bib[i]
                    ? 'border-blue-500/60 bg-blue-500/10 t-text-primary'
                    : i === bib.length
                    ? 'border-blue-400/40 t-bg-raised t-text-muted animate-pulse'
                    : 't-border t-bg-raised t-text-muted opacity-30'
                }`}>
                  {bib[i] ?? (i === bib.length ? '·' : '')}
                </div>
              ))}
            </div>

            <input ref={inputRef} type="text" inputMode="numeric" value={bib}
              onChange={handleKeyboard} className="opacity-0 absolute w-0 h-0"
              aria-label="Bib number" autoFocus />

            {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
            {loading && <p className="text-blue-500 text-xs text-center mt-2 animate-pulse">Looking up…</p>}
          </div>

          {/* Number pad */}
          <div className="w-full max-w-xs grid grid-cols-3 gap-2">
            {PAD_KEYS.map((key) => {
              const isBackspace = key === '⌫'
              const isSubmit    = key === '✓'
              const disabled = isSubmit ? bib.length !== 4 || loading
                : isBackspace ? bib.length === 0
                : bib.length >= 4
              return (
                <button key={key} onClick={() => handlePad(key)} disabled={disabled}
                  className={`
                    h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 select-none
                    disabled:opacity-30 disabled:cursor-not-allowed
                    ${isSubmit ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : isBackspace ? 't-card border t-border t-text-secondary hover:t-text-primary'
                      : 't-card border t-border t-text-primary hover:border-blue-500/40 font-mono'}
                  `}
                >
                  {key}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* RESULT MODE */}
      {result && (
        <div className="w-full max-w-sm space-y-3">
          {/* Logo small */}
          <div className="text-center mb-2">
            <img src="/logo.png" alt="DogReg" className="h-10 mx-auto object-contain opacity-70" />
          </div>

          {/* Search again bar */}
          <button onClick={reset}
            className="w-full flex items-center gap-3 t-card border t-border rounded-2xl px-4 py-3 hover:border-blue-500/40 transition-colors group">
            <svg className="w-4 h-4 t-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
            <span className="font-mono t-text-muted text-sm flex-1 text-left">Bib #{result.bib_number}</span>
            <span className="text-xs text-blue-500 group-hover:text-blue-400 transition-colors">Search again</span>
          </button>

          {/* Identity card */}
          <div className="t-card border t-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold font-mono text-blue-500">#{result.bib_number}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColor}`}>
                {result.submission_status}
              </span>
            </div>

            <dl className="space-y-2.5">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                </svg>
                <div>
                  <p className="text-xs t-text-muted uppercase tracking-wide">Name</p>
                  <p className="t-text-primary font-semibold">{result.first_name} {result.last_name}</p>
                </div>
              </div>

              {result.ticket_name && (
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"/>
                  </svg>
                  <div>
                    <p className="text-xs t-text-muted uppercase tracking-wide">Ticket Type</p>
                    <p className="t-text-primary text-sm">{result.ticket_name}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                </svg>
                <div>
                  <p className="text-xs t-text-muted uppercase tracking-wide">Email</p>
                  <p className="t-text-primary text-sm">{result.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"/>
                </svg>
                <div>
                  <p className="text-xs t-text-muted uppercase tracking-wide">Ticket ID</p>
                  <p className="t-text-primary text-sm font-mono">{result.ticket_id}</p>
                </div>
              </div>
            </dl>
          </div>

          {/* Dog photo */}
          {result.dog_photo_url && (
            <div className="t-card border t-border rounded-2xl overflow-hidden">
              <p className="text-xs t-text-muted uppercase tracking-wide px-4 pt-4 pb-2">Dog Photo</p>
              <img src={result.dog_photo_url} alt="Dog photo" className="w-full object-cover max-h-56"/>
            </div>
          )}

          {/* Certificates */}
          {result.cert_urls.length > 0 && (
            <div className="t-card border t-border rounded-2xl p-4 space-y-3">
              <p className="text-xs t-text-muted uppercase tracking-wide">
                Vaccine Certificate{result.cert_urls.length > 1 ? `s (${result.cert_urls.length})` : ''}
              </p>
              {result.cert_urls.map((url, i) => (
                <div key={i}>
                  {result.cert_urls.length > 1 && <p className="text-xs t-text-muted mb-1">Certificate {i + 1}</p>}
                  <PdfViewer url={url} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
