import bcrypt from 'bcryptjs'
import * as userRepository from '../repositories/userRepository.js'
import * as importDraftRepository from '../repositories/importDraftRepository.js'
import * as adminLogRepository from '../repositories/adminLogRepository.js'
import type { User, UserRole, DraftType } from '../../shared/types.js'
import {
  USER_IMPORT_FIELDS,
  USER_IMPORT_DEFAULT_PASSWORD,
  type FieldMapping,
  type UserImportPrecheckResult,
  type PrecheckHeaderIssue,
  type PrecheckRowError,
  type UserImportResult,
  type ImportDraft,
  type AdminOperationLog,
  ADMIN_OPERATION_TYPES,
} from '../../shared/types.js'
import { parseCsvLines } from '../utils/csv.js'
import {
  isEmailValid,
  isRoleValid,
  normalizeRole,
  buildDefaultMapping,
} from '../utils/role.js'

export class BusinessError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function getUsers(): User[] {
  return userRepository.findAll()
}

export function createUser(
  username: string,
  password: string,
  name: string,
  role: UserRole,
  email?: string | null
): { success: boolean; error?: string; user?: User } {
  if (!username || !password || !name || !role) {
    throw new BusinessError('用户名、密码、姓名和角色不能为空', 'MISSING_FIELDS')
  }

  const existing = userRepository.findByUsername(username)
  if (existing) {
    throw new BusinessError('用户名已存在', 'USERNAME_EXISTS')
  }

  if (email) {
    const existingEmail = userRepository.findByEmail(email)
    if (existingEmail) {
      throw new BusinessError('邮箱已被使用', 'EMAIL_EXISTS')
    }
  }

  const passwordHash = bcrypt.hashSync(password, 10)
  const id = userRepository.create(username, passwordHash, name, role, email)
  const user = userRepository.findById(id)

  if (!user) {
    throw new BusinessError('创建用户失败', 'CREATE_FAILED', 500)
  }

  return { success: true, user }
}

export function updateUser(
  id: number,
  data: { name?: string; role?: UserRole; password?: string; email?: string | null }
): { success: boolean; error?: string } {
  const existing = userRepository.findById(id)
  if (!existing) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND', 404)
  }

  const updateData: Partial<{ name: string; role: string; password_hash: string; email: string | null }> = {}

  if (data.name !== undefined) {
    updateData.name = data.name
  }
  if (data.role !== undefined) {
    updateData.role = data.role
  }
  if (data.password !== undefined) {
    updateData.password_hash = bcrypt.hashSync(data.password, 10)
  }
  if (data.email !== undefined) {
    if (data.email) {
      const existingByEmail = userRepository.findByEmail(data.email)
      if (existingByEmail && existingByEmail.id !== id) {
        throw new BusinessError('邮箱已被其他用户使用', 'EMAIL_EXISTS')
      }
    }
    updateData.email = data.email
  }

  if (Object.keys(updateData).length === 0) {
    throw new BusinessError('没有需要更新的字段', 'NO_FIELDS_TO_UPDATE')
  }

  const success = userRepository.update(id, updateData)
  if (!success) {
    throw new BusinessError('更新用户失败', 'UPDATE_FAILED', 500)
  }

  return { success: true }
}

export function deleteUser(id: number): { success: boolean; error?: string } {
  const existing = userRepository.findById(id)
  if (!existing) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND', 404)
  }

  const success = userRepository.deleteUser(id)
  if (!success) {
    throw new BusinessError('删除用户失败', 'DELETE_FAILED', 500)
  }

  return { success: true }
}

export function login(
  username: string,
  password: string
): { success: boolean; user?: User; error?: string } {
  if (!username || !password) {
    throw new BusinessError('用户名和密码不能为空', 'MISSING_CREDENTIALS')
  }

  const userWithPassword = userRepository.findByUsername(username)
  if (!userWithPassword) {
    throw new BusinessError('用户名或密码错误', 'INVALID_CREDENTIALS', 401)
  }

  const isPasswordValid = bcrypt.compareSync(password, userWithPassword.password_hash)
  if (!isPasswordValid) {
    throw new BusinessError('用户名或密码错误', 'INVALID_CREDENTIALS', 401)
  }

  const user: User = {
    id: userWithPassword.id,
    username: userWithPassword.username,
    name: userWithPassword.name,
    email: userWithPassword.email ?? null,
    role: userWithPassword.role,
    createdAt: userWithPassword.createdAt,
  }

  return { success: true, user }
}

