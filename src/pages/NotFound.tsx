import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const goBack = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div
        className={cn(
          'text-center max-w-md transition-all duration-700 ease-out',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
      >
        <div className="relative inline-block mb-8">
          <div className="w-32 h-32 bg-navy-900 flex items-center justify-center">
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-navy-900" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-navy-900" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-navy-900" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-navy-900" />
            <span className="font-mono text-6xl font-bold text-white">404</span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">页面未找到</h1>
          <p className="text-zinc-500">
            抱歉，您访问的页面不存在或已被移除。
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 border border-amber-200 mb-8">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            请检查您输入的网址是否正确，或返回首页。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={user ? '/board' : '/login'}
            className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Link>
          <button
            onClick={goBack}
            className="w-full sm:w-auto btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回上一页
          </button>
        </div>

        <p className="mt-8 text-xs text-zinc-400 font-mono">
          ERROR_CODE_404 · PAGE_NOT_FOUND
        </p>
      </div>
    </div>
  )
}
