import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'

type ScanResult = { count: number; keys: string[] }
type PurgeResult = { deleted: number; failed: string[] }

export default function StoragePage() {
  const { token } = useAuth()

  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState('')

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purge, setPurge] = useState<PurgeResult | null>(null)
  const [purgeError, setPurgeError] = useState('')

  async function handleScan() {
    setScanning(true)
    setScan(null)
    setScanError('')
    setPurge(null)
    setConfirmVisible(false)
    try {
      const res = await api.get<ScanResult>('/files/orphans', token)
      if (res.ok) setScan(res.data)
      else setScanError((res as any).error ?? 'Scan failed')
    } catch {
      setScanError('Network error — please try again')
    } finally {
      setScanning(false)
    }
  }

  async function handlePurge() {
    setPurging(true)
    setPurgeError('')
    setConfirmVisible(false)
    try {
      const res = await api.delete<PurgeResult>('/files/orphans', token)
      if (res.ok) { setPurge(res.data); setScan(null) }
      else setPurgeError((res as any).error ?? 'Purge failed')
    } catch {
      setPurgeError('Network error — please try again')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold t-text-primary">Storage</h1>
        <p className="text-sm t-text-muted mt-0.5">Scan and clean up orphaned files to free disk space</p>
      </div>

      {/* Info card */}
      <div className="t-card border t-border rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium t-text-primary mb-1">What are orphaned files?</p>
            <p className="text-xs t-text-muted leading-relaxed">
              Orphaned files are images or PDFs stored on disk that are no longer referenced by any runner record — typically left behind when a user replaced a certificate or photo. They are safe to delete.
            </p>
          </div>
        </div>
      </div>

      {/* Scan section */}
      <div className="t-card border t-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium t-text-primary">Scan for orphaned files</p>
            <p className="text-xs t-text-muted mt-0.5">Check how many files can be cleaned up</p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            {scanning ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Scanning…
              </>
            ) : 'Scan'}
          </button>
        </div>

        {scanError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-600">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
            {scanError}
          </div>
        )}

        {scan && (
          <div className={`rounded-xl px-4 py-3 border ${scan.count === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            <div className="flex items-center gap-2 mb-1">
              {scan.count === 0 ? (
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ) : (
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
              )}
              <p className={`text-sm font-semibold ${scan.count === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {scan.count === 0 ? 'No orphaned files found' : `${scan.count} orphaned file${scan.count !== 1 ? 's' : ''} found`}
              </p>
            </div>
            {scan.count > 0 && (
              <>
                <p className="text-xs text-amber-600/80 mb-3">These files are not referenced by any runner and can be safely deleted.</p>
                <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                  {scan.keys.map(k => (
                    <p key={k} className="font-mono text-xs text-amber-700 bg-amber-500/10 rounded px-2 py-0.5 truncate">{k}</p>
                  ))}
                </div>
                <button
                  onClick={() => setConfirmVisible(true)}
                  className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  Delete {scan.count} orphaned file{scan.count !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Purge result */}
      {purge && (
        <div className={`t-card border rounded-2xl p-5 mb-4 ${purge.failed.length > 0 ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
          <div className="flex items-center gap-2 mb-1">
            <svg className={`w-4 h-4 shrink-0 ${purge.failed.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className={`text-sm font-semibold ${purge.failed.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {purge.deleted} file{purge.deleted !== 1 ? 's' : ''} deleted
              {purge.failed.length > 0 ? `, ${purge.failed.length} failed` : ''}
            </p>
          </div>
          {purge.failed.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-amber-600/80">Failed to delete:</p>
              {purge.failed.map(k => (
                <p key={k} className="font-mono text-xs text-amber-700 bg-amber-500/10 rounded px-2 py-0.5 truncate">{k}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {purgeError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-600 mb-4">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
          {purgeError}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmVisible && scan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="t-card border t-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
              </svg>
            </div>
            <h3 className="t-text-primary text-base font-bold text-center mb-1">Delete {scan.count} orphaned file{scan.count !== 1 ? 's' : ''}?</h3>
            <p className="text-xs t-text-muted text-center mb-5">This action cannot be undone. These files are not referenced by any runner and will be permanently deleted from storage.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmVisible(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold t-text-muted border t-border hover:t-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={purging}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
              >
                {purging ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
