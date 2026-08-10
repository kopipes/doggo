import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Runner } from '@dogreg/shared'
import { useTheme } from '../hooks/useTheme'

const MAX_CERTS = 3

type PublicRunner = Omit<Runner, 'cert_file_key' | 'cert_file_key_2' | 'cert_file_key_3' | 'dog_photo_key'> & {
  has_cert: number
  has_cert_2: number
  has_cert_3: number
  cert_count: number
  has_dog_photo: number
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface SlotState {
  state: UploadState
  filename?: string
  error?: string
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: 'Pending upload', bg: 't-badge-pending',   text: '',  dot: 'bg-amber-400' },
  submitted: { label: 'Submitted',      bg: 't-badge-submitted', text: '',  dot: 'bg-blue-400' },
  verified:  { label: 'Verified',       bg: 't-badge-verified',  text: '',  dot: 'bg-emerald-400' },
  rejected:  { label: 'Rejected',       bg: 't-badge-rejected',  text: '',  dot: 'bg-red-400' },
}

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

function UploadSlot({ label, accept, hasExisting, slotState, onFile }: {
  label: string
  accept: string
  hasExisting: boolean
  slotState: SlotState
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  const isUploading = slotState.state === 'uploading'
  const isDone      = slotState.state === 'done'
  const isError     = slotState.state === 'error'

  return (
    <div
      onClick={() => !isUploading && inputRef.current?.click()}
      className={`
        relative rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition-all select-none
        ${isUploading ? 'border-blue-500/40 bg-blue-500/10 cursor-wait' : ''}
        ${isDone      ? 'border-emerald-500/40 bg-emerald-500/10' : ''}
        ${isError     ? 'border-red-500/40 bg-red-500/10' : ''}
        ${!isUploading && !isDone && !isError ? 't-border t-bg-raised hover:border-blue-500/40 hover:bg-blue-500/5' : ''}
      `}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} disabled={isUploading} />
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isDone ? 'bg-emerald-500/20' : isError ? 'bg-red-500/20' : 't-bg-overlay'
        }`}>
          {isUploading && (
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {isDone && <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          {isError && <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>}
          {!isUploading && !isDone && !isError && (
            <svg className="w-4 h-4 t-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1"/>
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${isDone ? 'text-emerald-600' : isError ? 'text-red-600' : 't-text-primary'}`}>
            {isUploading ? 'Uploading…'
              : isDone    ? (slotState.filename ?? 'Uploaded')
              : isError   ? (slotState.error ?? 'Upload failed — tap to retry')
              : hasExisting ? 'Tap to replace existing file'
              : label}
          </p>
          <p className={`text-xs mt-0.5 ${isDone ? 'text-emerald-500' : isError ? 'text-red-400' : 't-text-muted'}`}>
            {isDone ? 'Saved · tap to replace'
              : isError ? 'Tap to retry'
              : hasExisting ? 'File already on record'
              : 'JPG, PNG, WEBP or PDF · max 20 MB'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const { ticketId: paramTicketId } = useParams<{ ticketId?: string }>()
  const [ticketId, setTicketId] = useState(paramTicketId ?? '')
  const [runner, setRunner] = useState<PublicRunner | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [completionVisible, setCompletionVisible] = useState(false)

  const [certSlots, setCertSlots] = useState<SlotState[]>([
    { state: 'idle' }, { state: 'idle' }, { state: 'idle' },
  ])
  const [dogSlot, setDogSlot] = useState<SlotState>({ state: 'idle' })

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLookupError('')
    setLookupLoading(true)
    setCompletionVisible(false)
    setCertSlots([{ state: 'idle' }, { state: 'idle' }, { state: 'idle' }])
    setDogSlot({ state: 'idle' })
    try {
      const res = await api.get<PublicRunner>(`/runners/by-ticket/${ticketId.trim().toUpperCase()}`)
      if (!res.ok) { setLookupError(res.error); return }
      setRunner(res.data)
    } catch {
      setLookupError('Network error — please try again')
    } finally {
      setLookupLoading(false)
    }
  }

  async function uploadFile(fieldName: string, file: File, setSlot: (s: SlotState) => void) {
    setSlot({ state: 'uploading', filename: file.name })
    try {
      const form = new FormData()
      form.append(fieldName, file)
      const res = await api.upload(`/files/upload/${runner!.ticket_id}`, form)
      if (!res.ok) { setSlot({ state: 'error', error: (res as any).error ?? 'Upload failed' }); return }
      setSlot({ state: 'done', filename: file.name })
      const updated = await api.get<PublicRunner>(`/runners/by-ticket/${runner!.ticket_id}`)
      if (updated.ok) { setRunner(updated.data); setCompletionVisible(true) }
    } catch {
      setSlot({ state: 'error', error: 'Network error — tap to retry' })
    }
  }

  function handleCertFile(index: number, file: File) {
    const fieldNames = ['cert', 'cert_2', 'cert_3']
    setCertSlots(s => { const n = [...s]; n[index] = { state: 'uploading' }; return n })
    uploadFile(fieldNames[index], file, (s) => setCertSlots(prev => { const n = [...prev]; n[index] = s; return n }))
  }

  function handleDogFile(file: File) {
    setDogSlot({ state: 'uploading' })
    uploadFile('dog_photo', file, setDogSlot)
  }

  const certSlotHasFile = (i: number) =>
    runner ? [runner.has_cert, runner.has_cert_2, runner.has_cert_3][i] === 1 : false

  const certSlotsToShow = runner ? Math.min(Math.max(runner.cert_count + 1, 1), MAX_CERTS) : 1
  const bibLocked = runner && !!runner.bib_number
  const canUpload = runner
    && !bibLocked
    && runner.submission_status !== 'verified'
    && runner.submission_status !== 'rejected'
  const statusCfg = runner ? STATUS_CONFIG[runner.submission_status] : null

  return (
    <div className="min-h-screen t-bg-base flex items-center justify-center px-4 py-12">
      <ThemeToggle />
      <div className="w-full max-w-md space-y-4">

        {/* Header with logo */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="DogReg" className="h-24 mx-auto mb-3 object-contain" />
          <p className="t-text-muted text-sm mt-1">Participant Registration</p>
        </div>

        {/* Lookup form */}
        {!runner && (
          <div className="t-card border rounded-2xl p-6">
            <h2 className="t-text-primary font-semibold mb-1">Enter your Ticket ID</h2>
            <p className="text-sm t-text-muted mb-5">Found on your event confirmation email</p>
            {lookupError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-4">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
                <p className="text-red-600 text-sm">{lookupError}</p>
              </div>
            )}
            <form onSubmit={handleLookup} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. XUNU55EMM5GF2"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                className="t-input w-full border rounded-xl px-4 py-3 font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                required autoFocus
              />
              <button type="submit" disabled={lookupLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
                {lookupLoading ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {runner && (
          <>
            {/* Profile card */}
            <div className="t-card border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="t-text-primary font-semibold">
                    {runner.first_name}{runner.last_name ? ` ${runner.last_name}` : ''}
                  </p>
                  <p className="t-text-muted text-xs font-mono mt-0.5">{runner.ticket_id}</p>
                  <p className="t-text-muted text-xs mt-0.5">{runner.email}</p>
                </div>
                {statusCfg && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 border t-border ${statusCfg.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}/>
                    {statusCfg.label}
                  </span>
                )}
              </div>
              <button onClick={() => { setRunner(null); setCompletionVisible(false) }}
                className="mt-3 text-xs text-blue-500 hover:text-blue-400 transition-colors">
                ← Use a different ticket
              </button>
            </div>

            {/* Completion banner */}
            {completionVisible && canUpload && (
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div>
                  <p className="text-emerald-600 font-semibold text-sm">File uploaded successfully</p>
                  <p className="text-emerald-600/70 text-xs mt-0.5">
                    Your document is saved. You can upload more files below, or you're done — no further action required.
                  </p>
                  {runner.cert_count > 0 && runner.has_dog_photo === 1 && (
                    <p className="text-emerald-600/80 text-xs mt-1.5 font-medium">
                      ✓ Certificate{runner.cert_count > 1 ? 's' : ''} + dog photo on file — submission complete.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Upload area */}
            {canUpload && (
              <div className="t-card border rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="t-text-primary font-semibold text-sm">
                    Vaccine Certificate
                    <span className="ml-2 t-text-muted font-normal text-xs">up to {MAX_CERTS} files</span>
                  </h3>
                  <p className="t-text-muted text-xs mt-0.5">Choose a file to upload instantly</p>
                </div>

                {/* Already uploaded summary */}
                {(runner.cert_count > 0 || runner.has_dog_photo === 1) && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-emerald-600 mb-1.5">Already on file:</p>
                    {[runner.has_cert, runner.has_cert_2, runner.has_cert_3].map((has, i) =>
                      has ? (
                        <div key={i} className="flex items-center gap-2 text-xs text-emerald-600">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          Vaccine Certificate{runner.cert_count > 1 ? ` ${i + 1}` : ''} — uploaded
                        </div>
                      ) : null
                    )}
                    {runner.has_dog_photo === 1 && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        Dog Photo — uploaded
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {Array.from({ length: certSlotsToShow }).map((_, i) => (
                    <UploadSlot key={i}
                      label={certSlotsToShow > 1 ? `Certificate ${i + 1}` : 'Choose certificate file'}
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      hasExisting={certSlotHasFile(i)}
                      slotState={certSlots[i]}
                      onFile={(f) => handleCertFile(i, f)}
                    />
                  ))}
                </div>
                <div className="pt-2 border-t t-border">
                  <h3 className="t-text-primary font-semibold text-sm mb-2">Dog Photo</h3>
                  <UploadSlot
                    label="Choose dog photo"
                    accept=".jpg,.jpeg,.png,.webp"
                    hasExisting={runner.has_dog_photo === 1}
                    slotState={dogSlot}
                    onFile={handleDogFile}
                  />
                </div>

                {/* Done button — shown when at least cert is on file */}
                {runner.cert_count > 0 && (
                  <div className="pt-2 border-t t-border">
                    <button
                      onClick={() => { setRunner(null); setCompletionVisible(false); setTicketId('') }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Done — I've finished uploading
                    </button>
                    <p className="text-xs t-text-muted text-center mt-2">
                      Tap Done when you're finished. You can return anytime to update your files.
                    </p>
                  </div>
                )}
              </div>
            )}

            {runner.submission_status === 'verified' && (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4">
                <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-emerald-600 text-sm">Your documents have been verified. No further action needed.</p>
              </div>
            )}
            {runner.submission_status === 'rejected' && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
                <p className="text-red-600 text-sm">Your submission was rejected. Please contact the event organizer.</p>
              </div>
            )}
            {bibLocked && runner.submission_status !== 'verified' && runner.submission_status !== 'rejected' && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                </svg>
                <div>
                  <p className="text-amber-600 font-semibold text-sm">Uploads locked</p>
                  <p className="text-amber-600/80 text-xs mt-0.5">
                    Bib number <strong>#{runner.bib_number}</strong> has been assigned to your ticket.
                    Document uploads are no longer accepted. Contact the event organizer if you need to make changes.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
