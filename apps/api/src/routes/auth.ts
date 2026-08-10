import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { getDb } from '../db/database'
import { JwtPayload } from '@petreg/shared'
import { audit } from '../services/audit'

const DUMMY_HASH = '$2b$12$invalidhashfortimingsafety000000000000000000000000000000'

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{ Body: { username: string; password: string } }>(
    '/login',
    async (req, reply) => {
      const { username, password } = req.body
      if (!username || !password) {
        return reply.code(400).send({ ok: false, error: 'username and password required' })
      }

      const db = getDb()
      const account = db
        .prepare('SELECT * FROM staff_accounts WHERE username = ?')
        .get(username) as any

      // Always run bcrypt.compare to prevent timing attacks that reveal
      // whether a username exists
      const hashToCompare = account?.password_hash ?? DUMMY_HASH
      const valid = await bcrypt.compare(password, hashToCompare)

      if (!account || !valid) {
        return reply.code(401).send({ ok: false, error: 'Invalid credentials' })
      }

      const payload: JwtPayload = {
        sub: account.id,
        username: account.username,
        role: account.role,
      }
      const token = app.jwt.sign(payload, { expiresIn: '12h' })

      audit(account.id, account.role, 'login', 'staff_accounts', account.id)

      return reply.send({
        ok: true,
        data: {
          token,
          account: {
            id: account.id,
            username: account.username,
            email: account.email,
            role: account.role,
            created_at: account.created_at,
          },
        },
      })
    },
  )

  // GET /api/auth/me
  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify()
      const payload = req.user as JwtPayload
      const db = getDb()
      const account = db
        .prepare('SELECT id, username, email, role, created_at FROM staff_accounts WHERE id = ?')
        .get(payload.sub) as any
      if (!account) return reply.code(404).send({ ok: false, error: 'Not found' })
      return reply.send({ ok: true, data: account })
    } catch {
      return reply.code(401).send({ ok: false, error: 'Unauthorized' })
    }
  })
}
