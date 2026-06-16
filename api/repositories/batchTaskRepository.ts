import { getDb } from '../db/index.js'
import type {
  BatchTask,
  BatchTaskItem,
  BatchTaskStatus,
  BatchTaskItemType,
  BatchTaskItemStatus,
  FieldMapping,
  BatchTaskResultSummary,
} from '../../shared/types.js'

interface BatchTaskDb extends Omit<BatchTask, 'fieldMapping' | 'resultSummary'> {
  field_mapping: string
  result_summary: string | null
}

interface BatchTaskItemDb extends Omit<BatchTaskItem, 'rowData'> {
  row_data: string
}

function mapTaskFromDb(db: BatchTaskDb): BatchTask {
  return {
    id: db.id,
    taskName: db.taskName,
    createdBy: db.createdBy,
    createdByName: db.createdByName,
    status: db.status,
    fileName: db.fileName,
    fileSize: db.fileSize,
    fieldMapping: JSON.parse(db.field_mapping || '{}'),
    totalCount: db.totalCount,
    newCount: db.newCount,
    roleChangeCount: db.roleChangeCount,
    disableCount: db.disableCount,
    duplicateCount: db.duplicateCount,
    nameConflictCount: db.nameConflictCount,
    rawCsvContent: db.rawCsvContent,
    executedAt: db.executedAt,
    executedBy: db.executedBy,
    executedByName: db.executedByName,
    resultSummary: db.result_summary ? (JSON.parse(db.result_summary) as BatchTaskResultSummary) : null,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  }
}

function mapItemFromDb(db: BatchTaskItemDb): BatchTaskItem {
  return {
    id: db.id,
    taskId: db.taskId,
    itemType: db.itemType,
    lineNumber: db.lineNumber,
    username: db.username,
    name: db.name,
    email: db.email,
    role: db.role,
    oldRole: db.oldRole,
    password: db.password,
    status: db.status,
    skipReason: db.skipReason,
    errorMessage: db.errorMessage,
    userId: db.userId,
    rowData: JSON.parse(db.row_data || '{}'),
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  }
}

export function findAllTasks(limit = 100): BatchTask[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT
      id, task_name as taskName, created_by as createdBy, created_by_name as createdByName,
      status, file_name as fileName, file_size as fileSize, field_mapping,
      total_count as totalCount, new_count as newCount, role_change_count as roleChangeCount,
      disable_count as disableCount, duplicate_count as duplicateCount,
      name_conflict_count as nameConflictCount, raw_csv_content as rawCsvContent,
      executed_at as executedAt, executed_by as executedBy, executed_by_name as executedByName,
      result_summary, created_at as createdAt, updated_at as updatedAt
    FROM batch_tasks
    ORDER BY created_at DESC
    LIMIT ?
  `)
  const rows = stmt.all(limit) as BatchTaskDb[]
  return rows.map(mapTaskFromDb)
}

export function findTaskById(id: number): BatchTask | undefined {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT
      id, task_name as taskName, created_by as createdBy, created_by_name as createdByName,
      status, file_name as fileName, file_size as fileSize, field_mapping,
      total_count as totalCount, new_count as newCount, role_change_count as roleChangeCount,
      disable_count as disableCount, duplicate_count as duplicateCount,
      name_conflict_count as nameConflictCount, raw_csv_content as rawCsvContent,
      executed_at as executedAt, executed_by as executedBy, executed_by_name as executedByName,
      result_summary, created_at as createdAt, updated_at as updatedAt
    FROM batch_tasks
    WHERE id = ?
  `)
  const row = stmt.get(id) as BatchTaskDb | undefined
  return row ? mapTaskFromDb(row) : undefined
}

export function findItemsByTaskId(taskId: number): BatchTaskItem[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT
      id, task_id as taskId, item_type as itemType, line_number as lineNumber,
      username, name, email, role, old_role as oldRole, password,
      status, skip_reason as skipReason, error_message as errorMessage,
      user_id as userId, row_data, created_at as createdAt, updated_at as updatedAt
    FROM batch_task_items
    WHERE task_id = ?
    ORDER BY line_number ASC
  `)
  const rows = stmt.all(taskId) as BatchTaskItemDb[]
  return rows.map(mapItemFromDb)
}

export function findItemsByTaskIdAndType(taskId: number, itemType: BatchTaskItemType): BatchTaskItem[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT
      id, task_id as taskId, item_type as itemType, line_number as lineNumber,
      username, name, email, role, old_role as oldRole, password,
      status, skip_reason as skipReason, error_message as errorMessage,
      user_id as userId, row_data, created_at as createdAt, updated_at as updatedAt
    FROM batch_task_items
    WHERE task_id = ? AND item_type = ?
    ORDER BY line_number ASC
  `)
  const rows = stmt.all(taskId, itemType) as BatchTaskItemDb[]
  return rows.map(mapItemFromDb)
}

