#!/usr/bin/env node

const http = require('http');
const url = require('url');
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

// 配置
const config = {
  port: 3000,
  functionDir: path.join(__dirname, 'functions'),
  logDir: path.join(__dirname, 'logs'),
  maxConcurrentRequests: 100,
  functionTimeout: 5000, // 毫秒
  coldStartDelay: 100,   // 默认冷启动延迟(毫秒)
  autoscalerPort: 3001   // 自动扩展监控端口
};

// 确保日志目录存在
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

// 日志文件
const logFile = path.join(config.logDir, 'server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// 记录日志
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

// 函数实例跟踪
const functionInstances = {};
const functionStats = {};
const activeFunctionRequests = {};

// 加载函数
function loadFunction(functionName) {
  try {
    const functionPath = path.join(config.functionDir, `${functionName}.js`);
    if (!fs.existsSync(functionPath)) {
      return null;
    }
    
    // 清除缓存以确保重新加载最新版本
    delete require.cache[require.resolve(functionPath)];
    return require(functionPath);
  } catch (error) {
    log(`${colors.red}加载函数 ${functionName} 时出错: ${error.message}${colors.reset}`);
    return null;
  }
}

// 初始化函数
function initializeFunctions() {
  log(`${colors.blue}初始化函数...${colors.reset}`);
  
  // 读取函数目录中的所有 .js 文件
  const functionFiles = fs.readdirSync(config.functionDir)
    .filter(file => file.endsWith('.js'));
  
  functionFiles.forEach(file => {
    const functionName = path.basename(file, '.js');
    
    // 初始化函数实例计数和统计信息
    functionInstances[functionName] = {
      instances: 1, // 默认初始实例数
      coldStarts: 0, // 冷启动次数
      lastAccessed: Date.now() // 上次访问时间
    };
    
    functionStats[functionName] = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0
    };
    
    activeFunctionRequests[functionName] = 0;
    
    log(`${colors.green}已加载函数: ${functionName}${colors.reset}`);
  });
  
  log(`${colors.blue}共加载了 ${functionFiles.length} 个函数${colors.reset}`);
}

// 通知自动扩展监控
function notifyAutoscaler(functionName) {
  const options = {
    hostname: 'localhost',
    port: config.autoscalerPort,
    path: `/${functionName}`,
    method: 'GET'
  };
  
  // 改进通知方式，增加重试和日志
  let retries = 0;
  const maxRetries = 3;
  
  const sendNotification = () => {
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        log(`${colors.green}成功通知自动扩展监控: ${functionName}${colors.reset}`);
      } else {
        log(`${colors.yellow}通知自动扩展监控的状态码异常: ${res.statusCode} (${functionName})${colors.reset}`);
        if (retries < maxRetries) {
          retries++;
          setTimeout(sendNotification, 100);
        }
      }
    });
    
    req.on('error', (error) => {
      log(`${colors.red}通知自动扩展监控失败: ${error.message} (${functionName})${colors.reset}`);
      if (retries < maxRetries) {
        retries++;
        setTimeout(sendNotification, 100);
      }
    });
    
    req.end();
  };
  
  sendNotification();
}

