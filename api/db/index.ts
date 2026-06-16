import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.resolve(__dirname, '../../data/review-board.db')

let db: Database.Database | null = null

function ensureDataDir(): void {
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir()
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export { DB_PATH }

export {
  initializeDatabase,
  detectStartupMode,
  getDatabaseInfo,
  resetForTesting,
  type StartupMode,
  type DatabaseInfo,
} from './init.js'

export default getDb
