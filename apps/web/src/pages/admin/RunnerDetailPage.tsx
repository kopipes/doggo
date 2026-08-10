import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { Runner } from '@dogreg/shared'
import MediaModal from '../../components/MediaModal'

const STATUS_OPTIONS = ['pending', 'submitted', 'verified', 'rejected']

const STATUS_BADGE: Record<string, string> = {
  pending:   't-badge-pending',
  submitted: 't-badge-submitted',
  verified:  't-badge-verified',
  rejected:  't-badge-rejected',
}

interface MediaItem {
  url: string
  label: string
}

// Thumbnail: renders image preview or a PDF icon
function Thumbnail({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const isImage = /\.(jpe?g|png|webp)(\?|$)/i.test(item.url)
  return (
    <button
      onClick={onClick}
      className="relative group w-24 h-24 rounded-xl overflow-hidden border t-border hover:border-blue-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 shrink-0"
      title={item.label}
    >
      {isImage ? (
        <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full t-bg-raised flex flex-col items-center justify-center gap-1">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          <span className="text-xs t-text-muted">PDF</span>
        </div>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"/>
        </svg>
      </div>
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1 text-center">
        <p className="text-white text-[10px] truncate">{item.label}</p>
      </div>
    </button>
  )
}

export default function RunnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [runner, setRunner] = useState<Runner | null>(null)
  const [form, setForm] = useState<Partial<Runner>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [modalItem, setModalItem] = useState<MediaItem | null>(null)

  // Bib assignment state (officials + admins)
  const [bibInput, setBibInput] = useState('')
  const [bibMsg, setBibMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [bibSaving, setBibSaving] = useState(false)

  async function load() {
    const res = await api.get<Runner>(`/runners/${id}`, token)
    if (!res.ok) { setError(res.error); return }
    setRunner(res.data)
    setForm({
      first_name: res.data.first_name,
      last_name: res.data.last_name,
      email: res.data.email,
      phone: res.data.phone ?? '',
      submission_status: res.data.submission_status,
      notes: res.data.notes ?? '',
    })
    setBibInput(res.data.bib_number ?? '')

    // Resolve file URLs
    const keys = [
      { key: res.data.cert_file_key,   label: 'Vaccine Certificate' + (res.data.cert_file_key_2 ? ' 1' : '') },
      { key: res.data.cert_file_key_2, label: 'Vaccine Certificate 2' },
      { key: res.data.cert_file_key_3, label: 'Vaccine Certificate 3' },
      { key: res.data.dog_photo_key,   label: 'Dog Photo' },
    ]
    const items: MediaItem[] = []
    for (const { key, label } of keys) {
      if (!key) continue
      const r = await api.get<{ url: string }>(`/files/url/${key}`, token)
      if (r.ok) items.push({ url: r.data.url, label })
    }
    setMediaItems(items)
  }

  useEffect(() => { load() }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await api.patch(`/runners/${id}`, form, token)
    if (!res.ok) { setError((res as any).error); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    load()
  }

  async function handleBibAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!runner) return
    setBibMsg(null)
    setBibSaving(true)
    const res = await api.post('/bibs/assign', {
      ticket_id: runner.ticket_id,
      bib_number: bibInput,
    }, token)
    if (!res.ok) {
      setBibMsg({ type: 'err', text: (res as any).error })
    } else {
      setBibMsg({ type: 'ok', text: `Bib ${bibInput} assigned` })
      load()
    }
    setBibSaving(false)
  }

  if (!runner) return (
    <div className="flex items-center justify-center py-24">
      {error
        ? <p className="text-red-500 text-sm">{error}</p>
        : <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
      }
    </div>
  )

  return (
    <>
      {/* Modal */}
      {modalItem && (
        <MediaModal url={modalItem.url} label={modalItem.label} onClose={() => setModalItem(null)} />
      )}

      <div className="max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/runners')} className="t-text-muted hover:t-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold t-text-primary">{runner.first_name} {runner.last_name}</h1>
            <p className="text-xs t-text-muted font-mono">{runner.ticket_id}</p>
          </div>
          <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[runner.submission_status]}`}>
            {runner.submission_status}
          </span>
        </div>

        {/* Read-only info */}
        <div className="t-card border rounded-2xl p-5 grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Ticket Type', value: runner.ticket_name },
            { label: 'Shirt Size',  value: runner.shirt_size },
            { label: 'Collar Size', value: runner.collar_size },
            { label: 'Email',       value: runner.email },
            { label: 'Phone',       value: runner.phone },
            { label: 'Updated',     value: new Date(runner.updated_at).toLocaleDateString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs t-text-muted uppercase tracking-wide mb-0.5">{label}</dt>
              <dd className="t-text-primary font-medium">{value ?? '—'}</dd>
            </div>
          ))}
        </div>

        {/* Bib Assignment — officials and admins */}
        <div className="t-card border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold t-text-primary">Bib Number</h2>
            {runner.bib_number && (
              <span className="font-mono text-2xl font-bold text-blue-500">#{runner.bib_number}</span>
            )}
          </div>
          {bibMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-sm ${
              bibMsg.type === 'ok'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                : 'bg-red-500/10 border border-red-500/20 text-red-600'
            }`}>
              {bibMsg.type === 'ok'
                ? <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                : <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
              }
              {bibMsg.text}
            </div>
          )}
          <form onSubmit={handleBibAssign} className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={bibInput}
              onChange={e => setBibInput(e.target.value.replace(/\D/g, ''))}
              placeholder="0001"
              className="t-input flex-1 border rounded-xl px-4 py-2.5 text-xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              type="submit"
              disabled={bibSaving || bibInput.length !== 4}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {bibSaving ? '…' : runner.bib_number ? 'Update' : 'Assign'}
            </button>
          </form>
          <p className="text-xs t-text-muted mt-2">Enter exactly 4 digits. Each bib number must be unique.</p>
        </div>

        {/* Documents with thumbnails */}
        <div className="t-card border rounded-2xl p-5">
          <h2 className="text-sm font-semibold t-text-primary mb-4">Documents</h2>
          {mediaItems.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {mediaItems.map((item, i) => (
                <Thumbnail key={i} item={item} onClick={() => setModalItem(item)} />
              ))}
            </div>
          ) : (
            <p className="text-sm t-text-muted">No documents uploaded yet</p>
          )}
        </div>

        {/* Edit form — admin only */}
        {isAdmin && (
          <div className="t-card border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold t-text-primary">Edit Details</h2>
              {runner.bib_number && (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                  Bib assigned — admin override
                </span>
              )}
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: 'first_name', label: 'First Name' },
                  { field: 'last_name',  label: 'Last Name' },
                  { field: 'email',      label: 'Email' },
                  { field: 'phone',      label: 'Phone' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-xs t-text-muted uppercase tracking-wide mb-1">{label}</label>
                    <input
                      type="text"
                      value={(form as any)[field] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="t-input w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs t-text-muted uppercase tracking-wide mb-1">Status</label>
                <select
                  value={form.submission_status ?? runner.submission_status}
                  onChange={e => setForm(f => ({ ...f, submission_status: e.target.value as any }))}
                  className="t-select w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs t-text-muted uppercase tracking-wide mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="t-input w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  saved
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                }`}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}
