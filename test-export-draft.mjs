
import http from 'http'
import fs from 'fs'

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
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData)

    const req = http.request(options, (res) => {
      let data = ''
      res.setEncoding('utf8')
      const cookies = res.headers['set-cookie']
      if (cookies) sessionCookies = cookies.map(c => c.split(';')[0])
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, data, raw: true }) }
      })
    })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

async function main() {
  // 登录
  await request('POST', '/auth/login', { username: 'admin', password: 'admin123' })

  // 测试1: 错误导出 - 传正确参数
  console.log('\n=== 测试：错误行导出 ===')
  const csvErrors = fs.readFileSync('test_import_errors.csv', 'utf-8')
  
  // 先预检查获取 rowErrors
  const precheck = await request('POST', '/users/import/precheck', {
    rawCsv: csvErrors,
    fileName: 'test_import_errors.csv',
    fileSize: csvErrors.length,
  })
  
  if (!precheck.data.success) {
    console.log('预检查失败:', precheck.data.error)
    return
  }
  
  const { rowErrors, detectedHeaders } = precheck.data.data
  console.log('预检查: 错误行', rowErrors.length, '行')
  console.log('检测到的表头:', detectedHeaders.join(', '))

  // 导出错误
  const exportResp = await request('POST', '/users/import/export-errors', {
    rowErrors,
    detectedHeaders,
  })

  if (exportResp.raw) {
    const exportPath = 'test_export_result.csv'
    fs.writeFileSync(exportPath, exportResp.data, 'utf-8')
    console.log('导出成功！文件:', exportPath)
    console.log('文件大小:', Buffer.byteLength(exportResp.data, 'utf-8'), 'bytes')
    console.log('\n文件内容:')
    const lines = exportResp.data.split('\n')
    lines.slice(0, 10).forEach((line, i) => console.log(`  ${i + 1}. ${line}`))
    if (lines.length > 10) console.log(`  ... 还有 ${lines.length - 10} 行`)
  } else {
    console.log('导出失败:', exportResp.data?.error)
  }

  // 测试2: 草稿保存后重启验证
  console.log('\n=== 测试：草稿持久化 (保存到DB) ===')
  const csvDraft = 'username,name,role,email\ndraft_user,草稿用户,admin,draft@test.com\n'
  const saveResp = await request('POST', '/users/import/draft', {
    fileName: 'restart_test.csv',
    fileSize: csvDraft.length,
    rawCsvContent: csvDraft,
    fieldMapping: { username: 'username', name: 'name', role: 'role', email: 'email' },
    precheckResult: {
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      headerIssues: [],
      rowErrors: [],
      detectedHeaders: ['username', 'name', 'role', 'email'],
      canSubmit: true,
    },
  })
  console.log('草稿保存:', saveResp.data.success ? '成功' : '失败')
  if (saveResp.data.success) {
    console.log('  ID:', saveResp.data.data.id)
    console.log('  文件名:', saveResp.data.data.fileName)
  }

  // 读取草稿确认
  const getResp = await request('GET', '/users/import/draft')
  console.log('草稿读取:', getResp.data.success && getResp.data.data ? '成功' : '失败')
  if (getResp.data?.data) {
    console.log('  文件名:', getResp.data.data.fileName)
    console.log('  映射字段数:', Object.keys(getResp.data.data.fieldMapping || {}).length)
    console.log('  预检查结果存在:', !!getResp.data.data.precheckResult)
  }

  console.log('\n=== 测试完成 ===')
  console.log('接下来可以手动重启后端服务，然后重新 GET /users/import/draft 验证草稿是否还在')
}

main().catch(console.error)
