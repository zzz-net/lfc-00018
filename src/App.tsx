import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import Login from '@/pages/Login'
import Board from '@/pages/Board'
import UserManagement from '@/pages/UserManagement'
import BatchTaskCenter from '@/pages/BatchTaskCenter'
import NotFound from '@/pages/NotFound'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/useAuthStore'
import { useEffect } from 'react'

function RootRedirect() {
  const { user, checkAuth, isLoading } = useAuthStore()

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

  return user ? <Navigate to="/board" replace /> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/board',
    element: (
      <ProtectedRoute>
        <Board />
      </ProtectedRoute>
    ),
  },
  {
    path: '/users',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <UserManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/batch-tasks',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'reviewer', 'submitter']}>
        <BatchTaskCenter />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
