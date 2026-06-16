import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  X,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  RefreshCw,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react'
import type {
  UserImportPrecheckResult,
  UserImportResult,
  FieldMapping,
  PrecheckRowError,
  PrecheckHeaderIssue,
} from '../../shared/types'
import {
  USER_IMPORT_FIELDS,
  USER_IMPORT_DEFAULT_PASSWORD,
} from '../../shared/types'
import { useUserStore } from '@/store/useUserStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface UserImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: () => void
}

type Step = 1 | 2 | 3 | 4

const sampleCsv = `用户名,姓名,邮箱,角色,密码
zhangsan,张三,zhangsan@example.com,submitter,
lisi,李四,lisi@example.com,reviewer,
wangwu,王五,wangwu@example.com,admin,
zhaoliu,赵六,,submitter,`

interface ErrorGroupItem {
  type: string
  typeLabel: string
  icon: 'alert' | 'warn' | 'info'
  count: number
}

export default function UserImportModal({ isOpen, onClose, onImportSuccess }: UserImportModalProps) {
  const {
    isLoading,
    importDraft,
    precheckUserImport,
    precheckUserImportFromRaw,
    submitUserImport,
    exportImportErrors,
    loadImportDraft,
    saveImportDraft,
    clearImportDraft,
  } = useUserStore()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>(1)
  const [isVisible, setIsVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [rawCsv, setRawCsv] = useState('')
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [precheckResult, setPrecheckResult] = useState<UserImportPrecheckResult | null>(null)
  const [importResult, setImportResult] = useState<UserImportResult | null>(null)

  const [useDefaultPwd, setUseDefaultPwd] = useState(true)
  const [expandedErrorRows, setExpandedErrorRows] = useState<Set<number>>(new Set())
  const [restoreDraftAsked, setRestoreDraftAsked] = useState(false)
  const [filterErrorType, setFilterErrorType] = useState<string | null>(null)

  const draftSaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setRestoreDraftAsked(false)
      loadImportDraft().catch(() => {})
    } else {
      setIsVisible(false)
    }
  }, [isOpen, loadImportDraft])

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFile(null)
      setRawCsv('')
      setFieldMapping({})
      setPrecheckResult(null)
      setImportResult(null)
      setUseDefaultPwd(true)
      setExpandedErrorRows(new Set())
      setFilterErrorType(null)
    }
  }, [isOpen])

  const scheduleSaveDraft = useCallback(() => {
    if (!precheckResult || !rawCsv) return
    if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = window.setTimeout(() => {
      saveImportDraft({
        precheckResult,
        fieldMapping,
        fileName: file?.name || precheckResult.fileSummary.fileName,
        fileSize: file?.size || precheckResult.fileSummary.fileSize,
        rawCsvContent: rawCsv,
      })
        .then(() => showToast('草稿已自动保存', 'success'))
        .catch(() => {})
    }, 600)
  }, [precheckResult, fieldMapping, rawCsv, file, saveImportDraft, showToast])

  useEffect(() => {
    if (isOpen && precheckResult && step >= 2 && step <= 3) {
      scheduleSaveDraft()
    }
    return () => {
      if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current)
    }
  }, [precheckResult, fieldMapping, step, isOpen, scheduleSaveDraft])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const detectDefaultMapping = useCallback((headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {}
    const lowerToActual: Record<string, string> = {}
    headers.forEach((h) => {
      lowerToActual[h.toLowerCase()] = h
    })
    USER_IMPORT_FIELDS.forEach((field) => {
      const candidates = [field.key.toLowerCase(), field.label, field.label.toLowerCase()]
      for (const cand of candidates) {
        if (lowerToActual[cand]) {
          mapping[field.key] = lowerToActual[cand]
          break
        }
      }
    })
    return mapping
  }, [])

  const handleFileContent = useCallback(async (selectedFile: File, content: string) => {
    if (!content || !content.trim()) {
      showToast('CSV文件内容为空', 'error')
      return
    }
    setFile(selectedFile)
    setRawCsv(content)
    try {
      const firstLine = content.split(/\r?\n/)[0] || ''
      const headers = firstLine.split(',').map((h) => h.trim()).filter(Boolean)
      const defaultMapping = detectDefaultMapping(headers)
      setFieldMapping(defaultMapping)
      const result = await precheckUserImport(selectedFile, defaultMapping)
      setPrecheckResult(result)
      setStep(2)
      showToast('字段识别完成，请确认映射关系', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '解析失败', 'error')
    }
  }, [precheckUserImport, detectDefaultMapping, showToast])

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      showToast('请选择CSV格式文件', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      handleFileContent(selectedFile, content)
    }
    reader.onerror = () => showToast('文件读取失败', 'error')
    reader.readAsText(selectedFile, 'utf-8')
  }, [handleFileContent, showToast])

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
    if (droppedFile) handleFileSelect(droppedFile)
  }
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) handleFileSelect(selectedFile)
  }

  const handleRestoreDraft = async () => {
    if (!importDraft) return
    try {
      setRawCsv(importDraft.rawCsvContent)
      setFieldMapping(importDraft.fieldMapping)
      setPrecheckResult(importDraft.precheckResult)
      setFile(new File([importDraft.rawCsvContent], importDraft.fileName, { type: 'text/csv' }))
      if (Object.keys(importDraft.fieldMapping || {}).length > 0) {
        setStep(3)
      } else {
        setStep(2)
      }
      showToast('已恢复上次的导入草稿', 'success')
    } catch {
      showToast('草稿恢复失败', 'error')
    }
    setRestoreDraftAsked(true)
  }

  const handleRejectDraft = async () => {
    try {
      await clearImportDraft()
      showToast('草稿已清除', 'success')
    } catch {
      /* ignore */
    }
    setRestoreDraftAsked(true)
  }

  const downloadSample = () => {
    const blob = new Blob(['\uFEFF' + sampleCsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'members_sample.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('样例模板已下载', 'success')
  }

  const handleMappingChange = async (fieldKey: string, targetHeader: string) => {
    const newMapping = { ...fieldMapping }
    if (targetHeader === '__none__') {
      delete newMapping[fieldKey]
    } else {
      for (const k of Object.keys(newMapping)) {
        if (newMapping[k] === targetHeader) delete newMapping[k]
      }
      newMapping[fieldKey] = targetHeader
    }
    setFieldMapping(newMapping)
    if (precheckResult && rawCsv) {
      try {
        const result = await precheckUserImportFromRaw({
          rawCsv,
          fileName: file?.name || 'import.csv',
          fileSize: file?.size || 0,
          fieldMapping: newMapping,
        })
        setPrecheckResult(result)
      } catch (err) {
        showToast(err instanceof Error ? err.message : '重新预检查失败', 'error')
      }
    }
  }

  const requiredMappingComplete = useMemo(() => {
    const req = USER_IMPORT_FIELDS.filter((f) => f.required)
    return req.every((f) => !!fieldMapping[f.key])
  }, [fieldMapping])

  const headerIssuesSevere = useMemo(() => {
    if (!precheckResult) return [] as PrecheckHeaderIssue[]
    return precheckResult.headerIssues.filter((h) => h.type === 'MISSING_REQUIRED_COLUMN')
  }, [precheckResult])

  const errorGroups: ErrorGroupItem[] = useMemo(() => {
    if (!precheckResult) return []
    const groups = new Map<string, ErrorGroupItem & { rawType: string }>()
    for (const rowErr of precheckResult.rowErrors) {
      for (const e of rowErr.errors) {
        if (!groups.has(e.type)) {
          groups.set(e.type, {
            type: e.type,
            rawType: e.type,
            typeLabel: humanizeErrorType(e.type),
            icon: iconForError(e.type),
            count: 0,
          })
        }
        groups.get(e.type)!.count++
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count)
  }, [precheckResult])

  const visibleRowErrors = useMemo(() => {
    if (!precheckResult) return [] as PrecheckRowError[]
    if (!filterErrorType) return precheckResult.rowErrors
    return precheckResult.rowErrors.filter((r) =>
      r.errors.some((e) => e.type === filterErrorType)
    )
  }, [precheckResult, filterErrorType])

  const handleExportErrors = async () => {
    if (!precheckResult || precheckResult.rowErrors.length === 0) return
    try {
      await exportImportErrors(precheckResult.rowErrors, precheckResult.detectedHeaders)
      showToast(`已导出 ${precheckResult.rowErrors.length} 条错误记录`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败', 'error')
    }
  }

  const handleNext = async () => {
    if (step === 1) return
    if (step === 2) {
      if (!requiredMappingComplete) {
        showToast('请先完成所有必填字段的映射', 'error')
        return
      }
      if (!precheckResult && rawCsv) {
        try {
          const result = await precheckUserImportFromRaw({
            rawCsv,
            fileName: file?.name || 'import.csv',
            fileSize: file?.size || 0,
            fieldMapping,
          })
          setPrecheckResult(result)
        } catch (err) {
          showToast(err instanceof Error ? err.message : '预检查失败', 'error')
          return
        }
      }
      setStep(3)
      return
    }
    if (step === 3 && precheckResult) {
      if (precheckResult.validRows === 0) {
        showToast('没有可导入的有效数据行', 'error')
        return
      }
      try {
        const result = await submitUserImport({
          rawCsv,
          fieldMapping,
          applyDefaultPassword: useDefaultPwd,
          fileName: file?.name,
        })
        setImportResult(result)
        setStep(4)
        onImportSuccess?.()
        showToast(`成功导入 ${result.imported} 位成员`, 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : '导入失败', 'error')
      }
      return
    }
    if (step === 4) {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (step > 1) setStep((prev) => (prev - 1) as Step)
  }

  const toggleErrorRow = (line: number) => {
    setExpandedErrorRows((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

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
          'bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col transition-all duration-300',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-navy-900" />
            <h2 className="text-lg font-semibold text-zinc-900">批量导入成员</h2>
            {importDraft && !restoreDraftAsked && (
              <div className="ml-4 flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded text-xs">
                <History className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-700">检测到未完成的导入草稿</span>
                <button
                  onClick={handleRestoreDraft}
                  className="px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition"
                >
                  恢复
                </button>
                <button
                  onClick={handleRejectDraft}
                  className="p-0.5 text-amber-600 hover:text-amber-800"
                  title="放弃草稿"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 py-4 px-6 border-b border-zinc-100 bg-zinc-50">
          {[
            { s: 1 as Step, label: '选择文件' },
            { s: 2 as Step, label: '字段映射' },
            { s: 3 as Step, label: '预检查' },
            { s: 4 as Step, label: '导入结果' },
          ].map((it, idx, arr) => (
            <div key={it.s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step >= it.s ? 'bg-navy-900 text-white' : 'bg-zinc-200 text-zinc-500'
                )}
              >
                {step > it.s ? <CheckCircle className="h-4 w-4" /> : it.s}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm',
                  step >= it.s ? 'text-zinc-900 font-medium' : 'text-zinc-400'
                )}
              >
                {it.label}
              </span>
              {idx < arr.length - 1 && (
                <div
                  className={cn(
                    'w-10 h-0.5 mx-3',
                    step > it.s ? 'bg-navy-900' : 'bg-zinc-200'
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
                  id="user-csv-upload"
                />
                <label htmlFor="user-csv-upload" className="cursor-pointer">
                  <Upload
                    className={cn('h-12 w-12 mx-auto mb-4', isDragging ? 'text-navy-500' : 'text-zinc-400')}
                  />
                  <p className="text-lg font-medium text-zinc-700 mb-1">
                    {isDragging ? '释放文件以上传' : '拖拽CSV文件到此处'}
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
                  <button
                    onClick={() => {
                      setFile(null)
                      setRawCsv('')
                      setPrecheckResult(null)
                    }}
                    className="p-1 text-zinc-400 hover:text-red-500"
                    title="移除文件"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-navy-50 border border-navy-100 rounded">
                  <div className="flex items-center gap-2 mb-2 text-navy-800 font-medium text-sm">
                    <Info className="h-4 w-4" />
                    必填列
                  </div>
                  <ul className="text-xs text-navy-700 space-y-1">
                    {USER_IMPORT_FIELDS.filter((f) => f.required).map((f) => (
                      <li key={f.key}>
                        <span className="font-mono">{f.key}</span>（{f.label}）：{f.description}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded">
                  <div className="flex items-center gap-2 mb-2 text-zinc-800 font-medium text-sm">
                    <Sparkles className="h-4 w-4" />
                    可选列
                  </div>
                  <ul className="text-xs text-zinc-700 space-y-1">
                    {USER_IMPORT_FIELDS.filter((f) => !f.required).map((f) => (
                      <li key={f.key}>
                        <span className="font-mono">{f.key}</span>（{f.label}）：{f.description}
                      </li>
                    ))}
                    <li className="text-amber-700">
                      密码留空时将使用默认密码：
                      <span className="font-mono ml-1">{USER_IMPORT_DEFAULT_PASSWORD}</span>
                    </li>
                  </ul>
                </div>
              </div>
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

          {step === 2 && precheckResult && (
            <div className="space-y-5">
              {headerIssuesSevere.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                  <div className="flex items-center gap-2 font-medium text-red-700 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    存在严重表头问题，必须先修复映射才能继续
                  </div>
                  <ul className="text-red-600 space-y-1 ml-6 list-disc text-xs">
                    {headerIssuesSevere.map((h, i) => (
                      <li key={i}>{h.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">字段映射配置</h3>
                <div className="overflow-hidden border border-zinc-200 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-600 w-1/4">
                          目标字段
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-600">
                          对应CSV表头
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-600 w-2/5">
                          说明
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {USER_IMPORT_FIELDS.map((field) => {
                        const isReq = field.required
                        const current = fieldMapping[field.key] || ''
                        const isOk = !isReq || !!current
                        return (
                          <tr key={field.key} className={cn(!isOk && 'bg-red-50/40')}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-900">{field.label}</span>
                                {isReq ? (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                                    必填
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">
                                    可选
                                  </span>
                                )}
                                <code className="text-xs text-zinc-400 font-mono">{field.key}</code>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={current || '__none__'}
                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                className={cn(
                                  'w-full px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2',
                                  isOk
                                    ? 'border-zinc-300 focus:ring-navy-500 focus:border-navy-500'
                                    : 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                )}
                              >
                                <option value="__none__">-- 不映射（忽略）--</option>
                                {precheckResult.detectedHeaders.map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              {current && (
                                <div className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  已映射到表头「{current}」
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-500">{field.description}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <RefreshCw className="h-3.5 w-3.5" />
                  调整映射后将自动重新执行预检查
                </div>
              </div>
            </div>
          )}

          {step === 3 && precheckResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="总数据行" value={precheckResult.totalRows} tone="zinc" />
                <StatCard label="可导入行" value={precheckResult.validRows} tone="emerald" />
                <StatCard
                  label="存在问题行"
                  value={precheckResult.invalidRows}
                  tone={precheckResult.invalidRows > 0 ? 'red' : 'zinc'}
                />
                <StatCard
                  label="表头问题"
                  value={precheckResult.headerIssues.length}
                  tone={precheckResult.headerIssues.length > 0 ? 'amber' : 'zinc'}
                />
              </div>

              {precheckResult.headerIssues.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-center gap-2 font-medium text-amber-800 mb-2 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    表头相关问题
                  </div>
                  <ul className="ml-6 space-y-1 text-xs text-amber-700 list-disc">
                    {precheckResult.headerIssues.map((h, i) => (
                      <li key={i}>{h.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {errorGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterErrorType(null)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs border transition',
                      filterErrorType === null
                        ? 'bg-navy-900 text-white border-navy-900'
                        : 'bg-white text-zinc-600 border-zinc-300 hover:border-navy-500 hover:text-navy-700'
                    )}
                  >
                    全部 ({precheckResult.rowErrors.length})
                  </button>
                  {errorGroups.map((g) => (
                    <button
                      key={g.type}
                      onClick={() => setFilterErrorType(g.type)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs border transition',
                        filterErrorType === g.type
                          ? 'bg-navy-900 text-white border-navy-900'
                          : 'bg-white text-zinc-600 border-zinc-300 hover:border-navy-500 hover:text-navy-700'
                      )}
                    >
                      {g.typeLabel} ({g.count})
                    </button>
                  ))}
                  {precheckResult.rowErrors.length > 0 && (
                    <button
                      onClick={handleExportErrors}
                      className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      <Download className="h-3 w-3" />
                      导出错误行CSV
                    </button>
                  )}
                </div>
              )}

              {precheckResult.rowErrors.length > 0 && (
                <div className="border border-zinc-200 rounded overflow-hidden">
                  <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-sm font-medium text-zinc-700 flex items-center justify-between">
                    <span>
                      校验不通过明细
                      <span className="text-zinc-400 ml-2 text-xs">
                        （显示 {visibleRowErrors.length} 条 / 共 {precheckResult.rowErrors.length} 条）
                      </span>
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-[40vh] overflow-y-auto">
                    {visibleRowErrors.map((rowErr) => {
                      const expanded = expandedErrorRows.has(rowErr.lineNumber)
                      return (
                        <div key={rowErr.lineNumber}>
                          <button
                            onClick={() => toggleErrorRow(rowErr.lineNumber)}
                            className="w-full flex items-center px-4 py-2.5 hover:bg-zinc-50 text-left transition"
                          >
                            <div className="w-16 flex-shrink-0 text-xs text-zinc-500 font-mono">
                              第 {rowErr.lineNumber} 行
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-zinc-800 font-medium truncate">
                                {(rowErr.rowData[fieldMapping.name || 'name'] ||
                                  rowErr.rowData[fieldMapping.username || 'username'] ||
                                  '未命名') +
                                  '  '}
                                {Object.entries(rowErr.rowData)
                                  .slice(0, 3)
                                  .map(([k, v]) => `${k}=${v || '-'}`)
                                  .join(' | ')}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rowErr.errors.slice(0, 3).map((e, i) => (
                                  <span
                                    key={i}
                                    className={cn(
                                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                      e.type.startsWith('EMPTY') || e.type.startsWith('MISSING')
                                        ? 'bg-red-100 text-red-700'
                                        : e.type.startsWith('ROW_INTERNAL') || e.type.includes('EXISTS')
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-orange-100 text-orange-700'
                                    )}
                                  >
                                    {humanizeErrorType(e.type)}
                                  </span>
                                ))}
                                {rowErr.errors.length > 3 && (
                                  <span className="px-1.5 py-0.5 text-[10px] text-zinc-500">
                                    +{rowErr.errors.length - 3} 更多
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="ml-2 flex-shrink-0 text-zinc-400">
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </button>
                          {expanded && (
                            <div className="px-4 pb-3 pl-16">
                              <div className="border border-zinc-200 rounded p-3 bg-zinc-50/50 space-y-2">
                                <div className="text-xs font-medium text-zinc-600">原始数据：</div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                  {Object.entries(rowErr.rowData).map(([k, v]) => (
                                    <div key={k} className="flex gap-1">
                                      <span className="text-zinc-400 shrink-0">{k}:</span>
                                      <span className="text-zinc-700 truncate">{v || '(空)'}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2 mt-2 border-t border-zinc-200">
                                  <div className="text-xs font-medium text-red-600 mb-1">错误说明：</div>
                                  <ul className="space-y-1 ml-4 list-disc">
                                    {rowErr.errors.map((e, i) => (
                                      <li key={i} className="text-[11px] text-red-700">
                                        <span className="font-mono text-red-500">[{e.field || '-'}]</span>
                                        {' ' + e.message}
                                        {e.value !== undefined && e.value !== '' && e.value !== '***' && (
                                          <span className="text-zinc-500 ml-1">（值：{String(e.value)}）</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {precheckResult.validRows > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-emerald-800">准备就绪</div>
                      <div className="text-emerald-700 text-xs mt-1">
                        将导入 {precheckResult.validRows} 条有效记录，
                        跳过 {precheckResult.invalidRows} 条存在问题的记录。
                      </div>
                      <label className="mt-3 flex items-center gap-2 cursor-pointer text-zinc-700 text-xs">
                        <input
                          type="checkbox"
                          checked={useDefaultPwd}
                          onChange={(e) => setUseDefaultPwd(e.target.checked)}
                          className="rounded border-zinc-300"
                        />
                        密码为空的用户使用默认密码（
                        <span className="font-mono">{USER_IMPORT_DEFAULT_PASSWORD}</span>）
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && importResult && (
            <div className="space-y-6 text-center py-4">
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
                  <p className="text-3xl font-bold text-amber-500">
                    {importResult.skipped + (importResult.defaultPasswordUsed ? 0 : 0)}
                  </p>
                  <p className="text-sm text-zinc-500">跳过条数</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-navy-700">
                    {importResult.defaultPasswordUsed ? '是' : '否'}
                  </p>
                  <p className="text-sm text-zinc-500">使用默认密码</p>
                </div>
              </div>
              {importResult.skippedReasons.length > 0 && (
                <div className="text-left bg-red-50 border border-red-200 rounded p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-medium text-red-700 mb-2 flex items-center gap-1 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    跳过明细（{importResult.skippedReasons.length} 条）
                  </h4>
                  <ul className="space-y-1.5 text-xs text-red-600">
                    {importResult.skippedReasons.map((sr, i) => (
                      <li key={i} className="border-b border-red-100 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-red-500">第{sr.lineNumber}行</span>
                          <span className="font-medium text-red-800">{sr.name || sr.username}</span>
                        </div>
                        <div className="ml-6 mt-0.5">
                          {sr.reasons.map((r, j) => (
                            <div key={j}>• {r}</div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-zinc-200 bg-zinc-50">
          <div>
            {step > 1 && step < 4 && (
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
            <button onClick={handleClose} className="btn-secondary">
              {step === 4 ? '完成' : '取消'}
            </button>
            {step < 4 && (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-1"
                disabled={
                  isLoading ||
                  (step === 1 && !file) ||
                  (step === 2 && !requiredMappingComplete) ||
                  (step === 3 && (!precheckResult || precheckResult.validRows === 0))
                }
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : step === 3 ? (
                  <>
                    确认导入
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : step === 2 ? (
                  <>
                    开始预检查
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    下一步
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'zinc' | 'emerald' | 'red' | 'amber'
}) {
  const toneMap = {
    zinc: 'text-zinc-900 border-zinc-200 bg-zinc-50',
    emerald: 'text-emerald-700 border-emerald-200 bg-emerald-50',
    red: 'text-red-700 border-red-200 bg-red-50',
    amber: 'text-amber-700 border-amber-200 bg-amber-50',
  }
  return (
    <div className={cn('border rounded p-3', toneMap[tone])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

function humanizeErrorType(type: string): string {
  const map: Record<string, string> = {
    MISSING_REQUIRED_COLUMN: '缺少必填列',
    UNKNOWN_HEADER: '未知表头',
    EMPTY_REQUIRED_FIELD: '必填字段为空',
    INVALID_ROLE: '角色无效',
    INVALID_EMAIL: '邮箱格式错误',
    WEAK_PASSWORD: '密码强度不足',
    USERNAME_EXISTS: '系统内用户名重复',
    EMAIL_EXISTS: '系统内邮箱重复',
    NAME_EXISTS: '系统内姓名重复',
    ROW_INTERNAL_DUP_EMAIL: 'CSV内邮箱重复',
    ROW_INTERNAL_DUP_USERNAME: 'CSV内用户名重复',
    ROW_INTERNAL_DUP_NAME: 'CSV内姓名重复',
    DUPLICATE_EMAIL: '邮箱重复',
    DUPLICATE_NAME: '姓名重复',
    DUPLICATE_USERNAME: '用户名重复',
  }
  return map[type] || type
}

function iconForError(_type: string): 'alert' | 'warn' | 'info' {
  return 'alert'
}