export function createTask(data: {
  taskName: string
  createdBy: number
  createdByName: string
  fileName: string
  fileSize: number
  fieldMapping: FieldMapping
  rawCsvContent: string
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO batch_tasks (
      task_name, created_by, created_by_name, status, file_name, file_size,
      field_mapping, raw_csv_content
    ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.taskName,
    data.createdBy,
    data.createdByName,
    data.fileName,
    data.fileSize,
    JSON.stringify(data.fieldMapping),
    data.rawCsvContent
  )
  return Number(result.lastInsertRowid)
}

export function updateTaskCounts(
  taskId: number,
  counts: {
    totalCount: number
    newCount: number
    roleChangeCount: number
    disableCount: number
    duplicateCount: number
    nameConflictCount: number
  }
): boolean {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE batch_tasks
    SET total_count = ?, new_count = ?, role_change_count = ?,
        disable_count = ?, duplicate_count = ?, name_conflict_count = ?,
        status = 'pending_review', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const result = stmt.run(
    counts.totalCount,
    counts.newCount,
    counts.roleChangeCount,
    counts.disableCount,
    counts.duplicateCount,
    counts.nameConflictCount,
    taskId
  )
  return result.changes > 0
}

export function updateTaskStatus(taskId: number, status: BatchTaskStatus): boolean {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE batch_tasks
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const result = stmt.run(status, taskId)
  return result.changes > 0
}

export function updateTaskExecuted(
  taskId: number,
  data: {
    status: BatchTaskStatus
    executedBy: number
    executedByName: string
    resultSummary: BatchTaskResultSummary
  }
): boolean {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE batch_tasks
    SET status = ?, executed_at = CURRENT_TIMESTAMP,
        executed_by = ?, executed_by_name = ?,
        result_summary = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const result = stmt.run(
    data.status,
    data.executedBy,
    data.executedByName,
    JSON.stringify(data.resultSummary),
    taskId
  )
  return result.changes > 0
}

export function deleteTask(taskId: number): boolean {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM batch_tasks WHERE id = ?')
  const result = stmt.run(taskId)
  return result.changes > 0
}

export function bulkInsertItems(taskId: number, items: Array<{
  itemType: BatchTaskItemType
  lineNumber: number
  username: string
  name: string
  email?: string | null
  role?: string | null
  oldRole?: string | null
  password?: string | null
  status?: BatchTaskItemStatus
  skipReason?: string | null
  errorMessage?: string | null
  rowData: Record<string, string>
}>): void {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO batch_task_items (
      task_id, item_type, line_number, username, name, email, role,
      old_role, password, status, skip_reason, error_message, row_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction((itemList: typeof items) => {
    for (const item of itemList) {
      stmt.run(
        taskId,
        item.itemType,
        item.lineNumber,
        item.username,
        item.name,
        item.email ?? null,
        item.role ?? null,
        item.oldRole ?? null,
        item.password ?? null,
        item.status || 'pending',
        item.skipReason ?? null,
        item.errorMessage ?? null,
        JSON.stringify(item.rowData)
      )
    }
  })

  transaction(items)
}

export function updateItemStatus(itemId: number, status: BatchTaskItemStatus, skipReason?: string): boolean {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE batch_task_items
    SET status = ?, skip_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const result = stmt.run(status, skipReason ?? null, itemId)
  return result.changes > 0
}

export function updateItemResult(
  itemId: number,
  data: {
    status: BatchTaskItemStatus
    userId?: number | null
    errorMessage?: string | null
  }
): boolean {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE batch_task_items
    SET status = ?, user_id = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const result = stmt.run(
    data.status,
    data.userId ?? null,
    data.errorMessage ?? null,
    itemId
  )
  return result.changes > 0
}

export function bulkUpdateItemsStatus(
  taskId: number,
  itemType: BatchTaskItemType,
  status: BatchTaskItemStatus,
  skipReason?: string
): number {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE batch_task_items
    SET status = ?, skip_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE task_id = ? AND item_type = ?
  `)
  const result = stmt.run(status, skipReason ?? null, taskId, itemType)
  return result.changes
}

export function getTaskSummaryList(limit = 50): BatchTask['id'][] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id FROM batch_tasks ORDER BY created_at DESC LIMIT ?
  `)
  const rows = stmt.all(limit) as { id: number }[]
  return rows.map((r) => r.id)
}
