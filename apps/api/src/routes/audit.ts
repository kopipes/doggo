import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin } from '../middleware/auth'

export async function auditRoutes(app: FastifyInstance) {
  // GET /api/audit?page=1&limit=50&entity=runners&action=upload
  app.get('/', { preHandler: requireAdmin }, async (req, reply) => {
    const { page = '1', limit = '50', entity, action } = req.query as Record<string, string>
    const offset = (Number(page) - 1) * Number(limit)

    const db = getDb()
    let sql = 'SELECT * FROM audit_log WHERE 1=1'
    const params: any[] = []

    if (entity) { sql += ' AND entity = ?'; params.push(entity) }
    if (action) { sql += ' AND action = ?'; params.push(action) }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(Number(limit), offset)

    const entries = db.prepare(sql).all(...params)
    const total = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as any).n

    return reply.send({ ok: true, data: { entries, total } })
  })
}
