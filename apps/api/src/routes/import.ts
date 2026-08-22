import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin } from '../middleware/auth'
import { JwtPayload, ImportResult } from '@petreg/shared'
import { audit } from '../services/audit'
import * as XLSX from 'xlsx'

/** Split a full name into first/last. Single-word names go to first_name. */
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  const last = parts.pop()!
  return { first_name: parts.join(' '), last_name: last }
}

/** Resolve a column value from multiple possible key names */
function col(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim()
  }
  return ''
}

/** Sanitize a timestamp string to be a valid SQLite table name suffix */
function makeBackupName(): string {
  return `runners_import_bak_${new Date().toISOString().replace(/[:.TZ-]/g, '_').replace(/__+/g, '_').replace(/_$/, '')}`
}

export async function importRoutes(app: FastifyInstance) {
  // POST /api/import/excel — admin uploads Excel file (skip-existing mode)
  app.post(
    '/excel',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const parts = req.parts()
      let fileBuffer: Buffer | null = null

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk)
          fileBuffer = Buffer.concat(chunks)
          break
        }
      }

      if (!fileBuffer) return reply.code(400).send({ ok: false, error: 'No file uploaded' })

      const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

      const db = getDb()
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }

      // Create backup snapshot before any changes
      const backupName = makeBackupName()
      db.exec(`CREATE TABLE IF NOT EXISTS "${backupName}" AS SELECT * FROM runners WHERE 0`)
      db.exec(`INSERT INTO "${backupName}" SELECT * FROM runners`)

      const insert = db.prepare(`
        INSERT OR IGNORE INTO runners (
          ticket_id, first_name, last_name, email, phone,
          ticket_name, shirt_size, collar_size
        )
        VALUES (
          @ticket_id, @first_name, @last_name, @email, @phone,
          @ticket_name, @shirt_size, @collar_size
        )
      `)

      const runAll = db.transaction((rows: Record<string, any>[]) => {
        for (const row of rows) {
          try {
            const rawTicket = col(row, 'Ticket Code', 'ticket_code', 'Kode Tiket', 'ticket_id')
            if (!rawTicket) { result.errors.push({ row: rows.indexOf(row) + 2, reason: 'Missing ticket code' }); continue }
            const ticket_id = rawTicket.toUpperCase()

            const fullName = col(row, 'Nama', 'Full Name', 'Name', 'name', 'full_name')
            const { first_name, last_name } = fullName
              ? splitName(fullName)
              : {
                  first_name: col(row, 'First Name', 'first_name') || '',
                  last_name:  col(row, 'Last Name',  'last_name')  || '',
                }

            const email        = col(row, 'Email', 'email') || ''
            const phone        = col(row, 'Nomor HP', 'Phone', 'phone', 'nomor_hp') || null
            const ticket_name  = col(row, 'Ticket Name', 'ticket_name', 'Nama Tiket') || null
            const shirt_size   = col(row, 'Ukuran Baju', 'ukuran_baju', 'Shirt Size', 'shirt_size') || null
            const collar_size  = col(row, 'Ukuran Pet Collar', 'ukuran_pet_collar', 'Collar Size', 'collar_size') || null

            const existing = db.prepare('SELECT id FROM runners WHERE ticket_id = ?').get(ticket_id)
            if (existing) {
              result.skipped++
              continue
            }

            insert.run({ ticket_id, first_name, last_name, email, phone, ticket_name, shirt_size, collar_size })
            result.inserted++
          } catch (err: any) {
            result.errors.push({ row: rows.indexOf(row) + 2, reason: err.message ?? 'Unknown error' })
          }
        }
      })

      runAll(rows)

      const payload = req.user as JwtPayload
      audit(
        payload.sub,
        payload.role,
        'import_excel',
        'runners',
        'bulk',
        `inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors.length} backup=${backupName}`,
      )

      return reply.send({ ok: true, data: { ...result, backup_name: backupName } })
    },
  )

  // GET /api/import/backups — list available backup snapshots
  app.get(
    '/backups',
    { preHandler: requireAdmin },
    async (_req, reply) => {
      const db = getDb()
      const tables = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'runners_import_bak_%' ORDER BY name DESC`
      ).all() as { name: string }[]

      const backups = tables.map((t) => {
        const count = (db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as any).c
        return { name: t.name, row_count: count }
      })

      return reply.send({ ok: true, data: backups })
    },
  )

  // POST /api/import/restore/:name — restore runners from a backup snapshot
  app.post<{ Params: { name: string } }>(
    '/restore/:name',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      const { name } = req.params

      // Validate name — only allow our own backup table names
      if (!/^runners_import_bak_[0-9_]+$/.test(name)) {
        return reply.code(400).send({ ok: false, error: 'Invalid backup name' })
      }

      const exists = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`
      ).get(name)
      if (!exists) return reply.code(404).send({ ok: false, error: 'Backup not found' })

      // Create a safety backup of current state before restoring
      const safetyName = makeBackupName()
      db.exec(`CREATE TABLE IF NOT EXISTS "${safetyName}" AS SELECT * FROM runners WHERE 0`)
      db.exec(`INSERT INTO "${safetyName}" SELECT * FROM runners`)

      // Restore: delete current runners, re-insert from backup
      // Only restore registration fields — preserve nothing since we're doing a full revert
      db.transaction(() => {
        db.exec(`DELETE FROM runners`)
        db.exec(`INSERT INTO runners SELECT * FROM "${name}"`)
      })()

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'import_restore', 'runners', 'bulk', `restored_from=${name} safety_backup=${safetyName}`)

      return reply.send({ ok: true, data: { restored_from: name, safety_backup: safetyName } })
    },
  )

  // DELETE /api/import/backups/:name — delete a backup snapshot
  app.delete<{ Params: { name: string } }>(
    '/backups/:name',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const db = getDb()
      const { name } = req.params

      if (!/^runners_import_bak_[0-9_]+$/.test(name)) {
        return reply.code(400).send({ ok: false, error: 'Invalid backup name' })
      }

      db.exec(`DROP TABLE IF EXISTS "${name}"`)

      const payload = req.user as JwtPayload
      audit(payload.sub, payload.role, 'delete_import_backup', 'runners', 'bulk', `backup=${name}`)

      return reply.send({ ok: true, data: null })
    },
  )
}
