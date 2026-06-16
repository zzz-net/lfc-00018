import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3001';

function createSession() {
  return { cookie: '' };
}

async function apiRequest(session, method, path, body = null, expectedStatus = null) {
  const options = {
    method,
    headers: {
      'Cookie': session.cookie,
    },
  };
  
  if (body && !(body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    Object.assign(options.headers, body.getHeaders());
    options.body = body;
  }
  
  const res = await fetch(BASE_URL + path, options);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    session.cookie = setCookie.split(';')[0];
  }
  
  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  
  if (expectedStatus && res.status !== expectedStatus) {
    console.log(`❌ ${method} ${path} -> 期望 ${expectedStatus}, 实际 ${res.status}`);
    if (typeof data === 'object') {
      console.log(`   响应:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`   响应(前500字符):`, data.substring(0, 500));
    }
    throw new Error(`状态码不匹配: ${res.status}`);
  }
  
  return { status: res.status, data };
}

async function login(session, username, password) {
  const { data } = await apiRequest(session, 'POST', '/api/auth/login', { username, password }, 200);
  return data.data;
}

function createCsvContent(rows) {
  const header = 'designId,name,description,submitter,priority';
  const lines = [header];
  for (const row of rows) {
    lines.push(`${row.designId},${row.name},${row.description || ''},${row.submitter},${row.priority || 'medium'}`);
  }
  return lines.join('\n');
}

function createTempCsvFile(content, filename) {
  const filePath = path.join(__dirname, 'temp_' + filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('📋 FormData CSV 导入回归测试');
  console.log('='.repeat(70));
  console.log();

  const adminSession = createSession();
  await login(adminSession, 'admin', 'admin123');
  console.log('✅ 管理员登录成功');
  console.log();

  const tempFiles = [];

  try {
    // ==========================================
    // 测试1: 成功导入
    // ==========================================
    console.log('📋 测试1: 成功导入CSV文件');
    console.log('-'.repeat(70));
    
    const csvContent1 = createCsvContent([
      { designId: 'CSV-001', name: 'CSV测试设计1', description: '测试描述1', submitter: 'submitter1', priority: 'high' },
      { designId: 'CSV-002', name: 'CSV测试设计2', description: '测试描述2', submitter: '王设计', priority: 'medium' },
      { designId: 'CSV-003', name: 'CSV测试设计3', description: '测试描述3', submitter: '刘设计', priority: 'low' },
    ]);
    const filePath1 = createTempCsvFile(csvContent1, 'test_designs.csv');
    tempFiles.push(filePath1);
    
    const formData1 = new FormData();
    formData1.append('file', fs.createReadStream(filePath1), { filename: 'test_designs.csv', contentType: 'text/csv' });
    
    const { data: importResult1 } = await apiRequest(adminSession, 'POST', '/api/designs/import', formData1, 200);
    console.log(`✅ 导入成功: ${importResult1.data.imported} 条, 冲突 ${importResult1.data.conflicts.length} 条`);
    
    if (importResult1.data.imported === 3) {
      console.log('✅ 导入数量正确');
    } else {
      console.log('❌ 导入数量不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试2: 验证队列顺序
    // ==========================================
    console.log('📋 测试2: 验证队列顺序');
    console.log('-'.repeat(70));
    
    const { data: designsResult } = await apiRequest(adminSession, 'GET', '/api/designs', null, 200);
    const csvDesigns = designsResult.data.filter(d => d.designId.startsWith('CSV-'));
    console.log(`✅ 查询到 ${csvDesigns.length} 条CSV导入的设计稿`);
    
    const csv001 = csvDesigns.find(d => d.designId === 'CSV-001');
    const csv002 = csvDesigns.find(d => d.designId === 'CSV-002');
    const csv003 = csvDesigns.find(d => d.designId === 'CSV-003');
    
    if (csv001.queueOrder < csv002.queueOrder && csv002.queueOrder < csv003.queueOrder) {
      console.log('✅ 队列顺序正确（按导入顺序排列）');
    } else {
      console.log('❌ 队列顺序不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试3: 重复design_id导入冲突
    // ==========================================
    console.log('📋 测试3: 重复design_id导入冲突检测');
    console.log('-'.repeat(70));
    
    const csvContent2 = createCsvContent([
      { designId: 'CSV-001', name: '被覆盖的设计', description: '应该被跳过', submitter: 'submitter1', priority: 'high' },
      { designId: 'CSV-004', name: '新设计', description: '新的设计', submitter: 'submitter1', priority: 'medium' },
    ]);
    const filePath2 = createTempCsvFile(csvContent2, 'conflict_test.csv');
    tempFiles.push(filePath2);
    
    const formData2 = new FormData();
    formData2.append('file', fs.createReadStream(filePath2), { filename: 'conflict_test.csv', contentType: 'text/csv' });
    
    const { data: importResult2 } = await apiRequest(adminSession, 'POST', '/api/designs/import', formData2, 200);
    console.log(`✅ 导入结果: 成功 ${importResult2.data.imported} 条, 冲突 ${importResult2.data.conflicts.length} 条`);
    
    if (importResult2.data.imported === 1 && importResult2.data.conflicts.length === 1) {
      console.log('✅ 冲突检测正确（1条新导入，1条冲突）');
    } else {
      console.log('❌ 冲突检测不正确');
      process.exit(1);
    }
    
    const conflict = importResult2.data.conflicts[0];
    if (conflict.designId === 'CSV-001' && conflict.message.includes('已存在')) {
      console.log('✅ 冲突信息正确（CSV-001已存在）');
    } else {
      console.log('❌ 冲突信息不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试4: 旧评论不被覆盖
    // ==========================================
    console.log('📋 测试4: 旧评论不被覆盖');
    console.log('-'.repeat(70));
    
    const { data: addCommentResult } = await apiRequest(
      adminSession,
      'POST',
      `/api/designs/${csv002.id}/comments`,
      { content: '测试评论，不应该被覆盖', isReturnReason: false },
      201
    );
    console.log('✅ 添加测试评论成功');
    
    const commentCountBefore = (await apiRequest(adminSession, 'GET', `/api/designs/${csv002.id}/comments`, null, 200)).data.data.length;
    console.log(`评论数: ${commentCountBefore}`);
    
    const csvContent3 = createCsvContent([
      { designId: 'CSV-002', name: '覆盖测试', description: '应该被跳过', submitter: 'submitter1', priority: 'high' },
    ]);
    const filePath3 = createTempCsvFile(csvContent3, 'comment_test.csv');
    tempFiles.push(filePath3);
    
    const formData3 = new FormData();
    formData3.append('file', fs.createReadStream(filePath3), { filename: 'comment_test.csv', contentType: 'text/csv' });
    
    await apiRequest(adminSession, 'POST', '/api/designs/import', formData3, 200);
    
    const commentCountAfter = (await apiRequest(adminSession, 'GET', `/api/designs/${csv002.id}/comments`, null, 200)).data.data.length;
    console.log(`导入后评论数: ${commentCountAfter}`);
    
    if (commentCountBefore === commentCountAfter) {
      console.log('✅ 旧评论未被覆盖');
    } else {
      console.log('❌ 旧评论被覆盖了！');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试5: 错误文件格式（非CSV）
    // ==========================================
    console.log('📋 测试5: 错误文件格式（非CSV）');
    console.log('-'.repeat(70));
    
    const txtFilePath = path.join(__dirname, 'temp_test.txt');
    fs.writeFileSync(txtFilePath, '这是一个文本文件，不是CSV', 'utf-8');
    tempFiles.push(txtFilePath);
    
    const formData4 = new FormData();
    formData4.append('file', fs.createReadStream(txtFilePath), { filename: 'test.txt', contentType: 'text/plain' });
    
    const { status: status4, data: data4 } = await apiRequest(adminSession, 'POST', '/api/designs/import', formData4, 400);
    console.log(`✅ 返回状态码: ${status4}`);
    console.log(`✅ 错误信息: ${data4.error}`);
    
    if (data4.error && data4.error.includes('CSV')) {
      console.log('✅ 错误提示正确（提示只支持CSV格式）');
    } else {
      console.log('❌ 错误提示不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试6: CSV缺少必要列
    // ==========================================
    console.log('📋 测试6: CSV缺少必要列');
    console.log('-'.repeat(70));
    
    const badCsv = 'id,name,desc\n1,测试,描述';
    const badCsvPath = createTempCsvFile(badCsv, 'bad_format.csv');
    tempFiles.push(badCsvPath);
    
    const formData5 = new FormData();
    formData5.append('file', fs.createReadStream(badCsvPath), { filename: 'bad_format.csv', contentType: 'text/csv' });
    
    const { status: status5, data: data5 } = await apiRequest(adminSession, 'POST', '/api/designs/import', formData5, 400);
    console.log(`✅ 返回状态码: ${status5}`);
    console.log(`✅ 错误信息: ${data5.error}`);
    
    if (data5.error && data5.error.includes('缺少')) {
      console.log('✅ 错误提示正确（提示缺少必要列）');
    } else {
      console.log('❌ 错误提示不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试7: 空CSV文件（只有表头）
    // ==========================================
    console.log('📋 测试7: 空CSV文件（只有表头）');
    console.log('-'.repeat(70));
    
    const emptyCsv = 'designId,name,description,submitter,priority';
    const emptyCsvPath = createTempCsvFile(emptyCsv, 'empty.csv');
    tempFiles.push(emptyCsvPath);
    
    const formData6 = new FormData();
    formData6.append('file', fs.createReadStream(emptyCsvPath), { filename: 'empty.csv', contentType: 'text/csv' });
    
    const { status: status6, data: data6 } = await apiRequest(adminSession, 'POST', '/api/designs/import', formData6, 400);
    console.log(`✅ 返回状态码: ${status6}`);
    console.log(`✅ 错误信息: ${data6.error}`);
    
    if (data6.error && (data6.error.includes('没有') || data6.error.includes('空'))) {
      console.log('✅ 错误提示正确（提示没有有效数据）');
    } else {
      console.log('❌ 错误提示不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 测试8: 不上传文件
    // ==========================================
    console.log('📋 测试8: 不上传文件');
    console.log('-'.repeat(70));
    
    const formData7 = new FormData();
    formData7.append('someField', 'someValue');
    
    const { status: status7, data: data7 } = await apiRequest(adminSession, 'POST', '/api/designs/import', formData7, 400);
    console.log(`✅ 返回状态码: ${status7}`);
    console.log(`✅ 错误信息: ${data7.error}`);
    
    if (data7.error && data7.error.includes('上传')) {
      console.log('✅ 错误提示正确（提示请上传文件）');
    } else {
      console.log('❌ 错误提示不正确');
      process.exit(1);
    }
    console.log();

    // ==========================================
    // 总结
    // ==========================================
    console.log('='.repeat(70));
    console.log('🎉 所有FormData导入回归测试通过！');
    console.log('='.repeat(70));
    console.log();
    console.log('📝 测试总结:');
    console.log('  ✅ 1. 成功导入CSV文件');
    console.log('  ✅ 2. 队列顺序正确');
    console.log('  ✅ 3. 重复design_id冲突检测');
    console.log('  ✅ 4. 旧评论不被覆盖');
    console.log('  ✅ 5. 错误文件格式提示');
    console.log('  ✅ 6. CSV缺少必要列提示');
    console.log('  ✅ 7. 空CSV文件提示');
    console.log('  ✅ 8. 不上传文件提示');
    console.log();
    console.log('✅ 解析失败时都有可理解的错误响应，不再是笼统500');

  } finally {
    // 清理临时文件
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch (e) {
        // 忽略
      }
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ 测试失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