export function precheckUserImport(
  rawCsv: string,
  fileName: string,
  fileSize: number,
  customMapping?: FieldMapping
): UserImportPrecheckResult {
  const { headers, dataRows } = parseCsvLines(rawCsv)
  const fieldMapping = customMapping && Object.keys(customMapping).length > 0
    ? customMapping
    : buildDefaultMapping(headers)

  const headerIssues: PrecheckHeaderIssue[] = []
  const rowErrors: PrecheckRowError[] = []

  const requiredFields = USER_IMPORT_FIELDS.filter((f) => f.required)
  for (const req of requiredFields) {
    if (!fieldMapping[req.key]) {
      headerIssues.push({
        type: 'MISSING_REQUIRED_COLUMN',
        expected: [req.label, req.key],
        message: `缺少必填列「${req.label}」(${req.key})，该字段是导入必须的`,
      })
    }
  }

  const mappedHeaderKeys = Object.values(fieldMapping)
  for (const h of headers) {
    if (!mappedHeaderKeys.includes(h) && USER_IMPORT_FIELDS.every((f) => f.label !== h && f.key !== h)) {
      headerIssues.push({
        type: 'UNKNOWN_HEADER',
        header: h,
        message: `表头「${h}」未被识别，请在字段映射中手动选择或忽略该列`,
      })
    }
  }

  const existingUsernames = new Set(userRepository.findAllUsernames().map((s) => s.toLowerCase()))
  const existingNames = new Set(userRepository.findAllNames().map((s) => s))
  const existingEmails = new Set(userRepository.findAllEmails().map((s) => s.toLowerCase()))

  const fileScopeUsernames = new Map<string, number>()
  const fileScopeNames = new Map<string, number>()
  const fileScopeEmails = new Map<string, number>()

  const parsedRows: UserImportPrecheckResult['parsedRows'] = []

  for (const { lineNumber, values } of dataRows) {
    const rowData: Record<string, string> = {}
    headers.forEach((h, idx) => {
      rowData[h] = values[idx] ?? ''
    })

    const username = fieldMapping.username ? (rowData[fieldMapping.username] || '').trim() : ''
    const name = fieldMapping.name ? (rowData[fieldMapping.name] || '').trim() : ''
    const email = fieldMapping.email ? (rowData[fieldMapping.email] || '').trim() : ''
    const role = fieldMapping.role ? (rowData[fieldMapping.role] || '').trim() : ''
    const password = fieldMapping.password ? (rowData[fieldMapping.password] || '').trim() : ''

    const errors: PrecheckRowError['errors'] = []

    if (!username) {
      errors.push({
        type: 'EMPTY_REQUIRED_FIELD',
        field: 'username',
        value: username,
        message: '用户名为空，这是必填字段',
      })
    } else if (username.length < 3) {
      errors.push({
        type: 'EMPTY_REQUIRED_FIELD',
        field: 'username',
        value: username,
        message: '用户名长度不足3个字符',
      })
    }

    if (!name) {
      errors.push({
        type: 'EMPTY_REQUIRED_FIELD',
        field: 'name',
        value: name,
        message: '姓名为空，这是必填字段',
      })
    }

    if (!role) {
      errors.push({
        type: 'EMPTY_REQUIRED_FIELD',
        field: 'role',
        value: role,
        message: '角色为空，这是必填字段',
      })
    } else if (!isRoleValid(role)) {
      errors.push({
        type: 'INVALID_ROLE',
        field: 'role',
        value: role,
        message: `角色「${role}」无效，仅支持 admin/reviewer/submitter 或 管理员/评审人/提交者`,
      })
    }

    if (email && !isEmailValid(email)) {
      errors.push({
        type: 'INVALID_EMAIL',
        field: 'email',
        value: email,
        message: `邮箱「${email}」格式不正确`,
      })
    }

    if (password && password.length < 6) {
      errors.push({
        type: 'WEAK_PASSWORD',
        field: 'password',
        value: '***',
        message: '密码长度不足6个字符，或留空使用默认密码',
      })
    }

    if (username) {
      const unameLower = username.toLowerCase()
      if (existingUsernames.has(unameLower)) {
        errors.push({
          type: 'USERNAME_EXISTS',
          field: 'username',
          value: username,
          message: `用户名「${username}」已存在于系统中`,
        })
      }
      if (fileScopeUsernames.has(unameLower)) {
        errors.push({
          type: 'ROW_INTERNAL_DUP_USERNAME',
          field: 'username',
          value: username,
          message: `用户名「${username}」与 CSV 内第 ${fileScopeUsernames.get(unameLower)} 行重复`,
        })
      } else {
        fileScopeUsernames.set(unameLower, lineNumber)
      }
    }

    if (name) {
      if (existingNames.has(name)) {
        errors.push({
          type: 'NAME_EXISTS',
          field: 'name',
          value: name,
          message: `姓名「${name}」已存在于系统中`,
        })
      }
      if (fileScopeNames.has(name)) {
        errors.push({
          type: 'ROW_INTERNAL_DUP_NAME',
          field: 'name',
          value: name,
          message: `姓名「${name}」与 CSV 内第 ${fileScopeNames.get(name)} 行重复`,
        })
      } else {
        fileScopeNames.set(name, lineNumber)
      }
    }

    if (email) {
      const emailLower = email.toLowerCase()
      if (existingEmails.has(emailLower)) {
        errors.push({
          type: 'EMAIL_EXISTS',
          field: 'email',
          value: email,
          message: `邮箱「${email}」已被其他用户使用`,
        })
      }
      if (fileScopeEmails.has(emailLower)) {
        errors.push({
          type: 'ROW_INTERNAL_DUP_EMAIL',
          field: 'email',
          value: email,
          message: `邮箱「${email}」与 CSV 内第 ${fileScopeEmails.get(emailLower)} 行重复`,
        })
      } else {
        fileScopeEmails.set(emailLower, lineNumber)
      }
    }

    if (errors.length > 0) {
      rowErrors.push({ lineNumber, rowData, errors })
    }

    parsedRows.push({ lineNumber, username, name, email, role, password, rawRow: rowData })
  }

  const totalRows = parsedRows.length
  const invalidRows = rowErrors.length
  const validRows = totalRows - invalidRows

  return {
    totalRows,
    validRows,
    invalidRows,
    headerIssues,
    rowErrors,
    fieldMapping,
    detectedHeaders: headers,
    fileSummary: {
      fileName,
      fileSize,
      totalDataLines: dataRows.length,
    },
    parsedRows,
  }
}

