const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3008;

let testResults = [];
let passed = 0;
let failed = 0;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function testCase(name, testFn) {
  return async () => {
    console.log(`\n▶️  测试: ${name}`);
    try {
      await testFn();
      console.log(`✅  通过: ${name}`);
      testResults.push({ name, status: 'PASS' });
      passed++;
    } catch (err) {
      console.log(`❌  失败: ${name}`);
      console.log(`   错误: ${err.message}`);
      testResults.push({ name, status: 'FAIL', error: err.message });
      failed++;
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

async function runTests() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('       工业气瓶充装追溯 API 服务验证脚本');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`测试时间: ${new Date().toLocaleString()}`);
  console.log(`服务地址: http://${BASE_URL}:${PORT}`);

  try {
    console.log('\n📋 步骤 1: 检查服务健康状态');
    const health = await request('GET', '/api/health');
    assert(health.status === 200, `健康检查失败，状态码: ${health.status}`);
    assert(health.data.success === true, '健康检查返回失败');
    console.log('✅ 服务运行正常');
  } catch (err) {
    console.log('❌ 无法连接到服务，请先启动服务: npm start');
    console.log(`   错误: ${err.message}`);
    process.exit(1);
  }

  let users = [];
  let cylinders = [];
  let operatorId = null;
  let inspectorId = null;
  let deliveryPersonId = null;
  let customerId = null;
  let validCylinderId = null;
  let expiredCylinderId = null;
  let batchId = null;
  let deliveryId = null;

  await testCase('获取用户列表', async () => {
    const res = await request('GET', '/api/users');
    assert(res.status === 200, `状态码异常: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    assert(Array.isArray(res.data.data), '数据格式错误');
    users = res.data.data;
    
    operatorId = users.find(u => u.role === 'operator')?.id;
    inspectorId = users.find(u => u.role === 'inspector')?.id;
    deliveryPersonId = users.find(u => u.role === 'delivery')?.id;
    
    assert(operatorId, '未找到操作员用户');
    assert(inspectorId, '未找到检验员用户');
    assert(deliveryPersonId, '未找到配送员用户');
    console.log(`   操作员ID: ${operatorId}, 检验员ID: ${inspectorId}, 配送员ID: ${deliveryPersonId}`);
  })();

  await testCase('获取客户列表', async () => {
    const res = await request('GET', '/api/customers');
    assert(res.status === 200, `状态码异常: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    assert(Array.isArray(res.data.data), '数据格式错误');
    assert(res.data.data.length > 0, '客户列表为空');
    customerId = res.data.data[0].id;
    console.log(`   客户ID: ${customerId}`);
  })();

  await testCase('获取气瓶列表', async () => {
    const res = await request('GET', '/api/cylinders');
    assert(res.status === 200, `状态码异常: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    assert(Array.isArray(res.data.data), '数据格式错误');
    assert(res.data.data.length >= 2, '气瓶数量不足');
    cylinders = res.data.data;
    
    validCylinderId = cylinders.find(c => c.status === 'idle')?.id;
    expiredCylinderId = cylinders.find(c => c.status === 'expired')?.id;
    
    assert(validCylinderId, '未找到有效气瓶');
    assert(expiredCylinderId, '未找到过期气瓶');
    console.log(`   有效气瓶ID: ${validCylinderId}, 过期气瓶ID: ${expiredCylinderId}`);
  })();

  await testCase('验证过期气瓶检验状态', async () => {
    const res = await request('GET', `/api/inspections/verify/${expiredCylinderId}`);
    assert(res.status === 200, `状态码异常: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    assert(res.data.data.is_expired === true, '过期气瓶检验状态判断错误');
    assert(res.data.data.can_fill === false, '过期气瓶不应允许充装');
    console.log(`   过期气瓶: can_fill=${res.data.data.can_fill}, 过期天数=${res.data.data.days_until_expiry}`);
  })();

  await testCase('验证有效气瓶检验状态', async () => {
    const res = await request('GET', `/api/inspections/verify/${validCylinderId}`);
    assert(res.status === 200, `状态码异常: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    assert(res.data.data.is_expired === false, '有效气瓶检验状态判断错误');
    assert(res.data.data.can_fill === true, '有效气瓶应允许充装');
    console.log(`   有效气瓶: can_fill=${res.data.data.can_fill}, 距过期天数=${res.data.data.days_until_expiry}`);
  })();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  【验收路径】使用过期气瓶登记充装并验证被拒绝');
  console.log('══════════════════════════════════════════════════════════');

  await testCase('验收用例: 过期气瓶充装应被拒绝', async () => {
    const batchRes = await request('POST', '/api/fillings/batches', {
      operator_id: operatorId,
      remarks: '验收测试批次'
    });
    assert(batchRes.status === 201, `创建批次失败: ${batchRes.status}`);
    batchId = batchRes.data.data.id;
    console.log(`   创建充装批次成功, 批次ID: ${batchId}`);

    const fillRes = await request('POST', '/api/fillings/records', {
      batch_id: batchId,
      cylinder_id: expiredCylinderId,
      operator_id: operatorId,
      filling_weight: 5.0
    });
    
    assert(fillRes.status === 400, `过期气瓶充装应返回400，实际: ${fillRes.status}`);
    assert(fillRes.data.success === false, '过期气瓶充装应返回失败');
    assert(fillRes.data.error.includes('过期'), `错误信息应包含'过期'，实际: ${fillRes.data.error}`);
    
    console.log(`   过期气瓶充装被正确拒绝`);
    console.log(`   拒绝原因: ${fillRes.data.error}`);
    console.log(`   ✅ 验收通过: 过期气瓶禁止充装规则生效`);
  })();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  【附加测试】完整业务流程验证');
  console.log('══════════════════════════════════════════════════════════');

  await testCase('有效气瓶正常充装', async () => {
    const fillRes = await request('POST', '/api/fillings/records', {
      batch_id: batchId,
      cylinder_id: validCylinderId,
      operator_id: operatorId,
      filling_weight: 5.0
    });
    
    assert(fillRes.status === 201, `有效气瓶充装应返回201，实际: ${fillRes.status}`);
    assert(fillRes.data.success === true, '有效气瓶充装应成功');
    assert(fillRes.data.data.status === 'approved', '充装状态应为approved');
    console.log(`   有效气瓶充装成功`);
  })();

  await testCase('充装重量超限应报警并拒绝', async () => {
    const cylinder = cylinders.find(c => c.id === validCylinderId);
    const maxAllowed = cylinder.max_weight - cylinder.tare_weight;
    const overweight = maxAllowed + 1.0;
    
    const newCylinder = cylinders.find(c => c.id !== validCylinderId && c.id !== expiredCylinderId && c.status === 'idle');
    if (!newCylinder) {
      console.log('   跳过: 无额外有效气瓶进行超限测试');
      return;
    }

    const fillRes = await request('POST', '/api/fillings/records', {
      batch_id: batchId,
      cylinder_id: newCylinder.id,
      operator_id: operatorId,
      filling_weight: overweight
    });
    
    assert(fillRes.status === 400, `超重充装应返回400，实际: ${fillRes.status}`);
    assert(fillRes.data.data.is_overweight === true, '应标记为超重');
    console.log(`   超重充装被正确拒绝，最大允许: ${maxAllowed}kg，尝试充装: ${overweight}kg`);
  })();

  await testCase('完成充装批次', async () => {
    const res = await request('PUT', `/api/fillings/batches/${batchId}/complete`);
    assert(res.status === 200, `完成批次失败: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    console.log(`   充装批次已完成`);
  })();

  await testCase('创建配送单', async () => {
    const batchRecords = await request('GET', `/api/fillings/batches/${batchId}/records`);
    const approvedRecords = batchRecords.data.data.filter(r => r.status === 'approved');
    
    const cylinderItems = approvedRecords.map(r => ({
      cylinder_id: r.cylinder_id,
      filling_record_id: r.id
    }));

    if (cylinderItems.length === 0) {
      console.log('   跳过: 无已批准的充装记录');
      return;
    }

    const res = await request('POST', '/api/deliveries', {
      delivery_person_id: deliveryPersonId,
      customer_id: customerId,
      cylinder_ids: cylinderItems
    });
    
    assert(res.status === 201, `创建配送单失败: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    deliveryId = res.data.data.id;
    console.log(`   配送单创建成功，配送ID: ${deliveryId}`);
  })();

  await testCase('开始配送', async () => {
    if (!deliveryId) {
      console.log('   跳过: 无配送单');
      return;
    }
    const res = await request('PUT', `/api/deliveries/${deliveryId}/start`);
    assert(res.status === 200, `开始配送失败: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    console.log(`   配送已开始`);
  })();

  await testCase('配送签收后进入客户库存', async () => {
    if (!deliveryId) {
      console.log('   跳过: 无配送单');
      return;
    }
    const res = await request('PUT', `/api/deliveries/${deliveryId}/sign`, {
      signed_by: '客户签收人'
    });
    
    assert(res.status === 200, `签收失败: ${res.status}`);
    assert(res.data.success === true, '返回失败');
    assert(res.data.data.message.includes('已进入客户库存'), '签收后应进入客户库存');
    console.log(`   ${res.data.data.message}`);

    const inventoryRes = await request('GET', `/api/deliveries/inventory/customer/${customerId}`);
    assert(inventoryRes.status === 200, `查询客户库存失败: ${inventoryRes.status}`);
    assert(inventoryRes.data.data.length > 0, '客户库存应有气瓶');
    console.log(`   客户库存气瓶数量: ${inventoryRes.data.data.length}`);
  })();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('                      测试结果汇总');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`总测试数: ${testResults.length}`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('失败的测试:');
    testResults.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！系统验证完成');
    process.exit(0);
  } else {
    console.log('⚠️  部分测试失败，请检查系统');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('\n❌ 测试执行异常:', err.message);
  process.exit(1);
});
