import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { getDb } from '../db/database'
import { saveFile, getFileUrl, getLocalFilePath, deleteFile, listFiles } from '../services/storage'
import { sendSubmissionConfirmation } from '../services/email'
import { audit } from '../services/audit'
import { requireAdmin } from '../middleware/auth'
import { JwtPayload } from '@petreg/shared'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_CERTS = 3
const CERT_FIELDS = ['cert', 'cert_2', 'cert_3'] as const
const CERT_KEYS = ['cert_file_key', 'cert_file_key_2', 'cert_file_key_3'] as const
const ALL_FILE_FIELDS = ['cert_file_key', 'cert_file_key_2', 'cert_file_key_3', 'dog_photo_key'] as const

export async function fileRoutes(app: FastifyInstance) {
  // POST /api/files/upload/:ticketId — user uploads cert (up to 3) + dog photo
  app.post<{ Params: { ticketId: string } }>(
    '/upload/:ticketId',
    async (req, reply) => {
      const db = getDb()
      const runner = db
        .prepare('SELECT * FROM runners WHERE ticket_id = ?')
        .get(req.params.ticketId.toUpperCase()) as any
      if (!runner) return reply.code(404).send({ ok: false, error: 'Ticket ID not found' })

      // Block uploads if manually or auto locked
      if (runner.uploads_locked) {
        return reply.code(403).send({
          ok: false,
          error: 'Uploads are locked for this ticket.',
        })
      }

      const certKeys: (string | undefined)[] = [undefined, undefined, undefined]
      let dogPhotoKey: string | undefined

      const parts = req.parts()
      for await (const part of parts) {
        if (part.type !== 'file') continue
        if (!ALLOWED_TYPES.includes(part.mimetype)) {
          return reply.code(400).send({ ok: false, error: `Unsupported file type: ${part.mimetype}` })
        }
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk)
        const buf = Buffer.concat(chunks)
        if (buf.length === 0) continue

        const key = await saveFile(buf, part.filename, part.mimetype)

        const certIdx = CERT_FIELDS.indexOf(part.fieldname as any)
        if (certIdx >= 0) {
          certKeys[certIdx] = key
        } else if (part.fieldname === 'dog_photo') {
          dogPhotoKey = key
        }
      }

      const updates: string[] = []
      const vals: any[] = []

      // Delete old file from storage if this slot is being replaced
      const oldKeysToDelete: string[] = []
      certKeys.forEach((key, i) => {
        if (key) {
          const oldKey = runner[CERT_KEYS[i]]
          if (oldKey) oldKeysToDelete.push(oldKey)
          updates.push(`${CERT_KEYS[i]} = ?`)
          vals.push(key)
        }
      })
      if (dogPhotoKey) {
        if (runner.dog_photo_key) oldKeysToDelete.push(runner.dog_photo_key)
        updates.push('dog_photo_key = ?')
        vals.push(dogPhotoKey)
      }
      if (!updates.length) return reply.code(400).send({ ok: false, error: 'No files received' })

      updates.push("submission_status = 'submitted'", "updated_at = datetime('now')")
      db.prepare(`UPDATE runners SET ${updates.join(', ')} WHERE id = ?`).run(...vals, runner.id)

      // Best-effort: delete old replaced files from storage after DB is updated
      for (const oldKey of oldKeysToDelete) {
        deleteFile(oldKey).catch(() => {})
      }

      const certCount = certKeys.filter(Boolean).length
      audit(null, 'user', 'upload', 'runners', runner.id,
        `certs=${certCount} dogPhoto=${!!dogPhotoKey}`)

      // Determine if this is a first-time submission (no files existed before this upload)
      const isFirstSubmission = !runner.cert_file_key && !runner.cert_file_key_2 && !runner.cert_file_key_3 && !runner.dog_photo_key

      // Auto-lock if now has at least 1 cert AND dog photo
      const afterState = db.prepare(
        'SELECT cert_file_key, cert_file_key_2, cert_file_key_3, dog_photo_key FROM runners WHERE id = ?'
      ).get(runner.id) as any
      const hasCertNow = afterState.cert_file_key || afterState.cert_file_key_2 || afterState.cert_file_key_3
      const hasPhotoNow = afterState.dog_photo_key
      if (hasCertNow && hasPhotoNow) {
        db.prepare(`UPDATE runners SET uploads_locked = 1, updated_at = datetime('now') WHERE id = ?`).run(runner.id)
        audit(null, 'user', 'auto_lock', 'runners', runner.id, 'cert+photo complete')
      }

      // Only send confirmation email on first submission
      if (isFirstSubmission) {
        const eventName = (db.prepare("SELECT value FROM system_settings WHERE key='event_name'").get() as any)?.value ?? 'Dog Run Race'
        const webUrl = process.env.WEB_URL ?? 'http://localhost:5173'
        sendSubmissionConfirmation({
          toEmail: runner.email,
          toName: `${runner.first_name} ${runner.last_name}`.trim(),
          ticketId: runner.ticket_id,
          eventName,
          webUrl,
          phone: runner.phone ?? undefined,
          ticketName: runner.ticket_name ?? undefined,
          shirtSize: runner.shirt_size ?? undefined,
          collarSize: runner.collar_size ?? undefined,
          certCount,
          hasDogPhoto: !!dogPhotoKey,
        }).catch((err) => app.log.error({ err }, 'Failed to send confirmation email'))
      }

      return reply.send({ ok: true, data: { certs: certCount, dog_photo: !!dogPhotoKey, first_submission: isFirstSubmission } })
    },
  )

  // DELETE /api/files/runner/:id/:field — admin removes a specific file field
  // field: cert_file_key | cert_file_key_2 | cert_file_key_3 | dog_photo_key
  app.delete<{ Params: { id: string; field: string } }>(
    '/runner/:id/:field',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { id, field } = req.params
      const ALLOWED_FIELDS = [...ALL_FILE_FIELDS]
      if (!ALLOWED_FIELDS.includes(field as any)) {
        return reply.code(400).send({ ok: false, error: 'Invalid field' })
      }
      const db = getDb()
      const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(Number(id)) as any
      if (!runner) return reply.code(404).send({ ok: false, error: 'Runner not found' })

      const key = runner[field]
      if (!key) return reply.code(404).send({ ok: false, error: 'No file on this field' })

      // Delete from storage
      await deleteFile(key).catch(() => {}) // best-effort; file may already be missing

      // Clear the field in DB
      db.prepare(`UPDATE runners SET ${field} = NULL, updated_at = datetime('now') WHERE id = ?`).run(Number(id))

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'delete_file', 'runners', id, `field=${field} key=${key}`)

      // If no bib and all files are gone, reset status back to pending
      const updated = db.prepare(
        'SELECT bib_number, cert_file_key, cert_file_key_2, cert_file_key_3, dog_photo_key FROM runners WHERE id = ?'
      ).get(Number(id)) as any
      const hasAny = updated.bib_number || updated.cert_file_key || updated.cert_file_key_2 || updated.cert_file_key_3 || updated.dog_photo_key
      if (!hasAny) {
        db.prepare(`UPDATE runners SET submission_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(Number(id))
      }

      return reply.send({ ok: true, data: null })
    },
  )

  // GET /api/files/orphans — dry-run: list orphaned file keys (admin only)
  app.get(
    '/orphans',
    { preHandler: requireAdmin },
    async (_req, reply) => {
      const db = getDb()
      // Collect all keys currently referenced in the DB
      const rows = db.prepare(
        `SELECT cert_file_key, cert_file_key_2, cert_file_key_3, dog_photo_key FROM runners`
      ).all() as any[]
      const referencedKeys = new Set<string>()
      for (const row of rows) {
        for (const field of ALL_FILE_FIELDS) {
          if (row[field]) referencedKeys.add(row[field])
        }
      }

      // List all files in storage
      const allKeys = await listFiles()

      // Orphans = files in storage not referenced in DB
      const orphans = allKeys.filter(k => !referencedKeys.has(k))

      return reply.send({ ok: true, data: { count: orphans.length, keys: orphans } })
    },
  )

  // DELETE /api/files/orphans — purge orphaned files (admin only, audited)
  app.delete(
    '/orphans',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      // Collect all keys currently referenced in the DB
      const rows = db.prepare(
        `SELECT cert_file_key, cert_file_key_2, cert_file_key_3, dog_photo_key FROM runners`
      ).all() as any[]
      const referencedKeys = new Set<string>()
      for (const row of rows) {
        for (const field of ALL_FILE_FIELDS) {
          if (row[field]) referencedKeys.add(row[field])
        }
      }

      // List all files in storage
      const allKeys = await listFiles()
      const orphans = allKeys.filter(k => !referencedKeys.has(k))

      // Delete each orphan from storage
      let deleted = 0
      const failed: string[] = []
      for (const key of orphans) {
        try {
          await deleteFile(key)
          deleted++
        } catch {
          failed.push(key)
        }
      }

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'purge_orphans', 'storage', 0, `deleted=${deleted} failed=${failed.length}`)

      return reply.send({ ok: true, data: { deleted, failed } })
    },
  )

  // GET /api/files/:key — serve local file (dev only; in prod use S3 signed URLs)
  app.get<{ Params: { key: string } }>(
    '/:key',
    async (req, reply) => {
      if (process.env.STORAGE_DRIVER === 's3') {
        return reply.code(400).send({ ok: false, error: 'Use signed URL for S3' })
      }
      const filePath = getLocalFilePath(req.params.key)
      if (!filePath) return reply.code(400).send({ ok: false, error: 'Invalid file key' })
      if (!fs.existsSync(filePath)) return reply.code(404).send({ ok: false, error: 'File not found' })
      const ext = path.extname(filePath).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp',
        '.pdf': 'application/pdf',
      }
      const contentType = mimeMap[ext] ?? 'application/octet-stream'
      reply.header('Content-Type', contentType)
      return reply.send(fs.createReadStream(filePath))
    },
  )

  // GET /api/files/url/:key — get a (signed) URL for a file
  app.get<{ Params: { key: string } }>(
    '/url/:key',
    async (req, reply) => {
      const url = await getFileUrl(req.params.key)
      return reply.send({ ok: true, data: { url } })
    },
  )
}
