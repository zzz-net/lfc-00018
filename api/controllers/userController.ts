import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import * as userService from '../services/userService.js'
import { BusinessError } from '../services/userService.js'
import { requirePermissionByName } from '../middleware/auth.js'
import type {
  ApiResponse,
  User,
  UserRole,
  UserImportPrecheckResult,
  UserImportResult,
  FieldMapping,
  ImportDraft,
  AdminOperationLog,
  UserImportSubmitRequest,
  UserImportDraftPayload,
  PrecheckRowError,
} from '../../shared/types.js'
import { ADMIN_OPERATION_TYPES } from '../../shared/types.js'

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
  requirePermissionByName('user:view'),
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
  requirePermissionByName('user:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password, name, role, email } = req.body as {
        username: string
        password: string
        name: string
        role: UserRole
        email?: string | null
      }

      const result = userService.createUser(username, password, name, role, email)

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
  requirePermissionByName('user:manage'),
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

      const { name, role, password, email } = req.body as {
        name?: string
        role?: UserRole
        password?: string
        email?: string | null
      }

      const result = userService.updateUser(id, { name, role, password, email })

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
  requirePermissionByName('user:manage'),
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

router.post(
  '/import/precheck',
  requirePermissionByName('user:import'),
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
      let customMapping: FieldMapping | undefined

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

      if (req.body?.fieldMapping) {
        try {
          customMapping =
            typeof req.body.fieldMapping === 'string'
              ? (JSON.parse(req.body.fieldMapping) as FieldMapping)
              : (req.body.fieldMapping as FieldMapping)
        } catch {
          customMapping = undefined
        }
      }

      const result = userService.precheckUserImport(rawCsv, fileName, fileSize, customMapping)

      res.json({
        success: true,
        data: result,
      } satisfies ApiResponse<UserImportPrecheckResult>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/import/submit',
  requirePermissionByName('user:import'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      let rawCsv = ''
      let fieldMapping: FieldMapping = {}
      let applyDefaultPassword = true
      let fileName = ''

      if (req.file) {
        rawCsv = req.file.buffer.toString('utf-8')
        fileName = req.file.originalname
        try {
          if (req.body?.fieldMapping) {
            fieldMapping =
              typeof req.body.fieldMapping === 'string'
                ? (JSON.parse(req.body.fieldMapping) as FieldMapping)
                : (req.body.fieldMapping as FieldMapping)
          }
          if (req.body?.applyDefaultPassword !== undefined) {
            applyDefaultPassword = req.body.applyDefaultPassword !== 'false' && req.body.applyDefaultPassword !== false
          }
        } catch {
          /* ignore */
        }
      } else if (req.body) {
        const body = req.body as Partial<UserImportSubmitRequest & { rawCsv: string; fileName: string }>
        rawCsv = body.rawCsv || ''
        fieldMapping = body.fieldMapping || {}
        applyDefaultPassword = body.applyDefaultPassword !== false
        fileName = body.fileName || 'import.csv'
      }

      if (!rawCsv) {
        res.status(400).json({
          success: false,
          error: '缺少CSV内容',
        } satisfies ApiResponse)
        return
      }
      if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
        res.status(400).json({
          success: false,
          error: '请先完成字段映射',
        } satisfies ApiResponse)
        return
      }

      const operator = req.session.user!
      const result = userService.submitUserImport(rawCsv, fieldMapping, applyDefaultPassword)

      userService.writeAdminOperationLog(
        operator.id,
        operator.name,
        ADMIN_OPERATION_TYPES.USER_IMPORT,
        `导入成员：成功 ${result.imported} 条，跳过 ${result.skipped} 条`,
        {
          targetType: 'users',
          targetId: result.createdUserIds.join(','),
          details: {
            fileName,
            imported: result.imported,
            skipped: result.skipped,
            skippedReasons: result.skippedReasons,
            createdUserIds: result.createdUserIds,
            defaultPasswordUsed: result.defaultPasswordUsed,
          },
        }
      )

      if (result.imported > 0) {
        userService.clearImportDraft(operator.id, 'users')
      }

      res.json({
        success: true,
        data: result,
      } satisfies ApiResponse<UserImportResult>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/import/export-errors',
  requirePermissionByName('user:import'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rowErrors, detectedHeaders } = req.body as {
        rowErrors: PrecheckRowError[]
        detectedHeaders: string[]
      }

      if (!rowErrors || rowErrors.length === 0) {
        res.status(400).json({
          success: false,
          error: '没有校验不通过的行需要导出',
        } satisfies ApiResponse)
        return
      }

      const headers = ['行号', ...(detectedHeaders?.length ? detectedHeaders : []), '错误原因']
      const lines: string[] = [headers.map(escapeCsv).join(',')]

      for (const err of rowErrors) {
        const row: string[] = [String(err.lineNumber)]
        if (detectedHeaders?.length) {
          for (const h of detectedHeaders) {
            row.push(err.rowData[h] || '')
          }
        }
        row.push(err.errors.map((e) => e.message).join('；'))
        lines.push(row.map(escapeCsv).join(','))
      }

      const csvContent = '\uFEFF' + lines.join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="import_errors.csv"')
      res.send(csvContent)
    } catch (error) {
      handleError(res, error)
    }
  }
)

function escapeCsv(value: string): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

router.get(
  '/import/draft',
  requirePermissionByName('user:import'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.session.user!.id
      const draft = userService.getImportDraft(userId, 'users')
      res.json({
        success: true,
        data: draft || null,
      } satisfies ApiResponse<ImportDraft | null>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.post(
  '/import/draft',
  requirePermissionByName('user:import'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.session.user!.id
      const payload = req.body as Partial<UserImportDraftPayload>

      if (!payload.precheckResult || !payload.fieldMapping || payload.rawCsvContent == null) {
        res.status(400).json({
          success: false,
          error: '草稿缺少必要数据（预检查结果/字段映射/CSV内容）',
        } satisfies ApiResponse)
        return
      }

      const draft = userService.saveImportDraft(userId, 'users', {
        fileName: payload.fileName || 'draft_import.csv',
        fileSize: payload.fileSize || Buffer.byteLength(payload.rawCsvContent, 'utf-8'),
        fieldMapping: payload.fieldMapping,
        precheckResult: payload.precheckResult,
        rawCsvContent: payload.rawCsvContent,
      })

      res.json({
        success: true,
        data: draft,
      } satisfies ApiResponse<ImportDraft>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.delete(
  '/import/draft',
  requirePermissionByName('user:import'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.session.user!.id
      const ok = userService.clearImportDraft(userId, 'users')
      res.json({
        success: true,
        data: { cleared: ok },
      } satisfies ApiResponse<{ cleared: boolean }>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

router.get(
  '/admin-logs',
  requirePermissionByName('admin_log:view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 200
      const type = (req.query.type as string) || undefined
      let logs: AdminOperationLog[]
      if (type === 'user_import') {
        logs = userService.getUserImportLogs()
      } else {
        logs = userService.getAdminOperationLogs(limit)
      }
      res.json({
        success: true,
        data: logs,
      } satisfies ApiResponse<AdminOperationLog[]>)
    } catch (error) {
      handleError(res, error)
    }
  }
)

export default router
