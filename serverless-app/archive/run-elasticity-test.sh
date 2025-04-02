#!/bin/bash

# 定义颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 创建日志目录
mkdir -p logs

echo -e "${BLUE}[INFO]${NC} 开始弹性测试..."

# 确保没有服务器已在运行
echo -e "${BLUE}[INFO]${NC} 停止所有已运行的服务..."
pkill -f "node server.js" || true
pkill -f "node auto-scale.js" || true
sleep 2

# 启动服务器
echo -e "${GREEN}[STEP 1]${NC} 启动服务器..."
node server.js > logs/server.log 2>&1 &
SERVER_PID=$!
echo -e "${BLUE}[INFO]${NC} 服务器PID: $SERVER_PID"

# 等待服务器启动
echo -e "${BLUE}[INFO]${NC} 等待服务器启动..."
sleep 3

# 验证服务器是否运行
if ! curl -s http://localhost:3000/hello > /dev/null; then
    echo -e "${RED}[ERROR]${NC} 服务器未能成功启动，请检查logs/server.log"
    exit 1
fi
echo -e "${GREEN}[SUCCESS]${NC} 服务器已成功启动"

# 启动自动扩展监控
echo -e "${GREEN}[STEP 2]${NC} 启动自动扩展监控..."
node auto-scale.js > logs/auto-scale.log 2>&1 &
SCALE_PID=$!
echo -e "${BLUE}[INFO]${NC} 自动扩展监控PID: $SCALE_PID"
sleep 2

# 显示当前状态
echo -e "${YELLOW}[STATUS]${NC} 当前系统状态:"
echo -e "  - 服务器: 运行中 (PID: $SERVER_PID)"
echo -e "  - 自动扩展监控: 运行中 (PID: $SCALE_PID)"

# 运行负载测试
echo -e "${GREEN}[STEP 3]${NC} 开始运行负载测试..."
echo -e "${BLUE}[INFO]${NC} 测试将发送1000个请求，并发数100..."
node new-loadtest.js | tee logs/loadtest.log

# 测试结束
echo -e "${GREEN}[COMPLETE]${NC} 负载测试完成"

# 等待用户确认
read -p "按Enter键停止所有服务..." DUMMY

# 清理
echo -e "${BLUE}[INFO]${NC} 停止所有服务..."
kill $SERVER_PID $SCALE_PID 2>/dev/null || true
pkill -f "node server.js" || true
pkill -f "node auto-scale.js" || true

echo -e "${GREEN}[DONE]${NC} 测试完成，日志已保存到logs目录"
echo -e "${BLUE}[INFO]${NC} 查看详细日志:"
echo -e "  - 服务器日志: cat logs/server.log"
echo -e "  - 自动扩展监控日志: cat logs/auto-scale.log"
echo -e "  - 负载测试日志: cat logs/loadtest.log" 