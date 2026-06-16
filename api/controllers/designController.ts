import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import * as designService from '../services/designService.js'
import { BusinessError } from '../services/userService.js'
import { requirePermissionByName } from '../middleware/auth.js'
import type {
  ApiResponse,
  Design,
  ImportDesignItem,
  ImportResult,
  ReviewRequest,
} from '../../shared/types.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function parseCsvContent(content: string): ImportDesignItem[] {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) {
    throw new BusinessError('CSV文件内容为空或格式不正确', 'INVALID_CSV', 400)
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const requiredFields = ['designid', 'name', 'submitter']
  const missingFields = requiredFields.filter(f => !headers.includes(f))
  if (missingFields.length > 0) {
    throw new BusinessError(`CSV缺少必要列: ${missingFields.join(', ')}`, 'INVALID_CSV', 400)
  }

  const items: ImportDesignItem[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',').map(v => v.trim())
    if (values.length < 3) continue

    const designId = values[headers.indexOf('designid')] || ''
    const name = values[headers.indexOf('name')] || ''
    const submitter = values[headers.indexOf('submitter')] || ''
    const description = headers.indexOf('description') >= 0 ? values[headers.indexOf('description')] || '' : ''
    const priority = (headers.indexOf('priority') >= 0 ? values[headers.indexOf('priority')] as 'high' | 'medium' | 'low' : 'medium') || 'medium'

    if (!designId || !name || !submitter) {
      throw new BusinessError(`第${i + 1}行数据不完整，designId、名称和提交者不能为空`, 'INVALID_CSV', 400)
    }

    items.push({ designId, name, description, submitter, priority })
  }

  if (items.length === 0) {
    throw new BusinessError('CSV文件中没有有效的数据行', 'EMPTY_CSV', 400)
  }

  return items
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof BusinessError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    } satisfies ApiResponse)
    return
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: '文件大小超过限制（最大10MB）',
      } satisfies ApiResponse)
      return
    }
    res.status(400).json({
      success: false,
      error: `文件上传错误: ${error.message}`,
    } satisfies ApiResponse)
    return
  }
  if (error instanceof Error && (
    error.message.includes('Unexpected end of form') ||
    error.message.includes('multipart') ||
    error.message.includes('boundary')
  )) {
    res.status(400).json({
      success: false,
      error: '文件上传失败，请检查文件格式后重试',
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
  requirePermissionByName('design:view_all'),
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
  requirePermissionByName('design:view_all'),
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
  requirePermissionByName('design:import'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      let items: ImportDesignItem[]

      if (req.file) {
        if (!req.file.originalname.endsWith('.csv')) {
          res.status(400).json({
            success: false,
            error: '只支持CSV格式文件',
          } satisfies ApiResponse)
          return
        }
        const content = req.file.buffer.toString('utf-8')
        items = parseCsvContent(content)
      } else if (Array.isArray(req.body)) {
        items = req.body as ImportDesignItem[]
      } else {
        res.status(400).json({
          success: false,
          error: '请上传CSV文件或提供JSON数组数据',
        } satisfies ApiResponse)
        return
      }

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
  requirePermissionByName('design:claim'),
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
  requirePermissionByName('design:review'),
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
  requirePermissionByName('design:resubmit'),
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
