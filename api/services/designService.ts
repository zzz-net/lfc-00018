import * as designRepository from '../repositories/designRepository.js'
import * as userRepository from '../repositories/userRepository.js'
import * as commentRepository from '../repositories/commentRepository.js'
import * as logRepository from '../repositories/logRepository.js'
import { BusinessError } from './userService.js'
import type {
  Design,
  ImportDesignItem,
  ImportConflict,
  ClaimConflictData,
  ExportFilter,
  Comment,
  OperationLog,
  DesignStatus,
} from '../../shared/types.js'

export function getDesigns(): Design[] {
  return designRepository.findAll()
}

export function getDesignById(id: number): Design | undefined {
  return designRepository.findById(id)
}

export function importDesigns(
  items: ImportDesignItem[]
): { imported: number; conflicts: ImportConflict[] } {
  if (!items || items.length === 0) {
    throw new BusinessError('导入数据不能为空', 'EMPTY_IMPORT')
  }

  const conflicts: ImportConflict[] = []
  let imported = 0

  for (const item of items) {
    if (!item.designId || !item.name || !item.submitter) {
      throw new BusinessError('design_id、名称和提交者不能为空', 'MISSING_FIELDS')
    }

    const existing = designRepository.findByDesignId(item.designId)
    if (existing) {
      const commentCount = commentRepository.countByDesignId(existing.id)
      conflicts.push({
        designId: item.designId,
        name: item.name,
        existingCreatedAt: existing.createdAt,
        commentCount,
        message: `design_id ${item.designId} 已存在，包含 ${commentCount} 条评论，已跳过`,
      })
      continue
    }

    const submitter = userRepository.findByUsernameOrName(item.submitter)
    if (!submitter) {
      throw new BusinessError(`提交者 ${item.submitter} 不存在，请检查用户名或姓名是否正确`, 'SUBMITTER_NOT_FOUND')
    }

    const maxOrder = designRepository.getMaxQueueOrder()
    designRepository.create({
      designId: item.designId,
      name: item.name,
      description: item.description || '',
      submitterId: submitter.id,
      submitterName: submitter.name,
      priority: item.priority || 'medium',
      queueOrder: maxOrder + 1,
    })

    imported++
  }

  return { imported, conflicts }
}

export function claimDesign(
  designId: number,
  reviewerId: number,
  reviewerName: string,
  version: number,
  reviewerRole?: string
): {
  success: boolean
  design?: Design
  error?: string
  conflictData?: ClaimConflictData
} {
  if (reviewerRole && reviewerRole !== 'reviewer' && reviewerRole !== 'admin') {
    throw new BusinessError('权限不足，只有评审人或管理员可以认领设计稿', 'PERMISSION_DENIED', 403)
  }

  const design = designRepository.findById(designId)
  if (!design) {
    throw new BusinessError('设计稿不存在', 'DESIGN_NOT_FOUND', 404)
  }

  if (design.status !== 'pending_claim') {
    if (design.status === 'reviewing' && design.reviewerId) {
      return {
        success: false,
        error: '该设计稿已被其他评审人认领',
        conflictData: {
          currentReviewer: design.reviewerName || '',
          claimTime: design.updatedAt,
        },
      }
    }
    if (design.status === 'pending_review') {
      return {
        success: false,
        error: '该设计稿处于待复审状态，无需认领，由原评审人直接评审',
      }
    }
    throw new BusinessError('当前状态不允许认领', 'INVALID_STATUS')
  }

  if (design.version !== version) {
    throw new BusinessError('版本不匹配，请刷新后重试', 'VERSION_MISMATCH', 409)
  }

  const result = designRepository.claim(designId, reviewerId, reviewerName, version)
  if (!result.success || !result.updatedDesign) {
    throw new BusinessError('认领失败，请刷新后重试', 'CLAIM_FAILED', 500)
  }

  logRepository.create({
    designId,
    userId: reviewerId,
    userName: reviewerName,
    action: 'claim',
    oldStatus: design.status,
    newStatus: 'reviewing',
    details: '认领设计稿',
  })

  return { success: true, design: result.updatedDesign }
}

