import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3001/api';

async function login(username, password) {
  console.log(`正在登录: ${username}/${password}`);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  const data = await res.json();
  console.log(`登录响应: status=${res.status}, body=`, JSON.stringify(data, null, 2));
  
  if (!data.success) {
    console.log('❌ 登录失败:', data.error);
    return { success: false, error: data.error };
  }
  
  const cookie = res.headers.get('set-cookie');
  console.log('✅ 登录成功');
  return { success: true, cookie, user: data.data };
}

async function importCsvFile(cookie, filePath) {
  console.log(`正在导入CSV文件: ${filePath}`);
  
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
  console.log(`导入响应: status=${res.status}, body=`, JSON.stringify(data, null, 2));
  
  return { status: res.status, data };
}

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 复现CSV导入列名校验问题');
  console.log('='.repeat(70));
  console.log();
  
  // 先测试登录失败的场景（用户要求不要提前宣告完成）
  console.log('--- 测试1: 登录失败场景');
  const badLogin = await login('admin', 'wrongpassword');
  if (!badLogin.success) {
    console.log('✅ 正确识别登录失败，不会提前宣告完成');
  } else {
    console.log('❌ 登录失败未正确识别');
  }
  console.log();
  
  // 用正确的账号登录
  console.log('--- 测试2: 正确登录');
  const loginResult = await login('admin', 'admin123');
  if (!loginResult.success) {
    console.log('❌ 无法继续测试，登录失败');
    process.exit(1);
  }
  console.log();
  
  // 测试用前端样例格式的CSV（小驼峰 designId）
  console.log('--- 测试3: 导入样例格式CSV（表头: designId,name,description,submitter,priority）');
  const csvFile = path.join(__dirname, 'sample_import.csv');
  const csvContent = fs.readFileSync(csvFile, 'utf-8');
  console.log('CSV内容:');
  console.log(csvContent);
  
  const result = await importCsvFile(loginResult.cookie, csvFile);
  console.log();
  
  if (result.status === 400 && result.data.error?.includes('缺少必要列')) {
    console.log('🐛 成功复现问题: 合法CSV被误判为缺少必要列');
    console.log('   表头被转为小写后:', csvContent.split('\n')[0].split(',').map(h => h.trim().toLowerCase()));
    console.log('   需要的列: designid, name, submitter');
  } else if (result.data.success) {
    console.log('✅ CSV导入成功，没有列名问题');
    console.log('   导入:', result.data.data.imported, '条');
    console.log('   冲突:', result.data.data.conflicts.length, '条');
  } else {
    console.log('❌ 其他错误:', result.data.error);
  }
  
  console.log();
  console.log('='.repeat(70));
  console.log('🔍 复现完成');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});
