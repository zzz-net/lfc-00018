import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  removeToast: (id: number) => void
}

let toastId = 0

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],

  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },

  showToast: (message: string, type: ToastType = 'info') => {
    const id = ++toastId
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }))

    setTimeout(() => {
      get().removeToast(id)
    }, 3000)
  },
}))
