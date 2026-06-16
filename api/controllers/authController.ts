import { Router, type Request, type Response } from 'express'
import * as userService from '../services/userService.js'
import { BusinessError } from '../services/userService.js'
import type { ApiResponse, LoginRequest } from '../../shared/types.js'

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

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body as LoginRequest

    const result = userService.login(username, password)

    if (result.success && result.user) {
      req.session.user = {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        role: result.user.role,
      }

      res.json({
        success: true,
        data: result.user,
      } satisfies ApiResponse<typeof result.user>)
      return
    }

    res.status(401).json({
      success: false,
      error: result.error || '登录失败',
    } satisfies ApiResponse)
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({
          success: false,
          error: '登出失败',
        } satisfies ApiResponse)
        return
      }

      res.clearCookie('connect.sid')
      res.json({
        success: true,
        data: null,
      } satisfies ApiResponse)
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.session.user) {
      res.status(401).json({
        success: false,
        error: '未登录',
      } satisfies ApiResponse)
      return
    }

    res.json({
      success: true,
      data: req.session.user,
    } satisfies ApiResponse<typeof req.session.user>)
  } catch (error) {
    handleError(res, error)
  }
})

export default router
