import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import SCHEMA_SQL from './schema.sql.js'
import {
  DATABASE_VERSION,
  SEED_USERS,
  SEED_DESIGNS,
  type StartupMode,
  type SeedUser,
  type SeedDesign,
} from '../config/seed.config.js'
import { getDb, DB_PATH } from './index.js'

export type { StartupMode }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface DatabaseInfo {
  version: number
  initialized: boolean
  userCount: number
  hasDemoUsers: boolean
}

export interface MigrationScript {
  fromVersion: number
  toVersion: number
  sql: string | ((db: Database.Database) => void)
  description: string
}

export const MIGRATION_SCRIPTS: MigrationScript[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    description: 'Add email column to users table',
    sql: (db) => {
      const cols = db.pragma('table_info(users)') as { name: string }[]
      const hasEmail = cols.some((c) => c.name === 'email')
      if (!hasEmail) {
        db.exec(`ALTER TABLE users ADD COLUMN email TEXT`)
      }
    },
  },
]

export function detectStartupMode(): StartupMode {
  const envMode = process.env.STARTUP_MODE as StartupMode | undefined

  if (envMode && ['first_launch', 'restart', 'upgrade', 'test'].includes(envMode)) {
    return envMode
  }

  if (!fs.existsSync(DB_PATH)) {
    return 'first_launch'
  }

  const tempDb = new Database(DB_PATH, { readonly: true })
  try {
    const tables = tempDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='db_version'"
      )
      .get() as { name: string } | undefined

    if (!tables) {
      return 'upgrade'
    }

    const versionRow = tempDb
      .prepare('SELECT version FROM db_version ORDER BY id DESC LIMIT 1')
      .get() as { version: number } | undefined

    if (!versionRow || versionRow.version < DATABASE_VERSION) {
      return 'upgrade'
    }

    return 'restart'
  } finally {
    tempDb.close()
  }
}

export function getDatabaseInfo(): DatabaseInfo {
  const db = getDb()

  const versionRow = db
    .prepare('SELECT version FROM db_version ORDER BY id DESC LIMIT 1')
    .get() as { version: number } | undefined

  const userCountRow = db
    .prepare('SELECT COUNT(*) as count FROM users')
    .get() as { count: number }

  const demoUserRow = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE username IN ('admin', 'reviewer1', 'reviewer2', 'submitter1', 'submitter2')")
    .get() as { count: number }

  return {
    version: versionRow?.version || 0,
    initialized: !!versionRow,
    userCount: userCountRow.count,
    hasDemoUsers: demoUserRow.count >= 5,
  }
}

