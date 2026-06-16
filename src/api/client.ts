import type {
  User,
  Design,
  Comment,
  LoginRequest,
  ReviewRequest,
  ImportResult,
  ApiResponse,
  ExportFilter,
  ClaimConflictData,
} from '../../shared/types'

const BASE_URL = '/api'

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const data = await response.json() as ApiResponse<T>

  if (!data.success) {
    throw new Error(data.error || '请求失败')
  }

  return data.data as T
}

async function requestRaw(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const data = await response.json() as ApiResponse
    throw new Error(data.error || '请求失败')
  }

  return response
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password } satisfies LoginRequest),
      }),

    logout: () =>
      request<void>('/auth/logout', {
        method: 'POST',
      }),

    getMe: () =>
      request<User>('/auth/me'),
  },

  designs: {
    getList: () =>
      request<Design[]>('/designs'),

    getById: (id: number) =>
      request<Design>(`/designs/${id}`),

    claim: (id: number, version: number) =>
      request<Design | ClaimConflictData>(`/designs/${id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ version }),
      }),

    review: (id: number, version: number, action: 'pass' | 'return', reason?: string, comment?: string) =>
      request<Design>(`/designs/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ version, action, reason, comment } satisfies ReviewRequest & { version: number }),
      }),

    resubmit: (id: number, version: number) =>
      request<Design>(`/designs/${id}/resubmit`, {
        method: 'POST',
        body: JSON.stringify({ version }),
      }),

    importCsv: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<ImportResult>('/designs/import', {
        method: 'POST',
        body: formData,
        headers: {},
      })
    },

    exportMarkdown: (filter?: ExportFilter) => {
      const params = new URLSearchParams()
      if (filter) {
        if (filter.status) params.append('status', filter.status)
        if (filter.submitterId) params.append('submitterId', String(filter.submitterId))
        if (filter.reviewerId) params.append('reviewerId', String(filter.reviewerId))
        if (filter.startDate) params.append('startDate', filter.startDate)
        if (filter.endDate) params.append('endDate', filter.endDate)
      }
      const queryString = params.toString()
      return requestRaw(`/designs/export${queryString ? `?${queryString}` : ''}`)
    },
  },

  comments: {
    getList: (designId: number) =>
      request<Comment[]>(`/designs/${designId}/comments`),

    add: (designId: number, content: string, isReturnReason?: boolean) =>
      request<Comment>(`/designs/${designId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, isReturnReason }),
      }),
  },

  users: {
    getList: () =>
      request<User[]>('/users'),

    create: (user: { username: string; password: string; name: string; role: User['role'] }) =>
      request<User>('/users', {
        method: 'POST',
        body: JSON.stringify(user),
      }),

    update: (id: number, data: { name?: string; role?: User['role']; password?: string }) =>
      request<void>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      request<void>(`/users/${id}`, {
        method: 'DELETE',
      }),
  },
}
