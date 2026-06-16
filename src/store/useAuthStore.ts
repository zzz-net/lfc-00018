import { create } from 'zustand'
import type { User } from '../../shared/types'
import { api } from '@/api/client'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const user = await api.auth.login(username, password)
      set({ user, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '登录失败',
        isLoading: false,
      })
      throw err
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null })
    try {
      await api.auth.logout()
      set({ user: null, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '登出失败',
        isLoading: false,
      })
      throw err
    }
  },

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await api.auth.getMe()
      set({ user, isLoading: false })
    } catch (err) {
      set({
        user: null,
        error: null,
        isLoading: false,
      })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
