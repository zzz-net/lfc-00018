import { Router, type Request, type Response } from 'express'
import * as userService from '../services/userService.js'
import { BusinessError } from '../services/userService.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import type { ApiResponse, User, UserRole } from '../../shared/types.js'

const router = Router()

function handleError(res: Response, error: unknown): void {
  if (error instanceof BusinessError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    } satisfies ApiResponse)
    return
  }
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  } satisfies ApiResponse)
}

router.get(
  '/',
  authMiddleware,
  requirePermission(['admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const users = userService.getUsers()
      res.json({
        success: true,
        data: users,
      } satisfies ApiResponse<User[]>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/',
  authMiddleware,
  requirePermission(['admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password, name, role } = req.body as {
        username: string
        password: string
        name: string
        role: UserRole
      }

      const result = userService.createUser(username, password, name, role)

      if (result.success && result.user) {
        res.status(201).json({
          success: true,
          data: result.user,
        } satisfies ApiResponse<User>)
        return
      }

      res.status(400).json({
        success: false,
        error: result.error || '创建用户失败',
      } satisfies ApiResponse)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.put(
  '/:id',
  authMiddleware,
  requirePermission(['admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: '无效的用户ID',
        } satisfies ApiResponse)
        return
      }

      const { name, role, password } = req.body as {
        name?: string
        role?: UserRole
        password?: string
      }

      const result = userService.updateUser(id, { name, role, password })

      if (result.success) {
        res.json({
          success: true,
          data: null,
        } satisfies ApiResponse)
        return
      }

      res.status(400).json({
        success: false,
        error: result.error || '更新失败',
      } satisfies ApiResponse)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.delete(
  '/:id',
  authMiddleware,
  requirePermission(['admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: '无效的用户ID',
        } satisfies ApiResponse)
        return
      }

      const result = userService.deleteUser(id)

      if (result.success) {
        res.json({
          success: true,
          data: null,
        } satisfies ApiResponse)
        return
      }

      res.status(400).json({
        success: false,
        error: result.error || '删除失败',
      } satisfies ApiResponse)
    } catch (error) {
      handleError(res, error)
    }
  }
)

export default router
