const http = require('http');
const querystring = require('querystring');

// 配置项
const config = {
  host: 'localhost',
  port: 3000,
  totalRequests: 1000,  // 总请求数
  concurrency: 100,     // 并发数
  timeout: 5000,        // 超时时间(毫秒)
  endpoints: [
    '/hello',
    '/weather?city=' + encodeURIComponent('北京'),
    '/calculate?a=10&b=5&op=add',
    '/echo?message=' + encodeURIComponent('测试消息')
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

// 发送单个请求
function sendRequest() {
  const endpoint = getRandomEndpoint();
  const requestStart = Date.now();
  
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
    results.failed++;
    const errorKey = `${error.code || error.message} on ${endpoint}`;
    results.errors[errorKey] = (results.errors[errorKey] || 0) + 1;
    handleRequestCompletion();
  });
  
  req.on('timeout', () => {
    req.destroy();
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
  
  // 如果尚未达到总请求数，继续发送
  if (results.completed + activeRequests < config.totalRequests) {
    sendRequest();
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
}
