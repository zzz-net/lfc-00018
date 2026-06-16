import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  User,
  Shield,
  Upload,
  FileSpreadsheet,
  History,
  AlertCircle,
  Mail,
  Layers,
} from 'lucide-react'
import type { User as UserType, UserRole } from '../../shared/types'
import { ROLE_LABELS } from '../../shared/types'
import { useAuthStore } from '@/store/useAuthStore'
import { useUserStore } from '@/store/useUserStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import ConfirmModal from '@/components/ConfirmModal'
import UserImportModal from '@/components/UserImportModal'
import AdminLogViewerModal from '@/components/AdminLogViewerModal'

interface FormData {
  username: string
  name: string
  role: UserRole
  password: string
  email: string
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'reviewer', label: '评审人' },
  { value: 'submitter', label: '提交者' },
]

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-300',
  reviewer: 'bg-sky-100 text-sky-700 border-sky-300',
  submitter: 'bg-zinc-100 text-zinc-700 border-zinc-300',
}

export default function UserManagement() {
  const navigate = useNavigate()
  const { user, logout, checkAuth } = useAuthStore()
  const {
    users,
    importDraft,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    fetchAdminLogs,
    loadImportDraft,
    isLoading,
  } = useUserStore()
  const { showToast } = useToast()

  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<UserType | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    username: '',
    name: '',
    role: 'submitter',
    password: '',
    email: '',
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (!user) {
      checkAuth()
    }
  }, [user, checkAuth])

  useEffect(() => {
    fetchUsers()
    fetchAdminLogs('user_import').catch(() => {})
    loadImportDraft().catch(() => {})
  }, [fetchUsers, fetchAdminLogs, loadImportDraft])

  const handleLogout = async () => {
    try {
      await logout()
      showToast('已退出登录', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '登出失败', 'error')
    }
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      name: '',
      role: 'submitter',
      password: '',
      email: '',
    })
    setFormErrors({})
    setShowModal(true)
  }

  const openEditModal = (userData: UserType) => {
    setEditingUser(userData)
    setFormData({
      username: userData.username,
      name: userData.name,
      role: userData.role,
      password: '',
      email: userData.email || '',
    })
    setFormErrors({})
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.username.trim()) {
      errors.username = '请输入用户名'
    } else if (formData.username.length < 3) {
      errors.username = '用户名至少3个字符'
    }

    if (!formData.name.trim()) {
      errors.name = '请输入姓名'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = '邮箱格式不正确'
    }

    if (!editingUser && !formData.password) {
      errors.password = '请输入密码'
    } else if (formData.password && formData.password.length < 6) {
      errors.password = '密码至少6个字符'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      if (editingUser) {
        const updateData: { name?: string; role?: UserRole; password?: string; email?: string | null } = {
          name: formData.name.trim(),
          role: formData.role,
          email: formData.email.trim() || null,
        }
        if (formData.password) {
          updateData.password = formData.password
        }
        await updateUser(editingUser.id, updateData)
        showToast('用户更新成功', 'success')
      } else {
        await createUser({
          username: formData.username.trim(),
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password,
          email: formData.email.trim() || null,
        })
        showToast('用户创建成功', 'success')
      }
      closeModal()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return
    try {
      await deleteUser(showDeleteConfirm.id)
      showToast('用户删除成功', 'success')
      setShowDeleteConfirm(null)
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
            onClick={() => navigate('/board')}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Shield className="h-4 w-4" />
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
          {importDraft && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 text-sm text-amber-800">
                检测到一份未完成的成员导入草稿（
                <span className="font-mono">{importDraft.fileName}</span>），更新时间：
                {new Date(importDraft.updatedAt).toLocaleString('zh-CN')}
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 transition flex items-center gap-1"
              >
                <History className="h-3.5 w-3.5" />
                继续导入
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-navy-900" />
              <h2 className="text-2xl font-bold text-zinc-900">用户管理</h2>
              <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-sm font-medium">
                {users.length} 个用户
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/batch-tasks')}
                className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm"
              >
                <Layers className="h-4 w-4" />
                批量任务中心
              </button>
              <button
                onClick={() => setShowLogs(true)}
                className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm"
              >
                <History className="h-4 w-4" />
                操作日志
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <Upload className="h-3.5 w-3.5 -ml-1" />
                批量导入
              </button>
              <button
                onClick={openCreateModal}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                添加用户
              </button>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      用户名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      邮箱
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      角色
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                        加载中...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                        暂无用户数据
                      </td>
                    </tr>
                  ) : (
                    users.map((userItem) => (
                      <tr
                        key={userItem.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-zinc-900">
                          {userItem.username}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-900">
                          {userItem.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {userItem.email ? (
                            <span className="text-zinc-700 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-zinc-400" />
                              {userItem.email}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium border',
                              roleColors[userItem.role]
                            )}
                          >
                            {ROLE_LABELS[userItem.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-500">
                          {formatDate(userItem.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(userItem)}
                              className="p-1.5 text-zinc-500 hover:text-navy-900 hover:bg-navy-50 transition-colors"
                              title="编辑"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(userItem)}
                              className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="删除"
                              disabled={userItem.id === user?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white shadow-2xl w-full max-w-md border-2 border-zinc-800">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900">
                {editingUser ? '编辑用户' : '创建用户'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  用户名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className={cn(
                    'input',
                    formErrors.username && 'border-red-500 focus:border-red-500'
                  )}
                  placeholder="请输入用户名"
                  disabled={!!editingUser}
                />
                {formErrors.username && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={cn(
                    'input',
                    formErrors.name && 'border-red-500 focus:border-red-500'
                  )}
                  placeholder="请输入姓名"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  邮箱
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={cn(
                    'input',
                    formErrors.email && 'border-red-500 focus:border-red-500'
                  )}
                  placeholder="请输入邮箱（可选）"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  角色 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="input"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  密码 {editingUser ? '(留空不修改)' : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={cn(
                    'input',
                    formErrors.password && 'border-red-500 focus:border-red-500'
                  )}
                  placeholder={editingUser ? '请输入新密码（可选）' : '请输入密码'}
                />
                {formErrors.password && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.password}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? '处理中...' : editingUser ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        title="确认删除"
        message={`确定要删除用户 "${showDeleteConfirm?.name}" 吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(null)}
        confirmText="确认删除"
        cancelText="取消"
        type="danger"
      />

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

      <UserImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportSuccess={() => fetchUsers()}
      />

      <AdminLogViewerModal
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
      />
    </div>
  )
}
