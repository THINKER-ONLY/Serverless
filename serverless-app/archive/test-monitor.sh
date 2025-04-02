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
echo -e "${GREEN}     自动扩展监控系统测试                   ${NC}"
echo -e "${GREEN}=============================================${NC}"

# 确保日志目录存在
mkdir -p logs

# 测试变量
SERVER_PORT=3000
AUTOSCALER_PORT=3001
FUNCTIONS=("hello" "echo" "weather" "calculate")
TOTAL_REQUESTS=100
INTERVAL=0.1

# 检查服务器和监控器状态
echo -e "${BLUE}检查服务状态...${NC}"

# 检查服务器
if curl -s http://localhost:$SERVER_PORT/ > /dev/null; then
    echo -e "${GREEN}服务器正在运行 (端口: $SERVER_PORT)${NC}"
else
    echo -e "${RED}服务器未运行或无法访问 (端口: $SERVER_PORT)${NC}"
    echo -e "${YELLOW}请先使用 ./quick-elasticity-test.sh 启动服务${NC}"
    exit 1
fi

# 检查自动扩展监控
if curl -s http://localhost:$AUTOSCALER_PORT/status > /dev/null; then
    echo -e "${GREEN}自动扩展监控正在运行 (端口: $AUTOSCALER_PORT)${NC}"
else
    echo -e "${RED}自动扩展监控未运行或无法访问 (端口: $AUTOSCALER_PORT)${NC}"
    echo -e "${YELLOW}请先使用 ./quick-elasticity-test.sh 启动服务${NC}"
    exit 1
fi

# 直接测试自动扩展监控器
echo -e "\n${CYAN}开始直接测试自动扩展监控器...${NC}"

# 循环测试每个函数
for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}测试函数: $func${NC}"
    
    # 向自动扩展监控器发送请求
    for i in $(seq 1 10); do
        response=$(curl -s "http://localhost:$AUTOSCALER_PORT/$func")
        echo -e "请求 $i: $response"
        sleep 0.2
    done
    
    # 检查自动扩展监控器状态
    status=$(curl -s "http://localhost:$AUTOSCALER_PORT/status")
    echo -e "监控状态: $status"
    echo ""
done

# 验证通过服务器的请求是否能正确通知自动扩展监控
echo -e "\n${CYAN}开始通过服务器验证...${NC}"

# 清空之前的测试日志
> logs/monitor-test.log

# 测试间隔性调用服务器，确保通知到自动扩展监控器
echo -e "${BLUE}发送 $TOTAL_REQUESTS 个请求到服务器，间隔 ${INTERVAL}秒...${NC}"

# 获取自动扩展监控器初始状态
initial_status=$(curl -s "http://localhost:$AUTOSCALER_PORT/status")
echo -e "初始状态: $initial_status" >> logs/monitor-test.log

# 向所有函数发送请求
for i in $(seq 1 $TOTAL_REQUESTS); do
    # 随机选择一个函数
    func=${FUNCTIONS[$((RANDOM % ${#FUNCTIONS[@]}))]}
    
    # 发送请求到服务器
    response=$(curl -s "http://localhost:$SERVER_PORT/$func")
    echo -e "请求 $i ($func): $(echo $response | cut -c 1-50)..." >> logs/monitor-test.log
    
    # 打印进度
    if (( i % 10 == 0 )); then
        echo -e "${GREEN}已完成 $i / $TOTAL_REQUESTS 请求${NC}"
    fi
    
    sleep $INTERVAL
done

# 等待一会，让自动扩展监控器有时间处理
echo -e "${YELLOW}等待2秒让自动扩展监控器处理请求...${NC}"
sleep 2

# 获取自动扩展监控器最终状态
final_status=$(curl -s "http://localhost:$AUTOSCALER_PORT/status")
echo -e "最终状态: $final_status" >> logs/monitor-test.log

# 显示测试摘要
echo -e "\n${CYAN}测试摘要:${NC}"
echo -e "${BLUE}1. 发送了 $TOTAL_REQUESTS 个请求${NC}"
echo -e "${BLUE}2. 测试日志保存在 logs/monitor-test.log${NC}"
echo -e "${BLUE}3. 最终状态:${NC}"
echo -e "$final_status" | python3 -m json.tool || echo "$final_status"

# 检查是否成功记录请求
echo -e "\n${CYAN}请求处理分析:${NC}"
for func in "${FUNCTIONS[@]}"; do
    # 提取每个函数的调用计数
    if echo "$final_status" | grep -q "\"$func\""; then
        count=$(echo "$final_status" | grep -o "\"$func\"[^}]*" | grep -o "[0-9]\+")
        if [ -n "$count" ] && [ "$count" -gt 0 ]; then
            echo -e "${GREEN}函数 $func: 成功记录到 $count 个请求${NC}"
        else
            echo -e "${RED}函数 $func: 未检测到请求记录${NC}"
        fi
    else
        echo -e "${RED}函数 $func: 在状态中未找到${NC}"
    fi
done

echo -e "\n${GREEN}测试完成！${NC}" 