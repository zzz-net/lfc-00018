
import http from 'http'

const baseUrl = 'localhost'
const port = 3001
let sessionCookies = []

function request(method, path, body = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const postData = body ? (contentType === 'application/json' ? JSON.stringify(body) : body) : null

    const options = {
      hostname: baseUrl,
      port: port,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': contentType,
        'Cookie': sessionCookies.join('; '),
      },
    }
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData)
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.setEncoding('utf8')

      const cookies = res.headers['set-cookie']
      if (cookies) {
        sessionCookies = cookies.map(c => c.split(';')[0])
      }

      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, data, raw: true })
        }
      })
    })

    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

async function main() {
  console.log('\n=== 1. 登录 ===')
  const loginResp = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' })
  console.log('登录:', loginResp.data.success ? '成功' : '失败')
  console.log('用户:', loginResp.data.data?.name, '-', loginResp.data.data?.role)

  const fs = await import('fs')
  const csvGood = fs.readFileSync('test_import_good.csv', 'utf-8')
  const csvErrors = fs.readFileSync('test_import_errors.csv', 'utf-8')

  console.log('\n=== 2. 预检查 - 正确CSV (rawCsv方式) ===')
  const precheck1 = await request('POST', '/users/import/precheck', {
    rawCsv: csvGood,
    fileName: 'test_import_good.csv',
    fileSize: csvGood.length,
  })
  console.log('状态:', precheck1.status)
  if (precheck1.data.success) {
    const d = precheck1.data.data
    console.log('总行数:', d.totalRows)
    console.log('有效行:', d.validRows)
    console.log('无效行:', d.invalidRows)
    console.log('表头问题:', d.headerIssues?.length || 0)
    console.log('行错误数:', d.rowErrors?.length || 0)
    if (d.rowErrors?.length) {
      d.rowErrors.forEach(err => {
        console.log(`  第${err.lineNumber}行:`)
        err.errors.forEach(e => console.log(`    [${e.type}] ${e.message}`))
      })
    }
  } else {
    console.log('错误:', precheck1.data.error)
  }

  console.log('\n=== 3. 预检查 - 多错误CSV (rawCsv方式) ===')
  const precheck2 = await request('POST', '/users/import/precheck', {
    rawCsv: csvErrors,
    fileName: 'test_import_errors.csv',
    fileSize: csvErrors.length,
  })
  console.log('状态:', precheck2.status)
  if (precheck2.data.success) {
    const d = precheck2.data.data
    console.log('总行数:', d.totalRows)
    console.log('有效行:', d.validRows)
    console.log('无效行:', d.invalidRows)
    console.log('表头问题:', d.headerIssues?.length || 0)
    if (d.headerIssues?.length) {
      d.headerIssues.forEach(i => console.log(`  - [${i.type}] ${i.message}`))
    }
    console.log('行错误数:', d.rowErrors?.length || 0)
    if (d.rowErrors?.length) {
      d.rowErrors.slice(0, 3).forEach(err => {
        console.log(`  第${err.lineNumber}行:`)
        err.errors.forEach(e => console.log(`    [${e.type}] ${e.message}`))
      })
      if (d.rowErrors.length > 3) console.log(`  ... 还有 ${d.rowErrors.length - 3} 行错误`)
    }
  } else {
    console.log('错误:', precheck2.data.error)
  }

  console.log('\n=== 4. 保存草稿 ===')
  const saveDraft = await request('POST', '/users/import/draft', {
    fileName: 'test_import_good.csv',
    fileSize: csvGood.length,
    rawCsvContent: csvGood,
    fieldMapping: { username: 'username', name: 'name', role: 'role', email: 'email', password: 'password' },
    precheckResult: precheck1.data.data,
  })
  console.log('状态:', saveDraft.status)
  if (saveDraft.data.success) {
    console.log('草稿ID:', saveDraft.data.data.id)
    console.log('文件名:', saveDraft.data.data.fileName)
    console.log('更新时间:', saveDraft.data.data.updatedAt)
  } else {
    console.log('错误:', saveDraft.data.error)
  }

  console.log('\n=== 5. 读取草稿 ===')
  const getDraft = await request('GET', '/users/import/draft')
  console.log('状态:', getDraft.status)
  if (getDraft.data.success && getDraft.data.data) {
    const d = getDraft.data.data
    console.log('文件名:', d.fileName)
    console.log('文件大小:', d.fileSize)
    console.log('映射字段:', Object.keys(d.fieldMapping || {}).join(', '))
    console.log('预检查结果:', d.precheckResult ? '有' : '无')
  } else {
    console.log('无草稿')
  }

  console.log('\n=== 6. 错误导出 ===')
  const exportResp = await request('POST', '/users/import/export-errors', {
    rawCsv: csvErrors,
    fieldMapping: { username: '用户名', name: '姓名', role: '角色', email: '邮箱', password: '密码' },
  })
  console.log('状态:', exportResp.status)
  if (exportResp.raw) {
    fs.writeFileSync('test_export_output.csv', exportResp.data, 'utf-8')
    console.log('文件大小:', Buffer.byteLength(exportResp.data), 'bytes')
    console.log('前5行:')
    exportResp.data.split('\n').slice(0, 5).forEach((line, i) => console.log(`  ${i + 1}. ${line}`))
  } else {
    console.log('错误:', exportResp.data?.error || '未知错误')
  }

  console.log('\n=== 7. 正式导入 (正确CSV前3行) ===')
  // 只导入前3行（去掉最后两行有问题的）
  const csvLines = csvGood.trim().split('\n')
  const csvSubset = csvLines.slice(0, 4).join('\n') + '\n'
  const submitResp = await request('POST', '/users/import/submit', {
    rawCsv: csvSubset,
    fieldMapping: { username: 'username', name: 'name', role: 'role', email: 'email', password: 'password' },
    applyDefaultPassword: true,
  })
  console.log('状态:', submitResp.status)
  if (submitResp.data.success) {
    const d = submitResp.data.data
    console.log('成功导入:', d.successCount)
    console.log('跳过:', d.skippedCount)
    console.log('失败:', d.failedCount)
    if (d.skippedReasons?.length) {
      console.log('跳过原因:')
      d.skippedReasons.forEach(s => console.log(`  第${s.lineNumber}行: ${s.reason}`))
    }
  } else {
    console.log('错误:', submitResp.data.error)
  }

  console.log('\n=== 8. 管理员操作日志 ===')
  const logsResp = await request('GET', '/users/admin-logs?type=user_import')
  console.log('状态:', logsResp.status)
  if (logsResp.data.success) {
    const logs = logsResp.data.data
    console.log('日志条数:', logs.length)
    logs.slice(0, 3).forEach(log => {
      console.log(`  - [${log.operationType}] ${log.summary} (${log.operatorName} at ${log.createdAt})`)
    })
  } else {
    console.log('错误:', logsResp.data.error)
  }

  console.log('\n=== 全部测试完成 ===')
}

main().catch(console.error)