// 模拟冷启动延迟
async function simulateColdStart(functionName) {
  // 检查是否需要冷启动
  const now = Date.now();
  const instance = functionInstances[functionName];
  const idleThreshold = 30000; // 30秒不活动视为冷启动
  
  let coldStartDelay = 0;
  
  if (now - instance.lastAccessed > idleThreshold) {
    coldStartDelay = config.coldStartDelay * (1 + Math.random());
    instance.coldStarts++;
    log(`${colors.yellow}函数 ${functionName} 冷启动 (延迟: ${coldStartDelay.toFixed(2)}ms)${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, coldStartDelay));
  }
  
  // 更新最后访问时间
  instance.lastAccessed = now;
  return coldStartDelay;
}

// 处理函数请求
async function handleFunctionRequest(req, res, functionName, queryParams) {
  const func = loadFunction(functionName);
  
  if (!func) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ 
      error: 'Function not found',
      message: `函数 ${functionName} 不存在` 
    }));
    return;
  }
  
  // 通知自动扩展监控
  notifyAutoscaler(functionName);
  
  // 更新活动请求计数
  activeFunctionRequests[functionName]++;
  
  // 开始计时
  const startTime = Date.now();
  
  // 模拟冷启动延迟
  const coldStartDelay = await simulateColdStart(functionName);
  
  try {
    // 设置超时
    const timeoutId = setTimeout(() => {
      if (!res.writableEnded) {
        res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
          error: 'Timeout',
          message: `函数 ${functionName} 执行超时` 
        }));
        
        // 更新统计信息（确保这里也只更新一次）
        if (!functionStats[functionName].totalRequests) {
          functionStats[functionName].totalRequests++;
          functionStats[functionName].failedRequests++;
        }
        
        // 减少活动请求计数
        activeFunctionRequests[functionName]--;
      }
    }, config.functionTimeout);
    
    // 使用 Promise 包装函数执行
    const result = await new Promise(async (resolve) => {
      try {
        log(`${colors.blue}执行函数 ${functionName} 开始${colors.reset}`);
        const functionResult = await Promise.resolve(func(req, queryParams));
        log(`${colors.green}函数 ${functionName} 执行结果: ${JSON.stringify(functionResult)}${colors.reset}`);
        resolve(functionResult);
      } catch (error) {
        log(`${colors.red}函数 ${functionName} 执行错误: ${error.message}${colors.reset}`);
        resolve({ 
          error: 'Function execution error',
          message: error.message 
        });
      }
    });
    
    // 清除超时定时器
    clearTimeout(timeoutId);
    
    // 如果已经发送了响应（超时），则不再继续
    if (res.writableEnded) {
      log(`${colors.yellow}函数 ${functionName} 响应已结束（可能是超时）${colors.reset}`);
      return;
    }
    
    // 计算响应时间
    const responseTime = Date.now() - startTime - coldStartDelay;
    
    // 更新统计信息（只在这里更新一次）
    functionStats[functionName].totalRequests++;
    
    // 只有当结果中没有error字段时才计为成功请求
    if (!result.error) {
      log(`${colors.green}函数 ${functionName} 执行成功，响应时间: ${responseTime}ms${colors.reset}`);
      functionStats[functionName].successfulRequests++;
      functionStats[functionName].totalResponseTime += responseTime;
      functionStats[functionName].avgResponseTime = 
        functionStats[functionName].totalResponseTime / functionStats[functionName].successfulRequests;
      
      functionStats[functionName].minResponseTime = 
        Math.min(functionStats[functionName].minResponseTime, responseTime);
      
      functionStats[functionName].maxResponseTime = 
        Math.max(functionStats[functionName].maxResponseTime, responseTime);
    } else {
      log(`${colors.red}函数 ${functionName} 执行失败: ${result.error}${colors.reset}`);
      functionStats[functionName].failedRequests++;
    }
    
    // 发送响应，显式设置正确的UTF-8编码
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    // 确保中文被正确输出
    const jsonString = JSON.stringify(result);
    res.end(jsonString);
    
  } catch (error) {
    // 只有在响应未结束时才尝试写入错误
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ 
        error: 'Server error',
        message: error.message 
      }));
      
      // 更新统计信息（确保这里也只更新一次）
      if (!functionStats[functionName].totalRequests) {
        functionStats[functionName].totalRequests++;
        functionStats[functionName].failedRequests++;
      }
    }
  } finally {
    // 减少活动请求计数
    activeFunctionRequests[functionName]--;
  }
}

// 处理状态请求
function handleStatusRequest(req, res) {
  const status = {
    uptime: process.uptime(),
    functions: {}
  };
  
  Object.keys(functionInstances).forEach(funcName => {
    status.functions[funcName] = {
      instances: functionInstances[funcName].instances,
      activeRequests: activeFunctionRequests[funcName],
      coldStarts: functionInstances[funcName].coldStarts,
      stats: {
        totalRequests: Number(functionStats[funcName].totalRequests),
        successfulRequests: Number(functionStats[funcName].successfulRequests),
        failedRequests: Number(functionStats[funcName].failedRequests),
        totalResponseTime: Number(functionStats[funcName].totalResponseTime),
        avgResponseTime: Number(functionStats[funcName].avgResponseTime),
        minResponseTime: Number(functionStats[funcName].minResponseTime),
        maxResponseTime: Number(functionStats[funcName].maxResponseTime)
      }
    };
  });
  
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(status));
}

// 处理对根路径的请求
function handleRootRequest(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Serverless 函数服务</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { color: #333; }
      .function { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
      .function h3 { margin-top: 0; }
      .endpoint { background-color: #f5f5f5; padding: 5px; border-radius: 4px; font-family: monospace; }
      .stats { margin-top: 10px; font-size: 0.9em; color: #666; }
    </style>
  </head>
  <body>
    <h1>Serverless 函数服务</h1>
    
    <h2>可用函数:</h2>
    <div id="functions">载入中...</div>
    
    <script>
      // 获取函数状态
      fetch('/status')
        .then(response => response.json())
        .then(data => {
          const functionsDiv = document.getElementById('functions');
          functionsDiv.innerHTML = '';
          
          Object.keys(data.functions).forEach(functionName => {
            const func = data.functions[functionName];
            const funcDiv = document.createElement('div');
            funcDiv.className = 'function';
            
            const successRate = func.stats.totalRequests === 0 ? 
              100 : 
              (func.stats.successfulRequests / func.stats.totalRequests * 100).toFixed(1);
            
            funcDiv.innerHTML = 
              '<h3>' + functionName + '</h3>' +
              '<div class="endpoint">端点: <a href="/' + functionName + '" target="_blank">/' + functionName + '</a></div>' +
              '<div class="stats">' +
                '<div>实例数: ' + func.instances + '</div>' +
                '<div>活动请求: ' + func.activeRequests + '</div>' +
                '<div>总请求数: ' + func.stats.totalRequests + '</div>' +
                '<div>成功率: ' + successRate + '%</div>' +
                '<div>平均响应时间: ' + func.stats.avgResponseTime.toFixed(2) + ' ms</div>' +
                '<div>冷启动次数: ' + func.coldStarts + '</div>' +
              '</div>';
            
            functionsDiv.appendChild(funcDiv);
          });
        })
        .catch(error => {
          document.getElementById('functions').innerHTML = '<div class="error">加载失败: ' + error.message + '</div>';
        });
    </script>
  </body>
  </html>
  `);
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  // 添加CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // 解码URL中的中文参数
  const decodedQuery = {};
  Object.keys(parsedUrl.query).forEach(key => {
    try {
      decodedQuery[key] = decodeURIComponent(parsedUrl.query[key]);
    } catch (e) {
      decodedQuery[key] = parsedUrl.query[key];
    }
  });
  
  // 请求日志
  log(`${colors.blue}请求: ${req.method} ${pathname}${colors.reset}`);
  
  try {
    // 处理状态请求
    if (pathname === '/status') {
      handleStatusRequest(req, res);
      return;
    }
    
    // 处理根请求
    if (pathname === '/' || pathname === '/index.html') {
      handleRootRequest(req, res);
      return;
    }
    
    // 提取函数名
    const functionName = pathname.substring(1).split('/')[0];
    
    // 检查函数是否存在
    if (!functionInstances[functionName]) {
      // 尝试读取静态文件
      const staticFilePath = path.join(__dirname, pathname);
      if (fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isFile()) {
        // 简单的静态文件处理
        const fileContent = fs.readFileSync(staticFilePath);
        const extname = path.extname(staticFilePath);
        let contentType = 'text/plain';
        
        switch (extname) {
          case '.html': contentType = 'text/html'; break;
          case '.js': contentType = 'text/javascript'; break;
          case '.css': contentType = 'text/css'; break;
          case '.json': contentType = 'application/json'; break;
          case '.png': contentType = 'image/png'; break;
          case '.jpg': contentType = 'image/jpeg'; break;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fileContent);
        return;
      }
      
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Not Found',
        message: `函数或资源 ${functionName} 不存在` 
      }));
      return;
    }
    
    // 处理函数请求，使用解码后的查询参数
    await handleFunctionRequest(req, res, functionName, decodedQuery);
    
  } catch (error) {
    log(`${colors.red}处理请求时出错: ${error.message}${colors.reset}`);
    
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Server Error',
        message: error.message 
      }));
    }
  }
});

