import { getDb } from '../db/index.js'
import type { Comment, UserRole } from '../../shared/types.js'

function rowToComment(row: Record<string, unknown>): Comment {
  return {
    id: row.id as number,
    designId: row.design_id as number,
    userId: row.user_id as number,
    userName: row.user_name as string,
    userRole: row.user_role as UserRole,
    content: row.content as string,
    isReturnReason: row.is_return_reason as unknown as number === 1,
    createdAt: row.created_at as string,
  }
}

export function findByDesignId(designId: number): Comment[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM comments
    WHERE design_id = ?
    ORDER BY created_at DESC
  `)
  const rows = stmt.all(designId) as Record<string, unknown>[]
  return rows.map(rowToComment)
}

export function create(data: {
  designId: number
  userId: number
  userName: string
  userRole: string
  content: string
  isReturnReason: boolean
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO comments (
      design_id, user_id, user_name, user_role, content, is_return_reason
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.designId,
    data.userId,
    data.userName,
    data.userRole,
    data.content,
    data.isReturnReason ? 1 : 0
  )
  return Number(result.lastInsertRowid)
}

export function countByDesignId(designId: number): number {
  const db = getDb()
  const row = db
    .prepare('SELECT COUNT(*) as count FROM comments WHERE design_id = ?')
    .get(designId) as { count: number }
  return row.count
}
