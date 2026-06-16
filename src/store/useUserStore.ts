import { create } from 'zustand'
import type { User } from '../../shared/types'
import type {
  UserImportPrecheckResult,
  UserImportResult,
  FieldMapping,
  ImportDraft,
  AdminOperationLog,
  PrecheckRowError,
  UserImportDraftPayload,
} from '../../shared/types'
import { api } from '@/api/client'

interface UserState {
  users: User[]
  isLoading: boolean
  error: string | null
  importDraft: ImportDraft | null
  adminLogs: AdminOperationLog[]
  fetchUsers: () => Promise<void>
  createUser: (user: { username: string; password: string; name: string; role: User['role']; email?: string | null }) => Promise<User>
  updateUser: (id: number, data: { name?: string; role?: User['role']; password?: string; email?: string | null }) => Promise<void>
  deleteUser: (id: number) => Promise<void>
  precheckUserImport: (file: File, fieldMapping?: FieldMapping) => Promise<UserImportPrecheckResult>
  precheckUserImportFromRaw: (payload: {
    rawCsv: string
    fileName: string
    fileSize: number
    fieldMapping?: FieldMapping
  }) => Promise<UserImportPrecheckResult>
  submitUserImport: (payload: {
    rawCsv: string
    fieldMapping: FieldMapping
    applyDefaultPassword?: boolean
    fileName?: string
  }) => Promise<UserImportResult>
  exportImportErrors: (rowErrors: PrecheckRowError[], detectedHeaders: string[]) => Promise<void>
  loadImportDraft: () => Promise<ImportDraft | null>
  saveImportDraft: (payload: UserImportDraftPayload) => Promise<ImportDraft>
  clearImportDraft: () => Promise<void>
  fetchAdminLogs: (type?: 'user_import' | 'all') => Promise<AdminOperationLog[]>
  clearError: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,
  importDraft: null,
  adminLogs: [],

  fetchUsers: async () => {
    set({ isLoading: true, error: null })
    try {
      const users = await api.users.getList()
      set({ users, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '获取用户列表失败',
        isLoading: false,
      })
      throw err
    }
  },

  createUser: async (user) => {
    set({ isLoading: true, error: null })
    try {
      const newUser = await api.users.create(user)
      const users = [...get().users, newUser]
      set({ users, isLoading: false })
      return newUser
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '创建用户失败',
        isLoading: false,
      })
      throw err
    }
  },

  updateUser: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      await api.users.update(id, data)
      const users = get().users.map((u) =>
        u.id === id ? { ...u, ...data } : u
      )
      set({ users, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '更新用户失败',
        isLoading: false,
      })
      throw err
    }
  },

  deleteUser: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.users.delete(id)
      const users = get().users.filter((u) => u.id !== id)
      set({ users, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '删除用户失败',
        isLoading: false,
      })
      throw err
    }
  },

  precheckUserImport: async (file, fieldMapping) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.users.precheckImport(file, fieldMapping)
      set({ isLoading: false })
      return result
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '预检查失败',
        isLoading: false,
      })
      throw err
    }
  },

  precheckUserImportFromRaw: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.users.precheckImportFromRaw(payload)
      set({ isLoading: false })
      return result
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '预检查失败',
        isLoading: false,
      })
      throw err
    }
  },

  submitUserImport: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.users.submitImport(payload)
      await get().fetchUsers()
      await get().fetchAdminLogs('user_import')
      set({ importDraft: null, isLoading: false })
      return result
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '导入失败',
        isLoading: false,
      })
      throw err
    }
  },

  exportImportErrors: async (rowErrors, detectedHeaders) => {
    set({ isLoading: true, error: null })
    try {
      await api.users.exportImportErrors(rowErrors, detectedHeaders)
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '导出失败',
        isLoading: false,
      })
      throw err
    }
  },

  loadImportDraft: async () => {
    set({ isLoading: true, error: null })
    try {
      const draft = await api.users.getImportDraft()
      set({ importDraft: draft, isLoading: false })
      return draft
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '读取草稿失败',
        isLoading: false,
      })
      throw err
    }
  },

  saveImportDraft: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const draft = await api.users.saveImportDraft(payload)
      set({ importDraft: draft, isLoading: false })
      return draft
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '保存草稿失败',
        isLoading: false,
      })
      throw err
    }
  },

  clearImportDraft: async () => {
    try {
      await api.users.clearImportDraft()
      set({ importDraft: null })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '清除草稿失败',
      })
      throw err
    }
  },

  fetchAdminLogs: async (type = 'all') => {
    set({ isLoading: true, error: null })
    try {
      const logs = await api.users.getAdminLogs(type)
      set({ adminLogs: logs, isLoading: false })
      return logs
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '获取管理员日志失败',
        isLoading: false,
      })
      throw err
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
