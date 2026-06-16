import { useState, useCallback, useEffect } from 'react'
import { X, Upload, FileText, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react'
import type { ImportDesignItem, ImportConflict, ImportResult } from '../../shared/types'
import { useDesignStore } from '@/store/useDesignStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

type Step = 1 | 2 | 3

interface PreviewRow extends ImportDesignItem {
  lineNumber: number
  conflict?: ImportConflict
}

const sampleCsv = `designId,name,description,submitter,priority
DES001,用户中心设计稿,用户中心页面设计,张三,high
DES002,订单列表设计稿,订单列表页面设计,李四,medium
DES003,商品详情设计稿,商品详情页面设计,王五,low`

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { importDesigns, designs, isLoading } = useDesignStore()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFile(null)
      setPreviewRows([])
      setImportResult(null)
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

  const parseCsv = (content: string): PreviewRow[] => {
    const lines = content.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows: PreviewRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values.length < 4) continue

      const row: PreviewRow = {
        lineNumber: i + 1,
        designId: values[headers.indexOf('designid')] || '',
        name: values[headers.indexOf('name')] || '',
        description: values[headers.indexOf('description')] || '',
        submitter: values[headers.indexOf('submitter')] || '',
        priority: (values[headers.indexOf('priority')] as 'high' | 'medium' | 'low') || 'medium',
      }

      const existingDesign = designs.find(d => d.designId === row.designId)
      if (existingDesign) {
        row.conflict = {
          designId: row.designId,
          name: existingDesign.name,
          existingCreatedAt: existingDesign.createdAt,
          commentCount: 0,
          message: `设计ID ${row.designId} 已存在`,
        }
      }

      if (row.designId && row.name && row.submitter) {
        rows.push(row)
      }
    }

    return rows
  }

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      showToast('请选择CSV格式文件', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const rows = parseCsv(content)
      setFile(selectedFile)
      setPreviewRows(rows)
      showToast(`成功解析 ${rows.length} 条数据`, 'success')
    }
    reader.onerror = () => {
      showToast('文件读取失败', 'error')
    }
    reader.readAsText(selectedFile)
  }, [designs, showToast])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'designs_sample.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('样例模板已下载', 'success')
  }

  const handleNext = () => {
    if (step === 1 && file) {
      setStep(2)
    } else if (step === 2 && previewRows.length > 0) {
      setStep(3)
      handleImport()
    }
  }

  const handlePrev = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step)
    }
  }

  const handleImport = async () => {
    if (!file) return
    try {
      const result = await importDesigns(file)
      setImportResult(result)
      showToast(`成功导入 ${result.imported} 条数据`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败', 'error')
    }
  }

  const conflictCount = previewRows.filter(r => r.conflict).length
  const validCount = previewRows.filter(r => !r.conflict).length

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
          'bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col transition-all duration-300',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-navy-900" />
            <h2 className="text-lg font-semibold text-zinc-900">导入设计稿</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 py-4 px-6 border-b border-zinc-100">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step >= s
                    ? 'bg-navy-900 text-white'
                    : 'bg-zinc-100 text-zinc-400'
                )}
              >
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm',
                  step >= s ? 'text-zinc-900 font-medium' : 'text-zinc-400'
                )}
              >
                {s === 1 ? '选择文件' : s === 2 ? '检测冲突' : '确认导入'}
              </span>
              {s < 3 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-4',
                    step > s ? 'bg-navy-900' : 'bg-zinc-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
                  isDragging
                    ? 'border-navy-500 bg-navy-50'
                    : 'border-zinc-300 hover:border-navy-400 hover:bg-zinc-50'
                )}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleInputChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className={cn('h-12 w-12 mx-auto mb-4', isDragging ? 'text-navy-500' : 'text-zinc-400')} />
                  <p className="text-lg font-medium text-zinc-700 mb-1">
                    {isDragging ? '释放文件以上传' : '拖拽文件到此处'}
                  </p>
                  <p className="text-sm text-zinc-500 mb-4">或点击选择文件</p>
                  <span className="inline-block px-4 py-2 bg-navy-900 text-white rounded font-medium text-sm">
                    选择CSV文件
                  </span>
                </label>
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded border border-zinc-200">
                  <FileText className="h-5 w-5 text-navy-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={downloadSample}
                  className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  下载样例模板
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-600">
                    共 <span className="font-semibold text-zinc-900">{previewRows.length}</span> 条数据
                  </span>
                  <span className="text-sm text-emerald-600">
                    可导入 <span className="font-semibold">{validCount}</span> 条
                  </span>
                  {conflictCount > 0 && (
                    <span className="text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      冲突 <span className="font-semibold">{conflictCount}</span> 条
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600 border-b border-zinc-200">行号</th>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600 border-b border-zinc-200">设计ID</th>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600 border-b border-zinc-200">名称</th>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600 border-b border-zinc-200">提交者</th>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600 border-b border-zinc-200">优先级</th>
                      <th className="px-3 py-2 text-left font-medium text-zinc-600 border-b border-zinc-200">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr
                        key={index}
                        className={cn(
                          'border-b border-zinc-100 last:border-b-0',
                          row.conflict && 'bg-red-50'
                        )}
                      >
                        <td className="px-3 py-2 text-zinc-500">{row.lineNumber}</td>
                        <td className="px-3 py-2 font-mono text-zinc-900">{row.designId}</td>
                        <td className="px-3 py-2 text-zinc-900">{row.name}</td>
                        <td className="px-3 py-2 text-zinc-600">{row.submitter}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded',
                            row.priority === 'high' ? 'bg-red-100 text-red-700' :
                            row.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {row.priority === 'high' ? '高' : row.priority === 'medium' ? '中' : '低'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {row.conflict ? (
                            <span className="text-xs text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {row.conflict.message}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" />
                              可导入
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {conflictCount > 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  存在 {conflictCount} 条冲突数据，这些数据将被跳过不会导入
                </p>
              )}
            </div>
          )}

          {step === 3 && importResult && (
            <div className="space-y-6 text-center py-8">
              <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-900">导入完成</h3>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">{importResult.imported}</p>
                  <p className="text-sm text-zinc-500">成功导入</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{importResult.conflicts.length}</p>
                  <p className="text-sm text-zinc-500">冲突数量</p>
                </div>
              </div>
              {importResult.conflicts.length > 0 && (
                <div className="text-left bg-red-50 border border-red-200 rounded p-4">
                  <h4 className="font-medium text-red-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    冲突详情
                  </h4>
                  <ul className="space-y-1 text-sm text-red-600">
                    {importResult.conflicts.map((conflict, index) => (
                      <li key={index}>• {conflict.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-zinc-200 bg-zinc-50">
          <div>
            {step > 1 && step < 3 && (
              <button
                onClick={handlePrev}
                className="btn-secondary flex items-center gap-1"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                上一步
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="btn-secondary"
            >
              {step === 3 ? '完成' : '取消'}
            </button>
            {step < 3 && (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-1"
                disabled={isLoading || (step === 1 && !file) || (step === 2 && validCount === 0)}
              >
                {step === 2 ? '确认导入' : '下一步'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
