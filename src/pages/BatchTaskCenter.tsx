import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
  Plus,
  Eye,
  Play,
  Trash2,
  FileText,
  Clock,
  User,
  Users,
  UserPlus,
  UserMinus,
  Shield,
  AlertTriangle,
  LogOut,
} from 'lucide-react'
import type { BatchTask } from '../../shared/types'
import {
  BATCH_TASK_STATUS_LABELS,
  ROLE_LABELS,
} from '../../shared/types'
import { useAuthStore } from '@/store/useAuthStore'
import { useBatchTaskStore } from '@/store/useBatchTaskStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import ConfirmModal from '@/components/ConfirmModal'
import CreateBatchTaskModal from '@/components/CreateBatchTaskModal'
import BatchTaskDetailModal from '@/components/BatchTaskDetailModal'

const statusColorMap: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  pending_review: 'bg-amber-100 text-amber-700 border-amber-300',
  executing: 'bg-sky-100 text-sky-700 border-sky-300',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-300',
}

export default function BatchTaskCenter() {
  const navigate = useNavigate()
  const { user, logout, checkAuth } = useAuthStore()
  const {
    tasks,
    fetchTasks,
    createTaskWithFile,
    deleteTask,
    executeTask,
    isLoading,
  } = useBatchTaskStore()
  const { showToast } = useToast()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<BatchTask | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user) {
      checkAuth()
    }
  }, [user, checkAuth])

  useEffect(() => {
    fetchTasks().catch(() => {})
  }, [fetchTasks])

  const handleLogout = async () => {
    try {
      await logout()
      showToast('已退出登录', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '登出失败', 'error')
    }
  }

  const handleCreateTask = async (data: {
    taskName: string
    file: File
    fieldMapping: Record<string, string>
  }) => {
    return await createTaskWithFile(data.file, data.taskName, data.fieldMapping)
  }

  const handleViewDetail = (task: BatchTask) => {
    setSelectedTaskId(task.id)
    setShowDetailModal(true)
  }

  const handleExecuteTask = async (task: BatchTask) => {
    try {
      await executeTask(task.id)
      showToast('任务执行成功', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '执行失败', 'error')
    }
  }

  const handleDeleteTask = async () => {
    if (!deleteConfirmTask) return
    try {
      await deleteTask(deleteConfirmTask.id)
      showToast('任务已删除', 'success')
      setDeleteConfirmTask(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error')
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

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 border-red-300',
    reviewer: 'bg-sky-100 text-sky-700 border-sky-300',
    submitter: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <header className="bg-white border-b-2 border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-navy-900 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white" />
          </div>
          <h1 className="font-mono text-lg font-bold text-navy-900 tracking-wider">
            DESIGN REVIEW BOARD
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200">
              <User className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-900">{user.name}</span>
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium border',
                  roleColors[user.role]
                )}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          )}

          <button
            onClick={() => navigate('/users')}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Users className="h-4 w-4" />
            用户管理
          </button>

          <button
            onClick={() => navigate('/board')}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Layers className="h-4 w-4" />
            看板
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="btn-danger flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-navy-900" />
              <h2 className="text-2xl font-bold text-zinc-900">批量成员变更任务中心</h2>
              <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-sm font-medium">
                {tasks.length} 个任务
              </span>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                创建任务
              </button>
            )}
          </div>

          {isLoading && tasks.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-500 mb-4">暂无批量任务</p>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  创建第一个任务
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-zinc-900 truncate">
                          {task.taskName}
                        </h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium border rounded',
                            statusColorMap[task.status]
                          )}
                        >
                          {BATCH_TASK_STATUS_LABELS[task.status]}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {task.createdByName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(task.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {task.fileName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <StatBadge
                          icon={Users}
                          label="总计"
                          value={task.totalCount}
                          tone="zinc"
                        />
                        <StatBadge
                          icon={UserPlus}
                          label="新增"
                          value={task.newCount}
                          tone="emerald"
                        />
                        <StatBadge
                          icon={Shield}
                          label="角色变更"
                          value={task.roleChangeCount}
                          tone="sky"
                        />
                        <StatBadge
                          icon={UserMinus}
                          label="停用"
                          value={task.disableCount}
                          tone="amber"
                        />
                        <StatBadge
                          icon={AlertTriangle}
                          label="重复账号"
                          value={task.duplicateCount}
                          tone="red"
                        />
                        <StatBadge
                          icon={AlertTriangle}
                          label="同名冲突"
                          value={task.nameConflictCount}
                          tone="orange"
                        />
                      </div>

                      {task.resultSummary && task.status === 'completed' && (
                        <div className="mt-3 pt-3 border-t border-zinc-100">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-emerald-600">
                              成功 {task.resultSummary.successCount} 条
                            </span>
                            <span className="text-red-600">
                              失败 {task.resultSummary.failedCount} 条
                            </span>
                            <span className="text-amber-600">
                              跳过 {task.resultSummary.skippedCount} 条
                            </span>
                            <span className="text-gray-500">
                              忽略 {task.resultSummary.ignoredCount} 条
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleViewDetail(task)}
                        className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        查看详情
                      </button>

                      {isAdmin && task.status === 'pending_review' && (
                        <button
                          onClick={() => handleExecuteTask(task)}
                          className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                        >
                          <Play className="h-4 w-4" />
                          执行
                        </button>
                      )}

                      {isAdmin && (task.status === 'draft' || task.status === 'pending_review') && (
                        <button
                          onClick={() => setDeleteConfirmTask(task)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="删除任务"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="确认登出"
        message="确定要退出登录吗？"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        confirmText="确认登出"
        cancelText="取消"
        type="warning"
      />

      <ConfirmModal
        isOpen={!!deleteConfirmTask}
        title="确认删除"
        message={`确定要删除任务「${deleteConfirmTask?.taskName}」吗？此操作不可撤销。`}
        onConfirm={handleDeleteTask}
        onCancel={() => setDeleteConfirmTask(null)}
        confirmText="确认删除"
        cancelText="取消"
        type="danger"
      />

      <CreateBatchTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateTask}
      />

      <BatchTaskDetailModal
        isOpen={showDetailModal}
        taskId={selectedTaskId}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedTaskId(null)
        }}
        onExecuteSuccess={() => fetchTasks()}
        isAdmin={isAdmin}
      />
    </div>
  )
}

function StatBadge({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: number
  tone: 'zinc' | 'emerald' | 'sky' | 'amber' | 'red' | 'orange'
}) {
  const toneClasses: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded',
        toneClasses[tone]
      )}
    >
      <Icon className="h-3 w-3" />
      {label}: <span className="font-medium">{value}</span>
    </span>
  )
}
