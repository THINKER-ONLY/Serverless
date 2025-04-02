#!/usr/bin/env node

const http = require('http');
const readline = require('readline');

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

// 监控配置
const config = {
  serverHost: 'localhost',
  serverPort: 3000,
  autoscalerPort: 3001,
  monitorInterval: 2000, // 监控频率（毫秒）
  historyLength: 10,     // 记录历史数据的长度
  graphWidth: 60,        // 图表宽度
  graphHeight: 10        // 图表高度
};

// 全局状态
const state = {
  serverStatus: null,
  autoscalerStatus: null,
  instanceHistory: {}, // 函数实例数历史记录
  callRateHistory: {}, // 函数调用率历史记录
  cpuHistory: [],      // CPU使用率历史记录
  memoryHistory: [],   // 内存使用率历史记录
  loadHistory: [],     // 系统负载历史记录
  startTime: Date.now(),
  lastUpdateTime: null
};

// 清除终端
function clearScreen() {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

// 添加历史数据
function addHistory(collection, key, value) {
  if (!collection[key]) {
    collection[key] = [];
  }
  
  collection[key].push(value);
  
  // 保持历史记录不超过设定长度
  if (collection[key].length > config.historyLength) {
    collection[key].shift();
  }
}

// 绘制简单的ASCII图表
function drawGraph(values, maxValue, title, unit = '') {
  if (!values || values.length === 0) {
    return `${title}: 无数据`;
  }
  
  const height = config.graphHeight;
  const width = Math.min(config.graphWidth, values.length);
  
  // 创建图表网格
  const grid = Array(height).fill().map(() => Array(width).fill(' '));
  
  // 计算值的范围
  const max = maxValue || Math.max(...values, 1);
  
  // 绘制数据点
  for (let x = 0; x < width; x++) {
    const index = values.length - width + x;
    if (index >= 0) {
      const value = values[index];
      const y = Math.floor((height - 1) * (1 - value / max));
      if (y >= 0 && y < height) {
        grid[y][x] = '█';
      }
    }
  }
  
  // 构建图表字符串
  let graph = `${title} (${unit}max=${max.toFixed(1)}${unit})\n`;
  for (let y = 0; y < height; y++) {
    const yValue = max * (1 - y / (height - 1));
    graph += `${yValue.toFixed(1).padStart(5)}${unit} |`;
    graph += grid[y].join('');
    graph += '|\n';
  }
  
  // 添加底部边框
  graph += `      +${'-'.repeat(width)}+\n`;
  
  // 添加最新值
  const lastValue = values[values.length - 1];
  graph += `      当前值: ${lastValue.toFixed(1)}${unit}\n`;
  
  return graph;
}

// 从服务器获取状态
async function getServerStatus() {
  return new Promise((resolve, reject) => {
    http.get(`http://${config.serverHost}:${config.serverPort}/status`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const status = JSON.parse(data);
          resolve(status);
        } catch (error) {
          reject(new Error(`解析服务器状态失败: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`获取服务器状态失败: ${error.message}`));
    });
  });
}

// 从自动扩展监控获取状态
async function getAutoscalerStatus() {
  return new Promise((resolve, reject) => {
    http.get(`http://${config.serverHost}:${config.autoscalerPort}/status`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const status = JSON.parse(data);
          resolve(status);
        } catch (error) {
          reject(new Error(`解析自动扩展状态失败: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`获取自动扩展状态失败: ${error.message}`));
    });
  });
}

// 更新状态
async function updateStatus() {
  try {
    // 获取服务器状态
    state.serverStatus = await getServerStatus();
    
    // 获取自动扩展监控状态
    state.autoscalerStatus = await getAutoscalerStatus();
    
    // 更新历史记录
    if (state.autoscalerStatus) {
      // 更新实例数历史
      Object.keys(state.autoscalerStatus.instances || {}).forEach(funcName => {
        addHistory(state.instanceHistory, funcName, state.autoscalerStatus.instances[funcName]);
      });
      
      // 更新调用率历史
      Object.keys(state.autoscalerStatus.calls || {}).forEach(funcName => {
        addHistory(state.callRateHistory, funcName, state.autoscalerStatus.calls[funcName]);
      });
      
      // 更新系统指标历史
      if (state.autoscalerStatus.metrics) {
        state.cpuHistory.push(state.autoscalerStatus.metrics.cpuUsage);
        state.memoryHistory.push(state.autoscalerStatus.metrics.memoryUsage);
        state.loadHistory.push(state.autoscalerStatus.metrics.loadAvg);
        
        // 保持历史记录不超过设定长度
        if (state.cpuHistory.length > config.historyLength) {
          state.cpuHistory.shift();
          state.memoryHistory.shift();
          state.loadHistory.shift();
        }
      }
    }
    
    // 更新最后更新时间
    state.lastUpdateTime = Date.now();
  } catch (error) {
    console.error(`${colors.red}更新状态失败: ${error.message}${colors.reset}`);
  }
}

// 显示当前状态
function displayStatus() {
  clearScreen();
  
  // 计算运行时间
  const runtime = Math.floor((Date.now() - state.startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const seconds = runtime % 60;
  const runtimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // 标题
  console.log(`${colors.cyan}=============================================${colors.reset}`);
  console.log(`${colors.cyan}      Serverless 弹性扩缩容监控器           ${colors.reset}`);
  console.log(`${colors.cyan}=============================================${colors.reset}`);
  console.log(`${colors.blue}监控时长: ${runtimeStr}    最后更新: ${new Date().toISOString()}${colors.reset}`);
  console.log('');
  
  // 检查服务状态
  if (!state.serverStatus) {
    console.log(`${colors.red}服务器状态: 未连接 (http://${config.serverHost}:${config.serverPort})${colors.reset}`);
  } else {
    console.log(`${colors.green}服务器状态: 已连接 (运行时间: ${state.serverStatus.uptime.toFixed(0)}秒)${colors.reset}`);
  }
  
  if (!state.autoscalerStatus) {
    console.log(`${colors.red}自动扩展监控状态: 未连接 (http://${config.serverHost}:${config.autoscalerPort})${colors.reset}`);
    console.log('');
    console.log(`${colors.yellow}提示: 如果服务未运行，请使用以下命令启动完整环境:${colors.reset}`);
    console.log(`${colors.blue}cd /home/lzy/Projects/Code/serverless/serverless-app && ./start-elasticity-test.sh${colors.reset}`);
    return;
  }
  
  console.log(`${colors.green}自动扩展监控状态: 已连接${colors.reset}`);
  console.log('');
  
  // 显示系统资源使用情况图表
  console.log(`${colors.yellow}系统资源使用情况:${colors.reset}`);
  console.log(drawGraph(state.cpuHistory, 100, 'CPU 使用率', '%'));
  console.log(drawGraph(state.memoryHistory, 100, '内存使用率', '%'));
  console.log(drawGraph(state.loadHistory, null, '系统负载', ''));
  console.log('');
  
  // 显示函数实例数图表
  console.log(`${colors.yellow}函数实例数:${colors.reset}`);
  Object.keys(state.instanceHistory).forEach(funcName => {
    console.log(drawGraph(state.instanceHistory[funcName], null, `${funcName} 实例数`, ''));
  });
  console.log('');
  
  // 显示函数调用率图表
  console.log(`${colors.yellow}函数每分钟调用数:${colors.reset}`);
  Object.keys(state.callRateHistory).forEach(funcName => {
    console.log(drawGraph(state.callRateHistory[funcName], null, `${funcName} 调用数`, ''));
  });
  
  // 显示函数详细信息表格
  if (state.serverStatus && state.serverStatus.functions) {
    console.log('');
    console.log(`${colors.yellow}函数详细信息:${colors.reset}`);
    console.log('函数名称         实例数    活动请求    总请求数    成功率    平均响应时间    冷启动');
    console.log('---------------  --------  ----------  ----------  --------  --------------  --------');
    
    Object.keys(state.serverStatus.functions).forEach(funcName => {
      const func = state.serverStatus.functions[funcName] || {};
      const stats = func.stats || {};
      
      // 确保所有数值都有默认值
      const instances = Number(func.instances || 0);
      const activeRequests = Number(func.activeRequests || 0);
      const totalRequests = Number(stats.totalRequests || 0);
      const successfulRequests = Number(stats.successfulRequests || 0);
      const avgResponseTime = Number(stats.avgResponseTime || 0);
      const coldStarts = Number(func.coldStarts || 0);
      
      // 计算成功率，确保是数字
      const successRate = totalRequests === 0 ? 
        "100.0" : 
        (successfulRequests / totalRequests * 100).toFixed(1);
      
      // 格式化输出，确保所有值都是字符串
      console.log(
        `${funcName.padEnd(15)}  ` +
        `${String(instances).padEnd(8)}  ` +
        `${String(activeRequests).padEnd(10)}  ` +
        `${String(totalRequests).padEnd(10)}  ` +
        `${successRate.padEnd(8)}  ` +
        `${avgResponseTime.toFixed(2).padEnd(14)}  ` +
        `${String(coldStarts)}`
      );
    });
  }
  
  console.log('');
  console.log(`${colors.blue}自动刷新间隔: ${config.monitorInterval / 1000}秒${colors.reset}`);
  console.log(`${colors.blue}按 Ctrl+C 退出${colors.reset}`);
}

// 主函数
async function startMonitoring() {
  console.log(`${colors.green}启动 Serverless 弹性扩缩容监控器...${colors.reset}`);
  
  // 首次更新状态
  await updateStatus();
  
  // 显示初始状态
  displayStatus();
  
  // 定期更新状态
  setInterval(async () => {
    await updateStatus();
    displayStatus();
  }, config.monitorInterval);
}

// 启动监控
startMonitoring().catch(error => {
  console.error(`${colors.red}监控出错: ${error.message}${colors.reset}`);
}); 