// 启动服务器
function startServer() {
  // 初始化函数
  initializeFunctions();
  
  // 启动HTTP服务器
  server.listen(config.port, () => {
    log(`${colors.green}============================================${colors.reset}`);
    log(`${colors.green}      Serverless 函数服务已启动      ${colors.reset}`);
    log(`${colors.green}============================================${colors.reset}`);
    log(`${colors.green}服务器运行在: http://localhost:${config.port}${colors.reset}`);
    log(`${colors.green}自动扩展监控连接端口: ${config.autoscalerPort}${colors.reset}`);
    log(`${colors.green}可用函数: ${Object.keys(functionInstances).join(', ')}${colors.reset}`);
  });
  
  // 定期打印状态报告
  setInterval(() => {
    log(`\n${colors.cyan}=============== 服务器状态报告 ===============${colors.reset}`);
    log(`${colors.cyan}运行时间: ${process.uptime().toFixed(0)} 秒${colors.reset}`);
    
    log(`${colors.cyan}函数统计:${colors.reset}`);
    Object.keys(functionInstances).forEach(functionName => {
      const stats = functionStats[functionName];
      const successRate = stats.totalRequests === 0 ? 
        100 : 
        (stats.successfulRequests / stats.totalRequests * 100).toFixed(1);
      
      log(`  ${functionName}:`);
      log(`    - 实例数: ${functionInstances[functionName].instances}`);
      log(`    - 活动请求: ${activeFunctionRequests[functionName]}`);
      log(`    - 总请求数: ${stats.totalRequests}`);
      log(`    - 成功率: ${successRate}%`);
      log(`    - 平均响应时间: ${stats.avgResponseTime.toFixed(2)}ms`);
      log(`    - 冷启动次数: ${functionInstances[functionName].coldStarts}`);
    });
    
    log(`${colors.cyan}===========================================${colors.reset}\n`);
  }, 60000); // 每分钟打印一次状态报告
  
  // 同步最新的实例数量到自动扩展
  setInterval(() => {
    // 查询自动扩展监控获取最新实例数
    http.get(`http://localhost:${config.autoscalerPort}/status`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const statusData = JSON.parse(data);
          if (statusData && statusData.instances) {
            // 更新本地实例数
            Object.keys(statusData.instances).forEach(functionName => {
              if (functionInstances[functionName]) {
                functionInstances[functionName].instances = statusData.instances[functionName];
              }
            });
          }
        } catch (e) {
          // 忽略错误 - 自动扩展可能未启动
        }
      });
    }).on('error', (e) => {
      // 忽略错误 - 自动扩展可能未启动
    });
  }, 5000); // 每5秒同步一次
}

// 处理进程信号
process.on('SIGTERM', () => {
  log(`${colors.yellow}收到 SIGTERM 信号，正在关闭服务器...${colors.reset}`);
  server.close(() => {
    log(`${colors.yellow}服务器已关闭${colors.reset}`);
    logStream.end();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log(`${colors.yellow}收到 SIGINT 信号，正在关闭服务器...${colors.reset}`);
  server.close(() => {
    log(`${colors.yellow}服务器已关闭${colors.reset}`);
    logStream.end();
    process.exit(0);
  });
});

// 启动服务器
startServer(); 