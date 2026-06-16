import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import * as batchTaskService from '../services/batchTaskService.js'
import type { PrecheckBatchResult } from '../services/batchTaskService.js'
import { BusinessError } from '../services/userService.js'
import { requirePermission, requirePermissionByName } from '../middleware/auth.js'
import type {
  ApiResponse,
  BatchTask,
  BatchTaskItem,
  BatchTaskResultSummary,
  FieldMapping,
  BatchTaskItemStatus,
  BatchTaskItemType,
} from '../../shared/types.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

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
  requirePermissionByName('batch_task:view_list'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 50
      const tasks = batchTaskService.getBatchTaskList(limit)
      res.json({
        success: true,
        data: tasks,
      } satisfies ApiResponse<BatchTask[]>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.get(
  '/:id',
  requirePermissionByName('batch_task:view_detail'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }
      const detail = batchTaskService.getBatchTaskDetail(id)
      res.json({
        success: true,
        data: detail,
      } satisfies ApiResponse<{ task: BatchTask; items: BatchTaskItem[] }>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.get(
  '/:id/summary',
  requirePermissionByName('batch_task:view_summary'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }
      const summary = batchTaskService.getBatchTaskSummary(id)
      res.json({
        success: true,
        data: summary,
      } satisfies ApiResponse<ReturnType<typeof batchTaskService.getBatchTaskSummary>>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/',
  requirePermissionByName('batch_task:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      let rawCsv = ''
      let fileName = ''
      let fileSize = 0
      let taskName = ''
      let fieldMapping: FieldMapping = {}

      if (req.file) {
        if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
          res.status(400).json({
            success: false,
            error: '只支持CSV格式文件',
          } satisfies ApiResponse)
          return
        }
        rawCsv = req.file.buffer.toString('utf-8')
        fileName = req.file.originalname
        fileSize = req.file.size
      } else if (typeof req.body?.rawCsv === 'string') {
        rawCsv = req.body.rawCsv as string
        fileName = (req.body.fileName as string) || 'import.csv'
        fileSize = Number(req.body.fileSize || 0)
      } else {
        res.status(400).json({
          success: false,
          error: '请上传CSV文件或提供rawCsv内容',
        } satisfies ApiResponse)
        return
      }

      taskName = (req.body.taskName as string) || ''
      if (req.body?.fieldMapping) {
        try {
          fieldMapping =
            typeof req.body.fieldMapping === 'string'
              ? (JSON.parse(req.body.fieldMapping) as FieldMapping)
              : (req.body.fieldMapping as FieldMapping)
        } catch {
          fieldMapping = {}
        }
      }

      const operator = req.session.user!
      const result = batchTaskService.createAndPrecheckBatchTask({
        taskName,
        rawCsv,
        fileName,
        fileSize,
        fieldMapping,
        userId: operator.id,
        userName: operator.name,
      })

      res.status(201).json({
        success: true,
        data: result,
      } satisfies ApiResponse<PrecheckBatchResult>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.patch(
  '/items/:itemId',
  requirePermissionByName('batch_task:execute'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemId = parseInt(req.params.itemId, 10)
      if (isNaN(itemId)) {
        res.status(400).json({
          success: false,
          error: '无效的条目ID',
        } satisfies ApiResponse)
        return
      }

      const { status, skipReason } = req.body as {
        status?: BatchTaskItemStatus
        skipReason?: string
      }

      if (!status) {
        res.status(400).json({
          success: false,
          error: '缺少状态参数',
        } satisfies ApiResponse)
        return
      }

      const success = batchTaskService.updateBatchTaskItemStatus(itemId, status, skipReason)
      res.json({
        success: true,
        data: { updated: success },
      } satisfies ApiResponse<{ updated: boolean }>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/bulk-ignore/:itemType',
  requirePermissionByName('batch_task:execute'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const taskId = parseInt(req.params.id, 10)
      const itemType = req.params.itemType as BatchTaskItemType

      if (isNaN(taskId)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }

      const count = batchTaskService.bulkIgnoreByType(taskId, itemType)
      res.json({
        success: true,
        data: { count },
      } satisfies ApiResponse<{ count: number }>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/bulk-restore/:itemType',
  requirePermissionByName('batch_task:execute'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const taskId = parseInt(req.params.id, 10)
      const itemType = req.params.itemType as BatchTaskItemType

      if (isNaN(taskId)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }

      const count = batchTaskService.bulkRestoreByType(taskId, itemType)
      res.json({
        success: true,
        data: { count },
      } satisfies ApiResponse<{ count: number }>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/:id/execute',
  requirePermissionByName('batch_task:execute'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const taskId = parseInt(req.params.id, 10)
      if (isNaN(taskId)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }

      const operator = req.session.user!
      const result = batchTaskService.executeBatchTask(taskId, operator.id, operator.name)

      res.json({
        success: true,
        data: result,
      } satisfies ApiResponse<BatchTaskResultSummary>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.delete(
  '/:id',
  requirePermissionByName('batch_task:delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const taskId = parseInt(req.params.id, 10)
      if (isNaN(taskId)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }

      const success = batchTaskService.deleteBatchTask(taskId)
      res.json({
        success: true,
        data: { deleted: success },
      } satisfies ApiResponse<{ deleted: boolean }>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.get(
  '/:id/export-conflicts',
  requirePermissionByName('batch_task:export_conflicts'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const taskId = parseInt(req.params.id, 10)
      if (isNaN(taskId)) {
        res.status(400).json({
          success: false,
          error: '无效的任务ID',
        } satisfies ApiResponse)
        return
      }

      const csvContent = batchTaskService.exportConflictCsv(taskId)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="conflicts_task_${taskId}.csv"`)
      res.send(csvContent)
    } catch (error) {
      handleError(res, error)
    }
  }
)

export default router