export function createVersionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_version (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    );
  `)
}

export function insertVersionRecord(
  db: Database.Database,
  version: number,
  description: string
): void {
  db.prepare('INSERT INTO db_version (version, description) VALUES (?, ?)').run(
    version,
    description
  )
}

export function runMigrations(db: Database.Database): number {
  createVersionTable(db)

  const currentVersionRow = db
    .prepare('SELECT MAX(version) as max_version FROM db_version')
    .get() as { max_version: number | null }

  const currentVersion = currentVersionRow.max_version || 0

  if (currentVersion >= DATABASE_VERSION) {
    return currentVersion
  }

  const migrationsToRun = MIGRATION_SCRIPTS.filter(
    (m) => m.fromVersion >= currentVersion && m.toVersion <= DATABASE_VERSION
  ).sort((a, b) => a.fromVersion - b.fromVersion)

  for (const migration of migrationsToRun) {
    console.log(`Running migration: ${migration.description} (v${migration.fromVersion} -> v${migration.toVersion})`)

    if (typeof migration.sql === 'string') {
      db.exec(migration.sql)
    } else {
      migration.sql(db)
    }

    insertVersionRecord(db, migration.toVersion, migration.description)
  }

  if (currentVersion < DATABASE_VERSION && migrationsToRun.length === 0) {
    insertVersionRecord(
      db,
      DATABASE_VERSION,
      `Skip to version ${DATABASE_VERSION} (no migrations needed)`
    )
  }

  return DATABASE_VERSION
}

export function createSeedUsers(db: Database.Database, users: SeedUser[]): number[] {
  const createdIds: number[] = []

  const insertStmt = db.prepare(`
    INSERT INTO users (username, password_hash, name, role, email)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO NOTHING
  `)

  for (const user of users) {
    const passwordHash = bcrypt.hashSync(user.password, 10)
    const result = insertStmt.run(
      user.username,
      passwordHash,
      user.name,
      user.role,
      user.email ?? null
    )
    if (result.changes > 0) {
      createdIds.push(Number(result.lastInsertRowid))
    }
  }

  return createdIds
}

export function createSeedDesigns(db: Database.Database, designs: SeedDesign[]): number[] {
  const createdIds: number[] = []

  const userMap = new Map<string, { id: number; name: string }>()
  const users = db.prepare('SELECT id, username, name FROM users').all() as Array<{
    id: number
    username: string
    name: string
  }>
  users.forEach((u) => userMap.set(u.username.toLowerCase(), { id: u.id, name: u.name }))

  const insertStmt = db.prepare(`
    INSERT INTO designs (design_id, name, description, submitter_id, submitter_name, priority, queue_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(design_id) DO NOTHING
  `)

  let queueOrder = db.prepare('SELECT COALESCE(MAX(queue_order), 0) as max_order FROM designs').get() as { max_order: number }
  let nextOrder = queueOrder.max_order + 1

  for (const design of designs) {
    const submitter = userMap.get(design.submitterUsername.toLowerCase())
    if (!submitter) {
      console.warn(`Skipping seed design ${design.designId}: submitter ${design.submitterUsername} not found`)
      continue
    }

    const result = insertStmt.run(
      design.designId,
      design.name,
      design.description,
      submitter.id,
      submitter.name,
      design.priority,
      nextOrder
    )

    if (result.changes > 0) {
      createdIds.push(Number(result.lastInsertRowid))
      nextOrder++
    }
  }

  return createdIds
}

export function initializeDatabase(): {
  mode: StartupMode
  version: number
  usersCreated: number
  designsCreated: number
} {
  const mode = detectStartupMode()
  console.log(`Startup mode detected: ${mode}`)

  const db = getDb()

  db.exec(SCHEMA_SQL)

  const version = runMigrations(db)

  let usersCreated = 0
  let designsCreated = 0

  const loadSampleData = process.env.LOAD_SAMPLE_DATA !== 'false'

  switch (mode) {
    case 'first_launch':
    case 'test':
      if (loadSampleData) {
        console.log('Creating seed users...')
        usersCreated = createSeedUsers(db, SEED_USERS).length
        console.log(`Created ${usersCreated} seed users`)

        console.log('Creating seed designs...')
        designsCreated = createSeedDesigns(db, SEED_DESIGNS).length
        console.log(`Created ${designsCreated} seed designs`)
      }
      break

    case 'restart':
      console.log('Restart mode: skipping seed data creation')
      break

    case 'upgrade':
      console.log('Upgrade mode: migrations applied, skipping seed data')
      break
  }

  const info = getDatabaseInfo()
  console.log(`Database initialized: version=${info.version}, users=${info.userCount}`)

  return {
    mode,
    version,
    usersCreated,
    designsCreated,
  }
}

export function resetForTesting(): void {
  const db = getDb()

  db.exec('DELETE FROM batch_task_items')
  db.exec('DELETE FROM batch_tasks')
  db.exec('DELETE FROM comments')
  db.exec('DELETE FROM operation_logs')
  db.exec('DELETE FROM designs')
  db.exec('DELETE FROM users WHERE username NOT IN (SELECT username FROM users WHERE 1=0)')

  createSeedUsers(db, SEED_USERS)
  createSeedDesigns(db, SEED_DESIGNS)
}

export default {
  detectStartupMode,
  getDatabaseInfo,
  runMigrations,
  createSeedUsers,
  createSeedDesigns,
  initializeDatabase,
  resetForTesting,
}
