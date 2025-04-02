#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 配置
const config = {
  loadTestLogPath: path.join(__dirname, 'logs', 'loadtest.log'),
  autoScaleLogPath: path.join(__dirname, 'logs', 'auto-scale.log'),
  reportPath: path.join(__dirname, 'logs', 'elasticity-report.txt')
};

// 解析负载测试结果
async function parseLoadTestResults() {
  if (!fs.existsSync(config.loadTestLogPath)) {
    console.error(`错误: 找不到负载测试日志文件 ${config.loadTestLogPath}`);
    return null;
  }
  
  const results = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeoutRequests: 0,
    avgResponseTime: 0,
    minResponseTime: 0,
    maxResponseTime: 0,
    successRate: 0,
    requestsPerSecond: 0,
    totalTime: 0,
    responseTimeDistribution: {},
    errors: {}
  };
  
  const fileStream = fs.createReadStream(config.loadTestLogPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  // 解析日志文件
  for await (const line of rl) {
    if (line.includes('总请求数:')) {
      results.totalRequests = parseInt(line.split('总请求数:')[1].trim());
    } else if (line.includes('成功请求数:')) {
      results.successfulRequests = parseInt(line.split('成功请求数:')[1].trim());
    } else if (line.includes('失败请求数:')) {
      results.failedRequests = parseInt(line.split('失败请求数:')[1].trim());
    } else if (line.includes('超时请求数:')) {
      results.timeoutRequests = parseInt(line.split('超时请求数:')[1].trim());
    } else if (line.includes('成功率:')) {
      results.successRate = parseFloat(line.split('成功率:')[1].trim().replace('%', ''));
    } else if (line.includes('总测试时间:')) {
      results.totalTime = parseFloat(line.split('总测试时间:')[1].trim().replace('秒', ''));
    } else if (line.includes('平均响应时间:')) {
      results.avgResponseTime = parseFloat(line.split('平均响应时间:')[1].trim().replace('毫秒', ''));
    } else if (line.includes('最小响应时间:')) {
      results.minResponseTime = parseFloat(line.split('最小响应时间:')[1].trim().replace('毫秒', ''));
    } else if (line.includes('最大响应时间:')) {
      results.maxResponseTime = parseFloat(line.split('最大响应时间:')[1].trim().replace('毫秒', ''));
    } else if (line.includes('请求频率:')) {
      results.requestsPerSecond = parseFloat(line.split('请求频率:')[1].trim().replace('请求/秒', ''));
    } else if (line.trim().startsWith('<=')) {
      const parts = line.trim().split(':');
      if (parts.length === 2) {
        const timeRange = parts[0].trim().replace('<=', '').replace('ms', '').trim();
        const percentage = parseFloat(parts[1].trim().replace('%', ''));
        results.responseTimeDistribution[timeRange] = percentage;
      }
    } else if (line.trim().startsWith('  ') && line.includes(':') && line.includes('次')) {
      const parts = line.trim().split(':');
      if (parts.length === 2) {
        const errorType = parts[0].trim();
        const count = parseInt(parts[1].trim().replace('次', ''));
        results.errors[errorType] = count;
      }
    }
  }
  
  return results;
}

