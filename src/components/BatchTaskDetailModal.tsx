import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  UserPlus,
  UserMinus,
  Shield,
  AlertTriangle,
  Users,
  CheckCircle,
  XCircle,
  EyeOff,
  Eye,
  Download,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  User,
} from 'lucide-react'
import type {
  BatchTask,
  BatchTaskItem,
  BatchTaskItemType,
  BatchTaskItemStatus,
} from '../../shared/types'
import {
  BATCH_TASK_ITEM_TYPE_LABELS,
  BATCH_TASK_ITEM_STATUS_LABELS,
  BATCH_TASK_STATUS_LABELS,
  ROLE_LABELS,
} from '../../shared/types'
import { useBatchTaskStore } from '@/store/useBatchTaskStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import ConfirmModal from '@/components/ConfirmModal'

interface BatchTaskDetailModalProps {
  isOpen: boolean
  taskId: number | null
  onClose: () => void
  onExecuteSuccess?: () => void
  isAdmin?: boolean
}

type TabType = 'all' | BatchTaskItemType

const TABS: { key: TabType; label: string; icon: typeof UserPlus; tone: string }[] = [
  { key: 'all', label: '全部', icon: Users, tone: 'zinc' },
  { key: 'new', label: '新增成员', icon: UserPlus, tone: 'emerald' },
  { key: 'role_change', label: '角色变更', icon: Shield, tone: 'sky' },
  { key: 'disable', label: '停用成员', icon: UserMinus, tone: 'amber' },
  { key: 'duplicate_account', label: '重复账号', icon: AlertTriangle, tone: 'red' },
  { key: 'name_conflict', label: '同名冲突', icon: AlertTriangle, tone: 'orange' },
]

const toneMap: Record<string, string> = {
  zinc: 'text-zinc-700 border-zinc-300 bg-zinc-50',
  emerald: 'text-emerald-700 border-emerald-300 bg-emerald-50',
  sky: 'text-sky-700 border-sky-300 bg-sky-50',
  amber: 'text-amber-700 border-amber-300 bg-amber-50',
  red: 'text-red-700 border-red-300 bg-red-50',
  orange: 'text-orange-700 border-orange-300 bg-orange-50',
}

const statusColorMap: Record<BatchTaskItemStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  ignored: 'bg-gray-100 text-gray-600 border-gray-300',
  executing: 'bg-sky-100 text-sky-700 border-sky-300',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
  skipped: 'bg-amber-100 text-amber-700 border-amber-300',
}

