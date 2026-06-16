import * as commentRepository from '../repositories/commentRepository.js'
import * as designRepository from '../repositories/designRepository.js'
import * as logRepository from '../repositories/logRepository.js'
import { BusinessError } from './userService.js'
import type { Comment, UserRole } from '../../shared/types.js'

export function getComments(designId: number): Comment[] {
  const design = designRepository.findById(designId)
  if (!design) {
    throw new BusinessError('设计稿不存在', 'DESIGN_NOT_FOUND', 404)
  }

  return commentRepository.findByDesignId(designId)
}

export function addComment(
  designId: number,
  userId: number,
  userName: string,
  userRole: string,
  content: string,
  isReturnReason: boolean = false
): Comment {
  const design = designRepository.findById(designId)
  if (!design) {
    throw new BusinessError('设计稿不存在', 'DESIGN_NOT_FOUND', 404)
  }

  if (!content || content.trim() === '') {
    throw new BusinessError('评论内容不能为空', 'EMPTY_CONTENT')
  }

  const id = commentRepository.create({
    designId,
    userId,
    userName,
    userRole,
    content: content.trim(),
    isReturnReason,
  })

  const comments = commentRepository.findByDesignId(designId)
  const newComment = comments.find((c) => c.id === id)

  if (!newComment) {
    throw new BusinessError('添加评论失败', 'ADD_COMMENT_FAILED', 500)
  }

  logRepository.create({
    designId,
    userId,
    userName,
    action: 'comment',
    oldStatus: design.status,
    newStatus: design.status,
    details: isReturnReason ? '添加退回原因' : '添加评论',
  })

  return newComment
}
