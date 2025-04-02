#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

// 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 测试配置
const config = {
  host: 'localhost',
  port: 3000,
  // 总测试时间（毫秒）
  testDuration: 3 * 60 * 1000, // 3分钟，减少测试时间
  // 波动周期（毫秒）
  wavePeriod: 30 * 1000, // 30秒一个周期，更快的波动周期
  // 最大并发请求数
  maxConcurrency: 150, // 增加最大并发数
  // 最小并发请求数
  minConcurrency: 2, // 降低最小并发数
  // 请求超时时间（毫秒）
  timeout: 10000,
  // 输出统计信息的间隔（毫秒）
  statsInterval: 3000, // 更频繁地显示状态
  // 用于测试的函数列表
  functions: [
    {
      name: 'hello',
      endpoints: [
        '/',
        '/?name=张三',
        '/?name=李四',
        '/?name=王五'
      ],
      weight: 10
    },
    {
      name: 'echo',
      endpoints: [
        '/?text=你好世界',
        '/?text=' + encodeURIComponent('这是一个测试'),
        '/?text=' + encodeURIComponent('弹性扩缩容测试'),
        '/?text=' + encodeURIComponent('自动扩展能力')
      ],
      weight: 20
    },
    {
      name: 'weather',
      endpoints: [
        '/',
        '/?city=' + encodeURIComponent('北京'),
        '/?city=' + encodeURIComponent('上海'),
        '/?city=' + encodeURIComponent('广州'),
        '/?city=' + encodeURIComponent('深圳'),
        '/?city=' + encodeURIComponent('杭州')
      ],
      weight: 30
    },
    {
      name: 'calculate',
      endpoints: [
        '/?a=10&b=5&op=add',
        '/?a=10&b=5&op=subtract',
        '/?a=10&b=5&op=multiply',
        '/?a=10&b=5&op=divide'
      ],
      weight: 40
    }
  ],
  // 日志文件
  logFile: path.join(__dirname, 'logs', 'wave-loadtest.log')
};

// 确保日志目录存在
const logDir = path.dirname(config.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建日志流
const logStream = fs.createWriteStream(config.logFile, { flags: 'a' });

// 测试统计数据
const stats = {
  startTime: null,
  endTime: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeoutRequests: 0,
  responseTimes: [],
  errors: {},
  requestsPerSecond: [],
  concurrency: [],
  functionStats: {}
};

// 初始化函数统计
config.functions.forEach(func => {
  stats.functionStats[func.name] = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeoutRequests: 0,
    responseTimes: []
  };
});

// 当前活跃请求数
let activeRequests = 0;

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

// 获取当前时间
function now() {
  return Date.now();
}

// 计算当前应该的并发数（基于波动模式）
function getCurrentConcurrency() {
  const elapsed = now() - stats.startTime;
  const position = (elapsed % config.wavePeriod) / config.wavePeriod;
  
  // 使用组合波形（正弦+额外波峰）计算当前并发数，使波动更剧烈
  const amplitude = (config.maxConcurrency - config.minConcurrency) / 2;
  const offset = config.minConcurrency + amplitude;
  
  // 基本正弦波
  let concurrency = offset + amplitude * Math.sin(position * Math.PI * 2);
  
  // 添加额外波峰，使波形更加不规则
  if (position > 0.7 && position < 0.8) {
    concurrency = config.maxConcurrency; // 短暂尖峰
  } else if (position > 0.3 && position < 0.4) {
    concurrency = config.minConcurrency; // 短暂低谷
  }
  
  return Math.round(concurrency);
}

