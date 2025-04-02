const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  host: 'localhost',
  port: 3000,
  testDuration: 5 * 60 * 1000,  // 测试持续时间，默认5分钟
  intervalBetweenTests: 30 * 1000,  // 测试间隔，默认30秒
  endpoints: [
    '/hello',
    '/weather?city=北京',
    '/calculate?a=10&b=5&op=add',
    '/echo?message=测试消息'
  ]
};

// 记录测试结果
const results = [];
const logFile = path.join(__dirname, 'coldstart-results.json');

// 重启服务器
async function restartServer() {
  console.log('正在重启服务器...');
  
  try {
    // 关闭服务器进程
    await executeCommand('pkill -f "node server.js"');
    console.log('服务器已停止');
    
    // 等待一段时间确保彻底关闭
    await sleep(2000);
    
    // 重新启动服务器（后台运行）
    await executeCommand('node server.js &');
    console.log('服务器已重启');
    
    // 等待服务器完全启动
    await sleep(3000);
  } catch (error) {
    console.error('重启服务器失败:', error);
  }
}

// 执行命令的Promise包装
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试单个端点的冷启动时间
async function testColdStart(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.request({
      host: config.host,
      port: config.port,
      path: endpoint,
      method: 'GET',
      timeout: 10000 // 10秒超时
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          endpoint,
          responseTime,
          statusCode: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300,
          timestamp: new Date().toISOString()
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        endpoint,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        endpoint,
        error: 'Timeout',
        success: false,
        timestamp: new Date().toISOString()
      });
    });
    
    req.end();
  });
}

// 运行测试
async function runTests() {
  const startTime = Date.now();
  console.log(`开始冷启动测试，将持续约 ${config.testDuration / 60000} 分钟`);
  
  while (Date.now() - startTime < config.testDuration) {
    // 重启服务器，模拟冷启动
    await restartServer();
    
    // 测试每个端点
    for (const endpoint of config.endpoints) {
      console.log(`测试端点: ${endpoint}`);
      const result = await testColdStart(endpoint);
      results.push(result);
      
      if (result.success) {
        console.log(`  响应时间: ${result.responseTime}ms, 状态: ${result.statusCode}`);
      } else {
        console.log(`  失败: ${result.error || '未知错误'}`);
      }
    }
    
    // 保存当前结果
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
    console.log(`结果已保存到 ${logFile}`);
    
    // 等待下一轮测试
    console.log(`等待 ${config.intervalBetweenTests / 1000} 秒进行下一轮测试...`);
    await sleep(config.intervalBetweenTests);
  }
  
  // 汇总并显示结果
  summarizeResults();
}

// 汇总结果
function summarizeResults() {
  console.log('\n===== 冷启动测试结果汇总 =====');
  
  // 按端点分组
  const groupedByEndpoint = {};
  
  for (const result of results) {
    if (!groupedByEndpoint[result.endpoint]) {
      groupedByEndpoint[result.endpoint] = [];
    }
    groupedByEndpoint[result.endpoint].push(result);
  }
  
  // 计算每个端点的统计信息
  for (const [endpoint, endpointResults] of Object.entries(groupedByEndpoint)) {
    const successful = endpointResults.filter(r => r.success);
    
    if (successful.length === 0) {
      console.log(`\n${endpoint}:`);
      console.log('  所有请求均失败');
      continue;
    }
    
    const responseTimes = successful.map(r => r.responseTime);
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minTime = Math.min(...responseTimes);
    const maxTime = Math.max(...responseTimes);
    
    console.log(`\n${endpoint}:`);
    console.log(`  成功率: ${(successful.length / endpointResults.length * 100).toFixed(2)}%`);
    console.log(`  平均冷启动时间: ${avgTime.toFixed(2)}ms`);
    console.log(`  最小冷启动时间: ${minTime}ms`);
    console.log(`  最大冷启动时间: ${maxTime}ms`);
    console.log(`  测试次数: ${endpointResults.length}`);
  }
  
  console.log('\n测试完成。');
}

// 启动测试
runTests().catch(error => {
  console.error('测试过程中发生错误:', error);
}); 