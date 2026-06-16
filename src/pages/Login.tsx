import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle, Palette } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const { login, isLoading, error, clearError, user } = useAuthStore()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: Location })?.from?.pathname || '/board'

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [user, navigate, from])

  useEffect(() => {
    if (error) {
      showToast(error, 'error')
      clearError()
    }
  }, [error, showToast, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      showToast('请输入用户名和密码', 'warning')
      return
    }
    try {
      await login(username.trim(), password.trim())
      showToast('登录成功', 'success')
      navigate(from, { replace: true })
    } catch {
    }
  }

  const presetAccounts = [
    { username: 'admin', password: 'admin123', role: '管理员' },
    { username: 'reviewer1', password: 'reviewer123', role: '评审人' },
    { username: 'submitter1', password: 'submitter123', role: '提交者' },
  ]

  const fillAccount = (acc: { username: string; password: string }) => {
    setUsername(acc.username)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-navy-900/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-status-pending/5 rounded-full translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-status-reviewing/5 rounded-full" />
      </div>

      <div
        className={cn(
          'relative w-full max-w-md transition-all duration-700 ease-out',
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}
      >
        <div className="bg-white border-2 border-zinc-800 shadow-xl">
          <div className="absolute -top-1 -left-1 w-4 h-4 bg-navy-900" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-navy-900" />
          <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-navy-900" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-navy-900" />

          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-navy-900 mb-4">
                <Palette className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 mb-2 font-mono">
                设计稿评审排队板
              </h1>
              <p className="text-sm text-zinc-500">DESIGN REVIEW BOARD</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登 录'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-zinc-200">
              <p className="text-xs text-zinc-500 mb-3 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                预设测试账号（点击快速填充）
              </p>
              <div className="space-y-2">
                {presetAccounts.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => fillAccount(acc)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 hover:bg-navy-50 hover:border-navy-300 transition-colors"
                  >
                    <span className="font-mono text-zinc-700">{acc.username}</span>
                    <span className="text-zinc-400">{acc.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6 font-mono">
          v1.0.0 · INDUSTRIAL DESIGN
        </p>
      </div>
    </div>
  )
}
