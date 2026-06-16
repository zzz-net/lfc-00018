import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '../../shared/types.js'

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

export default authMiddleware
