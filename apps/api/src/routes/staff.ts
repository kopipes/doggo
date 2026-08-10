import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { getDb } from '../db/database'
import { requireAdmin } from '../middleware/auth'
import { JwtPayload } from '@dogreg/shared'
import { audit } from '../services/audit'

const MIN_PASSWORD_LENGTH = 8

export async function staffRoutes(app: FastifyInstance) {
  // GET /api/staff — list all staff accounts
  app.get('/', { preHandler: requireAdmin }, async (_req, reply) => {
    const db = getDb()
    const accounts = db
      .prepare('SELECT id, username, email, role, created_at FROM staff_accounts')
      .all()
    return reply.send({ ok: true, data: accounts })
  })

  // POST /api/staff — create staff account
  app.post<{ Body: { username: string; email: string; password: string; role: 'admin' | 'official' } }>(
    '/',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { username, email, password, role } = req.body
      if (!username || !email || !password || !role) {
        return reply.code(400).send({ ok: false, error: 'username, email, password, role required' })
      }
      if (!['admin', 'official'].includes(role)) {
        return reply.code(400).send({ ok: false, error: 'role must be admin or official' })
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
      }

      const db = getDb()
      const existing = db.prepare('SELECT id FROM staff_accounts WHERE username = ?').get(username)
      if (existing) return reply.code(409).send({ ok: false, error: 'Username already exists' })

      const hash = await bcrypt.hash(password, 12)
      const result = db
        .prepare('INSERT INTO staff_accounts(username, email, password_hash, role) VALUES (?,?,?,?)')
        .run(username, email, hash, role)

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'create_staff', 'staff_accounts', Number(result.lastInsertRowid), `role=${role}`)

      return reply.code(201).send({
        ok: true,
        data: { id: Number(result.lastInsertRowid), username, email, role },
      })
    },
  )

  // PATCH /api/staff/:id — update email, role, and/or password
  app.patch<{ Params: { id: string }; Body: { email?: string; role?: string; password?: string } }>(
    '/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { email, role, password } = req.body
      if (role && !['admin', 'official'].includes(role)) {
        return reply.code(400).send({ ok: false, error: 'role must be admin or official' })
      }
      if (password && password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
      }

      const db = getDb()
      const existing = db.prepare('SELECT id FROM staff_accounts WHERE id = ?').get(Number(req.params.id))
      if (!existing) return reply.code(404).send({ ok: false, error: 'Staff account not found' })

      const updates: string[] = []
      const vals: any[] = []
      if (email) { updates.push('email = ?'); vals.push(email) }
      if (role)  { updates.push('role = ?');  vals.push(role) }
      if (password) {
        const hash = await bcrypt.hash(password, 12)
        updates.push('password_hash = ?')
        vals.push(hash)
      }
      if (!updates.length) return reply.code(400).send({ ok: false, error: 'Nothing to update' })

      db.prepare(`UPDATE staff_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...vals, Number(req.params.id))

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'update_staff', 'staff_accounts', req.params.id,
        `changed=${[email && 'email', role && 'role', password && 'password'].filter(Boolean).join(',')}`)

      const updated = db.prepare('SELECT id, username, email, role, created_at FROM staff_accounts WHERE id = ?').get(Number(req.params.id))
      return reply.send({ ok: true, data: updated })
    },
  )

  // DELETE /api/staff/:id
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      db.prepare('DELETE FROM staff_accounts WHERE id = ?').run(Number(req.params.id))
      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'delete_staff', 'staff_accounts', req.params.id)
      return reply.send({ ok: true, data: null })
    },
  )

  // GET /api/staff/crew-tokens — list crew tokens
  app.get('/crew-tokens', { preHandler: requireAdmin }, async (_req, reply) => {
    const db = getDb()
    const tokens = db.prepare('SELECT id, token, label, active, created_at FROM crew_tokens').all()
    return reply.send({ ok: true, data: tokens })
  })

  // POST /api/staff/crew-tokens — generate new crew token
  app.post<{ Body: { label?: string } }>(
    '/crew-tokens',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      const token = randomUUID().replace(/-/g, '')
      const label = req.body?.label ?? ''
      const result = db
        .prepare('INSERT INTO crew_tokens(token, label) VALUES (?,?)')
        .run(token, label)

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'create_crew_token', 'crew_tokens', Number(result.lastInsertRowid), `label=${label}`)

      // Build the crew URL
      const settings = db
        .prepare("SELECT value FROM system_settings WHERE key='crew_link_base_url'")
        .get() as any
      const base = (settings?.value ?? 'http://localhost:5173/crew').replace(/\/$/, '')
      const crewUrl = `${base}?token=${encodeURIComponent(token)}`

      return reply.code(201).send({ ok: true, data: { token, crewUrl, label } })
    },
  )

  // DELETE /api/staff/crew-tokens/:id — revoke crew token
  app.delete<{ Params: { id: string } }>(
    '/crew-tokens/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      db.prepare('UPDATE crew_tokens SET active = 0 WHERE id = ?').run(Number(req.params.id))
      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'revoke_crew_token', 'crew_tokens', req.params.id)
      return reply.send({ ok: true, data: null })
    },
  )
}
