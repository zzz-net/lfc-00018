import { useEffect, useState } from 'react'
import { X, Clock, User, ChevronDown, ChevronUp, Download, FileText, UserPlus, History } from 'lucide-react'
import type { AdminOperationLog } from '../../shared/types'
import { useUserStore } from '@/store/useUserStore'
import { cn } from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const OPERATION_ICONS: Record<string, typeof UserPlus> = {
  user_import: Download,
  user_create: UserPlus,
  user_update: FileText,
  user_delete: X,
  design_import: Download,
}

const OPERATION_LABELS: Record<string, string> = {
  user_import: '批量导入成员',
  user_create: '创建用户',
  user_update: '更新用户',
  user_delete: '删除用户',
  design_import: '批量导入设计稿',
}

const OPERATION_TONES: Record<string, string> = {
  user_import: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  user_create: 'bg-sky-100 text-sky-700 border-sky-200',
  user_update: 'bg-amber-100 text-amber-700 border-amber-200',
  user_delete: 'bg-red-100 text-red-700 border-red-200',
  design_import: 'bg-purple-100 text-purple-700 border-purple-200',
}

export default function AdminLogViewerModal({ isOpen, onClose }: Props) {
  const { adminLogs, fetchAdminLogs, isLoading } = useUserStore()
  const [visible, setVisible] = useState(false)
  const [filter, setFilter] = useState<'all' | 'user_import'>('user_import')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loadedOnce, setLoadedOnce] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      if (!loadedOnce) {
        fetchAdminLogs(filter).finally(() => setLoadedOnce(true))
      }
    } else {
      setVisible(false)
    }
  }, [isOpen, fetchAdminLogs, filter, loadedOnce])

  useEffect(() => {
    if (isOpen) fetchAdminLogs(filter).catch(() => {})
  }, [filter, isOpen, fetchAdminLogs])

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const formatTime = (s: string) =>
    new Date(s).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const tryParseDetails = (log: AdminOperationLog) => {
    if (!log.details) return null
    try {
      return JSON.parse(log.details)
    } catch {
      return log.details
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className={cn(
          'bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col transition-all duration-200',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-navy-900" />
            <h2 className="text-lg font-semibold text-zinc-900">管理员操作日志</h2>
            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs font-medium">
              共 {adminLogs.length} 条
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-zinc-100 flex items-center gap-2 bg-zinc-50">
          <span className="text-xs text-zinc-500">筛选：</span>
          {(
            [
              { v: 'user_import' as const, label: '仅成员导入' },
              { v: 'all' as const, label: '全部操作' },
            ]
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setFilter(opt.v)}
              className={cn(
                'px-3 py-1 rounded-full text-xs border transition',
                filter === opt.v
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-white text-zinc-600 border-zinc-300 hover:border-navy-500 hover:text-navy-700'
              )}
            >
              {opt.label}
            </button>
          ))}
          {isLoading && <span className="ml-auto text-xs text-zinc-400">加载中...</span>}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {adminLogs.length === 0 && !isLoading && (
            <div className="py-16 text-center text-zinc-400 text-sm">暂无日志记录</div>
          )}
          {adminLogs.map((log) => {
            const isExpanded = expanded.has(log.id)
            const Icon = OPERATION_ICONS[log.operationType] || Clock
            const tone = OPERATION_TONES[log.operationType] || 'bg-zinc-100 text-zinc-700 border-zinc-200'
            const label = OPERATION_LABELS[log.operationType] || log.operationType
            const parsed = tryParseDetails(log)
            const hasDetails = !!parsed
            return (
              <div key={log.id}>
                <button
                  onClick={() => hasDetails && toggle(log.id)}
                  className={cn(
                    'w-full px-6 py-3 text-left flex items-center gap-4 hover:bg-zinc-50 transition',
                    hasDetails ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 flex items-center justify-center rounded-full border shrink-0',
                      tone
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">{label}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                        {log.operationType}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-700 truncate">{log.summary}</div>
                    <div className="mt-1 flex items-center gap-4 text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.operatorName}（ID:{log.operatorId}）
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                  </div>
                  {hasDetails && (
                    <div className="text-zinc-400 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </button>
                {isExpanded && hasDetails && (
                  <div className="px-6 pb-4 pl-20">
                    <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
                      {typeof parsed === 'string' ? (
                        <div className="text-xs text-zinc-700 whitespace-pre-wrap break-all">
                          {parsed}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {log.targetType && (
                            <DetailRow k="目标类型" v={log.targetType} />
                          )}
                          {log.targetId && <DetailRow k="目标ID" v={log.targetId} />}
                          {typeof parsed === 'object' && parsed != null && (
                            <>
                              {Object.entries(parsed as Record<string, unknown>).map(([k, v]) => (
                                <DetailRow
                                  key={k}
                                  k={k}
                                  v={
                                    Array.isArray(v) && v.length > 0 && typeof v[0] === 'object'
                                      ? (
                                        <div className="mt-1 space-y-1 max-h-48 overflow-auto border border-zinc-200 rounded p-2 bg-white text-[11px]">
                                          {(v as Record<string, unknown>[]).map((it, idx) => (
                                            <div
                                              key={idx}
                                              className="border-b border-zinc-100 last:border-0 pb-1 mb-1 last:mb-0"
                                            >
                                              {Object.entries(it).map(([k2, v2]) => (
                                                <span
                                                  key={k2}
                                                  className="inline-block mr-2 text-zinc-600"
                                                >
                                                  <span className="text-zinc-400">{k2}:</span>{' '}
                                                  <span className="font-medium">
                                                    {typeof v2 === 'object'
                                                      ? JSON.stringify(v2)
                                                      : String(v2)}
                                                  </span>
                                                </span>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      )
                                      : Array.isArray(v)
                                        ? v.map((x) => String(x)).join(', ')
                                        : typeof v === 'object'
                                          ? JSON.stringify(v)
                                          : String(v as unknown)
                                  }
                                />
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
          <button onClick={handleClose} className="btn-primary">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 w-28 text-zinc-400">{k}</span>
      <span className="flex-1 text-zinc-700 break-all">{v}</span>
    </div>
  )
}
