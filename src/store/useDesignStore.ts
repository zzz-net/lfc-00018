import { create } from 'zustand'
import type { Design, ImportResult, Comment } from '../../shared/types'
import { api } from '@/api/client'

interface DesignState {
  designs: Design[]
  comments: Record<number, Comment[]>
  isLoading: boolean
  error: string | null
  selectedDesignId: number | null
  fetchDesigns: () => Promise<void>
  fetchComments: (designId: number) => Promise<Comment[]>
  addComment: (designId: number, content: string, isReturnReason?: boolean) => Promise<Comment>
  claimDesign: (id: number, version: number) => Promise<Design>
  reviewDesign: (id: number, version: number, action: 'pass' | 'return', reason?: string, comment?: string) => Promise<Design>
  resubmitDesign: (id: number, version: number) => Promise<Design>
  importDesigns: (file: File) => Promise<ImportResult>
  selectDesign: (id: number | null) => void
  clearError: () => void
}

export const useDesignStore = create<DesignState>((set, get) => ({
  designs: [],
  comments: {},
  isLoading: false,
  error: null,
  selectedDesignId: null,

  fetchDesigns: async () => {
    set({ isLoading: true, error: null })
    try {
      const designs = await api.designs.getList()
      set({ designs, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '获取设计稿列表失败',
        isLoading: false,
      })
      throw err
    }
  },

  fetchComments: async (designId: number) => {
    set({ isLoading: true, error: null })
    try {
      const comments = await api.comments.getList(designId)
      set((state) => ({
        comments: { ...state.comments, [designId]: comments },
        isLoading: false,
      }))
      return comments
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '获取评论失败',
        isLoading: false,
      })
      throw err
    }
  },

  addComment: async (designId: number, content: string, isReturnReason?: boolean) => {
    set({ isLoading: true, error: null })
    try {
      const comment = await api.comments.add(designId, content, isReturnReason)
      set((state) => ({
        comments: {
          ...state.comments,
          [designId]: [...(state.comments[designId] || []), comment],
        },
        isLoading: false,
      }))
      return comment
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '添加评论失败',
        isLoading: false,
      })
      throw err
    }
  },

  claimDesign: async (id: number, version: number) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.designs.claim(id, version)
      const design = result as Design
      const designs = get().designs.map((d) =>
        d.id === id ? design : d
      )
      set({ designs, isLoading: false })
      return design
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '认领失败',
        isLoading: false,
      })
      throw err
    }
  },

  reviewDesign: async (id: number, version: number, action: 'pass' | 'return', reason?: string, comment?: string) => {
    set({ isLoading: true, error: null })
    try {
      const design = await api.designs.review(id, version, action, reason, comment)
      const designs = get().designs.map((d) =>
        d.id === id ? design : d
      )
      set({ designs, isLoading: false })
      return design
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '评审失败',
        isLoading: false,
      })
      throw err
    }
  },

  resubmitDesign: async (id: number, version: number) => {
    set({ isLoading: true, error: null })
    try {
      const design = await api.designs.resubmit(id, version)
      const designs = get().designs.map((d) =>
        d.id === id ? design : d
      )
      set({ designs, isLoading: false })
      return design
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '重新提交失败',
        isLoading: false,
      })
      throw err
    }
  },

  importDesigns: async (file: File) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.designs.importCsv(file)
      await get().fetchDesigns()
      set({ isLoading: false })
      return result
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '导入失败',
        isLoading: false,
      })
      throw err
    }
  },

  selectDesign: (id: number | null) => {
    set({ selectedDesignId: id })
  },

  clearError: () => {
    set({ error: null })
  },
}))
