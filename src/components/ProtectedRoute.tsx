import { ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Lock, AlertCircle } from 'lucide-react'
import type { UserRole } from '../../shared/types'
import { ROLE_LABELS } from '../../shared/types'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center p-8">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <Lock className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 mb-2">403</h1>
        <h2 className="text-xl font-semibold text-zinc-700 mb-4">访问被拒绝</h2>
        <p className="text-zinc-500 mb-6 max-w-md">
          抱歉，您没有权限访问此页面。请联系管理员获取相应权限。
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 max-w-md mx-auto">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>如需访问此页面，请提升您的用户角色权限</span>
        </div>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, checkAuth } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (!user) {
      checkAuth()
    }
  }, [user, checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-navy-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}
