import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Upload, Download, Users, Loader2, User, Shield } from 'lucide-react'
import type { Design, DesignStatus } from '../../shared/types'
import { ROLE_LABELS } from '../../shared/types'
import { useAuthStore } from '@/store/useAuthStore'
import { useDesignStore } from '@/store/useDesignStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import KanbanColumn from '@/components/KanbanColumn'
import DesignDetailDrawer from '@/components/DesignDetailDrawer'
import ImportModal from '@/components/ImportModal'
import ExportModal from '@/components/ExportModal'
import ConfirmModal from '@/components/ConfirmModal'

const statuses: DesignStatus[] = [
  'pending_claim',
  'reviewing',
  'returned',
  'pending_review',
  'passed',
]

export default function Board() {
  const navigate = useNavigate()
  const { user, logout, checkAuth } = useAuthStore()
  const { designs, fetchDesigns, isLoading, selectDesign, selectedDesignId } = useDesignStore()
  const { showToast } = useToast()

  const [headerLoaded, setHeaderLoaded] = useState(false)
  const [columnsLoaded, setColumnsLoaded] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null)

  useEffect(() => {
    if (!user) {
      checkAuth()
    }
  }, [user, checkAuth])

  useEffect(() => {
    fetchDesigns()
    const headerTimer = setTimeout(() => setHeaderLoaded(true), 100)
    const columnsTimer = setTimeout(() => setColumnsLoaded(true), 300)
    return () => {
      clearTimeout(headerTimer)
      clearTimeout(columnsTimer)
    }
  }, [fetchDesigns])

  useEffect(() => {
    if (selectedDesignId) {
      const design = designs.find(d => d.id === selectedDesignId)
      setSelectedDesign(design || null)
    } else {
      setSelectedDesign(null)
    }
  }, [selectedDesignId, designs])

  const handleLogout = async () => {
    try {
      await logout()
      showToast('已退出登录', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '登出失败', 'error')
    }
  }

  const getDesignsByStatus = (status: DesignStatus) => {
    return designs
      .filter(d => d.status === status)
      .sort((a, b) => a.queueOrder - b.queueOrder)
  }

  const handleCardClick = (design: Design) => {
    selectDesign(design.id)
  }

  const handleCloseDrawer = () => {
    selectDesign(null)
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 border-red-300',
    reviewer: 'bg-sky-100 text-sky-700 border-sky-300',
    submitter: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <header
        className={cn(
          'bg-white border-b-2 border-zinc-800 px-6 py-3 flex items-center justify-between transition-all duration-500',
          headerLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        )}
      >
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
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Upload className="h-4 w-4" />
            导入
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Download className="h-4 w-4" />
            导出
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/users')}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <Users className="h-4 w-4" />
              用户管理
            </button>
          )}

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="btn-danger flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {isLoading && designs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-navy-900 animate-spin" />
              <p className="text-sm text-zinc-500">加载中...</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-x-auto p-6">
            <div className="flex gap-4 h-full min-w-max">
              {statuses.map((status, index) => (
                <div
                  key={status}
                  className={cn(
                    'transition-all duration-500 h-full',
                    columnsLoaded
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 translate-x-8'
                  )}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <KanbanColumn
                    status={status}
                    designs={getDesignsByStatus(status)}
                    onCardClick={handleCardClick}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <DesignDetailDrawer
        design={selectedDesign}
        onClose={handleCloseDrawer}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
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
    </div>
  )
}
