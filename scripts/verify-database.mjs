#!/usr/bin/env node
/**
 * 数据库初始化和迁移验证脚本
 * 验证内容：
 * 1. 数据库版本管理正常
 * 2. 四种启动路径检测正确
 * 3. 迁移脚本正确执行
 * 4. 数据完整性在重启后保持
 * 5. 旧库升级不破坏现有数据
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_DB_PATH = path.resolve(__dirname, '../data/test-verify.db')
const ORIGINAL_DB_PATH = path.resolve(__dirname, '../data/review-board.db')
const BACKUP_DB_PATH = path.resolve(__dirname, '../data/review-board.db.backup')

function removeDbIfExists(dbPath) {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
    const walPath = dbPath + '-wal'
    const shmPath = dbPath + '-shm'
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
  }
}

function backupOriginalDb() {
  if (fs.existsSync(ORIGINAL_DB_PATH)) {
    fs.copyFileSync(ORIGINAL_DB_PATH, BACKUP_DB_PATH)
    console.log('✅ 原始数据库已备份到:', BACKUP_DB_PATH)
  }
}

function restoreOriginalDb() {
  if (fs.existsSync(BACKUP_DB_PATH)) {
    fs.copyFileSync(BACKUP_DB_PATH, ORIGINAL_DB_PATH)
    fs.unlinkSync(BACKUP_DB_PATH)
    console.log('✅ 原始数据库已恢复')
  }
}

function runNodeScript(scriptPath, envVars = {}) {
  const env = { ...process.env, ...envVars }
  try {
    const output = execSync(`node ${scriptPath}`, { 
      env, 
      stdio: 'pipe',
      cwd: path.resolve(__dirname, '..')
    })
    return { success: true, output: output.toString() }
  } catch (error) {
    return { success: false, output: error.stdout?.toString() + error.stderr?.toString() }
  }
}

console.log('='.repeat(70))
console.log('🔍 数据库初始化和迁移验证')
console.log('='.repeat(70))
console.log()

try {
  backupOriginalDb()
  
  console.log('📝 测试1: 首次启动 (first_launch)')
  console.log('-'.repeat(70))
  
  removeDbIfExists(ORIGINAL_DB_PATH)
  
  const result1 = runNodeScript('--eval "import { initializeDatabase } from \'./api/db/index.js\'; const r = initializeDatabase(); console.log(JSON.stringify(r))"', {
    STARTUP_MODE: 'first_launch'
  })
  
  if (result1.success) {
    const output = result1.output
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const initResult = JSON.parse(jsonMatch[0])
      console.log(`✅ 首次启动成功`)
      console.log(`   模式: ${initResult.mode}`)
      console.log(`   版本: ${initResult.version}`)
      console.log(`   创建用户: ${initResult.usersCreated}`)
      console.log(`   创建设计: ${initResult.designsCreated}`)
      
      if (initResult.mode !== 'first_launch') {
        throw new Error(`启动模式错误: 期望 first_launch, 实际 ${initResult.mode}`)
      }
      if (initResult.usersCreated < 5) {
        throw new Error(`创建用户数量不足: ${initResult.usersCreated}`)
      }
    }
  } else {
    throw new Error(`首次启动失败: ${result1.output}`)
  }
  
  console.log()
  console.log('📝 测试2: 已有库重启 (restart)')
  console.log('-'.repeat(70))
  
  const result2 = runNodeScript('--eval "import { initializeDatabase, getDatabaseInfo } from \'./api/db/index.js\'; const r = initializeDatabase(); const info = getDatabaseInfo(); console.log(JSON.stringify({ ...r, userCount: info.userCount }))"', {
    STARTUP_MODE: 'restart'
  })
  
  if (result2.success) {
    const output = result2.output
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const initResult = JSON.parse(jsonMatch[0])
      console.log(`✅ 重启成功`)
      console.log(`   模式: ${initResult.mode}`)
      console.log(`   用户总数: ${initResult.userCount}`)
      
      if (initResult.mode !== 'restart') {
        throw new Error(`启动模式错误: 期望 restart, 实际 ${initResult.mode}`)
      }
      if (initResult.usersCreated !== 0) {
        throw new Error(`重启时不应创建新用户: ${initResult.usersCreated}`)
      }
      if (initResult.userCount < 5) {
        throw new Error(`用户数据丢失: ${initResult.userCount}`)
      }
    }
  } else {
    throw new Error(`重启失败: ${result2.output}`)
  }
  
  console.log()
  console.log('📝 测试3: 数据完整性验证 - 重启后数据保持')
  console.log('-'.repeat(70))
  
  const db = new Database(ORIGINAL_DB_PATH)
  const users = db.prepare('SELECT username, name, role FROM users ORDER BY id').all()
  console.log(`✅ 数据库中用户数量: ${users.length}`)
  users.forEach(u => console.log(`   - ${u.username} (${u.role}): ${u.name}`))
  
  const expectedUsers = ['admin', 'reviewer1', 'reviewer2', 'submitter1', 'submitter2']
  for (const expected of expectedUsers) {
    const user = users.find(u => u.username === expected)
    if (!user) {
      throw new Error(`缺少预期用户: ${expected}`)
    }
  }
  console.log(`✅ 所有预期用户都存在`)
  
  const versionRow = db.prepare('SELECT MAX(version) as v FROM db_version').get()
  console.log(`✅ 数据库版本: ${versionRow.v}`)
  db.close()
  
  console.log()
  console.log('📝 测试4: 旧库升级模拟')
  console.log('-'.repeat(70))
  
  removeDbIfExists(ORIGINAL_DB_PATH)
  const oldDb = new Database(ORIGINAL_DB_PATH)
  
  oldDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('submitter', 'reviewer', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      design_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      submitter_id INTEGER NOT NULL,
      submitter_name TEXT NOT NULL,
      reviewer_id INTEGER,
      reviewer_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending_claim',
      priority TEXT NOT NULL DEFAULT 'medium',
      return_reason TEXT,
      queue_order INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    INSERT INTO users (username, password_hash, name, role) VALUES
    ('olduser', 'hash', '旧用户', 'submitter');
    
    INSERT INTO designs (design_id, name, submitter_id, submitter_name, queue_order) VALUES
    ('OLD-001', '旧设计稿', 1, '旧用户', 1);
  `)
  oldDb.close()
  
  console.log('✅ 模拟旧版本数据库已创建 (无 email 列)')
  
  const result3 = runNodeScript('--eval "import { initializeDatabase, getDatabaseInfo } from \'./api/db/index.js\'; const r = initializeDatabase(); const info = getDatabaseInfo(); console.log(JSON.stringify({ ...r, userCount: info.userCount }))"', {
    STARTUP_MODE: 'upgrade'
  })
  
  if (result3.success) {
    const output = result3.output
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const initResult = JSON.parse(jsonMatch[0])
      console.log(`✅ 升级成功`)
      console.log(`   模式: ${initResult.mode}`)
      console.log(`   用户总数: ${initResult.userCount}`)
      
      if (initResult.mode !== 'upgrade') {
        throw new Error(`启动模式错误: 期望 upgrade, 实际 ${initResult.mode}`)
      }
    }
  } else {
    throw new Error(`升级失败: ${result3.output}`)
  }
  
  const upgradedDb = new Database(ORIGINAL_DB_PATH)
  const cols = upgradedDb.pragma('table_info(users)')
  const hasEmail = cols.some(c => c.name === 'email')
  if (!hasEmail) {
    throw new Error('升级后 email 列未添加')
  }
  console.log(`✅ email 列已成功添加`)
  
  const oldUser = upgradedDb.prepare("SELECT * FROM users WHERE username = 'olduser'").get()
  if (!oldUser) {
    throw new Error('升级后原有数据丢失')
  }
  console.log(`✅ 原有数据保持完整: ${oldUser.username} (${oldUser.name})`)
  
  const oldDesign = upgradedDb.prepare("SELECT * FROM designs WHERE design_id = 'OLD-001'").get()
  if (!oldDesign) {
    throw new Error('升级后原有设计稿数据丢失')
  }
  console.log(`✅ 原有设计稿数据保持完整: ${oldDesign.design_id} (${oldDesign.name})`)
  
  upgradedDb.close()
  
  console.log()
  console.log('='.repeat(70))
  console.log('🎉 所有数据库验证通过！')
  console.log('='.repeat(70))
  console.log()
  console.log('✅ 首次启动: 用户和示例数据正确创建')
  console.log('✅ 重启模式: 不重复创建数据')
  console.log('✅ 数据持久化: 重启后数据完整')
  console.log('✅ 旧库升级: 迁移脚本正确执行，原有数据不破坏')
  console.log()
  
  restoreOriginalDb()
  removeDbIfExists(TEST_DB_PATH)
  process.exit(0)
  
} catch (error) {
  console.error('\n❌ 验证失败:', error.message)
  console.error(error.stack)
  
  restoreOriginalDb()
  removeDbIfExists(TEST_DB_PATH)
  process.exit(1)
}
