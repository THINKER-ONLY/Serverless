const http = require('http');

// 配置项
const config = {
  host: 'localhost',
  port: 3000,
  totalRequests: 1000,  // 总请求数
  concurrency: 100,     // 并发数
  timeout: 5000,        // 超时时间(毫秒)
  endpoints: [
    '/hello',
    `/weather?city=${encodeURIComponent('北京')}`,
    '/calculate?a=10&b=5&op=add',
    `/echo?message=${encodeURIComponent('测试消息')}`
  ]
};

// 记录测试结果
const results = {
  completed: 0,
  successful: 0,
  failed: 0,
  timeouts: 0,
  totalTime: 0,
  minTime: Infinity,
  maxTime: 0,
  responseTimes: [],
  errors: {}
};

// 开始测试时间
const startTime = Date.now();

// 随机选择一个端点
function getRandomEndpoint() {
  const index = Math.floor(Math.random() * config.endpoints.length);
  return config.endpoints[index];
}

// 记录活跃请求数
let activeRequests = 0;

// 发送单个请求
function sendRequest() {
  const endpoint = getRandomEndpoint();
  const requestStart = Date.now();
  
  // 增加活跃请求计数
  activeRequests++;
  
  // 创建请求对象
  const req = http.request({
    host: config.host,
    port: config.port,
    path: endpoint,
    method: 'GET',
    timeout: config.timeout
  }, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      // 减少活跃请求计数
      activeRequests--;
      
      const responseTime = Date.now() - requestStart;
      results.responseTimes.push(responseTime);
      results.totalTime += responseTime;
      results.minTime = Math.min(results.minTime, responseTime);
      results.maxTime = Math.max(results.maxTime, responseTime);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        results.successful++;
      } else {
        results.failed++;
        const errorKey = `${res.statusCode} on ${endpoint}`;
        results.errors[errorKey] = (results.errors[errorKey] || 0) + 1;
      }
      
      handleRequestCompletion();
    });
  });
  
  req.on('error', (error) => {
    // 减少活跃请求计数
    activeRequests--;
    
    results.failed++;
    const errorKey = `${error.code || error.message} on ${endpoint}`;
    results.errors[errorKey] = (results.errors[errorKey] || 0) + 1;
    handleRequestCompletion();
  });
  
  req.on('timeout', () => {
    req.destroy();
    
    // 减少活跃请求计数
    activeRequests--;
    
    results.timeouts++;
    results.failed++;
    const errorKey = `TIMEOUT on ${endpoint}`;
    results.errors[errorKey] = (results.errors[errorKey] || 0) + 1;
    handleRequestCompletion();
  });
  
  req.end();
}

// 处理请求完成后的逻辑
function handleRequestCompletion() {
  results.completed++;
  
  // 如果所有请求已完成，输出结果
  if (results.completed >= config.totalRequests) {
    printResults();
  } else if (results.completed % 100 === 0) {
    // 每100个请求打印一次进度
    console.log(`已完成 ${results.completed}/${config.totalRequests} 请求...`);
  }
  
  // 如果尚未达到总请求数且活跃请求数低于并发限制，继续发送
  if (results.completed + activeRequests < config.totalRequests && 
      activeRequests < config.concurrency) {
    // 计算可以发送的批量请求数
    const batchSize = Math.min(
      config.concurrency - activeRequests,
      config.totalRequests - results.completed - activeRequests
    );
    
    // 批量发送请求
    for (let i = 0; i < batchSize; i++) {
      sendRequest();
    }
  }
}

// 打印测试结果
function printResults() {
  const totalTime = Date.now() - startTime;
  const avgTime = results.totalTime / results.completed;
  
  console.log('\n===== 弹性测试结果 =====');
  console.log(`总请求数: ${config.totalRequests}`);
  console.log(`并发数: ${config.concurrency}`);
  console.log(`成功请求数: ${results.successful}`);
  console.log(`失败请求数: ${results.failed}`);
  console.log(`超时请求数: ${results.timeouts}`);
  console.log(`成功率: ${(results.successful / config.totalRequests * 100).toFixed(2)}%`);
  console.log(`总测试时间: ${(totalTime / 1000).toFixed(2)}秒`);
  console.log(`平均响应时间: ${avgTime.toFixed(2)}毫秒`);
  console.log(`最小响应时间: ${results.minTime}毫秒`);
  console.log(`最大响应时间: ${results.maxTime}毫秒`);
  console.log(`请求频率: ${(config.totalRequests / (totalTime / 1000)).toFixed(2)}请求/秒`);
  
  if (Object.keys(results.errors).length > 0) {
    console.log('\n错误详情:');
    for (const [key, count] of Object.entries(results.errors)) {
      console.log(`  ${key}: ${count}次`);
    }
  }
  
  console.log('\n响应时间分布:');
  const times = [10, 50, 100, 250, 500, 1000, 2000, 5000];
  for (const time of times) {
    const count = results.responseTimes.filter(rt => rt <= time).length;
    console.log(`  <= ${time}ms: ${(count / results.responseTimes.length * 100).toFixed(2)}%`);
  }
  
  process.exit(0);
}

// 启动测试
console.log(`开始弹性测试 - 共 ${config.totalRequests} 请求，并发数 ${config.concurrency}`);

// 启动初始并发请求
const initialBatchSize = Math.min(config.concurrency, config.totalRequests);
for (let i = 0; i < initialBatchSize; i++) {
  sendRequest();
} 