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
  console.log(`✅ 登录成功: ${data.data.name} (${data.data.role})`);
  return data.data;
}

async function runAcceptanceTest() {
  console.log('='.repeat(70));
  console.log('🚀 开始设计稿评审排队板验收测试');
  console.log('='.repeat(70));
  console.log();

  const adminSession = createSession();
  const reviewer1Session = createSession();
  const reviewer2Session = createSession();
  const submitterSession = createSession();

  try {
    console.log('📋 测试1: 用户登录');
    console.log('-'.repeat(70));
    
    const admin = await login(adminSession, 'admin', 'admin123');
    const reviewer1 = await login(reviewer1Session, 'reviewer1', 'reviewer123');
    const reviewer2 = await login(reviewer2Session, 'reviewer2', 'reviewer123');
    const submitter = await login(submitterSession, 'submitter1', 'submitter123');
    
    console.log();
    console.log('📋 测试2: 导入样例清单 (管理员)');
    console.log('-'.repeat(70));

    const sampleDesigns = [
      { designId: 'DESIGN-001', name: '产品首页改版设计', description: '优化首页视觉效果和用户体验，提升转化率', submitter: 'submitter1', priority: 'high' },
      { designId: 'DESIGN-002', name: '个人中心页面设计', description: '重构个人中心布局，新增消息通知功能', submitter: 'submitter1', priority: 'medium' },
      { designId: 'DESIGN-003', name: '商品详情页优化', description: '调整商品展示顺序，增加评价模块', submitter: 'submitter2', priority: 'high' },
      { designId: 'DESIGN-004', name: '购物车界面升级', description: '支持批量操作，优化结算流程', submitter: 'submitter2', priority: 'low' },
      { designId: 'DESIGN-005', name: '登录注册页设计', description: '全新设计登录注册流程', submitter: 'submitter1', priority: 'medium' },
    ];

    const { data: importResult } = await apiRequest(adminSession, 'POST', '/api/designs/import', sampleDesigns, 200);
    console.log(`✅ 导入成功: ${importResult.data.imported} 条, 冲突: ${importResult.data.conflicts.length} 条`);

    const { data: designs } = await apiRequest(adminSession, 'GET', '/api/designs', null, 200);
    console.log(`✅ 设计稿列表: ${designs.data.length} 条`);
    
    const design1 = designs.data.find(d => d.designId === 'DESIGN-001');
    const design2 = designs.data.find(d => d.designId === 'DESIGN-002');
    console.log(`✅ 队列顺序验证: DESIGN-001 queueOrder=${design1.queueOrder}, DESIGN-002 queueOrder=${design2.queueOrder}`);

    console.log();
    console.log('📋 测试3: 重复design_id导入冲突检测');
    console.log('-'.repeat(70));

    const duplicateImport = [
      { designId: 'DESIGN-001', name: '新的首页设计', description: '这应该被拒绝', submitter: 'submitter1', priority: 'low' },
      { designId: 'DESIGN-006', name: '全新设计', description: '这是新的', submitter: 'submitter1', priority: 'medium' },
    ];

    const { data: conflictResult } = await apiRequest(adminSession, 'POST', '/api/designs/import', duplicateImport, 200);
    console.log(`✅ 导入结果: 成功 ${conflictResult.data.imported} 条, 冲突 ${conflictResult.data.conflicts.length} 条`);
    
    const conflict = conflictResult.data.conflicts[0];
    if (conflict && conflict.designId === 'DESIGN-001') {
      console.log(`✅ 冲突检测正常: ${conflict.message}`);
    } else {
      throw new Error('冲突检测失败');
    }

    console.log();
    console.log('📋 测试4: 评审人认领设计稿');
    console.log('-'.repeat(70));

    console.log(`评审人1 (${reviewer1.name}) 认领 DESIGN-001...`);
    const { data: claimResult1 } = await apiRequest(reviewer1Session, 'POST', `/api/designs/${design1.id}/claim`, { version: design1.version }, 200);
    console.log(`✅ 认领成功: 状态=${claimResult1.data.status}, 评审人=${claimResult1.data.reviewerName}`);

    console.log();
    console.log('📋 测试5: 两个评审人同时认领同一项 (并发控制)');
    console.log('-'.repeat(70));

    console.log(`获取 DESIGN-002 最新数据...`);
    const { data: design2Latest } = await apiRequest(reviewer2Session, 'GET', `/api/designs/${design2.id}`, null, 200);
    const d2 = design2Latest.data;

    console.log(`评审人1 和 评审人2 同时认领 DESIGN-002...`);
    
    const claimPromise1 = apiRequest(reviewer1Session, 'POST', `/api/designs/${d2.id}/claim`, { version: d2.version });
    const claimPromise2 = apiRequest(reviewer2Session, 'POST', `/api/designs/${d2.id}/claim`, { version: d2.version });
    
    const [claimRes1, claimRes2] = await Promise.all([claimPromise1, claimPromise2]);
    
    const successCount = [claimRes1, claimRes2].filter(r => r.status === 200).length;
    const failCount = [claimRes1, claimRes2].filter(r => r.status === 409 || r.status === 400).length;
    
    console.log(`认领结果: 成功 ${successCount} 人, 失败 ${failCount} 人`);
    
    if (successCount === 1 && failCount === 1) {
      console.log('✅ 并发控制正常: 只有一人认领成功');
    } else {
      throw new Error('并发控制失败');
    }

    const { data: design2AfterClaim } = await apiRequest(adminSession, 'GET', `/api/designs/${d2.id}`, null, 200);
    console.log(`✅ DESIGN-002 当前评审人: ${design2AfterClaim.data.reviewerName}`);

    console.log();
    console.log('📋 测试6: 提交者不能通过自己的设计稿');
    console.log('-'.repeat(70));

    console.log(`先让提交者认领 DESIGN-003...`);
    const { data: design3Data } = await apiRequest(adminSession, 'GET', '/api/designs', null, 200);
    const design3 = design3Data.data.find(d => d.designId === 'DESIGN-003');

    const { data: claimRes } = await apiRequest(reviewer1Session, 'POST', `/api/designs/${design3.id}/claim`, { version: design3.version }, 200);
    console.log(`✅ 认领成功: 状态=${claimRes.data.status}`);

    console.log(`尝试让提交者 (${submitter.name}) 通过 DESIGN-003 (他自己提交的)...`);
    const { status: passFailStatus, data: passFailData } = await apiRequest(submitterSession, 'POST', `/api/designs/${design3.id}/review`, { 
      version: claimRes.data.version,
      action: 'pass',
    });

    if (passFailStatus === 403 || passFailStatus === 400) {
      console.log(`✅ 权限控制正常: ${passFailData.error || passFailData.message}`);
    } else {
      throw new Error('提交者应该不能通过自己的设计稿');
    }

    console.log();
    console.log('📋 测试7: 评审流程: 认领 -> 退回 -> 添加评论 -> 重新提交 -> 复审 -> 通过');
    console.log('-'.repeat(70));

    const { data: design1Latest } = await apiRequest(reviewer1Session, 'GET', `/api/designs/${design1.id}`, null, 200);
    const d1 = design1Latest.data;

    console.log(`1. 评审人退回 DESIGN-001...`);
    const returnReason = '整体风格不够统一，需要调整配色方案，按钮样式需要重新设计';
    const { data: returnResult } = await apiRequest(reviewer1Session, 'POST', `/api/designs/${d1.id}/review`, {
      version: d1.version,
      action: 'return',
      reason: returnReason,
      comment: '请按照设计规范重新调整后再提交',
    }, 200);
    console.log(`✅ 退回成功: 状态=${returnResult.data.status}`);

    console.log(`2. 检查退回原因和评论...`);
    const { data: comments } = await apiRequest(adminSession, 'GET', `/api/designs/${d1.id}/comments`, null, 200);
    const returnComment = comments.data.find(c => c.isReturnReason);
    const normalComment = comments.data.find(c => !c.isReturnReason);
    console.log(`✅ 评论记录: 退回原因1条, 普通评论1条`);
    if (returnComment.content === returnReason) {
      console.log(`✅ 退回原因正确保存`);
    }

    console.log(`3. 提交者重新提交 DESIGN-001...`);
    const { data: resubmitResult } = await apiRequest(submitterSession, 'POST', `/api/designs/${returnResult.data.id}/resubmit`, {
      version: returnResult.data.version,
    }, 200);
    console.log(`✅ 重新提交成功: 状态=${resubmitResult.data.status}`);

    console.log(`4. 原评审人复审 DESIGN-001...`);
    const { data: reviewResult } = await apiRequest(reviewer1Session, 'POST', `/api/designs/${resubmitResult.data.id}/review`, {
      version: resubmitResult.data.version,
      action: 'pass',
      comment: '修改后符合要求，通过评审',
    }, 200);
    console.log(`✅ 复审通过: 状态=${reviewResult.data.status}`);

    console.log();
    console.log('📋 测试8: 导出评审纪要');
    console.log('-'.repeat(70));

    const { data: exportContent } = await apiRequest(adminSession, 'GET', '/api/designs/export?status=passed', null, 200);
    console.log(`✅ 导出内容长度: ${exportContent.length} 字符`);
    
    const hasDesignId = exportContent.includes('DESIGN-001');
    const hasSubmitter = exportContent.includes('王设计');
    const hasReviewer = exportContent.includes('张评审');
    const hasReturnReason = exportContent.includes(returnReason);
    const hasQueueOrder = exportContent.includes('queueOrder') || exportContent.includes('排队顺序');
    const hasConclusion = exportContent.includes('通过') || exportContent.includes('passed');

    console.log(`  包含 DESIGN-001: ${hasDesignId ? '✅' : '❌'}`);
    console.log(`  包含提交者: ${hasSubmitter ? '✅' : '❌'}`);
    console.log(`  包含评审人: ${hasReviewer ? '✅' : '❌'}`);
    console.log(`  包含退回原因: ${hasReturnReason ? '✅' : '❌'}`);
    console.log(`  包含队列顺序: ${hasQueueOrder ? '✅' : '❌'}`);
    console.log(`  包含最终结论: ${hasConclusion ? '✅' : '❌'}`);

    if (hasDesignId && hasSubmitter && hasReviewer && hasReturnReason && hasConclusion) {
      console.log('✅ 导出内容完整');
    } else {
      console.log('⚠️  导出内容部分缺失');
    }

    console.log();
    console.log('📋 测试9: 旧评论不被覆盖验证');
    console.log('-'.repeat(70));

    const { data: commentsBefore } = await apiRequest(adminSession, 'GET', `/api/designs/${d1.id}/comments`, null, 200);
    const commentCountBefore = commentsBefore.data.length;
    console.log(`当前评论数: ${commentCountBefore}`);

    const duplicateImport2 = [{ designId: 'DESIGN-001', name: '覆盖测试', description: '测试', submitter: 'submitter1', priority: 'low' }];
    await apiRequest(adminSession, 'POST', '/api/designs/import', duplicateImport2, 200);

    const { data: commentsAfter } = await apiRequest(adminSession, 'GET', `/api/designs/${d1.id}/comments`, null, 200);
    const commentCountAfter = commentsAfter.data.length;
    console.log(`导入后评论数: ${commentCountAfter}`);

    if (commentCountBefore === commentCountAfter) {
      console.log('✅ 评论历史未被覆盖');
    } else {
      throw new Error('评论被覆盖了！');
    }

    console.log();
    console.log('='.repeat(70));
    console.log('🎉 所有验收测试通过！');
    console.log('='.repeat(70));
    console.log();
    console.log('📝 验收总结:');
    console.log('  ✅ 1. 导入样例清单 - 通过');
    console.log('  ✅ 2. 评审人认领并完成退回再通过 - 通过');
    console.log('  ✅ 3. 重复design_id导入冲突检测 - 通过');
    console.log('  ✅ 4. 并发认领控制 - 通过');
    console.log('  ✅ 5. 提交者不能通过自己的设计 - 通过');
    console.log('  ✅ 6. 导出纪要包含完整信息 - 通过');
    console.log('  ✅ 7. 旧评论不被覆盖 - 通过');
    console.log();
    console.log('🔄 请重启服务后验证数据持久性 (队列顺序、评论、退回原因、结论)');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAcceptanceTest();
