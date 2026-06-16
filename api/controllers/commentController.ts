import { Router, type Request, type Response } from 'express'
import * as commentService from '../services/commentService.js'
import { BusinessError } from '../services/userService.js'
import { authMiddleware } from '../middleware/auth.js'
import type { ApiResponse, Comment } from '../../shared/types.js'

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
  '/:id/comments',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const designId = parseInt(req.params.id, 10)
      if (isNaN(designId)) {
        res.status(400).json({
          success: false,
          error: '无效的设计稿ID',
        } satisfies ApiResponse)
        return
      }

      const comments = commentService.getComments(designId)
      res.json({
        success: true,
        data: comments,
      } satisfies ApiResponse<Comment[]>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/comments',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const designId = parseInt(req.params.id, 10)
      if (isNaN(designId)) {
        res.status(400).json({
          success: false,
          error: '无效的设计稿ID',
        } satisfies ApiResponse)
        return
      }

      const { content, isReturnReason } = req.body as {
        content: string
        isReturnReason?: boolean
      }

      if (!content || content.trim() === '') {
        res.status(400).json({
          success: false,
          error: '评论内容不能为空',
        } satisfies ApiResponse)
        return
      }

      const user = req.session.user!
      const comment = commentService.addComment(
        designId,
        user.id,
        user.name,
        user.role,
        content,
        isReturnReason
      )

      res.status(201).json({
        success: true,
        data: comment,
      } satisfies ApiResponse<Comment>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

export default router
