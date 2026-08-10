import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import path from 'path'
import fs from 'fs'
import { initDb } from './db/database'
import { authRoutes } from './routes/auth'
import { runnerRoutes } from './routes/runners'
import { bibRoutes } from './routes/bibs'
import { fileRoutes } from './routes/files'
import { importRoutes } from './routes/import'
import { settingsRoutes } from './routes/settings'
import { crewRoutes } from './routes/crew'
import { staffRoutes } from './routes/staff'
import { auditRoutes } from './routes/audit'

const PORT = Number(process.env.PORT ?? 3001)

async function main() {
  // Ensure data/uploads dirs exist
  const dataDir = path.resolve(process.env.DB_PATH ?? './data/petreg.db', '..')
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(uploadDir, { recursive: true })

  const app = Fastify({ logger: { level: 'info' } })

  await app.register(cors, {
    origin: process.env.WEB_URL ?? 'http://localhost:5173',
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  })

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  })

  // Init DB (runs migrations)
  initDb()

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(runnerRoutes, { prefix: '/api/runners' })
  await app.register(bibRoutes, { prefix: '/api/bibs' })
  await app.register(fileRoutes, { prefix: '/api/files' })
  await app.register(importRoutes, { prefix: '/api/import' })
  await app.register(settingsRoutes, { prefix: '/api/settings' })
  await app.register(crewRoutes, { prefix: '/api/crew' })
  await app.register(staffRoutes, { prefix: '/api/staff' })
  await app.register(auditRoutes, { prefix: '/api/audit' })

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }))

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`API running on http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
