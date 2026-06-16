import { useState, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ModalType = 'default' | 'danger' | 'success' | 'warning' | 'info'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  type?: ModalType
}

const typeConfig: Record<ModalType, { icon: React.ReactNode; confirmClass: string; iconClass: string }> = {
  default: {
    icon: <Info className="h-6 w-6" />,
    confirmClass: 'btn-primary',
    iconClass: 'text-navy-600 bg-navy-100',
  },
  danger: {
    icon: <XCircle className="h-6 w-6" />,
    confirmClass: 'btn-danger',
    iconClass: 'text-red-600 bg-red-100',
  },
  success: {
    icon: <CheckCircle className="h-6 w-6" />,
    confirmClass: 'btn-success',
    iconClass: 'text-emerald-600 bg-emerald-100',
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    confirmClass: 'btn-warning',
    iconClass: 'text-amber-600 bg-amber-100',
  },
  info: {
    icon: <Info className="h-6 w-6" />,
    confirmClass: 'btn-info',
    iconClass: 'text-sky-600 bg-sky-100',
  },
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  type = 'default',
}: ConfirmModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onCancel, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handleConfirm = () => {
    setIsVisible(false)
    setTimeout(onConfirm, 300)
  }

  const config = typeConfig[type]

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
          'bg-white rounded-lg shadow-2xl w-full max-w-md transition-all duration-300',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('flex-shrink-0 p-3 rounded-full', config.iconClass)}>
              {config.icon}
            </div>
            <p className="text-sm text-zinc-600 pt-1 whitespace-pre-wrap">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={handleClose}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={config.confirmClass}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
