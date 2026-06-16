import { Router, type Request, type Response } from 'express'
import * as exportService from '../services/exportService.js'
import { BusinessError } from '../services/userService.js'
import { authMiddleware } from '../middleware/auth.js'
import type { ApiResponse, ExportFilter } from '../../shared/types.js'

const router = Router()

function handleError(res: Response, error: unknown): void {
  console.error('Export error:', error)
  if (error instanceof BusinessError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    } satisfies ApiResponse)
    return
  }
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : '服务器内部错误',
  } satisfies ApiResponse)
}

router.get(
  '/export',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, submitterId, reviewerId, startDate, endDate } = req.query

      const filter: ExportFilter = {}

      if (status && typeof status === 'string') {
        filter.status = status as ExportFilter['status']
      }
      if (submitterId && typeof submitterId === 'string') {
        filter.submitterId = parseInt(submitterId, 10)
      }
      if (reviewerId && typeof reviewerId === 'string') {
        filter.reviewerId = parseInt(reviewerId, 10)
      }
      if (startDate && typeof startDate === 'string') {
        filter.startDate = startDate
      }
      if (endDate && typeof endDate === 'string') {
        filter.endDate = endDate
      }

      const user = req.session.user!
      const markdown = exportService.generateExportMarkdown(
        filter,
        user.id,
        user.role
      )

      const filename = `设计稿评审纪要_${new Date().toISOString().slice(0, 10)}.md`
      const encodedFilename = encodeURIComponent(filename)

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
      res.send(markdown)
    } catch (error) {
      handleError(res, error)
    }
  }
)

export default router
