import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, type Toast, type ToastType } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

const toastColors: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
    icon: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-500',
    icon: 'text-sky-500',
  },
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: number) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)
  const colors = toastColors[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => {
        onRemove(toast.id)
      }, 300)
    }, 2700)

    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onRemove(toast.id)
    }, 300)
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 p-4 border-l-4 rounded shadow-lg',
        colors.bg,
        colors.border,
        'transition-all duration-300',
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
      style={{ animation: !isExiting ? 'slideInFromRight 0.3s ease-out' : undefined }}
    >
      <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
        {toastIcons[toast.type]}
      </div>
      <p className="flex-1 text-sm text-zinc-800">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
      <style>{`
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
