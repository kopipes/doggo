import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'

type Stats = {
  total: number
  pending: number
  submitted: number
  verified: number
  rejected: number
  bib_assigned: number
  checked_in: number
}

function StatCard({ label, value, color, icon }: {
  label: string
  value: number
  color: string
  icon: React.ReactNode
}) {
  return (
    <div className="t-card border t-border rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold t-text-primary">{value.toLocaleString()}</p>
        <p className="text-xs t-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { token, account } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await api.get<Stats>('/stats', token)
    if (res.ok) setStats(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const submitRate = stats && stats.total > 0
    ? Math.round((stats.submitted + stats.verified) / stats.total * 100)
    : 0

  const verifyRate = stats && stats.total > 0
    ? Math.round(stats.checked_in / stats.total * 100)
    : 0

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold t-text-primary">Dashboard</h1>
        <p className="text-sm t-text-muted mt-0.5">
          Selamat datang, <span className="t-text-primary font-medium">{account?.username}</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* Main stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Total Peserta"
              value={stats.total}
              color="bg-blue-500/15"
              icon={<svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.75 3.75 0 11-6.75 0 3.75 3.75 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>}
            />
            <StatCard
              label="Total Submit"
              value={stats.submitted}
              color="bg-amber-500/15"
              icon={<svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>}
            />
            <StatCard
              label="Total Check-In"
              value={stats.checked_in}
              color="bg-emerald-500/15"
              icon={<svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Pending"
              value={stats.pending}
              color="bg-gray-500/15"
              icon={<svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              color="bg-red-500/15"
              icon={<svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <StatCard
              label="Bib Assigned"
              value={stats.bib_assigned}
              color="bg-purple-500/15"
              icon={<svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z"/><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z"/></svg>}
            />
          </div>

          {/* Progress bars */}
          <div className="t-card border t-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold t-text-primary">Progress</h2>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="t-text-muted">Submit Rate</span>
                <span className="t-text-primary font-medium">{submitRate}%</span>
              </div>
              <div className="h-2 t-bg-raised rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${submitRate}%` }}/>
              </div>
              <p className="text-xs t-text-muted mt-1">{stats.submitted + stats.verified} dari {stats.total} peserta telah submit</p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="t-text-muted">Verification Rate</span>
                <span className="t-text-primary font-medium">{verifyRate}%</span>
              </div>
              <div className="h-2 t-bg-raised rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${verifyRate}%` }}/>
              </div>
              <p className="text-xs t-text-muted mt-1">{stats.checked_in} dari {stats.total} peserta telah check-in</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={load} className="text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-500">Gagal memuat data.</p>
      )}
    </div>
  )
}
