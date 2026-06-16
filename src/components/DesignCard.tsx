import { User, UserCheck, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import type { Design, DesignStatus, UserRole } from '../../shared/types'
import { STATUS_COLORS, PRIORITY_LABELS } from '../../shared/types'
import { useAuthStore } from '@/store/useAuthStore'
import { useDesignStore } from '@/store/useDesignStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface DesignCardProps {
  design: Design
  onClick: () => void
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-gray-400 text-white',
}

const statusBorderColors: Record<DesignStatus, string> = {
  pending_claim: 'border-l-status-pending',
  reviewing: 'border-l-status-reviewing',
  returned: 'border-l-status-returned',
  pending_review: 'border-l-status-pendingReview',
  passed: 'border-l-status-passed',
}

interface ActionButton {
  label: string
  icon: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  className: string
}

export default function DesignCard({ design, onClick }: DesignCardProps) {
  const { user } = useAuthStore()
  const { claimDesign, reviewDesign, resubmitDesign, isLoading } = useDesignStore()
  const { showToast } = useToast()

  const canClaim = (): boolean => {
    if (!user || design.status !== 'pending_claim') return false
    return user.role === 'reviewer' || user.role === 'admin'
  }

  const canReview = (): boolean => {
    if (!user || design.status !== 'reviewing') return false
    if (user.role === 'admin') return true
    return user.role === 'reviewer' && user.id === design.reviewerId
  }

  const canResubmit = (): boolean => {
    if (!user || design.status !== 'returned') return false
    if (user.role === 'admin') return true
    return user.role === 'submitter' && user.id === design.submitterId
  }

  const canReReview = (): boolean => {
    if (!user || design.status !== 'pending_review') return false
    if (user.role === 'admin') return true
    return user.role === 'reviewer' && user.id === design.reviewerId
  }

  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    try {
      await claimDesign(design.id, design.version)
      showToast('认领成功', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '认领失败', 'error')
    }
  }

  const handlePass = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await reviewDesign(design.id, design.version, 'pass')
      showToast('已通过', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleReturn = async (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick()
  }

  const handleResubmit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await resubmitDesign(design.id, design.version)
      showToast('已提交复审', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '提交失败', 'error')
    }
  }

  const getActions = (): ActionButton[] => {
    const actions: ActionButton[] = []

    if (canClaim()) {
      actions.push({
        label: '认领',
        icon: <UserCheck className="h-4 w-4" />,
        onClick: handleClaim,
        className: 'btn-warning',
      })
    }

    if (canReview()) {
      actions.push(
        {
          label: '通过',
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: handlePass,
          className: 'btn-success',
        },
        {
          label: '退回',
          icon: <XCircle className="h-4 w-4" />,
          onClick: handleReturn,
          className: 'btn-danger',
        }
      )
    }

    if (canResubmit()) {
      actions.push({
        label: '提交复审',
        icon: <RotateCcw className="h-4 w-4" />,
        onClick: handleResubmit,
        className: 'btn-purple',
      })
    }

    if (canReReview()) {
      actions.push(
        {
          label: '通过',
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: handlePass,
          className: 'btn-success',
        },
        {
          label: '退回',
          icon: <XCircle className="h-4 w-4" />,
          onClick: handleReturn,
          className: 'btn-danger',
        }
      )
    }

    return actions
  }

  const actions = getActions()

  return (
    <div
      className={cn(
        'card card-hover p-4 border-l-4 rounded',
        statusBorderColors[design.status]
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-sm text-zinc-500">{design.designId}</span>
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded',
            priorityColors[design.priority]
          )}
        >
          {PRIORITY_LABELS[design.priority]}
        </span>
      </div>

      <h3 className="font-semibold text-zinc-900 mb-2 line-clamp-1">{design.name}</h3>

      <div className="space-y-1 text-xs text-zinc-600 mb-3">
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          <span>提交: {design.submitterName}</span>
        </div>
        {design.reviewerName && (
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            <span>评审: {design.reviewerName}</span>
          </div>
        )}
      </div>

      {design.returnReason && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 line-clamp-2">
          {design.returnReason}
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-2 rounded transition-all duration-200',
                action.className,
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
