import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { SystemSetting, SettingKey } from '@petreg/shared'

const SETTING_LABELS: Record<Exclude<SettingKey, 'crew_link_base_url'>, { label: string; description: string }> = {
  confirmation_cc_email: { label: 'Confirmation Email BCC', description: 'BCC address for submission confirmation emails' },
  event_name:            { label: 'Event Name',            description: 'Shown in confirmation emails and the crew screen' },
}

export default function SettingsPage() {
  const { token } = useAuth()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function load() {
    const res = await api.get<SystemSetting[]>('/settings', token)
    if (res.ok) setSettings(Object.fromEntries(res.data.map((s) => [s.key, s.value])))
  }

  useEffect(() => { load() }, [])

  async function handleSave(key: string, value: string) {
    setSaving(key)
    await api.put(`/settings/${key}`, { value }, token)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
    setSaving(null)
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold t-text-primary">Settings</h1>
        <p className="text-sm t-text-muted mt-0.5">System-wide configuration</p>
      </div>
      <div className="space-y-3">
        {(Object.keys(SETTING_LABELS) as Exclude<SettingKey, 'crew_link_base_url'>[]).map((key) => {
          const meta = SETTING_LABELS[key]
          const isSaving = saving === key
          const isSaved  = saved === key
          return (
            <div key={key} className="t-card border rounded-2xl p-5">
              <label className="block text-sm font-medium t-text-primary mb-0.5">{meta.label}</label>
              <p className="text-xs t-text-muted mb-3">{meta.description}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings[key] ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                  className="t-input flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  onClick={() => handleSave(key, settings[key] ?? '')}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors min-w-[64px] ${
                    isSaved
                      ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                      : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                  }`}
                >
                  {isSaving ? '…' : isSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
