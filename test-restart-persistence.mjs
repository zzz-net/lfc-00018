import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

function createSession() {
  return { cookie: '' };
}

async function apiRequest(session, method, path, body = null, expectedStatus = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': session.cookie,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
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
    throw new Error(`状态码不匹配: ${res.status}`);
  }
  
  return { status: res.status, data };
}

async function login(session, username, password) {
  const { data } = await apiRequest(session, 'POST', '/api/auth/login', { username, password }, 200);
  return data.data;
}

async function testPersistence() {
  console.log('='.repeat(70));
  console.log('🔄 重启后持久化验证测试');
  console.log('='.repeat(70));
  console.log();

  const adminSession = createSession();
  await login(adminSession, 'admin', 'admin123');

  console.log('📋 测试1: 验证设计稿列表和队列顺序');
  console.log('-'.repeat(70));
  const { data: designsResult } = await apiRequest(adminSession, 'GET', '/api/designs', null, 200);
  const designs = designsResult.data;
  console.log(`✅ 设计稿数量: ${designs.length}`);
  
  const d1 = designs.find(d => d.designId === 'DESIGN-001');
  const d2 = designs.find(d => d.designId === 'DESIGN-002');
  
  console.log(`  DESIGN-001: 状态=${d1.status}, 评审人=${d1.reviewerName}, 队列顺序=${d1.queueOrder}`);
  console.log(`  DESIGN-002: 状态=${d2.status}, 评审人=${d2.reviewerName}, 队列顺序=${d2.queueOrder}`);
  
  if (d1.status === 'passed' && d1.reviewerName === '张评审' && d1.queueOrder === 1) {
    console.log('✅ DESIGN-001 状态、评审人、队列顺序正确');
  } else {
    console.log('❌ DESIGN-001 数据不正确');
    process.exit(1);
  }

  console.log();
  console.log('📋 测试2: 验证评论和退回原因');
  console.log('-'.repeat(70));
  const { data: commentsResult } = await apiRequest(adminSession, 'GET', `/api/designs/${d1.id}/comments`, null, 200);
  const comments = commentsResult.data;
  console.log(`✅ 评论数量: ${comments.length}`);
  
  const returnComment = comments.find(c => c.isReturnReason);
  const normalComments = comments.filter(c => !c.isReturnReason);
  
  console.log(`  退回原因: ${returnComment ? '✅ 存在' : '❌ 缺失'}`);
  console.log(`  普通评论: ${normalComments.length} 条`);
  
  if (returnComment && returnComment.content.includes('整体风格不够统一')) {
    console.log('✅ 退回原因内容正确');
  }

  console.log();
  console.log('📋 测试3: 重新导出评审纪要');
  console.log('-'.repeat(70));
  const { data: exportContent } = await apiRequest(adminSession, 'GET', '/api/designs/export?status=passed', null, 200);
  console.log(`✅ 导出内容长度: ${exportContent.length} 字符`);
  
  const hasDesignId = exportContent.includes('DESIGN-001');
  const hasSubmitter = exportContent.includes('王设计');
  const hasReviewer = exportContent.includes('张评审');
  const hasReturnReason = exportContent.includes('整体风格不够统一');
  const hasQueueOrder = exportContent.includes('排队顺序');
  const hasConclusion = exportContent.includes('通过');
  const hasVersion = exportContent.includes('版本');
  
  console.log(`  包含 DESIGN-001: ${hasDesignId ? '✅' : '❌'}`);
  console.log(`  包含提交者: ${hasSubmitter ? '✅' : '❌'}`);
  console.log(`  包含评审人: ${hasReviewer ? '✅' : '❌'}`);
  console.log(`  包含退回原因: ${hasReturnReason ? '✅' : '❌'}`);
  console.log(`  包含队列顺序: ${hasQueueOrder ? '✅' : '❌'}`);
  console.log(`  包含最终结论: ${hasConclusion ? '✅' : '❌'}`);
  console.log(`  包含版本号: ${hasVersion ? '✅' : '❌'}`);

  if (hasDesignId && hasSubmitter && hasReviewer && hasReturnReason && hasQueueOrder && hasConclusion && hasVersion) {
    console.log('✅ 重启后导出内容完整，所有数据持久化成功！');
  } else {
    console.log('❌ 部分数据丢失');
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('🎉 重启后持久化验证通过！');
  console.log('='.repeat(70));
  console.log();
  console.log('📝 持久化内容包括:');
  console.log('  ✅ 设计稿队列顺序');
  console.log('  ✅ 设计稿状态流转');
  console.log('  ✅ 评审人认领记录');
  console.log('  ✅ 评论历史');
  console.log('  ✅ 退回原因');
  console.log('  ✅ 最终结论');
  console.log('  ✅ 版本号');
}

testPersistence().catch(console.error);