// 解析自动扩展日志
async function parseAutoScaleResults() {
  if (!fs.existsSync(config.autoScaleLogPath)) {
    console.error(`错误: 找不到自动扩展日志文件 ${config.autoScaleLogPath}`);
    return null;
  }
  
  const results = {
    timeline: [],
    instances: {
      hello: [],
      weather: [],
      calculate: [],
      echo: []
    },
    calls: {
      hello: [],
      weather: [],
      calculate: [],
      echo: []
    },
    systemMetrics: {
      cpu: [],
      memory: [],
      loadAvg: []
    }
  };
  
  const fileStream = fs.createReadStream(config.autoScaleLogPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let currentTimestamp = null;
  let readingInstancesSection = false;
  
  // 解析日志文件
  for await (const line of rl) {
    if (line.includes('系统指标:')) {
      // 新的监控周期开始
      currentTimestamp = new Date().toISOString();
      results.timeline.push(currentTimestamp);
      
      // 解析系统指标
      const cpuMatch = line.match(/CPU使用率=(\d+\.\d+)%/);
      const memMatch = line.match(/内存使用率=(\d+\.\d+)%/);
      const loadMatch = line.match(/负载=(\d+\.\d+)/);
      
      if (cpuMatch) results.systemMetrics.cpu.push(parseFloat(cpuMatch[1]));
      if (memMatch) results.systemMetrics.memory.push(parseFloat(memMatch[1]));
      if (loadMatch) results.systemMetrics.loadAvg.push(parseFloat(loadMatch[1]));
    } 
    else if (line.includes('最近一分钟调用=')) {
      // 解析函数调用统计
      for (const funcName of Object.keys(results.calls)) {
        if (line.startsWith(`  ${funcName}:`)) {
          const callsMatch = line.match(/最近一分钟调用=(\d+)/);
          if (callsMatch) {
            results.calls[funcName].push(parseInt(callsMatch[1]));
          }
          break;
        }
      }
    }
    else if (line.includes('当前函数实例:')) {
      readingInstancesSection = true;
    }
    else if (readingInstancesSection && line.trim().startsWith('  ')) {
      // 解析函数实例数
      for (const funcName of Object.keys(results.instances)) {
        if (line.includes(`${funcName}:`)) {
          const instancesMatch = line.match(/(\d+) 个实例/);
          if (instancesMatch) {
            results.instances[funcName].push(parseInt(instancesMatch[1]));
          }
          break;
        }
      }
    }
    else if (line.includes('等待下一个监控周期')) {
      readingInstancesSection = false;
    }
  }
  
  return results;
}

// 生成报告
async function generateReport() {
  console.log('正在分析负载测试结果...');
  const loadTestResults = await parseLoadTestResults();
  
  console.log('正在分析自动扩展日志...');
  const autoScaleResults = await parseAutoScaleResults();
  
  if (!loadTestResults || !autoScaleResults) {
    console.error('无法生成完整报告，缺少必要的日志文件');
    return;
  }
  
  console.log('正在生成弹性测试报告...');
  
  // 构建报告内容
  let report = '==========================================\n';
  report += '         Serverless 弹性测试报告            \n';
  report += '==========================================\n\n';
  
  // 负载测试摘要
  report += '1. 负载测试摘要\n';
  report += '==========================================\n';
  report += `总请求数: ${loadTestResults.totalRequests}\n`;
  report += `成功请求数: ${loadTestResults.successfulRequests}\n`;
  report += `失败请求数: ${loadTestResults.failedRequests}\n`;
  report += `超时请求数: ${loadTestResults.timeoutRequests}\n`;
  report += `成功率: ${loadTestResults.successRate}%\n`;
  report += `总测试时间: ${loadTestResults.totalTime} 秒\n`;
  report += `平均响应时间: ${loadTestResults.avgResponseTime} 毫秒\n`;
  report += `最小响应时间: ${loadTestResults.minResponseTime} 毫秒\n`;
  report += `最大响应时间: ${loadTestResults.maxResponseTime} 毫秒\n`;
  report += `每秒请求数: ${loadTestResults.requestsPerSecond} 请求/秒\n\n`;
  
  // 响应时间分布
  report += '2. 响应时间分布\n';
  report += '==========================================\n';
  for (const [time, percentage] of Object.entries(loadTestResults.responseTimeDistribution)) {
    report += `≤ ${time}ms: ${percentage}%\n`;
  }
  report += '\n';
  
  // 自动扩展分析
  report += '3. 自动扩展分析\n';
  report += '==========================================\n';
  
  // 计算平均实例数
  const avgInstances = {};
  const maxInstances = {};
  const minInstances = {};
  
  for (const funcName of Object.keys(autoScaleResults.instances)) {
    const instances = autoScaleResults.instances[funcName];
    if (instances.length > 0) {
      avgInstances[funcName] = instances.reduce((a, b) => a + b, 0) / instances.length;
      maxInstances[funcName] = Math.max(...instances);
      minInstances[funcName] = Math.min(...instances);
    }
  }
  
  // 计算扩容和缩容次数
  const scalingEvents = {
    up: {},
    down: {}
  };
  
  for (const funcName of Object.keys(autoScaleResults.instances)) {
    scalingEvents.up[funcName] = 0;
    scalingEvents.down[funcName] = 0;
    
    const instances = autoScaleResults.instances[funcName];
    for (let i = 1; i < instances.length; i++) {
      if (instances[i] > instances[i-1]) {
        scalingEvents.up[funcName]++;
      } else if (instances[i] < instances[i-1]) {
        scalingEvents.down[funcName]++;
      }
    }
  }
  
  report += '函数实例数统计:\n';
  for (const funcName of Object.keys(avgInstances)) {
    report += `  ${funcName}:\n`;
    report += `    - 平均实例数: ${avgInstances[funcName].toFixed(2)}\n`;
    report += `    - 最大实例数: ${maxInstances[funcName]}\n`;
    report += `    - 最小实例数: ${minInstances[funcName]}\n`;
    report += `    - 扩容次数: ${scalingEvents.up[funcName]}\n`;
    report += `    - 缩容次数: ${scalingEvents.down[funcName]}\n`;
  }
  report += '\n';
  
  // 系统资源利用率
  const avgCpu = autoScaleResults.systemMetrics.cpu.reduce((a, b) => a + b, 0) / autoScaleResults.systemMetrics.cpu.length;
  const avgMem = autoScaleResults.systemMetrics.memory.reduce((a, b) => a + b, 0) / autoScaleResults.systemMetrics.memory.length;
  const avgLoad = autoScaleResults.systemMetrics.loadAvg.reduce((a, b) => a + b, 0) / autoScaleResults.systemMetrics.loadAvg.length;
  
  report += '系统资源利用率:\n';
  report += `  - 平均CPU使用率: ${avgCpu.toFixed(2)}%\n`;
  report += `  - 平均内存使用率: ${avgMem.toFixed(2)}%\n`;
  report += `  - 平均系统负载: ${avgLoad.toFixed(2)}\n\n`;
  
  // 弹性分析结论
  report += '4. 弹性分析结论\n';
  report += '==========================================\n';
  
  // 计算平均每秒调用数与平均实例数的比率
  const functionEfficiency = {};
  for (const funcName of Object.keys(autoScaleResults.calls)) {
    const avgCalls = autoScaleResults.calls[funcName].reduce((a, b) => a + b, 0) / autoScaleResults.calls[funcName].length;
    if (avgInstances[funcName] > 0) {
      functionEfficiency[funcName] = avgCalls / avgInstances[funcName];
    } else {
      functionEfficiency[funcName] = 0;
    }
  }
  
  report += '函数效率分析 (每个实例每分钟处理的平均请求数):\n';
  for (const [funcName, efficiency] of Object.entries(functionEfficiency)) {
    report += `  - ${funcName}: ${efficiency.toFixed(2)} 请求/实例/分钟\n`;
  }
  report += '\n';
  
  // 总体评估
  const totalScalingEvents = Object.values(scalingEvents.up).reduce((a, b) => a + b, 0) + 
                             Object.values(scalingEvents.down).reduce((a, b) => a + b, 0);
  const scalingFrequency = totalScalingEvents / (autoScaleResults.timeline.length || 1);
  
  report += '总体弹性评估:\n';
  report += `  - 监控周期总数: ${autoScaleResults.timeline.length}\n`;
  report += `  - 扩缩容事件总数: ${totalScalingEvents}\n`;
  report += `  - 每个监控周期平均扩缩容次数: ${scalingFrequency.toFixed(2)}\n`;
  
  // 弹性评分
  let elasticityScore = 0;
  // 基于成功率评分 (40%)
  elasticityScore += (loadTestResults.successRate / 100) * 40;
  // 基于扩缩容响应性评分 (30%)
  elasticityScore += Math.min(scalingFrequency * 15, 30);
  // 基于资源利用率评分 (30%)
  const resourceEfficiency = 30 - Math.abs(75 - avgCpu) / 2;
  elasticityScore += Math.max(0, resourceEfficiency);
  
  report += `\n弹性评分: ${elasticityScore.toFixed(2)}/100\n`;
  
  if (elasticityScore >= 80) {
    report += '评估: 优秀 - 系统展现出出色的弹性能力，能够有效应对负载波动\n';
  } else if (elasticityScore >= 60) {
    report += '评估: 良好 - 系统具有足够的弹性，但在某些方面还可以优化\n';
  } else if (elasticityScore >= 40) {
    report += '评估: 一般 - 系统展示出一定的弹性，但需要显著改进\n';
  } else {
    report += '评估: 不足 - 系统弹性能力较弱，需要重大改进\n';
  }
  
  // 保存报告
  fs.writeFileSync(config.reportPath, report);
  console.log(`报告已生成并保存至: ${config.reportPath}`);
  console.log('\n报告摘要:');
  
  // 打印报告摘要
  console.log(`总请求数: ${loadTestResults.totalRequests}, 成功率: ${loadTestResults.successRate}%`);
  console.log(`平均响应时间: ${loadTestResults.avgResponseTime} 毫秒, 每秒请求数: ${loadTestResults.requestsPerSecond}`);
  console.log(`扩缩容事件总数: ${totalScalingEvents}, 弹性评分: ${elasticityScore.toFixed(2)}/100`);
}

// 运行报告生成
generateReport().catch(error => {
  console.error('生成报告时出错:', error);
}); 