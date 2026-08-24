import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireOfficial } from '../middleware/auth'

export async function statsRoutes(app: FastifyInstance) {
  // GET /api/stats — summary counts for dashboard
  app.get(
    '/',
    { preHandler: requireOfficial },
    async (_req, reply) => {
      const db = getDb()

      const rows = db.prepare(`
        SELECT submission_status, COUNT(*) as count
        FROM runners
        GROUP BY submission_status
      `).all() as { submission_status: string; count: number }[]

      const byStatus: Record<string, number> = {}
      let total = 0
      for (const r of rows) {
        byStatus[r.submission_status] = r.count
        total += r.count
      }

      const bibs = (db.prepare(`SELECT COUNT(*) as c FROM runners WHERE bib_number IS NOT NULL`).get() as any).c
      const checkedIn = (db.prepare(`SELECT COUNT(*) as c FROM runners WHERE checked_in = 1`).get() as any).c

      return reply.send({
        ok: true,
        data: {
          total,
          pending:      byStatus['pending']   ?? 0,
          submitted:    byStatus['submitted'] ?? 0,
          verified:     byStatus['verified']  ?? 0,
          rejected:     byStatus['rejected']  ?? 0,
          bib_assigned: bibs,
          checked_in:   checkedIn,
        },
      })
    },
  )
}
