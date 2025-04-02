# 简易Serverless应用框架

这是一个轻量级的本地Serverless函数框架，支持函数的自动扩缩容和性能监控。

## 主要组件

- `server.js` - 基础HTTP服务器，用于处理函数请求
- `server-with-scaling.js` - 支持自动扩缩容的HTTP服务器
- `auto-scale.js` - 自动扩缩容监控服务
- `monitor-scaling.js` - 实时监控和可视化工具
- `wave-loadtest.js` - 波动负载测试工具
- `functions/` - 函数目录，包含所有可调用的函数

## 如何使用

### 启动基础服务

```bash
node server.js
```

### 启动带自动扩缩容的服务

```bash
./quick-elasticity-test.sh
```

选项：
1. 运行负载测试
2. 运行负载测试 + 实时监控（推荐）
3. 仅启动监控（可在另一个窗口手动运行负载测试）

### 访问函数

- 基础函数: http://localhost:3000/hello
- 天气函数: http://localhost:3000/weather?city=北京
- 计算函数: http://localhost:3000/calculate?a=10&b=5&op=add
- 回显函数: http://localhost:3000/echo?text=测试消息

### 使用客户端界面

打开`client.html`文件在浏览器中进行交互式测试。

### 负载测试

标准负载测试:
```bash
node new-loadtest.js
```

波动负载测试（模拟真实场景）:
```bash
node wave-loadtest.js
```

## 监控和扩缩容特性

- 实时资源监控
- 函数调用统计（请求数、成功率、响应时间）
- 自动扩缩容策略
- 冷启动优化

## 日志系统

- 服务器日志: `logs/server.log`
- 自动扩缩容日志: `logs/autoscaler.log`
- 函数调用日志: `logs/functions.log`
- 历史日志存档: `logs/archive/`

## 最近修复的问题

- 修复监控系统成功率显示不正确的问题
- 修复数值处理中的类型转换错误
- 修复波动负载测试中请求成功/失败计数逻辑
- 修复对未定义值调用方法的错误

## 注意事项

- 此框架仅供学习和测试使用
- 所有数据和功能都在本地运行，无需网络连接
- 重启服务前建议先终止所有相关进程（使用`pkill`命令）
