import { getDb } from '../db/index.js'
import type { Design, DesignStatus, ExportFilter } from '../../shared/types.js'

const VALID_TRANSITIONS: Record<DesignStatus, DesignStatus[]> = {
  pending_claim: ['reviewing'],
  reviewing: ['passed', 'returned'],
  returned: ['pending_review'],
  pending_review: ['passed', 'returned'],
  passed: [],
}

function isValidTransition(from: DesignStatus, to: DesignStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

function rowToDesign(row: Record<string, unknown>): Design {
  return {
    id: row.id as number,
    designId: row.design_id as string,
    name: row.name as string,
    description: row.description as string,
    submitterId: row.submitter_id as number,
    submitterName: row.submitter_name as string,
    reviewerId: row.reviewer_id as number | null,
    reviewerName: row.reviewer_name as string | null,
    status: row.status as DesignStatus,
    priority: row.priority as 'high' | 'medium' | 'low',
    returnReason: row.return_reason as string | null,
    queueOrder: row.queue_order as number,
    version: row.version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function findAll(): Design[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM designs
    ORDER BY queue_order ASC, created_at DESC
  `)
  const rows = stmt.all() as Record<string, unknown>[]
  return rows.map(rowToDesign)
}

export function findById(id: number): Design | undefined {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM designs WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | undefined
  return row ? rowToDesign(row) : undefined
}

export function findByDesignId(designId: string): Design | undefined {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM designs WHERE design_id = ?')
  const row = stmt.get(designId) as Record<string, unknown> | undefined
  return row ? rowToDesign(row) : undefined
}

export function create(data: {
  designId: string
  name: string
  description: string
  submitterId: number
  submitterName: string
  priority: string
  queueOrder: number
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO designs (
      design_id, name, description, submitter_id, submitter_name,
      priority, queue_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.designId,
    data.name,
    data.description,
    data.submitterId,
    data.submitterName,
    data.priority,
    data.queueOrder
  )
  return Number(result.lastInsertRowid)
}

export function updateStatus(
  id: number,
  status: DesignStatus,
  expectedVersion: number
): { success: boolean; changes: number } {
  const db = getDb()

  const current = db.prepare('SELECT status FROM designs WHERE id = ?').get(id) as
    | { status: DesignStatus }
    | undefined

  if (!current) {
    return { success: false, changes: 0 }
  }

  if (!isValidTransition(current.status, status)) {
    return { success: false, changes: 0 }
  }

  const stmt = db.prepare(`
    UPDATE designs
    SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `)
  const result = stmt.run(status, id, expectedVersion)
  return {
    success: result.changes > 0,
    changes: result.changes,
  }
}

export function claim(
  id: number,
  reviewerId: number,
  reviewerName: string,
  expectedVersion: number
): { success: boolean; changes: number; updatedDesign?: Design } {
  const db = getDb()

  const transaction = db.transaction(() => {
    const current = db
      .prepare('SELECT * FROM designs WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined

    if (!current) {
      return { success: false, changes: 0 }
    }

    if (current.status !== 'pending_claim') {
      return { success: false, changes: 0 }
    }

    if (current.version !== expectedVersion) {
      return { success: false, changes: 0 }
    }

    const stmt = db.prepare(`
      UPDATE designs
      SET status = 'reviewing', reviewer_id = ?, reviewer_name = ?,
          version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `)
    const result = stmt.run(reviewerId, reviewerName, id, expectedVersion)

    if (result.changes === 0) {
      return { success: false, changes: 0 }
    }

    const updatedRow = db
      .prepare('SELECT * FROM designs WHERE id = ?')
      .get(id) as Record<string, unknown>
    const updatedDesign = rowToDesign(updatedRow)

    return { success: true, changes: result.changes, updatedDesign }
  })

  return transaction() as {
    success: boolean
    changes: number
    updatedDesign?: Design
  }
}

export function reviewPass(id: number, expectedVersion: number): boolean {
  const db = getDb()

  const transaction = db.transaction(() => {
    const current = db
      .prepare('SELECT status FROM designs WHERE id = ?')
      .get(id) as { status: DesignStatus } | undefined

    if (!current) {
      return false
    }

    if (!isValidTransition(current.status, 'passed')) {
      return false
    }

    const stmt = db.prepare(`
      UPDATE designs
      SET status = 'passed', version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `)
    const result = stmt.run(id, expectedVersion)
    return result.changes > 0
  })

  return transaction() as boolean
}

export function reviewReturn(
  id: number,
  reason: string,
  expectedVersion: number
): boolean {
  const db = getDb()

  const transaction = db.transaction(() => {
    const current = db
      .prepare('SELECT status FROM designs WHERE id = ?')
      .get(id) as { status: DesignStatus } | undefined

    if (!current) {
      return false
    }

    if (!isValidTransition(current.status, 'returned')) {
      return false
    }

    const stmt = db.prepare(`
      UPDATE designs
      SET status = 'returned', return_reason = ?, version = version + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `)
    const result = stmt.run(reason, id, expectedVersion)
    return result.changes > 0
  })

  return transaction() as boolean
}

export function resubmit(id: number, expectedVersion: number): boolean {
  const db = getDb()

  const transaction = db.transaction(() => {
    const current = db
      .prepare('SELECT status FROM designs WHERE id = ?')
      .get(id) as { status: DesignStatus } | undefined

    if (!current) {
      return false
    }

    if (!isValidTransition(current.status, 'pending_review')) {
      return false
    }

    const stmt = db.prepare(`
      UPDATE designs
      SET status = 'pending_review', return_reason = NULL,
          version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `)
    const result = stmt.run(id, expectedVersion)
    return result.changes > 0
  })

  return transaction() as boolean
}

export function getMaxQueueOrder(): number {
  const db = getDb()
  const row = db
    .prepare('SELECT MAX(queue_order) as maxOrder FROM designs')
    .get() as { maxOrder: number | null }
  return row.maxOrder ?? 0
}

export function findByFilter(filter: ExportFilter): Design[] {
  const db = getDb()
  const conditions: string[] = []
  const values: unknown[] = []

  if (filter.status !== undefined) {
    conditions.push('status = ?')
    values.push(filter.status)
  }
  if (filter.submitterId !== undefined) {
    conditions.push('submitter_id = ?')
    values.push(filter.submitterId)
  }
  if (filter.reviewerId !== undefined) {
    conditions.push('reviewer_id = ?')
    values.push(filter.reviewerId)
  }
  if (filter.startDate !== undefined) {
    conditions.push('created_at >= ?')
    values.push(filter.startDate)
  }
  if (filter.endDate !== undefined) {
    conditions.push('created_at <= ?')
    values.push(filter.endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const stmt = db.prepare(`
    SELECT * FROM designs
    ${whereClause}
    ORDER BY queue_order ASC, created_at DESC
  `)
  const rows = stmt.all(...values) as Record<string, unknown>[]
  return rows.map(rowToDesign)
}
