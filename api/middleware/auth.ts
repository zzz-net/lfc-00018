import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse, UserRole } from '../../shared/types.js'
import { hasPermission } from '../config/seed.config.js'

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    res.status(401).json({
      success: false,
      error: '未授权，请先登录',
    } satisfies ApiResponse)
    return
  }
  next()
}

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    authMiddleware(req, res, () => {
      const user = req.session.user!

      if (!allowedRoles.includes(user.role)) {
        res.status(403).json({
          success: false,
          error: '权限不足，无法执行此操作',
        } satisfies ApiResponse)
        return
      }

      next()
    })
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    authMiddleware(req, res, () => {
      const user = req.session.user!

      if (!hasPermission(user.role, permission)) {
        res.status(403).json({
          success: false,
          error: '权限不足，无法执行此操作',
        } satisfies ApiResponse)
        return
      }

      next()
    })
  }
}

export function getCurrentUser(req: Request) {
  return req.session?.user || null
}

export const requirePermissionByName = requirePermission

export { hasPermission }

export default authMiddleware
