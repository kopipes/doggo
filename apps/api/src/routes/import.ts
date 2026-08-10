import { FastifyInstance } from 'fastify'
import { getDb } from '../db/database'
import { requireAdmin } from '../middleware/auth'
import { JwtPayload, ImportResult } from '@dogreg/shared'
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

export async function importRoutes(app: FastifyInstance) {
  // POST /api/import/excel — admin uploads Excel file
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

      const upsert = db.prepare(`
        INSERT INTO runners (
          ticket_id, first_name, last_name, email, phone,
          ticket_name, shirt_size, collar_size
        )
        VALUES (
          @ticket_id, @first_name, @last_name, @email, @phone,
          @ticket_name, @shirt_size, @collar_size
        )
        ON CONFLICT(ticket_id) DO UPDATE SET
          first_name   = excluded.first_name,
          last_name    = excluded.last_name,
          email        = excluded.email,
          phone        = excluded.phone,
          ticket_name  = excluded.ticket_name,
          shirt_size   = excluded.shirt_size,
          collar_size  = excluded.collar_size,
          updated_at   = datetime('now')
      `)

      const runAll = db.transaction((rows: Record<string, any>[]) => {
        rows.forEach((row, i) => {
          // Support both Indonesian column names (actual file) and English fallbacks
          const ticket_id = col(row,
            'Ticket Code', 'ticket_code',
            'Ticket ID', 'ticket_id', 'TicketID',
          ).toUpperCase()

          if (!ticket_id) {
            result.errors.push({ row: i + 2, reason: 'Missing Ticket Code / Ticket ID' })
            result.skipped++
            return
          }

          // Name: Indonesian file uses 'Nama' (full name), English files use First/Last Name
          const fullName = col(row, 'Nama', 'nama', 'Name', 'name')
          const { first_name, last_name } = fullName
            ? splitName(fullName)
            : {
                first_name: col(row, 'First Name', 'first_name'),
                last_name:  col(row, 'Last Name',  'last_name'),
              }

          const email = col(row, 'Email', 'email').toLowerCase()
          const phone = col(row, 'Nomor HP', 'nomor_hp', 'Phone', 'phone') || null
          const ticket_name = col(row, 'Ticket Name', 'ticket_name', 'Nama Tiket') || null
          const shirt_size  = col(row, 'Ukuran Baju', 'ukuran_baju', 'Shirt Size', 'shirt_size') || null
          const collar_size = col(row, 'Ukuran Pet Collar', 'ukuran_pet_collar', 'Collar Size', 'collar_size') || null

          const existing = db.prepare('SELECT id FROM runners WHERE ticket_id = ?').get(ticket_id)
          upsert.run({ ticket_id, first_name, last_name, email, phone, ticket_name, shirt_size, collar_size })

          if (existing) result.updated++
          else result.inserted++
        })
      })

      runAll(rows)

      const payload = req.user as JwtPayload
      audit(
        payload.sub,
        payload.role,
        'import_excel',
        'runners',
        'bulk',
        `inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`,
      )

      return reply.send({ ok: true, data: result })
    },
  )
}
