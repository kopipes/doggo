// ─── Roles ───────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'official' | 'crew' | 'user'

// ─── Runner ──────────────────────────────────────────────────────────────────

export type SubmissionStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

export interface Runner {
  id: number
  ticket_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  bib_number: string | null
  cert_file_key: string | null
  cert_file_key_2: string | null
  cert_file_key_3: string | null
  dog_photo_key: string | null
  submission_status: SubmissionStatus
  ticket_name: string | null
  shirt_size: string | null
  collar_size: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type RunnerSummary = Pick<
  Runner,
  | 'id'
  | 'ticket_id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'bib_number'
  | 'submission_status'
  | 'ticket_name'
  | 'shirt_size'
  | 'collar_size'
>

// ─── Staff accounts ──────────────────────────────────────────────────────────

export interface StaffAccount {
  id: number
  username: string
  email: string
  role: 'admin' | 'official'
  created_at: string
}

// ─── Crew token ──────────────────────────────────────────────────────────────

export interface CrewToken {
  id: number
  token: string
  label: string
  active: boolean
  created_at: string
}

// ─── System settings ─────────────────────────────────────────────────────────

export interface SystemSetting {
  key: string
  value: string
}

// Known setting keys
export type SettingKey =
  | 'confirmation_cc_email'
  | 'event_name'
  | 'crew_link_base_url'

// ─── API response shapes ─────────────────────────────────────────────────────

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code?: string
}

export type ApiResult<T> = ApiOk<T> | ApiError

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: number       // staff account id
  username: string
  role: 'admin' | 'official'
}

export interface LoginResponse {
  token: string
  account: StaffAccount
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number
  actor_id: number | null
  actor_role: Role | null
  action: string
  entity: string
  entity_id: string
  detail: string | null
  created_at: string
}

// ─── Import result ───────────────────────────────────────────────────────────

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: { row: number; reason: string }[]
}
