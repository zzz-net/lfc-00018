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
  UserImportPrecheckResult,
  UserImportResult,
  FieldMapping,
  ImportDraft,
  AdminOperationLog,
  PrecheckRowError,
  UserImportDraftPayload,
} from '../../shared/types'

const BASE_URL = '/api'

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData
  
  const defaultHeaders: Record<string, string> = {}
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: {
      ...defaultHeaders,
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

    create: (user: { username: string; password: string; name: string; role: User['role']; email?: string | null }) =>
      request<User>('/users', {
        method: 'POST',
        body: JSON.stringify(user),
      }),

    update: (id: number, data: { name?: string; role?: User['role']; password?: string; email?: string | null }) =>
      request<void>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      request<void>(`/users/${id}`, {
        method: 'DELETE',
      }),

    precheckImport: (file: File, fieldMapping?: FieldMapping) => {
      const formData = new FormData()
      formData.append('file', file)
      if (fieldMapping) {
        formData.append('fieldMapping', JSON.stringify(fieldMapping))
      }
      return request<UserImportPrecheckResult>('/users/import/precheck', {
        method: 'POST',
        body: formData,
        headers: {},
      })
    },

    precheckImportFromRaw: (payload: { rawCsv: string; fileName: string; fileSize: number; fieldMapping?: FieldMapping }) =>
      request<UserImportPrecheckResult>('/users/import/precheck', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    submitImport: (payload: {
      rawCsv: string
      fieldMapping: FieldMapping
      applyDefaultPassword?: boolean
      fileName?: string
    }) =>
      request<UserImportResult>('/users/import/submit', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    submitImportWithFile: (file: File, fieldMapping: FieldMapping, applyDefaultPassword = true) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fieldMapping', JSON.stringify(fieldMapping))
      formData.append('applyDefaultPassword', String(applyDefaultPassword))
      return request<UserImportResult>('/users/import/submit', {
        method: 'POST',
        body: formData,
        headers: {},
      })
    },

    exportImportErrors: (rowErrors: PrecheckRowError[], detectedHeaders: string[]) => {
      const params = { rowErrors, detectedHeaders }
      return fetch(`${BASE_URL}/users/import/export-errors`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then(async (r) => {
        if (!r.ok) {
          const data = (await r.json()) as ApiResponse
          throw new Error(data.error || '导出失败')
        }
        const blob = await r.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'import_errors.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      })
    },

    getImportDraft: () =>
      request<ImportDraft | null>('/users/import/draft'),

    saveImportDraft: (payload: UserImportDraftPayload) =>
      request<ImportDraft>('/users/import/draft', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    clearImportDraft: () =>
      request<{ cleared: boolean }>('/users/import/draft', {
        method: 'DELETE',
      }),

    getAdminLogs: (type?: 'user_import' | 'all', limit = 200) => {
      const params = new URLSearchParams()
      if (type && type !== 'all') params.append('type', type)
      params.append('limit', String(limit))
      const qs = params.toString()
      return request<AdminOperationLog[]>(`/users/admin-logs${qs ? `?${qs}` : ''}`)
    },
  },
}
