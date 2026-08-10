import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { StaffAccount, CrewToken } from '@petreg/shared'

interface EditForm {
  email: string
  role: 'admin' | 'official'
  password: string
}

export default function StaffPage() {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState<StaffAccount[]>([])
  const [crewTokens, setCrewTokens] = useState<CrewToken[]>([])
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'official' as 'admin' | 'official' })
  const [createError, setCreateError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [tokenLabel, setTokenLabel] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ email: '', role: 'official', password: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editSaved, setEditSaved] = useState(false)

  async function loadAccounts() {
    const res = await api.get<StaffAccount[]>('/staff', token)
    if (res.ok) setAccounts(res.data)
  }

  async function loadTokens() {
    const res = await api.get<CrewToken[]>('/staff/crew-tokens', token)
    if (res.ok) setCrewTokens(res.data)
  }

  useEffect(() => { loadAccounts(); loadTokens() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setLoading(true)
    const res = await api.post('/staff', form, token)
    if (!res.ok) { setCreateError((res as any).error) }
    else { setForm({ username: '', email: '', password: '', role: 'official' }); setShowForm(false); loadAccounts() }
    setLoading(false)
  }

  function startEdit(a: StaffAccount) {
    setEditingId(a.id)
    setEditForm({ email: a.email, role: a.role, password: '' })
    setEditError('')
    setEditSaved(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent, id: number) {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    const body: Record<string, string> = { email: editForm.email, role: editForm.role }
    if (editForm.password) body.password = editForm.password
    const res = await api.patch(`/staff/${id}`, body, token)
    if (!res.ok) {
      setEditError((res as any).error)
    } else {
      setEditSaved(true)
      setTimeout(() => { setEditingId(null); setEditSaved(false) }, 1200)
      loadAccounts()
    }
    setEditSaving(false)
  }

  async function handleDeleteAccount(id: number) {
    if (!confirm('Remove this staff account?')) return
    await api.delete(`/staff/${id}`, token)
    if (editingId === id) setEditingId(null)
    loadAccounts()
  }

  async function handleGenerateToken() {
    const res = await api.post<{ token: string; crewUrl: string; label: string }>(
      '/staff/crew-tokens', { label: tokenLabel }, token
    )
    if (res.ok) { setTokenLabel(''); loadTokens() }
  }

  async function handleRevokeToken(id: number) {
    if (!confirm('Revoke this crew link?')) return
    await api.delete(`/staff/crew-tokens/${id}`, token)
    loadTokens()
  }

  function copyUrl(url: string, id: number) {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function crewUrl(t: string) {
    return `${window.location.origin}/crew?token=${t}`
  }

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Staff Accounts ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold t-text-primary">Staff Accounts</h1>
            <p className="text-sm t-text-muted mt-0.5">{accounts.length} accounts</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setCreateError('') }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Add Account
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="t-card border rounded-2xl p-5">
            <h3 className="text-sm font-semibold t-text-primary mb-4">New Staff Account</h3>
            {createError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4 text-sm text-red-600">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: 'username', label: 'Username', type: 'text' },
                  { field: 'email',    label: 'Email',    type: 'email' },
                  { field: 'password', label: 'Password (min 8 chars)', type: 'password' },
                ].map(({ field, label, type }) => (
                  <div key={field} className={field === 'password' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-1.5">{label}</label>
                    <input type={type} required value={(form as any)[field]}
                      onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="t-input w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium t-text-muted uppercase tracking-wide mb-1.5">Role</label>
                  <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value as any }))}
                    className="t-select w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    <option value="official">Official</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border t-border t-text-secondary hover:t-text-primary py-2 rounded-xl text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {loading ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Accounts list */}
        <div className="t-card border rounded-2xl overflow-hidden">
          {accounts.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm t-text-muted">No staff accounts</div>
          ) : (
            <div className="divide-y t-table-divider">
              {accounts.map((a) => (
                <div key={a.id}>
                  {/* Account row */}
                  <div className="flex items-center gap-3 px-5 py-3 t-table-row transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-500 uppercase">{a.username[0]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium t-text-primary">{a.username}</p>
                      <p className="text-xs t-text-muted">{a.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                      a.role === 'admin'
                        ? 'bg-purple-500/15 text-purple-600 border-purple-500/20'
                        : 'bg-gray-500/10 t-text-secondary border-gray-500/20'
                    }`}>{a.role}</span>
                    {/* Edit button */}
                    <button
                      onClick={() => editingId === a.id ? cancelEdit() : startEdit(a)}
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        editingId === a.id
                          ? 'bg-blue-500/15 text-blue-500'
                          : 't-text-muted hover:text-blue-500 hover:bg-blue-500/10'
                      }`}
                      title="Edit account"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/>
                      </svg>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteAccount(a.id)}
                      className="shrink-0 p-1.5 rounded-lg t-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove account"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                      </svg>
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {editingId === a.id && (
                    <div className="px-5 py-4 t-bg-raised border-t t-border">
                      <p className="text-xs font-semibold t-text-muted uppercase tracking-wide mb-3">Edit Account</p>
                      {editError && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3 text-sm text-red-600">
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
                          {editError}
                        </div>
                      )}
                      <form onSubmit={e => handleEdit(e, a.id)} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs t-text-muted uppercase tracking-wide mb-1">Email</label>
                            <input
                              type="email" required
                              value={editForm.email}
                              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                              className="t-input w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </div>
                          <div>
                            <label className="block text-xs t-text-muted uppercase tracking-wide mb-1">Role</label>
                            <select
                              value={editForm.role}
                              onChange={e => setEditForm(f => ({ ...f, role: e.target.value as any }))}
                              className="t-select w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            >
                              <option value="official">Official</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs t-text-muted uppercase tracking-wide mb-1">
                              New Password <span className="normal-case font-normal">(leave blank to keep current)</span>
                            </label>
                            <input
                              type="password"
                              value={editForm.password}
                              onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                              placeholder="Min 8 characters"
                              className="t-input w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={cancelEdit}
                            className="flex-1 border t-border t-text-secondary hover:t-text-primary py-2 rounded-xl text-sm transition-colors">
                            Cancel
                          </button>
                          <button type="submit" disabled={editSaving}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                              editSaved
                                ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                            }`}>
                            {editSaving ? 'Saving…' : editSaved ? '✓ Saved' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Crew Links ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold t-text-primary">Crew Verification Links</h2>
          <p className="text-sm t-text-muted mt-0.5">Shareable links for race-day crew to look up runners by bib — no login required</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Label (e.g. Gate A crew)"
            value={tokenLabel}
            onChange={e => setTokenLabel(e.target.value)}
            className="t-input flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button onClick={handleGenerateToken}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
            </svg>
            Generate Link
          </button>
        </div>

        <div className="space-y-2">
          {crewTokens.length === 0 && (
            <div className="t-card border rounded-2xl px-5 py-8 text-center text-sm t-text-muted">
              No crew links generated yet
            </div>
          )}
          {crewTokens.map(t => (
            <div key={t.id} className={`t-card border rounded-xl px-4 py-3 flex items-center gap-3 ${!t.active ? 'opacity-50' : ''}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${t.active ? 'bg-emerald-500' : 'bg-gray-400'}`}/>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium t-text-primary truncate">{t.label || 'Unlabeled link'}</p>
                <p className="text-xs t-text-muted font-mono truncate">{crewUrl(t.token)}</p>
              </div>
              {t.active && (
                <button
                  onClick={() => copyUrl(crewUrl(t.token), t.id)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    copiedId === t.id
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-600'
                      : 't-border t-text-secondary hover:t-text-primary t-nav-hover'
                  }`}
                >
                  {copiedId === t.id ? '✓ Copied' : 'Copy'}
                </button>
              )}
              {t.active && (
                <button onClick={() => handleRevokeToken(t.id)} className="shrink-0 t-text-muted hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
