import { useState, useEffect } from 'react'
import { X, User, UserCheck, Clock, Hash, MessageSquare, Send, CheckCircle, XCircle, RotateCcw, AlertCircle } from 'lucide-react'
import type { Design, Comment } from '../../shared/types'
import { STATUS_LABELS, PRIORITY_LABELS, ROLE_LABELS } from '../../shared/types'
import { useAuthStore } from '@/store/useAuthStore'
import { useDesignStore } from '@/store/useDesignStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface DesignDetailDrawerProps {
  design: Design | null
  onClose: () => void
}

const statusColors: Record<string, string> = {
  pending_claim: 'bg-status-pending text-white',
  reviewing: 'bg-status-reviewing text-white',
  returned: 'bg-status-returned text-white',
  pending_review: 'bg-status-pendingReview text-white',
  passed: 'bg-status-passed text-white',
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-gray-400 text-white',
}

export default function DesignDetailDrawer({ design, onClose }: DesignDetailDrawerProps) {
  const { user } = useAuthStore()
  const { comments, fetchComments, addComment, claimDesign, reviewDesign, resubmitDesign, isLoading } = useDesignStore()
  const { showToast } = useToast()

  const [commentText, setCommentText] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [showReturnInput, setShowReturnInput] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const designComments = design ? comments[design.id] || [] : []

  useEffect(() => {
    if (design) {
      setIsVisible(true)
      fetchComments(design.id)
      setCommentText('')
      setReturnReason('')
      setShowReturnInput(false)
    } else {
      setIsVisible(false)
    }
  }, [design, fetchComments])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const canClaim = (): boolean => {
    if (!user || !design || design.status !== 'pending_claim') return false
    return user.role === 'reviewer' || user.role === 'admin'
  }

  const canReview = (): boolean => {
    if (!user || !design || design.status !== 'reviewing') return false
    if (user.role === 'admin') return true
    return user.role === 'reviewer' && user.id === design.reviewerId
  }

  const canResubmit = (): boolean => {
    if (!user || !design || design.status !== 'returned') return false
    if (user.role === 'admin') return true
    return user.role === 'submitter' && user.id === design.submitterId
  }

  const canReReview = (): boolean => {
    if (!user || !design || design.status !== 'pending_review') return false
    if (user.role === 'admin') return true
    return user.role === 'reviewer' && user.id === design.reviewerId
  }

  const handleClaim = async () => {
    if (!design) return
    try {
      await claimDesign(design.id, design.version)
      showToast('认领成功', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '认领失败', 'error')
    }
  }

  const handlePass = async () => {
    if (!design) return
    try {
      await reviewDesign(design.id, design.version, 'pass')
      showToast('已通过', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleReturnClick = () => {
    setShowReturnInput(true)
  }

  const handleConfirmReturn = async () => {
    if (!design || !returnReason.trim()) {
      showToast('请填写退回原因', 'warning')
      return
    }
    try {
      await reviewDesign(design.id, design.version, 'return', returnReason.trim())
      showToast('已退回', 'success')
      setShowReturnInput(false)
      setReturnReason('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleCancelReturn = () => {
    setShowReturnInput(false)
    setReturnReason('')
  }

  const handleResubmit = async () => {
    if (!design) return
    try {
      await resubmitDesign(design.id, design.version)
      showToast('已提交复审', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '提交失败', 'error')
    }
  }

  const handleAddComment = async () => {
    if (!design || !commentText.trim()) return
    try {
      await addComment(design.id, commentText.trim())
      setCommentText('')
      showToast('评论已添加', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '添加失败', 'error')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!design) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          isVisible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-zinc-500">{design.designId}</span>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded', statusColors[design.status])}>
              {STATUS_LABELS[design.status]}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">{design.name}</h2>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{design.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-500">提交者:</span>
                <span className="text-zinc-900">{design.submitterName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <UserCheck className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-500">评审人:</span>
                <span className="text-zinc-900">{design.reviewerName || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-500">优先级:</span>
                <span className={cn('px-2 py-0.5 text-xs font-medium rounded', priorityColors[design.priority])}>
                  {PRIORITY_LABELS[design.priority]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-500">排队序号:</span>
                <span className="text-zinc-900">#{design.queueOrder}</span>
              </div>
              <div className="col-span-2 flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-500">创建时间:</span>
                <span className="text-zinc-900">{formatDate(design.createdAt)}</span>
              </div>
            </div>

            {design.returnReason && (
              <div className="p-3 bg-red-50 border-2 border-red-300 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700">退回原因</span>
                </div>
                <p className="text-sm text-red-600">{design.returnReason}</p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-medium text-zinc-900">状态操作</h3>
              
              {showReturnInput ? (
                <div className="space-y-3 p-3 bg-zinc-50 rounded border border-zinc-200">
                  <label className="block text-sm font-medium text-zinc-700">
                    退回原因 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="input min-h-[80px] resize-none"
                    placeholder="请填写退回原因..."
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelReturn}
                      className="btn-secondary"
                      disabled={isLoading}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmReturn}
                      className="btn-danger"
                      disabled={isLoading || !returnReason.trim()}
                    >
                      确认退回
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {canClaim() && (
                    <button onClick={handleClaim} className="btn-warning" disabled={isLoading}>
                      <UserCheck className="h-4 w-4" />
                      认领
                    </button>
                  )}
                  {canReview() && (
                    <>
                      <button onClick={handlePass} className="btn-success" disabled={isLoading}>
                        <CheckCircle className="h-4 w-4" />
                        通过
                      </button>
                      <button onClick={handleReturnClick} className="btn-danger" disabled={isLoading}>
                        <XCircle className="h-4 w-4" />
                        退回
                      </button>
                    </>
                  )}
                  {canResubmit() && (
                    <button onClick={handleResubmit} className="btn-purple" disabled={isLoading}>
                      <RotateCcw className="h-4 w-4" />
                      提交复审
                    </button>
                  )}
                  {canReReview() && (
                    <>
                      <button onClick={handlePass} className="btn-success" disabled={isLoading}>
                        <CheckCircle className="h-4 w-4" />
                        通过
                      </button>
                      <button onClick={handleReturnClick} className="btn-danger" disabled={isLoading}>
                        <XCircle className="h-4 w-4" />
                        退回
                      </button>
                    </>
                  )}
                  {!canClaim() && !canReview() && !canResubmit() && !canReReview() && (
                    <p className="text-sm text-zinc-500">当前状态无可用操作</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-zinc-900">添加评论</h3>
              <div className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="input flex-1 min-h-[60px] resize-none"
                  placeholder="输入评论..."
                />
                <button
                  onClick={handleAddComment}
                  className="btn-primary self-end"
                  disabled={isLoading || !commentText.trim()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                评论历史 ({designComments.length})
              </h3>
              <div className="space-y-3">
                {designComments.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">暂无评论</p>
                ) : (
                  designComments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentItem({ comment }: { comment: Comment }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className={cn(
        'p-3 rounded border',
        comment.isReturnReason
          ? 'bg-red-50 border-red-300 border-2'
          : 'bg-zinc-50 border-zinc-200'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-zinc-900">{comment.userName}</span>
          <span className="text-xs text-zinc-500">({ROLE_LABELS[comment.userRole]})</span>
          {comment.isReturnReason && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">退回原因</span>
          )}
        </div>
        <span className="text-xs text-zinc-400">{formatDate(comment.createdAt)}</span>
      </div>
      <p className={cn('text-sm whitespace-pre-wrap', comment.isReturnReason ? 'text-red-700' : 'text-zinc-700')}>
        {comment.content}
      </p>
    </div>
  )
}
