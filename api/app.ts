/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import session from 'express-session'
import BetterSqlite3SessionStore from 'better-sqlite3-session-store'
import authController from './controllers/authController.js'
import userController from './controllers/userController.js'
import designController from './controllers/designController.js'
import commentController from './controllers/commentController.js'
import exportController from './controllers/exportController.js'
import batchTaskController from './controllers/batchTaskController.js'
import { getDb } from './db/index.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors({
  credentials: true,
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:5175', 'http://127.0.0.1:5175'],
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const SqliteStore = BetterSqlite3SessionStore(session)
const db = getDb()

app.use(
  session({
    store: new SqliteStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 900000,
      },
    }),
    secret: 'design-review-board-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }),
)

/**
 * API Routes
 */
app.use('/api/auth', authController)
app.use('/api/users', userController)
app.use('/api/designs', exportController)
app.use('/api/designs', commentController)
app.use('/api/designs', designController)
app.use('/api/batch-tasks', batchTaskController)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
