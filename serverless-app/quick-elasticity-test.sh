#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # 无颜色

# 显示标题
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   Serverless 快速弹性测试 (精简版)         ${NC}"
echo -e "${GREEN}=============================================${NC}"

# 确保日志目录存在
mkdir -p logs

# 设置文件权限
chmod +x *.js *.sh

# 停止可能正在运行的先前实例
echo -e "${YELLOW}停止可能正在运行的已有服务...${NC}"
pkill -f "node server-with-scaling.js" || true
pkill -f "node auto-scale.js" || true
pkill -f "node monitor-scaling.js" || true
pkill -f "node wave-loadtest.js" || true
sleep 1

# 启动服务器
echo -e "${BLUE}启动Serverless服务器...${NC}"
node server-with-scaling.js > logs/server.log 2>&1 &
SERVER_PID=$!

# 等待服务器启动
echo -e "${YELLOW}等待服务器启动...${NC}"
max_retries=10
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if curl -s http://localhost:3000/hello > /dev/null; then
        echo -e "${GREEN}服务器已成功启动${NC}"
        break
    fi
    retry_count=$((retry_count + 1))
    echo -e "${YELLOW}等待服务器启动，尝试 $retry_count/$max_retries...${NC}"
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo -e "${RED}错误: 服务器未能在规定时间内启动，请检查 logs/server.log${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# 启动自动扩展监控
echo -e "${BLUE}启动自动扩展监控...${NC}"
node auto-scale.js > logs/auto-scale.log 2>&1 &
AUTOSCALER_PID=$!

# 等待自动扩展监控启动
sleep 2

# 确认自动扩展监控响应
if ! curl -s http://localhost:3001/status > /dev/null; then
    echo -e "${RED}错误: 自动扩展监控未响应${NC}"
    kill $SERVER_PID $AUTOSCALER_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}服务已成功启动！${NC}"
echo -e "${BLUE}服务器进程ID: ${SERVER_PID}${NC}"
echo -e "${BLUE}自动扩展监控进程ID: ${AUTOSCALER_PID}${NC}"
echo -e ""

# 方式选择
echo -e "${CYAN}请选择操作模式:${NC}"
echo -e "1. 运行负载测试"
echo -e "2. 运行负载测试 + 实时监控"
echo -e "3. 仅启动监控 (新窗口中手动运行负载测试)"
echo -e "4. 退出"
read -p "选择 [1-4]: " choice

case $choice in
    1)
        echo -e "${BLUE}开始运行波动负载测试...${NC}"
        node wave-loadtest.js | tee logs/wave-loadtest.log
        
        echo -e "${BLUE}生成弹性测试报告...${NC}"
        node analyze-results.js
        ;;
    2)
        # 使用screen或新终端启动监控
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- bash -c "cd $(pwd) && node monitor-scaling.js; read -p '按任意键关闭...'"
        elif command -v xterm &> /dev/null; then
            xterm -e "cd $(pwd) && node monitor-scaling.js; read -p '按任意键关闭...'" &
        else
            echo -e "${YELLOW}无法启动新终端窗口，在当前窗口运行监控...${NC}"
            node monitor-scaling.js &
            MONITOR_PID=$!
            sleep 2
        fi
        
        echo -e "${BLUE}开始运行波动负载测试...${NC}"
        node wave-loadtest.js | tee logs/wave-loadtest.log
        
        if [ ! -z "$MONITOR_PID" ]; then
            kill $MONITOR_PID 2>/dev/null || true
        fi
        
        echo -e "${BLUE}生成弹性测试报告...${NC}"
        node analyze-results.js
        ;;
    3)
        echo -e "${BLUE}启动弹性扩缩容监控器...${NC}"
        node monitor-scaling.js
        ;;
    *)
        echo -e "${YELLOW}退出程序${NC}"
        ;;
esac

# 询问是否停止服务
echo -e ""
read -p "是否停止所有服务？(y/n): " stop_choice
if [[ $stop_choice =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}正在停止所有服务...${NC}"
    kill $SERVER_PID $AUTOSCALER_PID 2>/dev/null || true
    echo -e "${GREEN}服务已停止${NC}"
else
    echo -e "${YELLOW}服务继续运行中...${NC}"
    echo -e "服务器进程ID: ${SERVER_PID}"
    echo -e "自动扩展监控进程ID: ${AUTOSCALER_PID}"
    echo -e "使用以下命令停止：kill ${SERVER_PID} ${AUTOSCALER_PID}"
fi 