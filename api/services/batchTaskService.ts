import bcrypt from 'bcryptjs'
import * as batchTaskRepository from '../repositories/batchTaskRepository.js'
import * as userRepository from '../repositories/userRepository.js'
import * as adminLogRepository from '../repositories/adminLogRepository.js'
import { getDb } from '../db/index.js'
import type {
  BatchTask,
  BatchTaskItem,
  BatchTaskItemType,
  BatchTaskItemStatus,
  BatchTaskResultSummary,
  FieldMapping,
  UserRole,
} from '../../shared/types.js'
import {
  USER_IMPORT_DEFAULT_PASSWORD,
  BATCH_TASK_ITEM_TYPE_LABELS,
  ADMIN_OPERATION_TYPES,
} from '../../shared/types.js'
import { BusinessError } from './userService.js'
import { parseCsvLines, escapeCsv } from '../utils/csv.js'
import {
  isEmailValid,
  isRoleValid,
  normalizeRole,
  buildDefaultMapping,
  isActionField,
  findActionHeader,
  normalizeAction,
} from '../utils/role.js'

export interface PrecheckBatchResult {
  taskId: number
  totalCount: number
  newCount: number
  roleChangeCount: number
  disableCount: number
  duplicateCount: number
  nameConflictCount: number
  items: BatchTaskItem[]
}

