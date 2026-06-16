import { useState, useEffect } from 'react'
import { X, Download, Copy, Check, FileText, Calendar, Filter } from 'lucide-react'
import type { DesignStatus, ExportFilter, User } from '../../shared/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '../../shared/types'
import { api } from '@/api/client'
import { useUserStore } from '@/store/useUserStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
}

const statusOptions: { value: DesignStatus; label: string }[] = [
  { value: 'pending_claim', label: '待认领' },
  { value: 'reviewing', label: '评审中' },
  { value: 'returned', label: '退回修改' },
  { value: 'pending_review', label: '待复审' },
  { value: 'passed', label: '通过' },
]

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { users, fetchUsers } = useUserStore()
  const { showToast } = useToast()

  const [selectedStatuses, setSelectedStatuses] = useState<DesignStatus[]>([])
  const [selectedSubmitter, setSelectedSubmitter] = useState<number | ''>('')
  const [selectedReviewer, setSelectedReviewer] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [preview, setPreview] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      fetchUsers()
    } else {
      setIsVisible(false)
    }
  }, [isOpen, fetchUsers])

  useEffect(() => {
    if (!isOpen) {
      setSelectedStatuses([])
      setSelectedSubmitter('')
      setSelectedReviewer('')
      setStartDate('')
      setEndDate('')
      setPreview('')
      setCopied(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const toggleStatus = (status: DesignStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
  }

  const submitters = users.filter((u) => u.role === 'submitter' || u.role === 'admin')
  const reviewers = users.filter((u) => u.role === 'reviewer' || u.role === 'admin')

  const generatePreview = async () => {
    setIsLoading(true)
    try {
      const filter: ExportFilter = {}
      if (selectedStatuses.length === 1) {
        filter.status = selectedStatuses[0]
      }
      if (selectedSubmitter) {
        filter.submitterId = selectedSubmitter
      }
      if (selectedReviewer) {
        filter.reviewerId = selectedReviewer
      }
      if (startDate) {
        filter.startDate = startDate
      }
      if (endDate) {
        filter.endDate = endDate
      }

      const response = await api.designs.exportMarkdown(filter)
      const text = await response.text()
      setPreview(text)
      showToast('预览已生成', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '生成预览失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!preview) return
    try {
      await navigator.clipboard.writeText(preview)
      setCopied(true)
      showToast('已复制到剪贴板', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      showToast('复制失败', 'error')
    }
  }

  const downloadMarkdown = () => {
    if (!preview) return
    const blob = new Blob([preview], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().split('T')[0]
    a.download = `designs_export_${dateStr}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('文件已下载', 'success')
  }

  const hasFilters = selectedStatuses.length > 0 || selectedSubmitter || selectedReviewer || startDate || endDate

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col transition-all duration-300',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-navy-900" />
            <h2 className="text-lg font-semibold text-zinc-900">导出设计稿</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <Filter className="h-4 w-4" />
              筛选条件
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  状态（可多选）
                </label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => toggleStatus(option.value)}
                      className={cn(
                        'px-3 py-1.5 text-sm border-2 rounded transition-all',
                        selectedStatuses.includes(option.value)
                          ? 'bg-navy-900 text-white border-navy-900'
                          : 'bg-white text-zinc-700 border-zinc-300 hover:border-navy-400'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  提交者
                </label>
                <select
                  value={selectedSubmitter}
                  onChange={(e) => setSelectedSubmitter(e.target.value ? Number(e.target.value) : '')}
                  className="input"
                >
                  <option value="">全部提交者</option>
                  {submitters.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  评审人
                </label>
                <select
                  value={selectedReviewer}
                  onChange={(e) => setSelectedReviewer(e.target.value ? Number(e.target.value) : '')}
                  className="input"
                >
                  <option value="">全部评审人</option>
                  {reviewers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  开始日期
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  结束日期
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={generatePreview}
                className="btn-primary flex items-center gap-2"
                disabled={isLoading}
              >
                <FileText className="h-4 w-4" />
                {isLoading ? '生成中...' : '生成预览'}
              </button>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSelectedStatuses([])
                    setSelectedSubmitter('')
                    setSelectedReviewer('')
                    setStartDate('')
                    setEndDate('')
                  }}
                  className="btn-secondary text-sm"
                >
                  清除筛选
                </button>
              )}
            </div>
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900">Markdown 预览</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="btn-secondary flex items-center gap-1 text-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-500" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        复制
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadMarkdown}
                    className="btn-primary flex items-center gap-1 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    下载 .md
                  </button>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs text-zinc-400">designs_export.md</span>
                </div>
                <pre className="p-4 text-sm text-zinc-100 overflow-x-auto max-h-96 overflow-y-auto">
                  <code>{preview}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={handleClose}
            className="btn-secondary"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
