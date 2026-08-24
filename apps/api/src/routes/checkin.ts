import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireOfficial } from '../middleware/auth'
import { JwtPayload } from '@petreg/shared'
import { audit } from '../services/audit'

export async function checkinRoutes(app: FastifyInstance) {
  // GET /api/checkin/lookup?bib=1234 — staff only, look up runner by bib
  app.get<{ Querystring: { bib: string } }>(
    '/lookup',
    { preHandler: requireOfficial },
    async (req, reply) => {
      const { bib } = req.query
      if (!bib || !/^\d{4}$/.test(bib)) {
        return reply.code(400).send({ ok: false, error: 'bib must be 4 digits' })
      }

      const db = getDb()
      const runner = db
        .prepare(
          `SELECT id, first_name, last_name, ticket_id, ticket_name,
                  bib_number, submission_status, checked_in, checked_in_at
           FROM runners WHERE bib_number = ?`,
        )
        .get(bib) as any

      if (!runner) return reply.code(404).send({ ok: false, error: 'Bib not found' })

      return reply.send({ ok: true, data: runner })
    },
  )

  // POST /api/checkin/:id — staff only, check in a runner
  app.post<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireOfficial },
    async (req, reply) => {
      const db = getDb()
      const runner = db
        .prepare('SELECT id, first_name, last_name, bib_number, checked_in FROM runners WHERE id = ?')
        .get(Number(req.params.id)) as any

      if (!runner) {
        return reply.code(404).send({ ok: false, error: 'Runner not found' })
      }

      if (runner.checked_in === 1) {
        return reply.code(409).send({
          ok: false,
          error: `${runner.first_name} ${runner.last_name} (Bib ${runner.bib_number}) is already checked in`,
          code: 'ALREADY_CHECKED_IN',
        })
      }

      db.prepare(
        `UPDATE runners SET checked_in = 1, checked_in_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      ).run(Number(req.params.id))

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'check_in', 'runners', req.params.id, `Bib ${runner.bib_number}`)

      const updated = db.prepare('SELECT * FROM runners WHERE id = ?').get(Number(req.params.id))
      return reply.send({ ok: true, data: updated })
    },
  )

  // DELETE /api/checkin/:id — admin only, undo check-in
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireOfficial },
    async (req, reply) => {
      const db = getDb()
      const runner = db
        .prepare('SELECT id, bib_number FROM runners WHERE id = ?')
        .get(Number(req.params.id)) as any

      if (!runner) {
        return reply.code(404).send({ ok: false, error: 'Runner not found' })
      }

      db.prepare(
        `UPDATE runners SET checked_in = 0, checked_in_at = NULL, updated_at = datetime('now') WHERE id = ?`,
      ).run(Number(req.params.id))

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'undo_check_in', 'runners', req.params.id, `Bib ${runner.bib_number}`)

      const updated = db.prepare('SELECT * FROM runners WHERE id = ?').get(Number(req.params.id))
      return reply.send({ ok: true, data: updated })
    },
  )
}