export function createAndPrecheckBatchTask(params: {
  taskName: string
  rawCsv: string
  fileName: string
  fileSize: number
  fieldMapping: FieldMapping
  userId: number
  userName: string
}): PrecheckBatchResult {
  if (!params.taskName || !params.taskName.trim()) {
    throw new BusinessError('任务名称不能为空', 'MISSING_TASK_NAME')
  }
  if (!params.rawCsv || !params.rawCsv.trim()) {
    throw new BusinessError('CSV内容不能为空', 'MISSING_CSV')
  }

  const { headers, dataRows } = parseCsvLines(params.rawCsv)
  const mapping = params.fieldMapping && Object.keys(params.fieldMapping).length > 0
    ? params.fieldMapping
    : buildDefaultMapping(headers)

  const existingUsers = userRepository.findAll()
  const existingUsernameMap = new Map(existingUsers.map(u => [u.username.toLowerCase(), u]))
  const existingNameMap = new Map(existingUsers.map(u => [u.name, u]))
  const existingEmailMap = new Map(existingUsers.filter(u => u.email).map(u => [u.email!.toLowerCase(), u]))

  const fileScopeUsernames = new Map<string, number>()
  const fileScopeNames = new Map<string, number>()
  const fileScopeEmails = new Map<string, number>()

  const items: Array<{
    itemType: BatchTaskItemType
    lineNumber: number
    username: string
    name: string
    email: string | null
    role: string | null
    oldRole: string | null
    password: string | null
    status: BatchTaskItemStatus
    skipReason: string | null
    errorMessage: string | null
    rowData: Record<string, string>
  }> = []

  const hasActionField = isActionField(headers, mapping)
  const actionHeader = hasActionField ? findActionHeader(headers, mapping) : ''

  for (const { lineNumber, values } of dataRows) {
    const rowData: Record<string, string> = {}
    headers.forEach((h, idx) => {
      rowData[h] = values[idx] ?? ''
    })

    const username = mapping.username ? (rowData[mapping.username] || '').trim() : ''
    const name = mapping.name ? (rowData[mapping.name] || '').trim() : ''
    const email = mapping.email ? (rowData[mapping.email] || '').trim() : ''
    const role = mapping.role ? (rowData[mapping.role] || '').trim() : ''
    const password = mapping.password ? (rowData[mapping.password] || '').trim() : ''
    const action = actionHeader ? (rowData[actionHeader] || '').trim() : ''

    const errors: string[] = []
    const warnings: string[] = []

    if (!username) errors.push('用户名为空')
    if (!name) errors.push('姓名为空')
    if (!role) {
      errors.push('角色为空')
    } else if (!isRoleValid(role)) {
      errors.push(`角色「${role}」无效`)
    }
    if (email && !isEmailValid(email)) {
      errors.push(`邮箱「${email}」格式不正确`)
    }

    let itemType: BatchTaskItemType = 'new'
    let oldRole: string | null = null

    const existingByUsername = username ? existingUsernameMap.get(username.toLowerCase()) : undefined
    const existingByName = name ? existingNameMap.get(name) : undefined
    const existingUser = existingByUsername || existingByName

    const normalizedAction = hasActionField ? normalizeAction(action) : 'unknown'

    switch (normalizedAction) {
      case 'disable':
        itemType = 'disable'
        if (existingUser) {
          oldRole = existingUser.role
        } else {
          errors.push('停用的用户不存在')
        }
        break

      case 'update':
        itemType = 'role_change'
        if (existingUser) {
          oldRole = existingUser.role
          if (oldRole === normalizeRole(role)) {
            warnings.push('角色未发生变化')
          }
        } else {
          errors.push('角色变更的用户不存在')
        }
        break

      case 'add':
      case 'unknown':
      default:
        if (hasActionField) {
          itemType = 'new'
          if (existingByUsername) {
            itemType = 'duplicate_account'
            errors.push(`用户名「${username}」已存在`)
          }
          if (existingByName) {
            if (itemType === 'duplicate_account') {
              errors.push(`姓名「${name}」已存在`)
            } else {
              itemType = 'name_conflict'
              errors.push(`姓名「${name}」已存在`)
            }
          }
        } else {
          if (existingByUsername) {
            oldRole = existingByUsername.role
            if (role && normalizeRole(role) !== existingByUsername.role) {
              itemType = 'role_change'
            } else {
              itemType = 'duplicate_account'
              errors.push(`用户名「${username}」已存在`)
            }
          } else if (existingByName) {
            itemType = 'name_conflict'
            errors.push(`姓名「${name}」已存在`)
          } else {
            itemType = 'new'
          }
        }
        break
    }

    if (username) {
      const unameLower = username.toLowerCase()
      if (fileScopeUsernames.has(unameLower)) {
        if (itemType === 'new') {
          itemType = 'duplicate_account'
        }
        errors.push(`用户名与 CSV 内第 ${fileScopeUsernames.get(unameLower)} 行重复`)
      } else {
        fileScopeUsernames.set(unameLower, lineNumber)
      }
    }

    if (name) {
      if (fileScopeNames.has(name)) {
        if (itemType === 'new') {
          itemType = 'name_conflict'
        }
        errors.push(`姓名与 CSV 内第 ${fileScopeNames.get(name)} 行重复`)
      } else {
        fileScopeNames.set(name, lineNumber)
      }
    }

    if (email) {
      const emailLower = email.toLowerCase()
      if (existingEmailMap.has(emailLower)) {
        errors.push(`邮箱「${email}」已被使用`)
      }
      if (fileScopeEmails.has(emailLower)) {
        errors.push(`邮箱与 CSV 内第 ${fileScopeEmails.get(emailLower)} 行重复`)
      } else {
        fileScopeEmails.set(emailLower, lineNumber)
      }
    }

    const hasErrors = errors.length > 0
    const status: BatchTaskItemStatus = hasErrors ? 'skipped' : 'pending'
    const errorMessage = hasErrors ? errors.join('；') : null
    const skipReason = hasErrors ? '数据校验不通过' : null

    items.push({
      itemType,
      lineNumber,
      username,
      name,
      email: email || null,
      role: role || null,
      oldRole,
      password: password || null,
      status,
      skipReason,
      errorMessage,
      rowData,
    })
  }

  const taskId = batchTaskRepository.createTask({
    taskName: params.taskName.trim(),
    createdBy: params.userId,
    createdByName: params.userName,
    fileName: params.fileName,
    fileSize: params.fileSize,
    fieldMapping: mapping,
    rawCsvContent: params.rawCsv,
  })

  if (items.length > 0) {
    batchTaskRepository.bulkInsertItems(taskId, items)
  }

  const counts = {
    totalCount: items.length,
    newCount: items.filter(i => i.itemType === 'new').length,
    roleChangeCount: items.filter(i => i.itemType === 'role_change').length,
    disableCount: items.filter(i => i.itemType === 'disable').length,
    duplicateCount: items.filter(i => i.itemType === 'duplicate_account').length,
    nameConflictCount: items.filter(i => i.itemType === 'name_conflict').length,
  }

  batchTaskRepository.updateTaskCounts(taskId, counts)

  const taskItems = batchTaskRepository.findItemsByTaskId(taskId)

  return {
    taskId,
    ...counts,
    items: taskItems,
  }
}

