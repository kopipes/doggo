import { getDb } from '../db/database'
import { Role } from '@petreg/shared'

export function audit(
  actorId: number | null,
  actorRole: Role | null,
  action: string,
  entity: string,
  entityId: string | number,
  detail?: string,
) {
  const db = getDb()
  db.prepare(`
    INSERT INTO audit_log (actor_id, actor_role, action, entity, entity_id, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorId, actorRole, action, entity, String(entityId), detail ?? null)
}
