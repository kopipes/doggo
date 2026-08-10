import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin, requireOfficial } from '../middleware/auth'
import { JwtPayload } from '@petreg/shared'
import { audit } from '../services/audit'

export async function bibRoutes(app: FastifyInstance) {
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

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'unassign_bib', 'runners', runner.id, `bib=${req.params.bib_number}`)

      return reply.send({ ok: true, data: null })
    },
  )
}
