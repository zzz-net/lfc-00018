import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3001/api';

function createTempFile(content, filename) {
  const tmpDir = path.join(__dirname, 'tmp_test');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = res.headers.get('set-cookie');
  return { cookie, res };
}

async function importCsvFile(cookie, filePath, expectedStatus = 200) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  
  const res = await fetch(`${API_BASE}/designs/import`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      ...formData.getHeaders(),
    },
    body: formData,
  });
  
  const data = await res.json();
  console.log(`  状态码: ${res.status}, 响应:`, JSON.stringify(data, null, 2));
  
  if (res.status !== expectedStatus) {
    throw new Error(`状态码不匹配: 期望 ${expectedStatus}, 实际 ${res.status}`);
  }
  
  return { status: res.status, data };
}

async function importWithoutFile(cookie, expectedStatus = 400) {
  const formData = new FormData();
  
  const res = await fetch(`${API_BASE}/designs/import`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      ...formData.getHeaders(),
    },
    body: formData,
  });
  
  const data = await res.json();
  console.log(`  状态码: ${res.status}, 响应:`, JSON.stringify(data, null, 2));
  
  if (res.status !== expectedStatus) {
    throw new Error(`状态码不匹配: 期望 ${expectedStatus}, 实际 ${res.status}`);
  }
  
  return { status: res.status, data };
}

async function runTests() {
  console.log('=' .repeat(70));
  console.log('🧪 FormData 导入错误场景验证');
  console.log('=' .repeat(70));
  console.log();
  
  const { cookie } = await login('admin', 'admin123');
  console.log('✅ 管理员登录成功');
  console.log();
  
  // 测试1: 不上传文件
  console.log('📋 测试1: 不上传文件');
  console.log('-'.repeat(70));
  const r1 = await importWithoutFile(cookie, 400);
  if (r1.data.error && r1.data.error.includes('请上传')) {
    console.log('✅ 错误提示正确:', r1.data.error);
  } else {
    console.log('❌ 错误提示不正确');
  }
  console.log();
  
  // 测试2: 上传非CSV文件
  console.log('📋 测试2: 上传非CSV文件');
  console.log('-'.repeat(70));
  const txtPath = createTempFile('这是文本文件内容', 'test.txt');
  const r2 = await importCsvFile(cookie, txtPath, 400);
  if (r2.data.error && r2.data.error.includes('CSV')) {
    console.log('✅ 错误提示正确:', r2.data.error);
  } else {
    console.log('❌ 错误提示不正确');
  }
  console.log();
  
  // 测试3: 空CSV文件（只有表头）
  console.log('📋 测试3: 空CSV文件（只有表头）');
  console.log('-'.repeat(70));
  const emptyCsv = 'designId,name,description,submitter,priority\n';
  const emptyPath = createTempFile(emptyCsv, 'empty.csv');
  const r3 = await importCsvFile(cookie, emptyPath, 400);
  if (r3.data.error && (r3.data.error.includes('空') || r3.data.error.includes('数据'))) {
    console.log('✅ 错误提示正确:', r3.data.error);
  } else {
    console.log('❌ 错误提示不正确:', r3.data.error);
  }
  console.log();
  
  // 测试4: CSV缺少必要列（没有submitter列）
  console.log('📋 测试4: CSV缺少必要列');
  console.log('-'.repeat(70));
  const badCsv = 'designId,name,description\nTEST-01,测试设计,测试描述\n';
  const badPath = createTempFile(badCsv, 'bad.csv');
  const r4 = await importCsvFile(cookie, badPath, 400);
  if (r4.data.error && (r4.data.error.includes('缺少') || r4.data.error.includes('列'))) {
    console.log('✅ 错误提示正确:', r4.data.error);
  } else {
    console.log('❌ 错误提示不正确:', r4.data.error);
  }
  console.log();
  
  // 测试5: 提交者不存在
  console.log('📋 测试5: 提交者不存在');
  console.log('-'.repeat(70));
  const badSubmitterCsv = 'designId,name,description,submitter,priority\nERR-01,测试设计,测试描述,不存在的用户,high\n';
  const badSubmitterPath = createTempFile(badSubmitterCsv, 'bad_submitter.csv');
  const r5 = await importCsvFile(cookie, badSubmitterPath, 400);
  if (r5.data.error && r5.data.error.includes('不存在')) {
    console.log('✅ 错误提示正确:', r5.data.error);
  } else {
    console.log('❌ 错误提示不正确:', r5.data.error);
  }
  console.log();
  
  console.log('=' .repeat(70));
  console.log('🎉 所有错误场景验证完成');
  console.log('=' .repeat(70));
}

runTests().catch(err => {
  console.error('❌ 测试失败:', err.message);
  process.exit(1);
});
