import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { getDb } from '../db/database'
import { saveFile, getFileUrl, getLocalFilePath, deleteFile } from '../services/storage'
import { sendSubmissionConfirmation } from '../services/email'
import { audit } from '../services/audit'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_CERTS = 3
const CERT_FIELDS = ['cert', 'cert_2', 'cert_3'] as const
const CERT_KEYS = ['cert_file_key', 'cert_file_key_2', 'cert_file_key_3'] as const

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

      // Block uploads after bib is assigned
      if (runner.bib_number) {
        return reply.code(403).send({
          ok: false,
          error: 'Uploads are locked — a bib number has already been assigned to this ticket.',
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

      certKeys.forEach((key, i) => {
        if (key) {
          updates.push(`${CERT_KEYS[i]} = ?`)
          vals.push(key)
        }
      })
      if (dogPhotoKey) { updates.push('dog_photo_key = ?'); vals.push(dogPhotoKey) }
      if (!updates.length) return reply.code(400).send({ ok: false, error: 'No files received' })

      updates.push("submission_status = 'submitted'", "updated_at = datetime('now')")
      db.prepare(`UPDATE runners SET ${updates.join(', ')} WHERE id = ?`).run(...vals, runner.id)

      const certCount = certKeys.filter(Boolean).length
      audit(null, 'user', 'upload', 'runners', runner.id,
        `certs=${certCount} dogPhoto=${!!dogPhotoKey}`)

      // Fire confirmation email (non-blocking)
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

      return reply.send({ ok: true, data: { certs: certCount, dog_photo: !!dogPhotoKey } })
    },
  )

  // DELETE /api/files/runner/:id/:field — admin removes a specific file field
  // field: cert_file_key | cert_file_key_2 | cert_file_key_3 | dog_photo_key
  app.delete<{ Params: { id: string; field: string } }>(
    '/runner/:id/:field',
    async (req, reply) => {
      const { id, field } = req.params
      const ALLOWED_FIELDS = ['cert_file_key', 'cert_file_key_2', 'cert_file_key_3', 'dog_photo_key']
      if (!ALLOWED_FIELDS.includes(field)) {
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
      audit(null, 'admin', 'delete_file', 'runners', id, `field=${field} key=${key}`)

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
