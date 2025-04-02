#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

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
  monitorInterval: 2000, // 2秒监控一次，提高监控频率
  functionDir: path.join(__dirname, 'functions'),
  logDir: path.join(__dirname, 'logs'),
  maxInstancesPerFunction: 10, // 增加最大实例数
  minInstancesPerFunction: 1,
  scaleUpThreshold: 2, // 进一步降低扩容阈值，超过每秒2个请求时扩容
  scaleDownThreshold: 0.5, // 降低缩容阈值，低于每秒0.5个请求时缩容
  metricsWindow: 10, // 进一步缩短统计窗口为10秒，使系统更快反应
  port: 3000
};

// 全局状态
const state = {
  functions: {},
  functionInstances: {},
  functionCalls: {},
  callHistory: {}
};

// 确保日志目录存在
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

// 日志文件
const logFile = path.join(config.logDir, 'auto-scale.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// 记录日志
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

// 初始化函数列表
function initializeFunctions() {
  // 读取函数目录
  log(`${colors.blue}初始化函数列表...${colors.reset}`);
  const functionFiles = fs.readdirSync(config.functionDir)
    .filter(file => file.endsWith('.js'));

  // 初始化每个函数
  for (const functionFile of functionFiles) {
    const functionName = path.basename(functionFile, '.js');
    state.functions[functionName] = {
      name: functionName,
      file: path.join(config.functionDir, functionFile)
    };
    
    state.functionInstances[functionName] = config.minInstancesPerFunction;
    state.functionCalls[functionName] = 0;
    state.callHistory[functionName] = [];
    
    log(`${colors.green}发现函数: ${functionName}${colors.reset}`);
  }
  
  log(`${colors.blue}共发现 ${Object.keys(state.functions).length} 个函数${colors.reset}`);
}

// 获取系统指标
function getSystemMetrics() {
  const cpus = os.cpus();
  const totalCpuTime = cpus.reduce((total, cpu) => {
    return total + Object.values(cpu.times).reduce((t, time) => t + time, 0);
  }, 0);
  const totalIdleTime = cpus.reduce((total, cpu) => total + cpu.times.idle, 0);
  
  // 计算CPU使用率
  const cpuUsage = ((totalCpuTime - totalIdleTime) / totalCpuTime) * 100;
  
  // 计算内存使用率
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  
  // 获取系统负载
  const loadAvg = os.loadavg()[0];
  
  return {
    cpuUsage,
    memoryUsage,
    loadAvg
  };
}

// 代理函数调用
function proxyFunctionCalls() {
  // 监听本地服务器的请求，记录函数调用
  const server = http.createServer((req, res) => {
    // 记录所有请求
    log(`${colors.blue}收到请求: ${req.url}${colors.reset}`);
    
    // 检查请求是否是对函数的调用
    const match = req.url.match(/^\/([^/?]+)/);

    // 状态请求处理
    if (req.url === '/status') {
      const statusData = {
        timestamp: Date.now(),
        instances: state.functionInstances,
        metrics: getSystemMetrics(),
        calls: {}
      };
      
      // 计算过去一分钟的调用次数
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      for (const functionName in state.callHistory) {
        statusData.calls[functionName] = state.callHistory[functionName].filter(
          timestamp => timestamp >= oneMinuteAgo
        ).length;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusData));
      return;
    }
    
    if (match) {
      const functionName = match[1];
      
      // 更宽松的函数处理 - 即使函数不在预加载列表中也记录
      if (!state.functions[functionName]) {
        log(`${colors.yellow}未知函数调用: ${functionName}, 但仍将记录${colors.reset}`);
        
        // 初始化函数信息
        state.functions[functionName] = {
          name: functionName,
          file: path.join(config.functionDir, `${functionName}.js`)
        };
        
        // 初始化函数实例和调用历史
        if (!state.functionInstances[functionName]) {
          state.functionInstances[functionName] = config.minInstancesPerFunction;
        }
        
        if (!state.functionCalls[functionName]) {
          state.functionCalls[functionName] = 0;
        }
        
        if (!state.callHistory[functionName]) {
          state.callHistory[functionName] = [];
        }
      }
      
      // 增加函数调用计数
      state.functionCalls[functionName] = (state.functionCalls[functionName] || 0) + 1;
      
      // 记录调用时间
      const timestamp = Date.now();
      if (!state.callHistory[functionName]) {
        state.callHistory[functionName] = [];
      }
      state.callHistory[functionName].push(timestamp);
      
      log(`${colors.green}记录函数调用: ${functionName}, 当前调用总数: ${state.callHistory[functionName].length}${colors.reset}`);
    }
    
    // 给所有请求成功响应
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: '监控请求已记录' }));
  });
  
  server.listen(config.port + 1, () => {
    log(`${colors.blue}监控代理服务器运行在端口 ${config.port + 1}${colors.reset}`);
  });
  
  // 处理服务器错误
  server.on('error', (error) => {
    log(`${colors.red}监控代理服务器错误: ${error.message}${colors.reset}`);
  });
}

