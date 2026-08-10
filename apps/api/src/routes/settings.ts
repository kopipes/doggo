import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin } from '../middleware/auth'
import { JwtPayload } from '@dogreg/shared'
import { audit } from '../services/audit'

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings — admin reads all settings
  app.get('/', { preHandler: requireAdmin }, async (_req, reply) => {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM system_settings').all()
    return reply.send({ ok: true, data: rows })
  })

  // PUT /api/settings/:key — admin updates a single setting
  app.put<{ Params: { key: string }; Body: { value: string } }>(
    '/:key',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      db.prepare(
        'INSERT OR REPLACE INTO system_settings(key, value) VALUES (?, ?)',
      ).run(req.params.key, req.body.value ?? '')

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'update_setting', 'system_settings', req.params.key, `value=${req.body.value}`)

      return reply.send({ ok: true, data: { key: req.params.key, value: req.body.value } })
    },
  )
}
