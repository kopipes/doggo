import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin, requireOfficial } from '../middleware/auth'
import { JwtPayload } from '@petreg/shared'
import { audit } from '../services/audit'

const BIB_MIN = 1000
const BIB_MAX = 1750

export async function bibRoutes(app: FastifyInstance) {
  // GET /api/bibs/available — returns available bib numbers in range 1000-1750
  app.get(
    '/available',
    { preHandler: requireOfficial },
    async (_req, reply) => {
      const db = getDb()
      const taken = new Set(
        (db.prepare('SELECT bib_number FROM runners WHERE bib_number IS NOT NULL').all() as any[])
          .map((r) => r.bib_number)
      )

      const available: string[] = []
      for (let n = BIB_MIN; n <= BIB_MAX; n++) {
        const bib = String(n)
        if (!taken.has(bib)) available.push(bib)
      }

      // Pick 5 random suggestions from available
      const shuffled = [...available].sort(() => Math.random() - 0.5)
      const suggestions = shuffled.slice(0, 5).sort()

      return reply.send({
        ok: true,
        data: {
          total_available: available.length,
          total_taken: taken.size,
          range: { min: BIB_MIN, max: BIB_MAX },
          suggestions,
          next: available[0] ?? null,
        },
      })
    },
  )

  // GET /api/bibs/check/:bib_number — check if a specific bib is available
  app.get<{ Params: { bib_number: string } }>(
    '/check/:bib_number',
    { preHandler: requireOfficial },
    async (req, reply) => {
      const db = getDb()
      const existing = db
        .prepare('SELECT ticket_id FROM runners WHERE bib_number = ?')
        .get(req.params.bib_number) as any
      return reply.send({ ok: true, data: { available: !existing } })
    },
  )

  // POST /api/bibs/assign — official assigns bib to runner
  app.post<{ Body: { ticket_id: string; bib_number: string } }>(
    '/assign',
    { preHandler: requireOfficial },
    async (req, reply) => {
      const { ticket_id, bib_number } = req.body
      if (!ticket_id || !bib_number) {
        return reply.code(400).send({ ok: false, error: 'ticket_id and bib_number required' })
      }
      if (!/^\d{4}$/.test(bib_number)) {
        return reply.code(400).send({ ok: false, error: 'bib_number must be exactly 4 digits' })
      }

      const db = getDb()
      const runner = db
        .prepare('SELECT id, bib_number FROM runners WHERE ticket_id = ?')
        .get(ticket_id.toUpperCase()) as any
      if (!runner) return reply.code(404).send({ ok: false, error: 'Ticket ID not found' })

      const payload = req.user as JwtPayload

      // Officials can only assign a bib if none is set yet — admin can overwrite
      if (runner.bib_number && payload.role !== 'admin') {
        return reply.code(403).send({
          ok: false,
          error: `Bib ${runner.bib_number} is already assigned. Only an admin can change it.`,
        })
      }
      const conflict = db
        .prepare('SELECT ticket_id FROM runners WHERE bib_number = ? AND id != ?')
        .get(bib_number, runner.id) as any
      if (conflict) {
        return reply
          .code(409)
          .send({ ok: false, error: `Bib ${bib_number} already assigned to ticket ${conflict.ticket_id}` })
      }

      db.prepare(
        `UPDATE runners SET bib_number = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(bib_number, runner.id)

      audit(payload.sub, payload.role, 'assign_bib', 'runners', runner.id, `bib=${bib_number}`)

      return reply.send({ ok: true, data: { ticket_id, bib_number } })
    },
  )

  // DELETE /api/bibs/:bib_number — admin only (officials cannot unassign)
  app.delete<{ Params: { bib_number: string } }>(
    '/:bib_number',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      const runner = db
        .prepare('SELECT id FROM runners WHERE bib_number = ?')
        .get(req.params.bib_number) as any
      if (!runner) return reply.code(404).send({ ok: false, error: 'Bib not found' })

      db.prepare(`UPDATE runners SET bib_number = NULL, updated_at = datetime('now') WHERE id = ?`).run(
        runner.id,
      )

      // If all files are also gone, reset status back to pending
      const updated = db.prepare(
        'SELECT cert_file_key, cert_file_key_2, cert_file_key_3, dog_photo_key FROM runners WHERE id = ?'
      ).get(runner.id) as any
      const hasFiles = updated.cert_file_key || updated.cert_file_key_2 || updated.cert_file_key_3 || updated.dog_photo_key
      if (!hasFiles) {
        db.prepare(`UPDATE runners SET submission_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(runner.id)
      }

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'unassign_bib', 'runners', runner.id, `bib=${req.params.bib_number}`)

      return reply.send({ ok: true, data: null })
    },
  )
}
