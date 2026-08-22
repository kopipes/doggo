import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { ImportResult } from '@petreg/shared'

type Backup = { name: string; row_count: number }
type ImportResultWithBackup = ImportResult & { backup_name?: string }

export default function ImportPage() {
  const { token } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResultWithBackup | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [backups, setBackups] = useState<Backup[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [restoreMsg, setRestoreMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<Backup | null>(null)

  async function loadBackups() {
    const res = await api.get<Backup[]>('/import/backups', token)
    if (res.ok) setBackups(res.data)
  }

  useEffect(() => { loadBackups() }, [])

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.upload<ImportResultWithBackup>('/import/excel', form, token)
      if (!res.ok) { setError((res as any).error); return }
      setResult(res.data)
      loadBackups()
    } catch {
      setError('Upload failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(backup: Backup) {
    setRestoring(backup.name)
    setRestoreMsg(null)
    try {
      const res = await api.post<{ restored_from: string; safety_backup: string }>(`/import/restore/${backup.name}`, {}, token)
      if (res.ok) {
        setRestoreMsg({ type: 'ok', text: `Restored from ${formatBackupName(backup.name)}. Current state saved as safety backup.` })
        loadBackups()
      } else {
        setRestoreMsg({ type: 'err', text: (res as any).error ?? 'Restore failed' })
      }
    } catch {
      setRestoreMsg({ type: 'err', text: 'Network error' })
    } finally {
      setRestoring(null)
      setConfirmRestore(null)
    }
  }

  async function handleDeleteBackup(name: string) {
    setDeleting(name)
    try {
      await api.delete(`/import/backups/${name}`, token)
      loadBackups()
    } finally {
      setDeleting(null)
    }
  }

  function formatBackupName(name: string): string {
    // runners_import_bak_2026_08_22T12_00_00_000Z → 2026-08-22 12:00:00
    const m = name.match(/bak_(\d{4})_(\d{2})_(\d{2})T(\d{2})_(\d{2})_(\d{2})/)
    if (!m) return name
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="mb-2">
        <h1 className="text-xl font-bold t-text-primary">Import Runners</h1>
        <p className="text-sm t-text-muted mt-0.5">Upload an Excel file to import participant records</p>
      </div>

      {/* Import card */}
      <div className="t-card border rounded-2xl p-6 space-y-5">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-600 dark:text-blue-300 space-y-1">
          <p className="font-medium">Expected columns</p>
          <p className="opacity-80">Ticket Code · Nama · Email · Nomor HP · Ticket Name · Ukuran Baju · Ukuran Pet Collar</p>
          <p className="opacity-60">Existing records with the same Ticket Code will be <strong>skipped</strong> — not overwritten.</p>
          <p className="opacity-60">A backup snapshot is automatically created before each import.</p>
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div
            onClick={() => document.getElementById('excel-input')?.click()}
            className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
              file ? 'border-emerald-500/40 bg-emerald-500/5' : 't-border t-bg-raised hover:border-blue-500/40 hover:bg-blue-500/5'
            }`}
          >
            <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
            <svg className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-emerald-500' : 't-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
            </svg>
            {file
              ? <p className="text-sm text-emerald-600 font-medium">{file.name}</p>
              : <><p className="text-sm t-text-secondary font-medium">Click to select Excel file</p><p className="text-xs t-text-muted mt-1">.xlsx or .xls</p></>
            }
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-sm text-red-600">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !file}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
            {loading ? 'Importing…' : 'Import'}
          </button>
        </form>

        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-emerald-600">Import complete</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Inserted', value: result.inserted, color: 'text-emerald-600' },
                { label: 'Skipped',  value: result.skipped,  color: 'text-amber-600' },
                { label: 'Errors',   value: result.errors.length, color: 'text-red-500' },
              ].map(stat => (
                <div key={stat.label} className="t-bg-raised rounded-lg px-3 py-2.5 text-center border t-border">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs t-text-muted mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            {result.backup_name && (
              <p className="text-xs t-text-muted">Backup saved: <span className="font-mono">{formatBackupName(result.backup_name)}</span></p>
            )}
            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1">Errors ({result.errors.length})</p>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-500">Row {e.row}: {e.reason}</p>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backups card */}
      <div className="t-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold t-text-primary">Import Backups</h2>
            <p className="text-xs t-text-muted mt-0.5">Restore runners data to a previous state</p>
          </div>
          <button onClick={loadBackups} className="text-xs text-blue-500 hover:text-blue-400 transition-colors">Refresh</button>
        </div>

        {restoreMsg && (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-xs ${
            restoreMsg.type === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border border-red-500/20 text-red-600'
          }`}>
            {restoreMsg.type === 'ok'
              ? <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              : <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
            }
            {restoreMsg.text}
          </div>
        )}

        {backups.length === 0 ? (
          <p className="text-xs t-text-muted text-center py-4">No backups yet. A backup is created automatically on each import.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 t-bg-raised border t-border rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium t-text-primary font-mono">{formatBackupName(b.name)}</p>
                  <p className="text-xs t-text-muted">{b.row_count} runners</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmRestore(b)}
                    disabled={!!restoring}
                    className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-50 border border-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(b.name)}
                    disabled={deleting === b.name}
                    className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 border border-red-500/20 px-2 py-1 rounded-lg transition-colors"
                  >
                    {deleting === b.name ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm restore modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="t-card border t-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
              </svg>
            </div>
            <h3 className="t-text-primary text-base font-bold text-center mb-1">Restore runners data?</h3>
            <p className="text-xs t-text-muted text-center mb-1">This will replace <strong>all current runner records</strong> with the snapshot from:</p>
            <p className="text-xs font-mono text-center text-blue-500 mb-3">{formatBackupName(confirmRestore.name)}</p>
            <p className="text-xs t-text-muted text-center mb-5">A safety backup of the current state will be saved before restoring.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRestore(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold t-text-muted border t-border hover:t-text-primary transition-colors">
                Cancel
              </button>
              <button onClick={() => handleRestore(confirmRestore)} disabled={!!restoring}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white transition-colors">
                {restoring ? 'Restoring…' : 'Yes, restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
