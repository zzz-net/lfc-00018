import { Router, type Request, type Response } from 'express'
import * as designService from '../services/designService.js'
import { BusinessError } from '../services/userService.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import type {
  ApiResponse,
  Design,
  ImportDesignItem,
  ImportResult,
  ReviewRequest,
} from '../../shared/types.js'

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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const designs = designService.getDesigns()
      res.json({
        success: true,
        data: designs,
      } satisfies ApiResponse<Design[]>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: '无效的设计稿ID',
        } satisfies ApiResponse)
        return
      }

      const design = designService.getDesignById(id)
      if (!design) {
        res.status(404).json({
          success: false,
          error: '设计稿不存在',
        } satisfies ApiResponse)
        return
      }

      res.json({
        success: true,
        data: design,
      } satisfies ApiResponse<Design>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/import',
  authMiddleware,
  requirePermission(['admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const items = req.body as ImportDesignItem[]
      const result = designService.importDesigns(items)

      res.json({
        success: true,
        data: result,
      } satisfies ApiResponse<ImportResult>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/claim',
  authMiddleware,
  requirePermission(['reviewer', 'admin']),
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

      const { version } = req.body as { version: number }
      if (version === undefined || version === null) {
        res.status(400).json({
          success: false,
          error: '缺少版本号',
        } satisfies ApiResponse)
        return
      }

      const user = req.session.user!
      const result = designService.claimDesign(
        designId,
        user.id,
        user.name,
        version,
        user.role
      )

      if (result.success && result.design) {
        res.json({
          success: true,
          data: result.design,
        } satisfies ApiResponse<Design>)
        return
      }

      if (result.conflictData) {
        res.status(409).json({
          success: false,
          error: result.error,
          data: result.conflictData,
        } satisfies ApiResponse<typeof result.conflictData>)
        return
      }

      res.status(400).json({
        success: false,
        error: result.error || '认领失败',
      } satisfies ApiResponse)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/review',
  authMiddleware,
  requirePermission(['reviewer', 'admin']),
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

      const { version, action, reason, comment } = req.body as ReviewRequest & {
        version: number
      }

      if (version === undefined || version === null) {
        res.status(400).json({
          success: false,
          error: '缺少版本号',
        } satisfies ApiResponse)
        return
      }

      if (!action || (action !== 'pass' && action !== 'return')) {
        res.status(400).json({
          success: false,
          error: '无效的操作类型',
        } satisfies ApiResponse)
        return
      }

      const user = req.session.user!
      const result = designService.reviewDesign(
        designId,
        user.id,
        user.name,
        version,
        action,
        reason,
        comment
      )

      if (result.success && result.design) {
        res.json({
          success: true,
          data: result.design,
        } satisfies ApiResponse<Design>)
        return
      }

      res.status(400).json({
        success: false,
        error: result.error || '评审失败',
      } satisfies ApiResponse)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/resubmit',
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

      const { version } = req.body as { version: number }
      if (version === undefined || version === null) {
        res.status(400).json({
          success: false,
          error: '缺少版本号',
        } satisfies ApiResponse)
        return
      }

      const user = req.session.user!

      if (user.role !== 'submitter' && user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: '只有提交者或管理员才能重新提交',
        } satisfies ApiResponse)
        return
      }

      const result = designService.resubmitDesign(designId, user.id, version)

      if (result.success && result.design) {
        res.json({
          success: true,
          data: result.design,
        } satisfies ApiResponse<Design>)
        return
      }

      res.status(400).json({
        success: false,
        error: result.error || '重新提交失败',
      } satisfies ApiResponse)
    } catch (error) {
      handleError(res, error)
    }
  }
)

export default router
