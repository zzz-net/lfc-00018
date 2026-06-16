import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3001/api';
const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : 'ℹ️ ';
  console.log(`${icon} ${name}: ${detail}`);
}

async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  const cookie = res.headers.get('set-cookie');
  return { status: res.status, data, cookie };
}

async function importCsv(cookie, filePath) {
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
  return { status: res.status, data };
}

async function getDesigns(cookie) {
  const res = await fetch(`${API_BASE}/designs`, {
    headers: { Cookie: cookie },
  });
  const data = await res.json();
  return { status: res.status, data };
}

function createTempFile(content, filename) {
  const tmpDir = path.join(__dirname, 'tmp_verify');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function runAllTests() {
  console.log('='.repeat(70));
  console.log('🔬 设计稿评审系统 - 端到端验证');
  console.log('='.repeat(70));
  console.log();

  // === 1. 健康检查 ===
  console.log('--- 1. 健康检查 ---');
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    const healthData = await healthRes.json();
    record('健康检查', healthData.success ? 'pass' : 'fail', 
           healthData.success ? '接口可用' : healthData.error || '未知错误');
  } catch (e) {
    record('健康检查', 'fail', e.message);
  }
  console.log();

  // === 2. 登录失败（错误密码）===
  console.log('--- 2. 登录失败验证（错误密码）---');
  const badLogin = await login('admin', 'wrongpassword');
  record('登录失败-状态码', badLogin.status === 401 ? 'pass' : 'fail',
         badLogin.status === 401 ? '返回 401' : `返回 ${badLogin.status}`);
  record('登录失败-错误信息', badLogin.data.error?.includes('用户名或密码') ? 'pass' : 'fail',
         badLogin.data.error || '无错误信息');
  console.log();

  // === 3. 管理员登录成功 ===
  console.log('--- 3. 管理员登录成功 ---');
  const adminLogin = await login('admin', 'admin123');
  const loginOk = adminLogin.status === 200 && adminLogin.data.success;
  record('管理员登录', loginOk ? 'pass' : 'fail',
         loginOk ? `登录成功，角色: ${adminLogin.data.data.role}` : adminLogin.data.error || '未知错误');
  
  if (!loginOk) {
    console.log('\n❌ 登录失败，无法继续测试');
    return;
  }
  
  const adminCookie = adminLogin.cookie;
  console.log();

  // === 4. 导入合法 CSV（标准小驼峰表头）===
  console.log('--- 4. 导入合法 CSV（小驼峰表头: designId, name, submitter）---');
  const validCsv = `designId,name,description,submitter,priority
VERIFY-001,验证测试设计1,验证描述1,王设计,high
VERIFY-002,验证测试设计2,验证描述2,submitter1,medium
VERIFY-003,验证测试设计3,验证描述3,刘设计,low`;
  const validPath = createTempFile(validCsv, 'valid.csv');
  const import1 = await importCsv(adminCookie, validPath);
  record('合法CSV导入', import1.data.success ? 'pass' : 'fail',
         import1.data.success 
           ? `成功 ${import1.data.data.imported} 条，冲突 ${import1.data.data.conflicts.length} 条`
           : import1.data.error || '未知错误');
  console.log();

  // === 5. 验证列表中能看到导入的设计 ===
  console.log('--- 5. 验证导入结果可见 ---');
  const listRes = await getDesigns(adminCookie);
  const verifyDesigns = listRes.data.data?.filter(d => d.designId.startsWith('VERIFY-')) || [];
  record('导入结果可见', verifyDesigns.length === 3 ? 'pass' : 'fail',
         `查询到 ${verifyDesigns.length} 条 VERIFY- 开头的设计`);
  if (verifyDesigns.length > 0) {
    const first = verifyDesigns[0];
    record('设计数据完整', first.status && first.submitterName ? 'pass' : 'fail',
           `状态: ${first.status}, 提交者: ${first.submitterName}, 队列序号: ${first.queueOrder}`);
  }
  console.log();

  // === 6. CSV 缺少必要列（没有 submitter）===
  console.log('--- 6. CSV 缺少必要列（无 submitter）---');
  const missingColCsv = `designId,name,description
BAD-001,坏设计,描述`;
  const missingColPath = createTempFile(missingColCsv, 'missing_col.csv');
  const import2 = await importCsv(adminCookie, missingColPath);
  record('缺少必要列-状态码', import2.status === 400 ? 'pass' : 'fail',
         import2.status === 400 ? '返回 400' : `返回 ${import2.status}`);
  record('缺少必要列-错误提示', import2.data.error?.includes('缺少必要列') ? 'pass' : 'fail',
         import2.data.error || '无错误信息');
  console.log();

  // === 7. CSV 表头错列（用 id 代替 designId）===
  console.log('--- 7. CSV 表头错列（用 id 代替 designId）---');
  const wrongColCsv = `id,name,submitter
WRONG-001,错列设计,submitter1`;
  const wrongColPath = createTempFile(wrongColCsv, 'wrong_col.csv');
  const import3 = await importCsv(adminCookie, wrongColPath);
  record('错列-状态码', import3.status === 400 ? 'pass' : 'fail',
         import3.status === 400 ? '返回 400' : `返回 ${import3.status}`);
  record('错列-错误提示', import3.data.error?.includes('缺少必要列') ? 'pass' : 'fail',
         import3.data.error || '无错误信息');
  console.log();

  // === 8. 非 CSV 文件 ===
  console.log('--- 8. 非 CSV 文件 ---');
  const txtPath = createTempFile('这是文本文件', 'test.txt');
  const import4 = await importCsv(adminCookie, txtPath);
  record('非CSV文件-状态码', import4.status === 400 ? 'pass' : 'fail',
         import4.status === 400 ? '返回 400' : `返回 ${import4.status}`);
  record('非CSV文件-错误提示', import4.data.error?.includes('CSV') ? 'pass' : 'fail',
         import4.data.error || '无错误信息');
  console.log();

  // === 9. 空 CSV 文件 ===
  console.log('--- 9. 空 CSV 文件（只有表头）---');
  const emptyCsv = 'designId,name,submitter';
  const emptyPath = createTempFile(emptyCsv, 'empty.csv');
  const import5 = await importCsv(adminCookie, emptyPath);
  record('空CSV-状态码', import5.status === 400 ? 'pass' : 'fail',
         import5.status === 400 ? '返回 400' : `返回 ${import5.status}`);
  record('空CSV-错误提示', import5.data.error ? 'pass' : 'fail',
         import5.data.error || '无错误信息');
  console.log();

  // === 10. 重复导入冲突 ===
  console.log('--- 10. 重复导入冲突检测 ---');
  const conflictCsv = `designId,name,description,submitter,priority
VERIFY-001,已存在的设计,应该冲突,王设计,high
VERIFY-004,新设计,不冲突,submitter1,low`;
  const conflictPath = createTempFile(conflictCsv, 'conflict.csv');
  const import6 = await importCsv(adminCookie, conflictPath);
  record('冲突检测', import6.data.success && import6.data.data.conflicts.length > 0 ? 'pass' : 'fail',
         import6.data.success 
           ? `新增 ${import6.data.data.imported} 条，冲突 ${import6.data.data.conflicts.length} 条`
           : import6.data.error || '未知错误');
  if (import6.data.data?.conflicts?.[0]) {
    record('冲突详情', import6.data.data.conflicts[0].message?.includes('已存在') ? 'pass' : 'fail',
           import6.data.data.conflicts[0].message || '无冲突消息');
  }
  console.log();

  // === 总结 ===
  console.log('='.repeat(70));
  console.log('📊 验证总结');
  console.log('='.repeat(70));
  const passed = results.filter(r => r.status === 'pass').length;
  const total = results.length;
  console.log(`通过: ${passed}/${total}`);
  console.log();
  
  results.forEach(r => {
    const icon = r.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
  });
  
  console.log();
  console.log('💡 实际现象已记录，可用于撰写 README');
}

runAllTests().catch(err => {
  console.error('❌ 验证脚本执行失败:', err);
  process.exit(1);
});