export function getBatchTaskList(limit = 50): BatchTask[] {
  return batchTaskRepository.findAllTasks(limit)
}

export function getBatchTaskDetail(taskId: number): { task: BatchTask; items: BatchTaskItem[] } {
  const task = batchTaskRepository.findTaskById(taskId)
  if (!task) {
    throw new BusinessError('任务不存在', 'TASK_NOT_FOUND', 404)
  }
  const items = batchTaskRepository.findItemsByTaskId(taskId)
  return { task, items }
}

export function updateBatchTaskItemStatus(
  itemId: number,
  status: BatchTaskItemStatus,
  skipReason?: string
): boolean {
  const success = batchTaskRepository.updateItemStatus(itemId, status, skipReason)
  if (!success) {
    throw new BusinessError('更新条目状态失败', 'UPDATE_FAILED')
  }
  return success
}

export function bulkIgnoreByType(
  taskId: number,
  itemType: BatchTaskItemType
): number {
  const task = batchTaskRepository.findTaskById(taskId)
  if (!task) {
    throw new BusinessError('任务不存在', 'TASK_NOT_FOUND', 404)
  }
  if (task.status === 'executing' || task.status === 'completed' || task.status === 'failed') {
    throw new BusinessError('任务已执行，无法修改', 'TASK_ALREADY_EXECUTED')
  }
  return batchTaskRepository.bulkUpdateItemsStatus(taskId, itemType, 'ignored', '批量忽略')
}

export function bulkRestoreByType(
  taskId: number,
  itemType: BatchTaskItemType
): number {
  const task = batchTaskRepository.findTaskById(taskId)
  if (!task) {
    throw new BusinessError('任务不存在', 'TASK_NOT_FOUND', 404)
  }
  if (task.status === 'executing' || task.status === 'completed' || task.status === 'failed') {
    throw new BusinessError('任务已执行，无法修改', 'TASK_ALREADY_EXECUTED')
  }
  return batchTaskRepository.bulkUpdateItemsStatus(taskId, itemType, 'pending')
}

export function deleteBatchTask(taskId: number): boolean {
  const task = batchTaskRepository.findTaskById(taskId)
  if (!task) {
    throw new BusinessError('任务不存在', 'TASK_NOT_FOUND', 404)
  }
  if (task.status === 'executing') {
    throw new BusinessError('任务执行中，无法删除', 'TASK_EXECUTING')
  }
  return batchTaskRepository.deleteTask(taskId)
}

