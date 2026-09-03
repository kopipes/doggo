import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin, requireOfficial } from '../middleware/auth'
import { JwtPayload } from '@petreg/shared'
import { audit } from '../services/audit'

const MAX_LIMIT = 200

export async function runnerRoutes(app: FastifyInstance) {
  // GET /api/runners — staff: list all runners
  app.get('/', { preHandler: requireOfficial }, async (req, reply) => {
    const db = getDb()
    const { q, status, page = '1', limit: limitStr = '50' } = req.query as Record<string, string>
    const limit = Math.min(Math.max(1, Number(limitStr)), MAX_LIMIT)
    const offset = (Math.max(1, Number(page)) - 1) * limit

    let where = 'WHERE 1=1'
    const params: any[] = []

    if (q) {
      where += ` AND (ticket_id LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`
      const like = `%${q}%`
      params.push(like, like, like, like)
    }
    if (status === 'checked_in') {
      where += ` AND checked_in = 1`
    } else if (status === 'no_photo') {
      where += ` AND dog_photo_key IS NULL`
    } else if (status === 'no_cert') {
      where += ` AND cert_file_key IS NULL AND cert_file_key_2 IS NULL AND cert_file_key_3 IS NULL`
    } else if (status) {
      where += ` AND submission_status = ?`
      params.push(status)
    }

    const runners = db.prepare(
      `SELECT id, ticket_id, first_name, last_name, email, bib_number, submission_status,
              ticket_name, shirt_size, collar_size, checked_in, checked_in_at, uploads_locked,
              CASE WHEN cert_file_key IS NOT NULL OR cert_file_key_2 IS NOT NULL OR cert_file_key_3 IS NOT NULL THEN 1 ELSE 0 END as has_cert,
              CASE WHEN dog_photo_key IS NOT NULL THEN 1 ELSE 0 END as has_dog_photo
       FROM runners ${where}
       ORDER BY last_name, first_name LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset)

    // Count uses same WHERE clause so totals match the active filter
    const total = (db.prepare(`SELECT COUNT(*) as n FROM runners ${where}`).get(...params) as any).n

    return reply.send({ ok: true, data: { runners, total } })
  })

  // GET /api/runners/by-ticket/:ticketId — user self-service lookup
  // Returns only fields the user needs; does NOT expose internal file keys
  app.get<{ Params: { ticketId: string } }>(
    '/by-ticket/:ticketId',
    async (req, reply) => {
      const db = getDb()
      const runner = db
        .prepare(
          `SELECT id, ticket_id, first_name, last_name, email, phone,
                  bib_number, submission_status, notes, uploads_locked,
                  (cert_file_key IS NOT NULL) as has_cert,
                  (cert_file_key_2 IS NOT NULL) as has_cert_2,
                  (cert_file_key_3 IS NOT NULL) as has_cert_3,
                  (dog_photo_key IS NOT NULL) as has_dog_photo
           FROM runners WHERE ticket_id = ?`,
        )
        .get(req.params.ticketId.toUpperCase()) as any
      if (!runner) return reply.code(404).send({ ok: false, error: 'Ticket ID not found' })
      // Total cert count for convenience
      runner.cert_count = (runner.has_cert + runner.has_cert_2 + runner.has_cert_3)
      return reply.send({ ok: true, data: runner })
    },
  )

  // GET /api/runners/:id — staff full profile
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireOfficial },
    async (req, reply) => {
      const db = getDb()
      const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(Number(req.params.id)) as any
      if (!runner) return reply.code(404).send({ ok: false, error: 'Runner not found' })
      return reply.send({ ok: true, data: runner })
    },
  )

  // PATCH /api/runners/:id — admin edits any field; officials blocked if bib is set
  app.patch<{ Params: { id: string }; Body: Record<string, any> }>(
    '/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      const existing = db.prepare('SELECT bib_number FROM runners WHERE id = ?').get(Number(req.params.id)) as any
      if (!existing) return reply.code(404).send({ ok: false, error: 'Runner not found' })
      const allowed = ['first_name', 'last_name', 'email', 'phone', 'submission_status', 'notes', 'uploads_locked']
      const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
      if (!updates.length) return reply.code(400).send({ ok: false, error: 'No valid fields' })

      const set = updates.map(([k]) => `${k} = ?`).join(', ')
      const vals = updates.map(([, v]) => v)
      db.prepare(`UPDATE runners SET ${set}, updated_at = datetime('now') WHERE id = ?`).run(
        ...vals,
        Number(req.params.id),
      )

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'update', 'runners', req.params.id, JSON.stringify(req.body))

      const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(Number(req.params.id))
      return reply.send({ ok: true, data: runner })
    },
  )

  // POST /api/runners/lock-bulk — admin locks uploads for selected runner IDs
  app.post<{ Body: { ids: number[]; locked: boolean } }>(
    '/lock-bulk',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { ids, locked } = req.body
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.code(400).send({ ok: false, error: 'ids array required' })
      }
      const db = getDb()
      const placeholders = ids.map(() => '?').join(',')
      db.prepare(
        `UPDATE runners SET uploads_locked = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      ).run(locked ? 1 : 0, ...ids)
      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, locked ? 'bulk_lock' : 'bulk_unlock', 'runners', 'bulk', `ids=${ids.join(',')}`)
      return reply.send({ ok: true, data: { updated: ids.length, locked } })
    },
  )

  // DELETE /api/runners/:id — admin only
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      db.prepare('DELETE FROM runners WHERE id = ?').run(Number(req.params.id))
      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'delete', 'runners', req.params.id)
      return reply.send({ ok: true, data: null })
    },
  )
}
