import type { UserRole, UserImportFieldDef } from '../../shared/types.js'
import { USER_IMPORT_FIELDS } from '../../shared/types.js'
import type { FieldMapping } from '../../shared/types.js'

export function isEmailValid(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isRoleValid(role: string): boolean {
  return ['admin', 'reviewer', 'submitter', '管理员', '评审人', '提交者'].includes(role)
}

export function normalizeRole(role: string): UserRole {
  const map: Record<string, UserRole> = {
    admin: 'admin',
    reviewer: 'reviewer',
    submitter: 'submitter',
    '管理员': 'admin',
    '评审人': 'reviewer',
    '提交者': 'submitter',
  }
  return map[role] || 'submitter'
}

export function buildDefaultMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {}
  const lowerToActual: Record<string, string> = {}
  headers.forEach((h) => {
    lowerToActual[h.toLowerCase()] = h
  })

  USER_IMPORT_FIELDS.forEach((field) => {
    const candidates = [
      field.key.toLowerCase(),
      field.label,
      field.label.toLowerCase(),
    ]
    for (const cand of candidates) {
      if (lowerToActual[cand]) {
        mapping[field.key] = lowerToActual[cand]
        break
      }
    }
  })

  return mapping
}

export function isActionField(headers: string[], fieldMapping: FieldMapping): boolean {
  const actionKeys = ['action', '操作', '变更类型']
  for (const h of headers) {
    if (actionKeys.some((k) => h.toLowerCase().includes(k.toLowerCase()))) {
      return true
    }
  }
  return !!fieldMapping.action
}

export function findActionHeader(headers: string[], mapping: FieldMapping): string {
  if (mapping.action) return mapping.action
  return (
    headers.find(
      (h) =>
        h.toLowerCase().includes('action') ||
        h.includes('操作') ||
        h.includes('变更类型')
    ) || ''
  )
}

export function normalizeAction(action: string): 'add' | 'update' | 'disable' | 'unknown' {
  const lower = action.toLowerCase().trim()
  if (lower === 'add' || lower === '新增' || lower === '创建') return 'add'
  if (
    lower === 'update' ||
    lower === '更新' ||
    lower === '修改' ||
    lower === 'role_change' ||
    lower === '角色变更'
  )
    return 'update'
  if (lower === 'disable' || lower === '停用' || lower === '删除') return 'disable'
  return 'unknown'
}
