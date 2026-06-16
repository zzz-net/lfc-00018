import { getDb } from '../db/index.js'
import type { User, UserRole } from '../../shared/types.js'

interface UserWithPassword extends User {
  password_hash: string
}

export function findAll(): User[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id, username, name, email, role, created_at as createdAt
    FROM users
    ORDER BY id
  `)
  return stmt.all() as User[]
}

export function findById(id: number): User | undefined {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id, username, name, email, role, created_at as createdAt
    FROM users
    WHERE id = ?
  `)
  return stmt.get(id) as User | undefined
}

export function findByUsername(username: string): UserWithPassword | undefined {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id, username, name, email, role, password_hash, created_at as createdAt
    FROM users
    WHERE username = ?
  `)
  return stmt.get(username) as UserWithPassword | undefined
}

export function findByName(name: string): UserWithPassword | undefined {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id, username, name, email, role, password_hash, created_at as createdAt
    FROM users
    WHERE name = ?
  `)
  return stmt.get(name) as UserWithPassword | undefined
}

export function findByEmail(email: string): UserWithPassword | undefined {
  const db = getDb()
  if (!email) return undefined
  const stmt = db.prepare(`
    SELECT id, username, name, email, role, password_hash, created_at as createdAt
    FROM users
    WHERE email = ?
  `)
  return stmt.get(email) as UserWithPassword | undefined
}

export function findByUsernameOrName(identifier: string): UserWithPassword | undefined {
  return findByUsername(identifier) || findByName(identifier)
}

export function findAllUsernames(): string[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT username FROM users WHERE username IS NOT NULL`)
  return (stmt.all() as { username: string }[]).map((r) => r.username)
}

export function findAllEmails(): string[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT email FROM users WHERE email IS NOT NULL AND email != ''`)
  return (stmt.all() as { email: string }[]).map((r) => r.email)
}

export function findAllNames(): string[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT name FROM users WHERE name IS NOT NULL`)
  return (stmt.all() as { name: string }[]).map((r) => r.name)
}

export function create(
  username: string,
  passwordHash: string,
  name: string,
  role: UserRole,
  email?: string | null
): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, name, role, email)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(username, passwordHash, name, role, email ?? null)
  return Number(result.lastInsertRowid)
}

export function update(
  id: number,
  data: Partial<{ name: string; role: string; password_hash: string; email: string | null }>
): boolean {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.role !== undefined) {
    fields.push('role = ?')
    values.push(data.role)
  }
  if (data.password_hash !== undefined) {
    fields.push('password_hash = ?')
    values.push(data.password_hash)
  }
  if (data.email !== undefined) {
    fields.push('email = ?')
    values.push(data.email)
  }

  if (fields.length === 0) {
    return false
  }

  values.push(id)

  const stmt = db.prepare(`
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = ?
  `)
  const result = stmt.run(...values)
  return result.changes > 0
}

export function deleteUser(id: number): boolean {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM users WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}
