#!/usr/bin/env node
/**
 * 账号和权限完整性验证脚本
 * 验证内容：
 * 1. 所有 seed 账号能正确登录
 * 2. 登录后角色信息正确
 * 3. 各角色权限控制正确
 * 4. 非管理员被正确拦截
 * 5. 数据库初始化状态正确
 */

import fetch from 'node-fetch'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'

function parseSeedConfig() {
  const seedConfigPath = path.resolve(__dirname, '../api/config/seed.config.ts')
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
    
    return {
      username: usernameMatch[1],
      password: passwordMatch[1],
      name: nameMatch[1],
      role: roleMatch[1],
    }
  }).filter(Boolean)
  
  return userObjects
}

const SEED_USERS = parseSeedConfig()
const DEFAULT_USER_PASSWORD = 'user123456'

function createSession() {
  return { cookie: '' }
}

async function apiRequest(session, method, path, body = null, expectedStatus = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': session.cookie,
    },
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(BASE_URL + path, options)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    session.cookie = setCookie.split(';')[0]
  }
  
  const contentType = res.headers.get('content-type') || ''
  let data
  if (contentType.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.text()
  }
  
  if (expectedStatus && res.status !== expectedStatus) {
    console.log(`❌ ${method} ${path} -> 期望 ${expectedStatus}, 实际 ${res.status}`)
    if (typeof data === 'object') {
      console.log(`   响应:`, JSON.stringify(data, null, 2))
    } else {
      console.log(`   响应(前500字符):`, data.substring(0, 500))
    }
    throw new Error(`状态码不匹配: ${res.status}`)
  }
  
  return { status: res.status, data }
}

async function login(session, username, password) {
  const { data } = await apiRequest(session, 'POST', '/api/auth/login', { username, password }, 200)
  return data.data
}

async function runAccountVerification() {
  console.log('='.repeat(70))
  console.log('🔍 账号和权限完整性验证')
  console.log('='.repeat(70))
  console.log()
  
  console.log('📋 待验证账号:')
  SEED_USERS.forEach(u => console.log(`  - ${u.username} (${u.role}): ${u.name}`))
  console.log()
  
  const sessions = {}
  const results = {
    loginSuccess: 0,
    loginFailed: 0,
    roleCorrect: 0,
    roleIncorrect: 0,
    permissionCorrect: 0,
    permissionIncorrect: 0,
  }
  
  console.log('='.repeat(70))
  console.log('📝 测试1: 账号登录验证')
  console.log('='.repeat(70))
  console.log()
  
  for (const seedUser of SEED_USERS) {
    const session = createSession()
    sessions[seedUser.username] = session
    
    try {
      const user = await login(session, seedUser.username, seedUser.password)
      console.log(`✅ ${seedUser.username} 登录成功`)
      results.loginSuccess++
      
      if (user.role === seedUser.role) {
        console.log(`   ✅ 角色正确: ${user.role}`)
        results.roleCorrect++
      } else {
        console.log(`   ❌ 角色错误: 期望 ${seedUser.role}, 实际 ${user.role}`)
        results.roleIncorrect++
      }
      
      if (user.name === seedUser.name) {
        console.log(`   ✅ 姓名正确: ${user.name}`)
      } else {
        console.log(`   ❌ 姓名错误: 期望 ${seedUser.name}, 实际 ${user.name}`)
        results.roleIncorrect++
      }
      
    } catch (error) {
      console.log(`❌ ${seedUser.username} 登录失败: ${error.message}`)
      results.loginFailed++
    }
    console.log()
  }
  
  console.log('='.repeat(70))
  console.log('📝 测试2: 权限控制验证 - 非管理员访问受限接口')
  console.log('='.repeat(70))
  console.log()
  
  const adminSession = sessions['admin']
  const reviewerSession = sessions['reviewer1']
  const submitterSession = sessions['submitter1']
  
  const adminOnlyEndpoints = [
    { method: 'GET', path: '/api/batch-tasks/1', desc: '获取批量任务详情' },
    { method: 'POST', path: '/api/batch-tasks', body: { taskName: 'test', rawCsv: 'username,name,role\ntest,测试,admin', fileName: 'test.csv', fileSize: 100 }, desc: '创建批量任务' },
    { method: 'GET', path: '/api/users', desc: '获取用户列表' },
  ]
  
  for (const endpoint of adminOnlyEndpoints) {
    console.log(`测试: ${endpoint.desc}`)
    
    try {
      await apiRequest(adminSession, endpoint.method, endpoint.path, endpoint.body, 200)
      console.log(`  ✅ 管理员可以访问`)
    } catch (error) {
      console.log(`  ❌ 管理员访问失败: ${error.message}`)
      results.permissionIncorrect++
    }
    
    try {
      await apiRequest(reviewerSession, endpoint.method, endpoint.path, endpoint.body, 403)
      console.log(`  ✅ 评审人被正确拦截 (403)`)
      results.permissionCorrect++
    } catch (error) {
      console.log(`  ❌ 评审人未被正确拦截`)
      results.permissionIncorrect++
    }
    
    try {
      await apiRequest(submitterSession, endpoint.method, endpoint.path, endpoint.body, 403)
      console.log(`  ✅ 提交者被正确拦截 (403)`)
      results.permissionCorrect++
    } catch (error) {
      console.log(`  ❌ 提交者未被正确拦截`)
      results.permissionIncorrect++
    }
    
    console.log()
  }
  
  console.log('='.repeat(70))
  console.log('📝 测试3: 未登录用户访问受限接口')
  console.log('='.repeat(70))
  console.log()
  
  const anonymousSession = createSession()
  const protectedEndpoints = [
    { method: 'GET', path: '/api/designs', desc: '获取设计稿列表' },
    { method: 'GET', path: '/api/users', desc: '获取用户列表' },
    { method: 'GET', path: '/api/batch-tasks', desc: '获取批量任务列表' },
  ]
  
  for (const endpoint of protectedEndpoints) {
    try {
      await apiRequest(anonymousSession, endpoint.method, endpoint.path, null, 401)
      console.log(`✅ ${endpoint.desc}: 未登录用户被正确拦截 (401)`)
      results.permissionCorrect++
    } catch (error) {
      console.log(`❌ ${endpoint.desc}: 未登录用户未被正确拦截`)
      results.permissionIncorrect++
    }
  }
  
  console.log()
  console.log('='.repeat(70))
  console.log('📊 验证结果汇总')
  console.log('='.repeat(70))
  console.log()
  console.log(`登录成功: ${results.loginSuccess}/${SEED_USERS.length}`)
  console.log(`登录失败: ${results.loginFailed}/${SEED_USERS.length}`)
  console.log(`角色正确: ${results.roleCorrect}/${SEED_USERS.length}`)
  console.log(`角色错误: ${results.roleIncorrect}/${SEED_USERS.length}`)
  console.log(`权限正确: ${results.permissionCorrect}`)
  console.log(`权限错误: ${results.permissionIncorrect}`)
  console.log()
  
  const totalErrors = results.loginFailed + results.roleIncorrect + results.permissionIncorrect
  if (totalErrors > 0) {
    console.log('❌ 验证失败，发现错误')
    process.exit(1)
  }
  
  console.log('✅ 所有验证通过！')
  console.log()
  console.log('🎉 账号和权限系统工作正常')
  process.exit(0)
}

runAccountVerification().catch(error => {
  console.error('❌ 验证过程出错:', error.message)
  console.error(error.stack)
  process.exit(1)
})
