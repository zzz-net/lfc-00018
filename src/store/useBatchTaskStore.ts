import { create } from 'zustand'
import type {
  BatchTask,
  BatchTaskItem,
  BatchTaskItemStatus,
  BatchTaskItemType,
  BatchTaskResultSummary,
  FieldMapping,
} from '../../shared/types'
import { api } from '@/api/client'

interface BatchTaskState {
  tasks: BatchTask[]
  currentTask: BatchTask | null
  currentItems: BatchTaskItem[]
  isLoading: boolean
  error: string | null
  fetchTasks: (limit?: number) => Promise<void>
  fetchTaskDetail: (id: number) => Promise<{ task: BatchTask; items: BatchTaskItem[] }>
  createTask: (payload: {
    taskName: string
    rawCsv: string
    fileName: string
    fileSize: number
    fieldMapping?: FieldMapping
  }) => Promise<{ taskId: number; items: BatchTaskItem[] }>
  createTaskWithFile: (file: File, taskName: string, fieldMapping?: FieldMapping) => Promise<{ taskId: number; items: BatchTaskItem[] }>
  updateItemStatus: (itemId: number, status: BatchTaskItemStatus, skipReason?: string) => Promise<void>
  bulkIgnoreByType: (taskId: number, itemType: BatchTaskItemType) => Promise<number>
  bulkRestoreByType: (taskId: number, itemType: BatchTaskItemType) => Promise<number>
  executeTask: (taskId: number) => Promise<BatchTaskResultSummary>
  deleteTask: (taskId: number) => Promise<void>
  exportConflicts: (taskId: number) => Promise<void>
  clearCurrentTask: () => void
  clearError: () => void
}

export const useBatchTaskStore = create<BatchTaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  currentItems: [],
  isLoading: false,
  error: null,

  fetchTasks: async (limit = 50) => {
    set({ isLoading: true, error: null })
    try {
      const tasks = await api.batchTasks.getList(limit)
      set({ tasks, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '获取任务列表失败',
        isLoading: false,
      })
      throw err
    }
  },

  fetchTaskDetail: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      const detail = await api.batchTasks.getDetail(id)
      set({
        currentTask: detail.task,
        currentItems: detail.items,
        isLoading: false,
      })
      return detail
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '获取任务详情失败',
        isLoading: false,
      })
      throw err
    }
  },

  createTask: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.batchTasks.create(payload)
      await get().fetchTasks()
      set({ isLoading: false })
      return { taskId: result.taskId, items: result.items }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '创建任务失败',
        isLoading: false,
      })
      throw err
    }
  },

  createTaskWithFile: async (file, taskName, fieldMapping) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.batchTasks.createWithFile(file, taskName, fieldMapping)
      await get().fetchTasks()
      set({ isLoading: false })
      return { taskId: result.taskId, items: result.items }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '创建任务失败',
        isLoading: false,
      })
      throw err
    }
  },

  updateItemStatus: async (itemId, status, skipReason) => {
    set({ isLoading: true, error: null })
    try {
      await api.batchTasks.updateItemStatus(itemId, status, skipReason)
      const currentItems = get().currentItems.map(item =>
        item.id === itemId ? { ...item, status, skipReason: skipReason || null } : item
      )
      set({ currentItems, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '更新条目失败',
        isLoading: false,
      })
      throw err
    }
  },

  bulkIgnoreByType: async (taskId, itemType) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.batchTasks.bulkIgnoreByType(taskId, itemType)
      const currentItems = get().currentItems.map(item =>
        item.taskId === taskId && item.itemType === itemType
          ? { ...item, status: 'ignored' as const, skipReason: '批量忽略' }
          : item
      )
      set({ currentItems, isLoading: false })
      return result.count
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '批量忽略失败',
        isLoading: false,
      })
      throw err
    }
  },

  bulkRestoreByType: async (taskId, itemType) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.batchTasks.bulkRestoreByType(taskId, itemType)
      const currentItems = get().currentItems.map(item =>
        item.taskId === taskId && item.itemType === itemType
          ? { ...item, status: 'pending' as const, skipReason: null }
          : item
      )
      set({ currentItems, isLoading: false })
      return result.count
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '批量恢复失败',
        isLoading: false,
      })
      throw err
    }
  },

  executeTask: async (taskId: number) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.batchTasks.execute(taskId)
      await get().fetchTaskDetail(taskId)
      await get().fetchTasks()
      set({ isLoading: false })
      return result
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '执行任务失败',
        isLoading: false,
      })
      throw err
    }
  },

  deleteTask: async (taskId: number) => {
    set({ isLoading: true, error: null })
    try {
      await api.batchTasks.remove(taskId)
      const tasks = get().tasks.filter(t => t.id !== taskId)
      set({ tasks, isLoading: false })
      if (get().currentTask?.id === taskId) {
        set({ currentTask: null, currentItems: [] })
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '删除任务失败',
        isLoading: false,
      })
      throw err
    }
  },

  exportConflicts: async (taskId: number) => {
    set({ isLoading: true, error: null })
    try {
      await api.batchTasks.exportConflicts(taskId)
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '导出冲突失败',
        isLoading: false,
      })
      throw err
    }
  },

  clearCurrentTask: () => {
    set({ currentTask: null, currentItems: [] })
  },

  clearError: () => {
    set({ error: null })
  },
}))