export function reviewDesign(
  designId: number,
  reviewerId: number,
  reviewerName: string,
  version: number,
  action: 'pass' | 'return',
  reason?: string,
  comment?: string
): { success: boolean; design?: Design; error?: string } {
  const design = designRepository.findById(designId)
  if (!design) {
    throw new BusinessError('设计稿不存在', 'DESIGN_NOT_FOUND', 404)
  }

  if (design.status !== 'reviewing' && design.status !== 'pending_review') {
    throw new BusinessError('只有评审中或待复审状态的设计稿才能进行评审操作', 'INVALID_STATUS')
  }

  if (design.reviewerId !== reviewerId) {
    throw new BusinessError('只有认领该设计稿的评审人才能进行评审', 'NOT_REVIEWER', 403)
  }

  if (design.submitterId === reviewerId && action === 'pass') {
    throw new BusinessError('提交者不能通过自己提交的设计稿', 'CANNOT_REVIEW_OWN', 403)
  }

  if (design.version !== version) {
    throw new BusinessError('版本不匹配，请刷新后重试', 'VERSION_MISMATCH', 409)
  }

  if (action === 'return' && !reason) {
    throw new BusinessError('退回操作必须填写原因', 'MISSING_RETURN_REASON')
  }

  const oldStatus = design.status
  let newStatus: DesignStatus
  let success: boolean

  if (action === 'pass') {
    success = designRepository.reviewPass(designId, version)
    newStatus = 'passed'
  } else {
    success = designRepository.reviewReturn(designId, reason!, version)
    newStatus = 'returned'
  }

  if (!success) {
    throw new BusinessError('评审失败，请刷新后重试', 'REVIEW_FAILED', 500)
  }

  if (action === 'return' && reason) {
    commentRepository.create({
      designId,
      userId: reviewerId,
      userName: reviewerName,
      userRole: 'reviewer',
      content: reason,
      isReturnReason: true,
    })
  }

  if (comment) {
    commentRepository.create({
      designId,
      userId: reviewerId,
      userName: reviewerName,
      userRole: 'reviewer',
      content: comment,
      isReturnReason: false,
    })
  }

  logRepository.create({
    designId,
    userId: reviewerId,
    userName: reviewerName,
    action: action === 'pass' ? 'pass' : 'return',
    oldStatus,
    newStatus,
    details: action === 'pass' ? '通过评审' : `退回修改：${reason}`,
  })

  const updatedDesign = designRepository.findById(designId)
  return { success: true, design: updatedDesign }
}

export function resubmitDesign(
  designId: number,
  submitterId: number,
  version: number
): { success: boolean; design?: Design; error?: string } {
  const design = designRepository.findById(designId)
  if (!design) {
    throw new BusinessError('设计稿不存在', 'DESIGN_NOT_FOUND', 404)
  }

  if (design.status !== 'returned') {
    throw new BusinessError('只有退回状态的设计稿才能重新提交', 'INVALID_STATUS')
  }

  if (design.submitterId !== submitterId) {
    throw new BusinessError('只有提交者才能重新提交该设计稿', 'NOT_SUBMITTER', 403)
  }

  if (design.version !== version) {
    throw new BusinessError('版本不匹配，请刷新后重试', 'VERSION_MISMATCH', 409)
  }

  const oldStatus = design.status
  const success = designRepository.resubmit(designId, version)
  if (!success) {
    throw new BusinessError('重新提交失败，请刷新后重试', 'RESUBMIT_FAILED', 500)
  }

  const submitter = userRepository.findById(submitterId)
  logRepository.create({
    designId,
    userId: submitterId,
    userName: submitter?.name || '',
    action: 'resubmit',
    oldStatus,
    newStatus: 'pending_review',
    details: '重新提交待复审',
  })

  const updatedDesign = designRepository.findById(designId)
  return { success: true, design: updatedDesign }
}

export function getDesignsForExport(filter: ExportFilter): {
  designs: Design[]
  commentsMap: Map<number, Comment[]>
  logsMap: Map<number, OperationLog[]>
} {
  const designs = designRepository.findByFilter(filter)
  const commentsMap = new Map<number, Comment[]>()
  const logsMap = new Map<number, OperationLog[]>()

  for (const design of designs) {
    const comments = commentRepository.findByDesignId(design.id)
    const logs = logRepository.findByDesignId(design.id)
    commentsMap.set(design.id, comments)
    logsMap.set(design.id, logs)
  }

  return { designs, commentsMap, logsMap }
}
