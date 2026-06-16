import { getDb } from '../db/index.js'
import type { AdminOperationLog } from '../../shared/types.js'

function rowToLog(row: Record<string, unknown>): AdminOperationLog {
  return {
    id: row.id as number,
    operatorId: row.operator_id as number,
    operatorName: row.operator_name as string,
    operationType: row.operation_type as string,
    targetType: row.target_type as string,
    targetId: row.target_id as string | null,
    summary: row.summary as string,
    details: row.details as string | null,
    createdAt: row.created_at as string,
  }
}

export function create(data: {
  operatorId: number
  operatorName: string
  operationType: string
  targetType?: string
  targetId?: string | null
  summary: string
  details?: unknown
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO admin_operation_logs (
      operator_id, operator_name, operation_type,
      target_type, target_id, summary, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const detailsJson = data.details !== undefined ? JSON.stringify(data.details) : null
  const result = stmt.run(
    data.operatorId,
    data.operatorName,
    data.operationType,
    data.targetType || '',
    data.targetId ?? null,
    data.summary,
    detailsJson
  )
  return Number(result.lastInsertRowid)
}

export function findAll(limit = 200): AdminOperationLog[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM admin_operation_logs
    ORDER BY created_at DESC
    LIMIT ?
  `)
  const rows = stmt.all(limit) as Record<string, unknown>[]
  return rows.map(rowToLog)
}

export function findByOperator(operatorId: number, limit = 100): AdminOperationLog[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM admin_operation_logs
    WHERE operator_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
  const rows = stmt.all(operatorId, limit) as Record<string, unknown>[]
  return rows.map(rowToLog)
}

export function findByOperationType(
  operationType: string,
  limit = 100
): AdminOperationLog[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM admin_operation_logs
    WHERE operation_type = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
  const rows = stmt.all(operationType, limit) as Record<string, unknown>[]
  return rows.map(rowToLog)
}