// 选择一个随机函数和端点
function selectRandomEndpoint() {
  // 根据权重选择函数
  const totalWeight = config.functions.reduce((sum, func) => sum + func.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedFunc = null;
  
  for (const func of config.functions) {
    random -= func.weight;
    if (random <= 0) {
      selectedFunc = func;
      break;
    }
  }
  
  // 如果没有选中（理论上不会发生），选择最后一个
  if (!selectedFunc) {
    selectedFunc = config.functions[config.functions.length - 1];
  }
  
  // 从选中的函数中随机选择一个端点
  const endpoint = selectedFunc.endpoints[Math.floor(Math.random() * selectedFunc.endpoints.length)];
  
  return {
    functionName: selectedFunc.name,
    endpoint: endpoint
  };
}

// 发送单个请求
function sendRequest() {
  const { functionName, endpoint } = selectRandomEndpoint();
  const url = `http://${config.host}:${config.port}/${functionName}${endpoint}`;
  const startTime = now();
  
  // 增加活跃请求计数
  activeRequests++;
  
  // 记录总请求数
  stats.totalRequests++;
  stats.functionStats[functionName].totalRequests++;
  
  // 同时通知自动扩展监控
  notifyAutoscaler(functionName);
  
  const req = http.get(url, { timeout: config.timeout }, (res) => {
    const responseTime = now() - startTime;
    
    let data = '';
    res.on('data', chunk => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        // 添加调试输出
        if (stats.totalRequests % 100 === 0) {
          log(`${colors.magenta}调试: 请求响应数据 ${url} -> ${data}${colors.reset}`);
        }
        
        // 修改判断逻辑：检查success字段或没有error字段都算成功
        if (response.success === true || (!response.error && !response.success)) {
          // 成功请求
          stats.successfulRequests++;
          stats.functionStats[functionName].successfulRequests++;
          stats.responseTimes.push(responseTime);
          stats.functionStats[functionName].responseTimes.push(responseTime);
        } else {
          // 失败请求
          stats.failedRequests++;
          stats.functionStats[functionName].failedRequests++;
          
          const errorKey = `FUNC_ERROR`;
          stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
        }
      } catch (error) {
        // JSON解析失败，视为请求失败
        stats.failedRequests++;
        stats.functionStats[functionName].failedRequests++;
        
        if (stats.totalRequests % 100 === 0) {
          log(`${colors.red}调试: JSON解析失败 ${url} -> ${data} -> ${error.message}${colors.reset}`);
        }
        
        const errorKey = 'INVALID_JSON';
        stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
      }
      
      // 减少活跃请求计数
      activeRequests--;
    });
  });
  
  req.on('error', (error) => {
    const responseTime = now() - startTime;
    
    // 失败请求
    stats.failedRequests++;
    stats.functionStats[functionName].failedRequests++;
    
    const errorKey = error.code || 'UNKNOWN_ERROR';
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    
    // 减少活跃请求计数
    activeRequests--;
  });
  
  req.on('timeout', () => {
    req.destroy();
    
    // 记录超时的请求
    stats.timeoutRequests++;
    stats.functionStats[functionName].timeoutRequests++;
    stats.failedRequests++;
    stats.functionStats[functionName].failedRequests++;
    
    const errorKey = 'TIMEOUT';
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    
    // 减少活跃请求计数
    activeRequests--;
  });
}

// 通知自动扩展监控
function notifyAutoscaler(functionName) {
  // 发送请求到自动扩展监控
  const autoscalerUrl = `http://${config.host}:${config.port + 1}/${functionName}`;
  
  http.get(autoscalerUrl, { timeout: 1000 }).on('error', () => {
    // 忽略错误，不影响主测试流程
  });
}

// 打印当前测试状态
function printStatus() {
  const elapsed = now() - stats.startTime;
  const elapsedSeconds = elapsed / 1000;
  const percentComplete = Math.min(100, (elapsed / config.testDuration) * 100).toFixed(1);
  const successRate = (stats.successfulRequests / stats.totalRequests * 100).toFixed(2);
  const rps = (stats.totalRequests / elapsedSeconds).toFixed(2);
  
  // 记录当前统计数据
  stats.requestsPerSecond.push(parseFloat(rps));
  stats.concurrency.push(activeRequests);
  
  log(`${colors.blue}测试进度: ${percentComplete}% (${Math.floor(elapsedSeconds)}秒/${config.testDuration/1000}秒)${colors.reset}`);
  log(`${colors.green}当前并发数目标: ${getCurrentConcurrency()}, 活跃请求: ${activeRequests}${colors.reset}`);
  log(`${colors.cyan}总请求数: ${stats.totalRequests}, 成功率: ${successRate}%, 每秒请求: ${rps}${colors.reset}`);
  
  // 打印每个函数的统计数据
  log(`${colors.yellow}函数统计:${colors.reset}`);
  Object.keys(stats.functionStats).forEach(functionName => {
    const funcStats = stats.functionStats[functionName];
    const funcSuccessRate = (funcStats.successfulRequests / (funcStats.totalRequests || 1) * 100).toFixed(2);
    const funcAvgResponseTime = funcStats.responseTimes.length > 0 
      ? (funcStats.responseTimes.reduce((a, b) => a + b, 0) / funcStats.responseTimes.length).toFixed(2)
      : 0;
    
    log(`  - ${functionName}: 请求=${funcStats.totalRequests}, 成功率=${funcSuccessRate}%, 平均响应时间=${funcAvgResponseTime}ms`);
  });
  
  log('');
}

