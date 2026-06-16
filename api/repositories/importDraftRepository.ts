import { getDb } from '../db/index.js'
import type {
  ImportDraft,
  DraftType,
  FieldMapping,
  UserImportPrecheckResult,
} from '../../shared/types.js'

function rowToImportDraft(row: Record<string, unknown>): ImportDraft {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    draftType: row.draft_type as DraftType,
    fileName: row.file_name as string,
    fileSize: row.file_size as number,
    fieldMapping: JSON.parse(row.field_mapping as string) as FieldMapping,
    precheckResult: JSON.parse(row.precheck_result as string) as UserImportPrecheckResult,
    rawCsvContent: row.raw_csv_content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function findByUserAndType(
  userId: number,
  draftType: DraftType
): ImportDraft | undefined {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM import_drafts
    WHERE user_id = ? AND draft_type = ?
  `)
  const row = stmt.get(userId, draftType) as Record<string, unknown> | undefined
  return row ? rowToImportDraft(row) : undefined
}

export function upsert(
  userId: number,
  draftType: DraftType,
  data: {
    fileName: string
    fileSize: number
    fieldMapping: FieldMapping
    precheckResult: UserImportPrecheckResult
    rawCsvContent: string
  }
): ImportDraft | undefined {
  const db = getDb()
  const fieldMappingJson = JSON.stringify(data.fieldMapping)
  const precheckJson = JSON.stringify(data.precheckResult)

  const existing = db
    .prepare(`SELECT id FROM import_drafts WHERE user_id = ? AND draft_type = ?`)
    .get(userId, draftType) as { id: number } | undefined

  if (existing) {
    const stmt = db.prepare(`
      UPDATE import_drafts
      SET file_name = ?,
          file_size = ?,
          field_mapping = ?,
          precheck_result = ?,
          raw_csv_content = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(
      data.fileName,
      data.fileSize,
      fieldMappingJson,
      precheckJson,
      data.rawCsvContent,
      existing.id
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO import_drafts (
        user_id, draft_type, file_name, file_size,
        field_mapping, precheck_result, raw_csv_content
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      userId,
      draftType,
      data.fileName,
      data.fileSize,
      fieldMappingJson,
      precheckJson,
      data.rawCsvContent
    )
  }

  return findByUserAndType(userId, draftType)
}

export function deleteByUserAndType(userId: number, draftType: DraftType): boolean {
  const db = getDb()
  const stmt = db.prepare(`
    DELETE FROM import_drafts WHERE user_id = ? AND draft_type = ?
  `)
  const result = stmt.run(userId, draftType)
  return result.changes > 0
}
