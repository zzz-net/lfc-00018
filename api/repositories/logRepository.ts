import { getDb } from '../db/index.js'
import type { OperationLog, DesignStatus } from '../../shared/types.js'

function rowToOperationLog(row: Record<string, unknown>): OperationLog {
  return {
    id: row.id as number,
    designId: row.design_id as number,
    userId: row.user_id as number,
    userName: row.user_name as string,
    action: row.action as string,
    oldStatus: row.old_status as DesignStatus | null,
    newStatus: row.new_status as DesignStatus | null,
    details: row.details as string | null,
    createdAt: row.created_at as string,
  }
}

export function findByDesignId(designId: number): OperationLog[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM operation_logs
    WHERE design_id = ?
    ORDER BY created_at DESC
  `)
  const rows = stmt.all(designId) as Record<string, unknown>[]
  return rows.map(rowToOperationLog)
}

export function create(data: {
  designId: number
  userId: number
  userName: string
  action: string
  oldStatus: DesignStatus | null
  newStatus: DesignStatus | null
  details: string | null
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO operation_logs (
      design_id, user_id, user_name, action, old_status, new_status, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.designId,
    data.userId,
    data.userName,
    data.action,
    data.oldStatus,
    data.newStatus,
    data.details
  )
  return Number(result.lastInsertRowid)
}
