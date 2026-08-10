import { FastifyRequest, FastifyReply } from 'fastify'
import { JwtPayload } from '@petreg/shared'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' })
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
    const payload = req.user as JwtPayload
    if (payload.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Forbidden — admin only' })
    }
  } catch {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' })
  }
}

export async function requireOfficial(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
    const payload = req.user as JwtPayload
    if (payload.role !== 'admin' && payload.role !== 'official') {
      return reply.code(403).send({ ok: false, error: 'Forbidden — staff only' })
    }
  } catch {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' })
  }
}