export function submitUserImport(
  rawCsv: string,
  fieldMapping: FieldMapping,
  applyDefaultPassword = true
): UserImportResult {
  const precheck = precheckUserImport(rawCsv, 'submit.csv', 0, fieldMapping)
  const invalidLineSet = new Set(precheck.rowErrors.map((r) => r.lineNumber))

  const skippedReasons: UserImportResult['skippedReasons'] = []
  const createdUserIds: number[] = []
  let imported = 0

  for (const row of precheck.parsedRows) {
    if (invalidLineSet.has(row.lineNumber)) {
      const rowErr = precheck.rowErrors.find((r) => r.lineNumber === row.lineNumber)
      skippedReasons.push({
        lineNumber: row.lineNumber,
        username: row.username,
        name: row.name,
        reasons: rowErr ? rowErr.errors.map((e) => e.message) : ['预检查未通过'],
      })
      continue
    }

    try {
      const role = normalizeRole(row.role)
      const password = row.password || (applyDefaultPassword ? USER_IMPORT_DEFAULT_PASSWORD : '')
      if (!password) {
        skippedReasons.push({
          lineNumber: row.lineNumber,
          username: row.username,
          name: row.name,
          reasons: ['密码为空且未启用默认密码'],
        })
        continue
      }
      const id = userRepository.create(
        row.username,
        bcrypt.hashSync(password, 10),
        row.name,
        role,
        row.email || null
      )
      createdUserIds.push(id)
      imported++
    } catch (err) {
      skippedReasons.push({
        lineNumber: row.lineNumber,
        username: row.username,
        name: row.name,
        reasons: [err instanceof Error ? err.message : '创建失败，未知错误'],
      })
    }
  }

  return {
    imported,
    skipped: skippedReasons.length,
    skippedReasons,
    createdUserIds,
    defaultPasswordUsed: applyDefaultPassword,
  }
}

export function saveImportDraft(
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
  return importDraftRepository.upsert(userId, draftType, data)
}

export function getImportDraft(
  userId: number,
  draftType: DraftType
): ImportDraft | undefined {
  return importDraftRepository.findByUserAndType(userId, draftType)
}

export function clearImportDraft(userId: number, draftType: DraftType): boolean {
  return importDraftRepository.deleteByUserAndType(userId, draftType)
}

export function writeAdminOperationLog(
  operatorId: number,
  operatorName: string,
  operationType: string,
  summary: string,
  options: { targetType?: string; targetId?: string | null; details?: unknown } = {}
): number {
  return adminLogRepository.create({
    operatorId,
    operatorName,
    operationType,
    targetType: options.targetType,
    targetId: options.targetId,
    summary,
    details: options.details,
  })
}

export function getAdminOperationLogs(limit = 200): AdminOperationLog[] {
  return adminLogRepository.findAll(limit)
}

export function getUserImportLogs(): AdminOperationLog[] {
  return adminLogRepository.findByOperationType(ADMIN_OPERATION_TYPES.USER_IMPORT)
}

export { USER_IMPORT_FIELDS }