// 模拟函数实例扩缩容决策
function scaleInstances() {
  const now = Date.now();
  const metricsWindowMs = config.metricsWindow * 1000;
  
  // 清理过期的调用历史
  for (const functionName in state.callHistory) {
    state.callHistory[functionName] = state.callHistory[functionName].filter(
      timestamp => now - timestamp <= metricsWindowMs
    );
  }
  
  // 计算每个函数的每秒调用率
  const callRates = {};
  for (const functionName in state.callHistory) {
    const callCount = state.callHistory[functionName].length;
    callRates[functionName] = callCount / config.metricsWindow;
  }
  
  // 对每个函数进行扩缩容判断
  for (const functionName in state.functionInstances) {
    const callRate = callRates[functionName] || 0;
    const currentInstances = state.functionInstances[functionName];
    
    // 保证每个实例处理的请求不超过每秒5个
    const idealInstances = Math.ceil(callRate / 5);
    const targetInstances = Math.min(
      config.maxInstancesPerFunction, 
      Math.max(config.minInstancesPerFunction, idealInstances)
    );
    
    // 扩容逻辑：比理想实例数低，或者调用率超过阈值
    if ((targetInstances > currentInstances) || 
        (callRate > config.scaleUpThreshold && currentInstances < config.maxInstancesPerFunction)) {
      // 使扩容更激进
      const newInstances = Math.min(config.maxInstancesPerFunction, currentInstances + 1);
      if (newInstances > currentInstances) {
        state.functionInstances[functionName] = newInstances;
        log(`${colors.green}扩容函数 ${functionName}: ${currentInstances} -> ${newInstances} (调用率: ${callRate.toFixed(2)}/秒, 理想实例数: ${idealInstances})${colors.reset}`);
      }
    }
    // 缩容逻辑: 比理想实例数高，并且调用率低于阈值
    else if ((targetInstances < currentInstances) && 
             (callRate < config.scaleDownThreshold && currentInstances > config.minInstancesPerFunction)) {
      const newInstances = Math.max(config.minInstancesPerFunction, currentInstances - 1);
      if (newInstances < currentInstances) {
        state.functionInstances[functionName] = newInstances;
        log(`${colors.yellow}缩容函数 ${functionName}: ${currentInstances} -> ${newInstances} (调用率: ${callRate.toFixed(2)}/秒, 理想实例数: ${idealInstances})${colors.reset}`);
      }
    }
  }
}

// 打印当前状态
function printStatus() {
  const metrics = getSystemMetrics();
  
  log(`\n${colors.cyan}=============== 监控状态报告 ===============${colors.reset}`);
  log(`${colors.cyan}系统指标: CPU使用率=${metrics.cpuUsage.toFixed(2)}%, 内存使用率=${metrics.memoryUsage.toFixed(2)}%, 负载=${metrics.loadAvg.toFixed(2)}${colors.reset}`);
  
  log(`${colors.cyan}当前函数实例:${colors.reset}`);
  for (const functionName in state.functionInstances) {
    log(`  ${functionName}: ${state.functionInstances[functionName]} 个实例`);
  }
  
  // 计算过去一分钟的调用次数
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  log(`${colors.cyan}函数调用统计:${colors.reset}`);
  for (const functionName in state.callHistory) {
    const recentCalls = state.callHistory[functionName].filter(
      timestamp => timestamp >= oneMinuteAgo
    ).length;
    
    log(`  ${functionName}: 最近一分钟调用=${recentCalls}`);
  }
  
  log(`${colors.cyan}===========================================${colors.reset}`);
  log(`${colors.cyan}等待下一个监控周期...${colors.reset}\n`);
}

// 主循环
async function monitorLoop() {
  while (true) {
    try {
      // 1. 更新实例数量
      scaleInstances();
      
      // 2. 打印当前状态
      printStatus();
      
      // 3. 重置函数调用计数
      for (const functionName in state.functionCalls) {
        state.functionCalls[functionName] = 0;
      }
      
      // 4. 等待下一个监控周期
      await new Promise(resolve => setTimeout(resolve, config.monitorInterval));
    } catch (error) {
      log(`${colors.red}监控过程中出错: ${error.message}${colors.reset}`);
      // 等待短暂时间后继续
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// 启动监控
async function startMonitoring() {
  log(`${colors.green}============================================${colors.reset}`);
  log(`${colors.green}      启动 Serverless 自动扩展监控       ${colors.reset}`);
  log(`${colors.green}============================================${colors.reset}`);
  
  // 初始化函数列表
  initializeFunctions();
  
  // 设置监控代理
  proxyFunctionCalls();
  
  // 启动监控循环
  await monitorLoop();
}

// 处理退出信号
process.on('SIGINT', () => {
  log(`${colors.yellow}正在关闭监控...${colors.reset}`);
  logStream.end();
  process.exit(0);
});

// 启动监控
startMonitoring().catch(error => {
  log(`${colors.red}启动监控时出错: ${error.message}${colors.reset}`);
  logStream.end();
  process.exit(1);
}); 