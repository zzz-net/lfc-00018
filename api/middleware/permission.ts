import type { Request, Response, NextFunction } from 'express'
import type { UserRole, ApiResponse } from '../../shared/types.js'

export function requirePermission(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session?.user

    if (!user) {
      res.status(401).json({
        success: false,
        error: '未授权，请先登录',
      } satisfies ApiResponse)
      return
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: '权限不足，无法执行此操作',
      } satisfies ApiResponse)
      return
    }

    next()
  }
}

export default requirePermission
