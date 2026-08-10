import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { ImportResult } from '@dogreg/shared'

export default function ImportPage() {
  const { token } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.upload<ImportResult>('/import/excel', form, token)
      if (!res.ok) { setError((res as any).error); return }
      setResult(res.data)
    } catch {
      setError('Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold t-text-primary">Import Runners</h1>
        <p className="text-sm t-text-muted mt-0.5">Upload an Excel file to import or update participant records</p>
      </div>

      <div className="t-card border rounded-2xl p-6 space-y-5">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-600 dark:text-blue-300 space-y-1">
          <p className="font-medium">Expected columns</p>
          <p className="opacity-80">Ticket Code · Nama · Email · Nomor HP · Ticket Name · Ukuran Baju · Ukuran Pet Collar</p>
          <p className="opacity-60">Existing records with the same Ticket Code will be updated.</p>
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div
            onClick={() => document.getElementById('excel-input')?.click()}
            className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
              file
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 't-border t-bg-raised hover:border-blue-500/40 hover:bg-blue-500/5'
            }`}
          >
            <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
            <svg className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-emerald-500' : 't-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
            </svg>
            {file
              ? <p className="text-sm text-emerald-600 font-medium">{file.name}</p>
              : <>
                  <p className="text-sm t-text-secondary font-medium">Click to select Excel file</p>
                  <p className="text-xs t-text-muted mt-1">.xlsx or .xls</p>
                </>
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
                { label: 'Updated',  value: result.updated,  color: 'text-blue-600' },
                { label: 'Skipped',  value: result.skipped,  color: 'text-amber-600' },
              ].map(stat => (
                <div key={stat.label} className="t-bg-raised rounded-lg px-3 py-2.5 text-center border t-border">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs t-text-muted mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
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
    </div>
  )
}
