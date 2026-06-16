import { create } from 'zustand'
import type { User } from '../../shared/types'
import { api } from '@/api/client'

interface UserState {
  users: User[]
  isLoading: boolean
  error: string | null
  fetchUsers: () => Promise<void>
  createUser: (user: { username: string; password: string; name: string; role: User['role'] }) => Promise<User>
  updateUser: (id: number, data: { name?: string; role?: User['role']; password?: string }) => Promise<void>
  deleteUser: (id: number) => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

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

  createUser: async (user: { username: string; password: string; name: string; role: User['role'] }) => {
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

  updateUser: async (id: number, data: { name?: string; role?: User['role']; password?: string }) => {
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

  deleteUser: async (id: number) => {
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
}))