export default function BatchTaskDetailModal({
  isOpen,
  taskId,
  onClose,
  onExecuteSuccess,
  isAdmin = true,
}: BatchTaskDetailModalProps) {
  const {
    currentTask,
    currentItems,
    isLoading,
    fetchTaskDetail,
    updateItemStatus,
    bulkIgnoreByType,
    bulkRestoreByType,
    executeTask,
    exportConflicts,
  } = useBatchTaskStore()
  const { showToast } = useToast()

  const [isVisible, setIsVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      if (taskId) {
        fetchTaskDetail(taskId).catch(() => {})
      }
    } else {
      setIsVisible(false)
      setActiveTab('all')
      setExpandedItems(new Set())
    }
  }, [isOpen, taskId, fetchTaskDetail])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return currentItems
    return currentItems.filter(item => item.itemType === activeTab)
  }, [currentItems, activeTab])

  const getCount = useCallback((type: BatchTaskItemType | 'all') => {
    if (type === 'all') return currentItems.length
    return currentItems.filter(i => i.itemType === type).length
  }, [currentItems])

  const toggleItemExpand = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const handleIgnoreItem = async (item: BatchTaskItem) => {
    if (!isAdmin) return
    try {
      await updateItemStatus(item.id, 'ignored', '手动忽略')
      showToast('已忽略该条记录', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleRestoreItem = async (item: BatchTaskItem) => {
    if (!isAdmin) return
    try {
      await updateItemStatus(item.id, 'pending')
      showToast('已恢复该条记录', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleBulkIgnore = async () => {
    if (!isAdmin || !currentTask || activeTab === 'all') return
    try {
      const count = await bulkIgnoreByType(currentTask.id, activeTab as BatchTaskItemType)
      showToast(`已批量忽略 ${count} 条记录`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleBulkRestore = async () => {
    if (!isAdmin || !currentTask || activeTab === 'all') return
    try {
      const count = await bulkRestoreByType(currentTask.id, activeTab as BatchTaskItemType)
      showToast(`已批量恢复 ${count} 条记录`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleExportConflicts = async () => {
    if (!currentTask) return
    try {
      await exportConflicts(currentTask.id)
      showToast('冲突记录已导出', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败', 'error')
    }
  }

  const handleExecute = async () => {
    if (!isAdmin || !currentTask) return
    setShowExecuteConfirm(false)
    try {
      const result = await executeTask(currentTask.id)
      showToast(`执行完成：成功 ${result.successCount} 条`, 'success')
      onExecuteSuccess?.()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '执行失败', 'error')
    }
  }

  const canExecute = useMemo(() => {
    if (!currentTask) return false
    if (currentTask.status === 'completed' || currentTask.status === 'executing') return false
    const pendingItems = currentItems.filter(i => i.status === 'pending')
    return pendingItems.length > 0
  }, [currentTask, currentItems])

  const hasConflicts = useMemo(() => {
    return currentItems.some(i => i.itemType === 'duplicate_account' || i.itemType === 'name_conflict')
  }, [currentItems])

  const isExecuted = currentTask?.status === 'completed' || currentTask?.status === 'failed'

  if (!isOpen && !isVisible) return null

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleBackdropClick}
      >
        <div
          className={cn(
            'bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col transition-all duration-300',
            isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-navy-900" />
              <h2 className="text-lg font-semibold text-zinc-900">
                {currentTask?.taskName || '任务详情'}
              </h2>
              {currentTask && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium border rounded',
                    currentTask.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                    currentTask.status === 'executing' ? 'bg-sky-100 text-sky-700 border-sky-300' :
                    currentTask.status === 'failed' ? 'bg-red-100 text-red-700 border-red-300' :
                    currentTask.status === 'pending_review' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                    'bg-zinc-100 text-zinc-700 border-zinc-300'
                  )}
                >
                  {BATCH_TASK_STATUS_LABELS[currentTask.status]}
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {currentTask && (
            <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-100">
              <div className="flex items-center gap-6 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  创建人：{currentTask.createdByName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  创建时间：{new Date(currentTask.createdAt).toLocaleString('zh-CN')}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  文件：{currentTask.fileName}
                </span>
                {currentTask.executedAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    执行时间：{new Date(currentTask.executedAt).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2 flex-wrap">
              {TABS.map(tab => {
                const Icon = tab.icon
                const count = getCount(tab.key)
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition',
                      isActive
                        ? 'bg-navy-900 text-white border-navy-900'
                        : cn(toneMap[tab.tone], 'hover:border-navy-400')
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    <span className="text-xs opacity-80">({count})</span>
                  </button>
                )
              })}

              <div className="ml-auto flex items-center gap-2">
                {hasConflicts && isAdmin && !isExecuted && (
                  <button
                    onClick={handleExportConflicts}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-orange-300 text-orange-700 rounded-full hover:bg-orange-50 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出冲突CSV
                  </button>
                )}

                {isAdmin && activeTab !== 'all' && !isExecuted && (
                  <>
                    <button
                      onClick={handleBulkIgnore}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 text-zinc-700 rounded-full hover:bg-zinc-50 transition"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      批量忽略
                    </button>
                    <button
                      onClick={handleBulkRestore}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 text-zinc-700 rounded-full hover:bg-zinc-50 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      批量恢复
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading && currentItems.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">加载中...</div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map(item => {
                  const expanded = expandedItems.has(item.id)
                  const typeInfo = TABS.find(t => t.key === item.itemType)
                  const TypeIcon = typeInfo?.icon || Users

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'border rounded-lg overflow-hidden transition',
                        item.status === 'ignored' ? 'opacity-60 bg-gray-50' : 'bg-white',
                        item.status === 'success' ? 'border-emerald-300' :
                        item.status === 'failed' ? 'border-red-300' :
                        'border-zinc-200 hover:border-zinc-300'
                      )}
                    >
                      <div className="flex items-center px-4 py-3">
                        <div className={cn(
                          'w-8 h-8 rounded flex items-center justify-center mr-3',
                          toneMap[typeInfo?.tone || 'zinc']
                        )}>
                          <TypeIcon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 truncate">
                              {item.name || item.username || '未命名'}
                            </span>
                            <span className="text-xs text-zinc-400 font-mono">
                              第 {item.lineNumber} 行
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                            <span className="font-mono">{item.username}</span>
                            {item.email && <span>{item.email}</span>}
                            {item.role && (
                              <span className={cn(
                                'px-1.5 py-0.5 border rounded',
                                item.oldRole ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                              )}>
                                {item.oldRole
                                  ? `${ROLE_LABELS[item.oldRole as keyof typeof ROLE_LABELS] || item.oldRole} → ${ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] || item.role}`
                                  : ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] || item.role
                                }
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium border rounded mr-3',
                          statusColorMap[item.status]
                        )}>
                          {BATCH_TASK_ITEM_STATUS_LABELS[item.status]}
                        </span>

                        {isAdmin && !isExecuted && (
                          <div className="flex items-center gap-1 mr-2">
                            {item.status === 'ignored' ? (
                              <button
                                onClick={() => handleRestoreItem(item)}
                                className="p-1.5 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                                title="恢复"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleIgnoreItem(item)}
                                className="p-1.5 text-zinc-500 hover:text-gray-600 hover:bg-gray-100 rounded transition"
                                title="忽略"
                              >
                                <EyeOff className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => toggleItemExpand(item.id)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 transition"
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {expanded && (
                        <div className="px-4 pb-3 pl-15">
                          <div className="ml-11 p-3 bg-zinc-50 rounded border border-zinc-100 space-y-2">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {Object.entries(item.rowData).map(([key, value]) => (
                                <div key={key} className="flex gap-1">
                                  <span className="text-zinc-400 shrink-0">{key}:</span>
                                  <span className="text-zinc-700 truncate">{value || '(空)'}</span>
                                </div>
                              ))}
                            </div>

                            {item.errorMessage && (
                              <div className="pt-2 border-t border-zinc-200">
                                <div className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  问题说明
                                </div>
                                <p className="text-xs text-red-700">{item.errorMessage}</p>
                              </div>
                            )}

                            {item.skipReason && (
                              <div className="pt-2 border-t border-zinc-200">
                                <div className="text-xs font-medium text-gray-600 mb-1">跳过原因</div>
                                <p className="text-xs text-gray-700">{item.skipReason}</p>
                              </div>
                            )}

                            {isExecuted && item.userId && (
                              <div className="pt-2 border-t border-zinc-200">
                                <div className="text-xs font-medium text-emerald-600 mb-1 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  执行结果
                                </div>
                                <p className="text-xs text-emerald-700">
                                  用户ID: {item.userId}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-4 border-t border-zinc-200 bg-zinc-50">
            <div className="text-xs text-zinc-500">
              共 {currentItems.length} 条记录
              {currentTask?.resultSummary && (
                <span className="ml-3">
                  成功 {currentTask.resultSummary.successCount} 条，
                  失败 {currentTask.resultSummary.failedCount} 条，
                  跳过 {currentTask.resultSummary.skippedCount} 条，
                  忽略 {currentTask.resultSummary.ignoredCount} 条
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {isAdmin && !isExecuted && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger flex items-center gap-1.5"
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  删除任务
                </button>
              )}
              <button onClick={handleClose} className="btn-secondary">
                {isExecuted ? '关闭' : '取消'}
              </button>
              {isAdmin && !isExecuted && (
                <button
                  onClick={() => setShowExecuteConfirm(true)}
                  className="btn-primary flex items-center gap-1.5"
                  disabled={isLoading || !canExecute}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      正式执行
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showExecuteConfirm}
        title="确认执行"
        message={`确定要执行任务「${currentTask?.taskName}」吗？执行后数据将正式写入系统，此操作不可撤销。`}
        onConfirm={handleExecute}
        onCancel={() => setShowExecuteConfirm(false)}
        confirmText="确认执行"
        cancelText="取消"
        type="warning"
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="确认删除"
        message={`确定要删除任务「${currentTask?.taskName}」吗？此操作不可撤销。`}
        onConfirm={() => {
          if (currentTask) {
            useBatchTaskStore.getState().deleteTask(currentTask.id)
              .then(() => {
                showToast('任务已删除', 'success')
                setShowDeleteConfirm(false)
                handleClose()
              })
              .catch((err) => {
                showToast(err instanceof Error ? err.message : '删除失败', 'error')
              })
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="确认删除"
        cancelText="取消"
        type="danger"
      />
    </>
  )
}
