import type { Design, DesignStatus } from '../../shared/types'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/types'
import DesignCard from './DesignCard'
import Empty from './Empty'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  status: DesignStatus
  designs: Design[]
  onCardClick: (design: Design) => void
}

const statusBarColors: Record<DesignStatus, string> = {
  pending_claim: 'bg-status-pending',
  reviewing: 'bg-status-reviewing',
  returned: 'bg-status-returned',
  pending_review: 'bg-status-pendingReview',
  passed: 'bg-status-passed',
}

export default function KanbanColumn({ status, designs, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col h-full min-w-[300px] w-[300px] bg-zinc-50 rounded border border-zinc-200">
      <div className="flex items-center gap-2 p-3 border-b border-zinc-200 bg-white">
        <div className={cn('w-1 h-5 rounded', statusBarColors[status])} />
        <h3 className="font-semibold text-sm text-zinc-800">{STATUS_LABELS[status]}</h3>
        <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 rounded">
          {designs.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {designs.length === 0 ? (
          <div className="h-32">
            <Empty />
          </div>
        ) : (
          designs.map((design) => (
            <DesignCard
              key={design.id}
              design={design}
              onClick={() => onCardClick(design)}
            />
          ))
        )}
      </div>
    </div>
  )
}
