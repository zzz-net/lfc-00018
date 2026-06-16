import * as userRepository from '../repositories/userRepository.js'
import { getDesignsForExport } from './designService.js'
import { BusinessError } from './userService.js'
import {
  STATUS_LABELS,
  ROLE_LABELS,
  PRIORITY_LABELS,
} from '../../shared/types.js'
import type {
  ExportFilter,
  Design,
  Comment,
  OperationLog,
  UserRole,
} from '../../shared/types.js'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getFinalConclusion(design: Design, logs: OperationLog[]): string {
  const passLog = logs.find((l) => l.action === 'pass')
  const returnLog = logs.find((l) => l.action === 'return')

  if (design.status === 'passed' && passLog) {
    return `设计稿于 ${formatDate(passLog.createdAt)} 由 ${passLog.userName} 评审通过`
  }
  if (design.status === 'returned' && returnLog) {
    return `设计稿于 ${formatDate(returnLog.createdAt)} 被 ${returnLog.userName} 退回修改`
  }
  if (design.status === 'reviewing') {
    return `设计稿正在由 ${design.reviewerName || '未知'} 评审中`
  }
  if (design.status === 'pending_claim') {
    return '设计稿待认领'
  }
  if (design.status === 'pending_review') {
    return '设计稿待复审'
  }
  return '暂无最终结论'
}

function getFilterDescription(filter: ExportFilter, currentUserName: string): string {
  const parts: string[] = []

  if (filter.status) {
    parts.push(`状态：${STATUS_LABELS[filter.status]}`)
  }
  if (filter.submitterId) {
    const submitter = userRepository.findById(filter.submitterId)
    parts.push(`提交者：${submitter?.name || '未知'}`)
  }
  if (filter.reviewerId) {
    const reviewer = userRepository.findById(filter.reviewerId)
    parts.push(`评审人：${reviewer?.name || '未知'}`)
  }
  if (filter.startDate) {
    parts.push(`开始日期：${formatDate(filter.startDate)}`)
  }
  if (filter.endDate) {
    parts.push(`结束日期：${formatDate(filter.endDate)}`)
  }

  parts.push(`导出人：${currentUserName}`)

  return parts.length > 0 ? parts.join(' | ') : '无筛选条件'
}

function generateDesignMarkdown(
  design: Design,
  comments: Comment[],
  logs: OperationLog[],
  index: number
): string {
  const returnComments = comments.filter((c) => c.isReturnReason)
  const normalComments = comments.filter((c) => !c.isReturnReason)

  let md = `## ${index}. ${design.name}\n\n`
  md += `**设计ID**: ${design.designId}\n\n`
  md += `**状态**: <span style="color: var(--status-color)">${STATUS_LABELS[design.status]}</span>\n\n`
  md += `**优先级**: ${PRIORITY_LABELS[design.priority]}\n\n`
  md += `**提交者**: ${design.submitterName}\n\n`
  md += `**评审人**: ${design.reviewerName || '未分配'}\n\n`
  md += `**排队顺序**: ${design.queueOrder}\n\n`
  md += `**创建时间**: ${formatDate(design.createdAt)}\n\n`
  md += `**更新时间**: ${formatDate(design.updatedAt)}\n\n`
  md += `**版本**: ${design.version}\n\n`

  if (design.description) {
    md += `### 设计描述\n\n${design.description}\n\n`
  }

  if (returnComments.length > 0) {
    md += `### 退回原因\n\n`
    returnComments.forEach((comment, i) => {
      md += `${i + 1}. **${comment.userName}** (${ROLE_LABELS[comment.userRole as UserRole]}) - ${formatDate(comment.createdAt)}\n\n`
      md += `   > ${comment.content}\n\n`
    })
  }

  if (normalComments.length > 0) {
    md += `### 历史评论\n\n`
    normalComments.forEach((comment, i) => {
      md += `${i + 1}. **${comment.userName}** (${ROLE_LABELS[comment.userRole as UserRole]}) - ${formatDate(comment.createdAt)}\n\n`
      md += `   > ${comment.content}\n\n`
    })
  }

  if (logs.length > 0) {
    md += `### 操作日志\n\n`
    md += `| 时间 | 操作人 | 操作 | 状态变更 | 详情 |\n`
    md += `|------|--------|------|----------|------|\n`
    logs.forEach((log) => {
      const oldStatus = log.oldStatus ? STATUS_LABELS[log.oldStatus] : '-'
      const newStatus = log.newStatus ? STATUS_LABELS[log.newStatus] : '-'
      const statusChange = log.oldStatus && log.newStatus ? `${oldStatus} → ${newStatus}` : '-'
      md += `| ${formatDate(log.createdAt)} | ${log.userName} | ${log.action} | ${statusChange} | ${log.details || '-'} |\n`
    })
    md += `\n`
  }

  md += `### 最终结论\n\n${getFinalConclusion(design, logs)}\n\n`
  md += `---\n\n`

  return md
}

export function generateExportMarkdown(
  filter: ExportFilter,
  currentUserId: number,
  currentUserRole: string
): string {
  const currentUser = userRepository.findById(currentUserId)
  if (!currentUser) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND', 404)
  }

  const exportFilter: ExportFilter = { ...filter }

  if (currentUserRole === 'submitter') {
    exportFilter.submitterId = currentUserId
  }

  const { designs, commentsMap, logsMap } = getDesignsForExport(exportFilter)

  if (designs.length === 0) {
    throw new BusinessError('没有符合条件的设计稿可导出', 'NO_DESIGNS_TO_EXPORT')
  }

  let md = `# 设计稿评审纪要\n\n`
  md += `**导出时间**: ${formatDate(new Date().toISOString())}\n\n`
  md += `**筛选条件**: ${getFilterDescription(exportFilter, currentUser.name)}\n\n`
  md += `**导出数量**: ${designs.length} 个设计稿\n\n`
  md += `---\n\n`

  designs.forEach((design, index) => {
    const comments = commentsMap.get(design.id) || []
    const logs = logsMap.get(design.id) || []
    md += generateDesignMarkdown(design, comments, logs, index + 1)
  })

  md += `\n---\n\n`
  md += `*本纪要由设计稿评审系统自动生成于 ${formatDate(new Date().toISOString())}*\n`

  return md
}
