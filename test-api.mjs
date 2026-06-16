import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const jar = { cookie: '' };

async function apiRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': jar.cookie,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(BASE_URL + path, options);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    jar.cookie = setCookie.split(';')[0];
  }
  const data = await res.json();
  console.log(`${method} ${path} -> ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
  console.log('---');
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== 测试登录 API ===\n');
  
  // 1. 测试登录
  await apiRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  });

  // 2. 测试获取当前用户
  await apiRequest('GET', '/api/auth/me');

  // 3. 测试获取设计稿列表
  await apiRequest('GET', '/api/designs');

  // 4. 测试获取用户列表
  await apiRequest('GET', '/api/users');

  console.log('\n=== 测试导入设计稿 ===\n');

  // 5. 测试导入设计稿
  const importData = [
    { designId: 'DESIGN-001', name: '产品首页改版设计', description: '优化首页视觉效果', submitter: 'submitter1', priority: 'high' },
    { designId: 'DESIGN-002', name: '个人中心页面设计', description: '重构个人中心布局', submitter: 'submitter1', priority: 'medium' },
  ];
  await apiRequest('POST', '/api/designs/import', importData);

  // 6. 再次获取设计稿列表
  await apiRequest('GET', '/api/designs');
}

runTests().catch(console.error);
