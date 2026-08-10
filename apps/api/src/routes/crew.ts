import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { getFileUrl } from '../services/storage'

export async function crewRoutes(app: FastifyInstance) {
  async function verifyCrewToken(token: string): Promise<boolean> {
    if (!token) return false
    const db = getDb()
    const row = db
      .prepare('SELECT id FROM crew_tokens WHERE token = ? AND active = 1')
      .get(token) as any
    return !!row
  }

  // GET /api/crew/lookup?bib=1234&token=xxx
  app.get<{ Querystring: { bib: string; token: string } }>(
    '/lookup',
    async (req, reply) => {
      const { bib, token } = req.query
      if (!await verifyCrewToken(token)) {
        return reply.code(401).send({ ok: false, error: 'Invalid or expired crew token' })
      }
      if (!bib || !/^\d{4}$/.test(bib)) {
        return reply.code(400).send({ ok: false, error: 'bib must be 4 digits' })
      }

      const db = getDb()
      const runner = db
        .prepare(
          `SELECT first_name, last_name, email, ticket_id, ticket_name, bib_number,
                  cert_file_key, cert_file_key_2, cert_file_key_3,
                  dog_photo_key, submission_status
           FROM runners WHERE bib_number = ?`,
        )
        .get(bib) as any

      if (!runner) return reply.code(404).send({ ok: false, error: 'Bib not found' })

      // Resolve all cert URLs (up to 3)
      const certUrls: (string | null)[] = await Promise.all([
        runner.cert_file_key   ? getFileUrl(runner.cert_file_key)   : Promise.resolve(null),
        runner.cert_file_key_2 ? getFileUrl(runner.cert_file_key_2) : Promise.resolve(null),
        runner.cert_file_key_3 ? getFileUrl(runner.cert_file_key_3) : Promise.resolve(null),
      ])
      const dogPhotoUrl = runner.dog_photo_key ? await getFileUrl(runner.dog_photo_key) : null

      return reply.send({
        ok: true,
        data: {
          first_name: runner.first_name,
          last_name: runner.last_name,
          email: runner.email,
          ticket_id: runner.ticket_id,
          ticket_name: runner.ticket_name,
          bib_number: runner.bib_number,
          submission_status: runner.submission_status,
          cert_urls: certUrls.filter(Boolean),
          dog_photo_url: dogPhotoUrl,
        },
      })
    },
  )
}
