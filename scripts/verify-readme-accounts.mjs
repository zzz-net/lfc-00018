#!/usr/bin/env node
/**
 * 验证 README.md 中的账号信息是否与 seed.config.ts 中的配置一致
 * 如果不一致，直接失败并提示需要更新
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const seedConfigPath = path.resolve(__dirname, '../api/config/seed.config.ts')
const readmePath = path.resolve(__dirname, '../README.md')

function extractReadmeAccounts() {
  const readme = readFileSync(readmePath, 'utf-8')
  const accountSectionRegex = /## 预设账号\n\n([\s\S]*?)\n\n##/
  const match = readme.match(accountSectionRegex)
  
  if (!match) {
    throw new Error('无法在 README.md 中找到预设账号部分')
  }
  
  const tableContent = match[1]
  const rows = tableContent.split('\n').filter(line => line.startsWith('| `'))
  
  const accounts = rows.map(row => {
    const parts = row.split('|').map(p => p.trim()).filter(p => p)
    return {
      username: parts[0].replace(/`/g, ''),
      password: parts[1].replace(/`/g, ''),
      role: parts[2],
      name: parts[3],
    }
  })
  
  return accounts
}

function extractSeedAccounts() {
  const seedConfig = readFileSync(seedConfigPath, 'utf-8')
  
  const usersRegex = /export const SEED_USERS: SeedUser\[\] = \[([\s\S]*?)\]/
  const match = seedConfig.match(usersRegex)
  
  if (!match) {
    throw new Error('无法在 seed.config.ts 中找到 SEED_USERS 配置')
  }
  
  const usersContent = match[1]
  const userObjects = usersContent.split(/\n\s*\},?\s*\{/).map((objStr, index) => {
    if (index === 0) {
      objStr = objStr.replace(/^\s*\{/, '')
    }
    if (index > 0) {
      objStr = '{' + objStr
    }
    objStr = objStr.replace(/\}\s*$/, '')
    
    const usernameMatch = objStr.match(/(?:^|\s)username:\s*'([^']+)'/)
    const passwordMatch = objStr.match(/(?:^|\s)password:\s*'([^']+)'/)
    const nameMatch = objStr.match(/(?:^|\s)name:\s*'([^']+)'/)
    const roleMatch = objStr.match(/(?:^|\s)role:\s*'([^']+)'/)
    
    if (!usernameMatch || !passwordMatch || !nameMatch || !roleMatch) {
      return null
    }
    
    const roleLabel = {
      admin: '管理员',
      reviewer: '评审人',
      submitter: '提交者',
    }
    
    return {
      username: usernameMatch[1],
      password: passwordMatch[1],
      name: nameMatch[1],
      role: roleLabel[roleMatch[1]] || roleMatch[1],
    }
  }).filter(Boolean)
  
  return userObjects
}

function generateExpectedTable(accounts) {
  const header = '| 用户名 | 密码 | 角色 | 姓名 |\n|--------|------|------|------|'
  const rows = accounts.map(u => 
    `| \`${u.username}\` | \`${u.password}\` | ${u.role} | ${u.name} |`
  ).join('\n')
  return `${header}\n${rows}`
}

console.log('='.repeat(70))
console.log('🔍 验证 README 账号信息与 seed.config.ts 一致性')
console.log('='.repeat(70))
console.log()

try {
  const seedAccounts = extractSeedAccounts()
  const readmeAccounts = extractReadmeAccounts()
  
  console.log(`📋 seed.config.ts 中的账号 (${seedAccounts.length} 个):`)
  seedAccounts.forEach(a => console.log(`  - ${a.username} (${a.role}): ${a.name}`))
  console.log()
  
  console.log(`📋 README.md 中的账号 (${readmeAccounts.length} 个):`)
  readmeAccounts.forEach(a => console.log(`  - ${a.username} (${a.role}): ${a.name}`))
  console.log()
  
  let hasErrors = false
  
  if (seedAccounts.length !== readmeAccounts.length) {
    console.error(`❌ 账号数量不一致: seed=${seedAccounts.length}, readme=${readmeAccounts.length}`)
    hasErrors = true
  }
  
  for (const seedAcc of seedAccounts) {
    const readmeAcc = readmeAccounts.find(r => r.username === seedAcc.username)
    
    if (!readmeAcc) {
      console.error(`❌ README 中缺少账号: ${seedAcc.username}`)
      hasErrors = true
      continue
    }
    
    if (readmeAcc.password !== seedAcc.password) {
      console.error(`❌ 账号 ${seedAcc.username} 密码不一致: seed="${seedAcc.password}", readme="${readmeAcc.password}"`)
      hasErrors = true
    }
    
    if (readmeAcc.role !== seedAcc.role) {
      console.error(`❌ 账号 ${seedAcc.username} 角色不一致: seed="${seedAcc.role}", readme="${readmeAcc.role}"`)
      hasErrors = true
    }
    
    if (readmeAcc.name !== seedAcc.name) {
      console.error(`❌ 账号 ${seedAcc.username} 姓名不一致: seed="${seedAcc.name}", readme="${readmeAcc.name}"`)
      hasErrors = true
    }
  }
  
  for (const readmeAcc of readmeAccounts) {
    const seedAcc = seedAccounts.find(s => s.username === readmeAcc.username)
    if (!seedAcc) {
      console.error(`❌ seed.config.ts 中缺少账号: ${readmeAcc.username}`)
      hasErrors = true
    }
  }
  
  console.log()
  
  if (hasErrors) {
    console.error('❌ 验证失败！README 与 seed.config.ts 不一致')
    console.log()
    console.log('📝 期望的 README 账号表格:')
    console.log(generateExpectedTable(seedAccounts))
    console.log()
    process.exit(1)
  }
  
  console.log('✅ README 账号信息与 seed.config.ts 完全一致')
  console.log()
  console.log('🎉 验证通过！')
  process.exit(0)
  
} catch (error) {
  console.error('❌ 验证过程出错:', error.message)
  process.exit(1)
}
