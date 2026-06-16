#!/usr/bin/env node
/**
 * 批量任务完整流程测试
 * 测试内容：创建任务、预检分类、预览、执行、验证结果
 */

import fetch from 'node-fetch'

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002'

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
  
  let data
  try {
    data = await res.json()
  } catch {
    data = await res.text()
  }
  
  if (expectedStatus && res.status !== expectedStatus) {
    console.log(`❌ ${method} ${path} -> 期望 ${expectedStatus}, 实际 ${res.status}`)
    console.log(`   响应:`, JSON.stringify(data, null, 2).substring(0, 500))
    throw new Error(`状态码不匹配: ${res.status}`)
  }
  
  return { status: res.status, data }
}

async function login(session, username, password) {
  const { data } = await apiRequest(session, 'POST', '/api/auth/login', { username, password }, 200)
  return data.data
}

async function runBatchTaskTest() {
  console.log('='.repeat(70))
  console.log('🔍 批量任务完整流程测试')
  console.log('='.repeat(70))
  console.log()
  
  const adminSession = createSession()
  
  console.log('📝 步骤1: 管理员登录')
  const adminUser = await login(adminSession, 'admin', 'admin123')
  console.log(`✅ 登录成功: ${adminUser.name} (${adminUser.role})`)
  console.log()
  
  console.log('📝 步骤2: 创建批量任务（包含新增和角色变更）')
  const testCsv = `用户名,姓名,角色,操作,邮箱
newuser1,新用户1,管理员,新增,newuser1@example.com
newuser2,新用户2,评审人,新增,newuser2@example.com
reviewer1,张评审,submitter,角色变更,
`
  
  const createResult = await apiRequest(adminSession, 'POST', '/api/batch-tasks', {
    taskName: '测试批量任务',
    rawCsv: testCsv,
    fileName: 'test-batch.csv',
    fileSize: testCsv.length,
  }, 201)
  
  const taskId = createResult.data.data.taskId
  console.log(`✅ 任务创建成功: ID=${taskId}`)
  console.log(`   总条目: ${createResult.data.data.totalCount}`)
  console.log(`   新增: ${createResult.data.data.newCount}`)
  console.log(`   角色变更: ${createResult.data.data.roleChangeCount}`)
  console.log(`   停用: ${createResult.data.data.disableCount}`)
  console.log(`   重复: ${createResult.data.data.duplicateCount}`)
  console.log(`   同名冲突: ${createResult.data.data.nameConflictCount}`)
  console.log()
  
  console.log('📝 步骤3: 查看任务详情（预检结果）')
  const detailResult = await apiRequest(adminSession, 'GET', `/api/batch-tasks/${taskId}`, null, 200)
  const items = detailResult.data.data.items
  console.log(`✅ 获取任务详情成功，共 ${items.length} 条`)
  
  items.forEach(item => {
    const status = item.ignored ? '已忽略' : item.status
    console.log(`   - [${item.itemType}] ${item.username} (${item.name}): ${status}`)
    if (item.errorMessage) {
      console.log(`     错误: ${item.errorMessage}`)
    }
  })
  console.log()
  
  console.log('📝 步骤4: 查看任务摘要')
  const summaryResult = await apiRequest(adminSession, 'GET', `/api/batch-tasks/${taskId}/summary`, null, 200)
  console.log(`✅ 任务摘要:`)
  console.log(`   名称: ${summaryResult.data.data.taskName}`)
  console.log(`   状态: ${summaryResult.data.data.status}`)
  console.log(`   新增: ${summaryResult.data.data.newCount}`)
  console.log(`   角色变更: ${summaryResult.data.data.roleChangeCount}`)
  console.log()
  
  console.log('📝 步骤5: 正式执行任务')
  const executeResult = await apiRequest(adminSession, 'POST', `/api/batch-tasks/${taskId}/execute`, null, 200)
  console.log(`✅ 任务执行成功`)
  console.log(`   成功: ${executeResult.data.data.successCount}`)
  console.log(`   失败: ${executeResult.data.data.failedCount}`)
  console.log(`   跳过: ${executeResult.data.data.skippedCount}`)
  console.log(`   忽略: ${executeResult.data.data.ignoredCount}`)
  console.log()
  
  if (executeResult.data.data.failedCount > 0) {
    console.log(`❌ 失败条目:`)
    executeResult.data.data.failedItems.forEach(item => {
      console.log(`   - ${item.username}: ${item.errorMessage}`)
    })
  }
  
  console.log('📝 步骤6: 验证新用户已创建')
  const usersResult = await apiRequest(adminSession, 'GET', '/api/users', null, 200)
  const users = usersResult.data.data
  console.log(`✅ 当前用户总数: ${users.length}`)
  
  const newUser1 = users.find(u => u.username === 'newuser1')
  const newUser2 = users.find(u => u.username === 'newuser2')
  const reviewer1 = users.find(u => u.username === 'reviewer1')
  
  let allPassed = true
  
  if (newUser1) {
    console.log(`   ✅ newuser1 创建成功: ${newUser1.name} (${newUser1.role})`)
  } else {
    console.log(`   ❌ newuser1 未创建`)
    allPassed = false
  }
  
  if (newUser2) {
    console.log(`   ✅ newuser2 创建成功: ${newUser2.name} (${newUser2.role})`)
  } else {
    console.log(`   ❌ newuser2 未创建`)
    allPassed = false
  }
  
  if (reviewer1 && reviewer1.role === 'submitter') {
    console.log(`   ✅ reviewer1 角色变更成功: ${reviewer1.role}`)
  } else if (reviewer1) {
    console.log(`   ❌ reviewer1 角色未变更: 期望 submitter, 实际 ${reviewer1.role}`)
    allPassed = false
  } else {
    console.log(`   ❌ reviewer1 不存在`)
    allPassed = false
  }
  
  console.log()
  console.log('📝 步骤7: 验证非管理员无法访问任务详情')
  const reviewerSession = createSession()
  await login(reviewerSession, 'reviewer2', 'reviewer123')
  
  try {
    await apiRequest(reviewerSession, 'GET', `/api/batch-tasks/${taskId}`, null, 403)
    console.log(`✅ 评审人被正确拦截 (403)`)
  } catch (error) {
    console.log(`❌ 评审人未被正确拦截`)
    allPassed = false
  }
  
  console.log()
  console.log('='.repeat(70))
  if (allPassed) {
    console.log('🎉 批量任务完整流程测试通过！')
    console.log()
    console.log('✅ 任务创建和预检正常')
    console.log('✅ 任务预览正常')
    console.log('✅ 任务执行成功')
    console.log('✅ 新用户创建成功')
    console.log('✅ 角色变更成功')
    console.log('✅ 权限控制正常')
    process.exit(0)
  } else {
    console.log('❌ 批量任务测试存在问题')
    process.exit(1)
  }
}

runBatchTaskTest().catch(error => {
  console.error('❌ 测试过程出错:', error.message)
  console.error(error.stack)
  process.exit(1)
})