// 打印最终测试结果
function printResults() {
  const totalTime = (stats.endTime - stats.startTime) / 1000;
  
  // 计算统计数据
  const avgResponseTime = stats.responseTimes.length > 0 
    ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
    : 0;
  
  const minResponseTime = stats.responseTimes.length > 0 
    ? Math.min(...stats.responseTimes)
    : 0;
  
  const maxResponseTime = stats.responseTimes.length > 0
    ? Math.max(...stats.responseTimes)
    : 0;
  
  const avgRequestsPerSecond = stats.requestsPerSecond.length > 0
    ? stats.requestsPerSecond.reduce((a, b) => a + b, 0) / stats.requestsPerSecond.length
    : 0;
  
  const peakRequestsPerSecond = stats.requestsPerSecond.length > 0
    ? Math.max(...stats.requestsPerSecond)
    : 0;
  
  const avgConcurrency = stats.concurrency.length > 0
    ? stats.concurrency.reduce((a, b) => a + b, 0) / stats.concurrency.length
    : 0;
  
  const peakConcurrency = stats.concurrency.length > 0
    ? Math.max(...stats.concurrency)
    : 0;
  
  // 计算响应时间分布
  const distribution = {};
  const timeRanges = [10, 50, 100, 250, 500, 1000, 2000, 5000];
  
  timeRanges.forEach(range => {
    const count = stats.responseTimes.filter(time => time <= range).length;
    distribution[range] = (count / stats.responseTimes.length * 100).toFixed(2);
  });
  
  // 输出结果
  log(`\n${colors.cyan}============================${colors.reset}`);
  log(`${colors.cyan}     波动负载测试结果       ${colors.reset}`);
  log(`${colors.cyan}============================${colors.reset}`);
  log(`${colors.green}总请求数: ${stats.totalRequests}${colors.reset}`);
  log(`${colors.green}最大目标并发数: ${config.maxConcurrency}${colors.reset}`);
  log(`${colors.green}成功请求数: ${stats.successfulRequests}${colors.reset}`);
  log(`${colors.green}失败请求数: ${stats.failedRequests}${colors.reset}`);
  log(`${colors.green}超时请求数: ${stats.timeoutRequests}${colors.reset}`);
  log(`${colors.green}成功率: ${(stats.successfulRequests / stats.totalRequests * 100).toFixed(2)}%${colors.reset}`);
  log(`${colors.green}总测试时间: ${totalTime.toFixed(2)}秒${colors.reset}`);
  log(`${colors.green}平均响应时间: ${avgResponseTime.toFixed(2)}毫秒${colors.reset}`);
  log(`${colors.green}最小响应时间: ${minResponseTime}毫秒${colors.reset}`);
  log(`${colors.green}最大响应时间: ${maxResponseTime}毫秒${colors.reset}`);
  log(`${colors.green}平均请求频率: ${avgRequestsPerSecond.toFixed(2)}请求/秒${colors.reset}`);
  log(`${colors.green}峰值请求频率: ${peakRequestsPerSecond.toFixed(2)}请求/秒${colors.reset}`);
  log(`${colors.green}平均并发数: ${avgConcurrency.toFixed(2)}${colors.reset}`);
  log(`${colors.green}峰值并发数: ${peakConcurrency}${colors.reset}`);
  
  log(`\n${colors.yellow}响应时间分布:${colors.reset}`);
  timeRanges.forEach(range => {
    log(`  <= ${range}ms: ${distribution[range]}%`);
  });
  
  if (Object.keys(stats.errors).length > 0) {
    log(`\n${colors.red}错误统计:${colors.reset}`);
    Object.keys(stats.errors).forEach(error => {
      log(`  ${error}: ${stats.errors[error]}次`);
    });
  }
  
  log(`\n${colors.yellow}函数统计:${colors.reset}`);
  Object.keys(stats.functionStats).forEach(functionName => {
    const funcStats = stats.functionStats[functionName];
    const funcAvgResponseTime = funcStats.responseTimes.length > 0 
      ? (funcStats.responseTimes.reduce((a, b) => a + b, 0) / funcStats.responseTimes.length).toFixed(2)
      : 0;
    
    log(`  ${functionName}:`);
    log(`    - 总请求数: ${funcStats.totalRequests}`);
    log(`    - 成功请求数: ${funcStats.successfulRequests}`);
    log(`    - 失败请求数: ${funcStats.failedRequests}`);
    log(`    - 超时请求数: ${funcStats.timeoutRequests}`);
    log(`    - 成功率: ${(funcStats.successfulRequests / (funcStats.totalRequests || 1) * 100).toFixed(2)}%`);
    log(`    - 平均响应时间: ${funcAvgResponseTime}毫秒`);
  });
  
  log(`\n${colors.cyan}测试完成，结果已保存到 ${config.logFile}${colors.reset}`);
}

// 运行负载测试
async function runLoadTest() {
  log(`${colors.green}开始波动负载测试...${colors.reset}`);
  log(`${colors.blue}测试时长: ${config.testDuration / 1000 / 60}分钟${colors.reset}`);
  log(`${colors.blue}波动周期: ${config.wavePeriod / 1000}秒${colors.reset}`);
  log(`${colors.blue}并发范围: ${config.minConcurrency} - ${config.maxConcurrency}${colors.reset}`);
  log(``);
  
  // 记录开始时间
  stats.startTime = now();
  
  // 打印状态的定时器
  const statusInterval = setInterval(printStatus, config.statsInterval);
  
  // 测试循环
  while (now() - stats.startTime < config.testDuration) {
    // 获取当前应该的并发数
    const targetConcurrency = getCurrentConcurrency();
    
    // 发送请求以达到目标并发数
    while (activeRequests < targetConcurrency) {
      sendRequest();
    }
    
    // 小暂停让其他请求有机会完成
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // 等待所有活跃请求完成
  while (activeRequests > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 清除状态定时器
  clearInterval(statusInterval);
  
  // 记录结束时间
  stats.endTime = now();
  
  // 打印最终结果
  printResults();
  
  // 关闭日志流
  logStream.end();
}

// 运行测试
runLoadTest().catch(error => {
  log(`${colors.red}测试过程中出错: ${error.message}${colors.reset}`);
  logStream.end();
}); 