export function executeBatchTask(
  taskId: number,
  operatorId: number,
  operatorName: string
): BatchTaskResultSummary {
  const task = batchTaskRepository.findTaskById(taskId)
  if (!task) {
    throw new BusinessError('任务不存在', 'TASK_NOT_FOUND', 404)
  }
  if (task.status === 'executing') {
    throw new BusinessError('任务正在执行中', 'TASK_EXECUTING')
  }
  if (task.status === 'completed') {
    throw new BusinessError('任务已完成，不能重复执行', 'TASK_ALREADY_COMPLETED')
  }

  batchTaskRepository.updateTaskStatus(taskId, 'executing')

  const items = batchTaskRepository.findItemsByTaskId(taskId)

  const failedItems: BatchTaskResultSummary['failedItems'] = []
  const skippedItems: BatchTaskResultSummary['skippedItems'] = []
  let successCount = 0
  let ignoredCount = 0
  let newSuccess = 0
  let roleChangeSuccess = 0
  let disableSuccess = 0

  const db = getDb()
  const transaction = db.transaction(() => {
    for (const item of items) {
      if (item.status === 'ignored') {
        ignoredCount++
        skippedItems.push({
          id: item.id,
          username: item.username,
          name: item.name,
          reason: item.skipReason || '已忽略',
        })
        continue
      }

      batchTaskRepository.updateItemResult(item.id, { status: 'executing' })

      try {
        if (item.itemType === 'new') {
          const password = item.password || USER_IMPORT_DEFAULT_PASSWORD
          const passwordHash = bcrypt.hashSync(password, 10)
          const role = normalizeRole(item.role || 'submitter')

          const id = userRepository.create(
            item.username,
            passwordHash,
            item.name,
            role,
            item.email
          )

          batchTaskRepository.updateItemResult(item.id, {
            status: 'success',
            userId: id,
          })
          successCount++
          newSuccess++
        } else if (item.itemType === 'role_change') {
          const existingUser = userRepository.findByUsername(item.username) || userRepository.findByName(item.name)
          if (!existingUser) {
            throw new Error('用户不存在')
          }
          const role = normalizeRole(item.role || existingUser.role)
          userRepository.update(existingUser.id, { role })
          batchTaskRepository.updateItemResult(item.id, {
            status: 'success',
            userId: existingUser.id,
          })
          successCount++
          roleChangeSuccess++
        } else if (item.itemType === 'disable') {
          const existingUser = userRepository.findByUsername(item.username) || userRepository.findByName(item.name)
          if (!existingUser) {
            throw new Error('用户不存在')
          }
          userRepository.deleteUser(existingUser.id)
          batchTaskRepository.updateItemResult(item.id, {
            status: 'success',
            userId: existingUser.id,
          })
          successCount++
          disableSuccess++
        } else {
          batchTaskRepository.updateItemResult(item.id, {
            status: 'skipped',
            errorMessage: item.errorMessage || '存在冲突，跳过执行',
          })
          skippedItems.push({
            id: item.id,
            username: item.username,
            name: item.name,
            reason: item.errorMessage || BATCH_TASK_ITEM_TYPE_LABELS[item.itemType],
          })
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        batchTaskRepository.updateItemResult(item.id, {
          status: 'failed',
          errorMessage: errorMsg,
        })
        failedItems.push({
          id: item.id,
          username: item.username,
          name: item.name,
          error: errorMsg,
        })
      }
    }
  })

  try {
    transaction()
  } catch (err) {
    batchTaskRepository.updateTaskStatus(taskId, 'failed')
    throw err
  }

  const resultSummary: BatchTaskResultSummary = {
    successCount,
    failedCount: failedItems.length,
    skippedCount: skippedItems.length,
    ignoredCount,
    newSuccess,
    roleChangeSuccess,
    disableSuccess,
    failedItems,
    skippedItems,
  }

  batchTaskRepository.updateTaskExecuted(taskId, {
    status: 'completed',
    executedBy: operatorId,
    executedByName: operatorName,
    resultSummary,
  })

  adminLogRepository.create({
    operatorId,
    operatorName,
    operationType: ADMIN_OPERATION_TYPES.USER_IMPORT,
    targetType: 'batch_task',
    targetId: String(taskId),
    summary: `批量成员变更任务「${task.taskName}」执行完成：成功 ${successCount} 条，失败 ${failedItems.length} 条，跳过 ${skippedItems.length} 条，忽略 ${ignoredCount} 条`,
    details: resultSummary,
  })

  return resultSummary
}

export function exportConflictCsv(taskId: number): string {
  const { items } = getBatchTaskDetail(taskId)

  const conflictTypes: BatchTaskItemType[] = ['duplicate_account', 'name_conflict']
  const conflictItems = items.filter(i => conflictTypes.includes(i.itemType))

  if (conflictItems.length === 0) {
    throw new BusinessError('没有冲突记录需要导出', 'NO_CONFLICTS')
  }

  const headers = ['行号', '类型', '用户名', '姓名', '邮箱', '角色', '冲突原因']
  const lines: string[] = [headers.map(escapeCsv).join(',')]

  for (const item of conflictItems) {
    const row: string[] = [
      String(item.lineNumber),
      BATCH_TASK_ITEM_TYPE_LABELS[item.itemType],
      item.username,
      item.name,
      item.email || '',
      item.role || '',
      item.errorMessage || '',
    ]
    lines.push(row.map(escapeCsv).join(','))
  }

  return '\uFEFF' + lines.join('\n')
}

export function getBatchTaskSummary(taskId: number): {
  id: number
  taskName: string
  status: BatchTask['status']
  totalCount: number
  createdAt: string
  createdByName: string
} {
  const task = batchTaskRepository.findTaskById(taskId)
  if (!task) {
    throw new BusinessError('任务不存在', 'TASK_NOT_FOUND', 404)
  }
  return {
    id: task.id,
    taskName: task.taskName,
    status: task.status,
    totalCount: task.totalCount,
    createdAt: task.createdAt,
    createdByName: task.createdByName,
  }
}
