import { useState, useEffect, useCallback, useRef } from 'react'
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
  Info,
  Sparkles,
} from 'lucide-react'
import type { FieldMapping, UserImportFieldDef } from '../../shared/types'
import {
  USER_IMPORT_FIELDS,
  USER_IMPORT_DEFAULT_PASSWORD,
} from '../../shared/types'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface CreateBatchTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: {
    taskName: string
    file: File
    fieldMapping: FieldMapping
  }) => Promise<{ taskId: number; items: unknown[] }>
}

type Step = 1 | 2 | 3

const sampleCsv = `用户名,姓名,邮箱,角色,密码,操作
zhangsan,张三,zhangsan@example.com,submitter,,新增
lisi,李四,lisi@example.com,reviewer,,角色变更
wangwu,王五,wangwu@example.com,admin,,停用
zhaoliu,赵六,,submitter,,`

export default function CreateBatchTaskModal({ isOpen, onClose, onCreate }: CreateBatchTaskModalProps) {
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>(1)
  const [isVisible, setIsVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [taskName, setTaskName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rawCsv, setRawCsv] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setTaskName('')
      setFile(null)
      setRawCsv('')
      setHeaders([])
      setFieldMapping({})
      setIsSubmitting(false)
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

  const detectDefaultMapping = useCallback((headerList: string[]): FieldMapping => {
    const mapping: FieldMapping = {}
    const lowerToActual: Record<string, string> = {}
    headerList.forEach((h) => {
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

  const handleFileContent = useCallback((selectedFile: File, content: string) => {
    if (!content || !content.trim()) {
      showToast('CSV文件内容为空', 'error')
      return
    }
    setFile(selectedFile)
    setRawCsv(content)

    const firstLine = content.split(/\r?\n/)[0] || ''
    const headerList = firstLine.split(',').map((h) => h.trim()).filter(Boolean)
    setHeaders(headerList)

    const defaultMapping = detectDefaultMapping(headerList)
    setFieldMapping(defaultMapping)

    setStep(2)
    showToast('文件解析成功，请配置字段映射', 'success')
  }, [detectDefaultMapping, showToast])

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

  const handleMappingChange = (fieldKey: string, targetHeader: string) => {
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
  }

  const requiredMappingComplete = () => {
    const req = USER_IMPORT_FIELDS.filter((f) => f.required)
    return req.every((f) => !!fieldMapping[f.key])
  }

  const downloadSample = () => {
    const blob = new Blob(['\uFEFF' + sampleCsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch_members_sample.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('样例模板已下载', 'success')
  }

  const handleSubmit = async () => {
    if (!taskName.trim()) {
      showToast('请输入任务名称', 'error')
      return
    }
    if (!file) {
      showToast('请选择CSV文件', 'error')
      return
    }
    if (!requiredMappingComplete()) {
      showToast('请先完成所有必填字段的映射', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await onCreate({
        taskName: taskName.trim(),
        file,
        fieldMapping,
      })
      showToast(`任务创建成功，共 ${result.items.length} 条记录`, 'success')
      handleClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建失败', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (step === 1) return
    if (step === 2) {
      if (!requiredMappingComplete()) {
        showToast('请先完成所有必填字段的映射', 'error')
        return
      }
      setStep(3)
      return
    }
    if (step === 3) {
      handleSubmit()
    }
  }

  const handlePrev = () => {
    if (step > 1) setStep((prev) => (prev - 1) as Step)
  }

  if (!isOpen && !isVisible) return null

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
          'bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-300',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-navy-900" />
            <h2 className="text-lg font-semibold text-zinc-900">创建批量成员变更任务</h2>
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
            { s: 1 as Step, label: '上传文件' },
            { s: 2 as Step, label: '字段映射' },
            { s: 3 as Step, label: '确认创建' },
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
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  任务名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="input"
                  placeholder="请输入任务名称，如：2024年Q1成员调整"
                />
              </div>

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
                  id="batch-csv-upload"
                  ref={fileInputRef}
                />
                <label htmlFor="batch-csv-upload" className="cursor-pointer">
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
                      setHeaders([])
                    }}
                    className="p-1 text-zinc-400 hover:text-red-500"
                    title="移除文件"
                  >
                    <X className="h-4 w-4" />
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

              <div className="p-4 bg-amber-50 border border-amber-200 rounded">
                <div className="flex items-center gap-2 mb-2 text-amber-800 font-medium text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  支持的操作类型
                </div>
                <ul className="text-xs text-amber-700 space-y-1 ml-6 list-disc">
                  <li><strong>新增成员</strong>：系统中不存在的用户，将被创建</li>
                  <li><strong>角色变更</strong>：用户名或姓名匹配到现有用户，且角色不同</li>
                  <li><strong>停用成员</strong>：CSV中操作列为"停用/删除/disable"的记录</li>
                  <li><strong>重复账号</strong>：用户名已存在且无角色变化</li>
                  <li><strong>同名冲突</strong>：姓名已存在于系统中</li>
                </ul>
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

          {step === 2 && (
            <div className="space-y-5">
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
                      {USER_IMPORT_FIELDS.map((field: UserImportFieldDef) => {
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
                                {headers.map((h) => (
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
              </div>

              <div className="p-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-700">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <Info className="h-3.5 w-3.5" />
                  关于"操作"列
                </div>
                <p>
                  如果CSV中包含"操作"或"变更类型"列，系统将自动识别。值为"停用"、"删除"、"disable"表示停用成员；
                  值为"更新"、"修改"、"角色变更"表示角色变更；其他或无此列时默认按新增处理。
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-emerald-800 mb-1">配置确认</div>
                    <div className="text-sm text-emerald-700 space-y-1">
                      <p><span className="font-medium">任务名称：</span>{taskName}</p>
                      <p><span className="font-medium">文件名称：</span>{file?.name}</p>
                      <p><span className="font-medium">文件大小：</span>{file ? (file.size / 1024).toFixed(2) + ' KB' : '-'}</p>
                      <p><span className="font-medium">已映射字段：</span>{Object.keys(fieldMapping).length} 个</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-amber-800 text-sm mb-1">重要提示</div>
                    <ul className="text-xs text-amber-700 space-y-1 ml-4 list-disc">
                      <li>点击"创建任务"后，系统将生成任务单并进行预检分类，不会直接写入数据库</li>
                      <li>你可以在任务详情中查看分类结果，逐条忽略或批量处理有问题的记录</li>
                      <li>确认无误后再点击"正式执行"，数据才会真正写入系统</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-zinc-200 bg-zinc-50">
          <div>
            {step > 1 && (
              <button
                onClick={handlePrev}
                className="btn-secondary flex items-center gap-1"
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4" />
                上一步
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="btn-secondary">
              取消
            </button>
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-1"
                disabled={
                  isSubmitting ||
                  (step === 1 && (!file || !taskName.trim())) ||
                  (step === 2 && !requiredMappingComplete())
                }
              >
                下一步
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    创建任务
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
