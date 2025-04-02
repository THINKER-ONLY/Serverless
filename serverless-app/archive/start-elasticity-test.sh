#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # 无颜色

# 确保日志目录存在
mkdir -p logs

# 显示标题
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}      Serverless 弹性测试环境启动           ${NC}"
echo -e "${GREEN}=============================================${NC}"

# 检查是否安装了Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到Node.js。请先安装Node.js。${NC}"
    echo -e "${YELLOW}可以使用以下命令安装:${NC}"
    echo -e "${BLUE}sudo apt install nodejs npm${NC}"
    exit 1
fi

# 停止可能正在运行的先前实例
echo -e "${YELLOW}停止可能正在运行的已有服务...${NC}"
pkill -f "node server-with-scaling.js" || true
pkill -f "node auto-scale.js" || true
sleep 1

# 存储环境中的进程IDs
server_pid=""
autoscaler_pid=""

# 启动带有自动扩展功能的服务器
echo -e "${BLUE}启动Serverless服务器...${NC}"
node server-with-scaling.js > logs/server.log 2>&1 &
server_pid=$!
echo -e "${GREEN}服务器进程ID: ${server_pid}${NC}"

# 等待服务器启动
echo -e "${YELLOW}等待服务器启动...${NC}"
sleep 2

# 检查服务器是否正在运行
if ! ps -p $server_pid > /dev/null; then
    echo -e "${RED}错误: 服务器启动失败。请检查 logs/server.log 以获取更多信息。${NC}"
    exit 1
fi

# 确认服务器响应
echo -e "${YELLOW}检查服务器可用性...${NC}"
if ! curl -s http://localhost:3000/ > /dev/null; then
    echo -e "${RED}错误: 服务器未响应。请检查 logs/server.log 以获取更多信息。${NC}"
    kill $server_pid 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}服务器成功启动并响应。${NC}"

# 启动自动扩展监控
echo -e "${BLUE}启动自动扩展监控...${NC}"
node auto-scale.js > logs/auto-scale.log 2>&1 &
autoscaler_pid=$!
echo -e "${GREEN}自动扩展监控进程ID: ${autoscaler_pid}${NC}"

# 等待自动扩展监控启动
echo -e "${YELLOW}等待自动扩展监控启动...${NC}"
sleep 3

# 检查自动扩展监控是否正在运行
if ! ps -p $autoscaler_pid > /dev/null; then
    echo -e "${RED}错误: 自动扩展监控启动失败。请检查 logs/auto-scale.log 以获取更多信息。${NC}"
    kill $server_pid 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}自动扩展监控成功启动。${NC}"

# 显示当前状态
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}            当前服务状态                     ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "${GREEN}服务器: ${NC}运行中 (PID: ${server_pid})"
echo -e "${GREEN}自动扩展监控: ${NC}运行中 (PID: ${autoscaler_pid})"
echo -e "${GREEN}服务器地址: ${NC}http://localhost:3000/"
echo -e "${GREEN}服务器日志: ${NC}logs/server.log"
echo -e "${GREEN}自动扩展监控日志: ${NC}logs/auto-scale.log"

# 提供选项菜单
show_menu() {
    echo -e "${CYAN}=============================================${NC}"
    echo -e "${CYAN}            弹性测试环境菜单                ${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo -e "${BLUE}1. 运行负载测试 (new-loadtest.js)${NC}"
    echo -e "${BLUE}2. 查看服务器日志${NC}"
    echo -e "${BLUE}3. 查看自动扩展监控日志${NC}"
    echo -e "${BLUE}4. 生成弹性测试报告${NC}"
    echo -e "${BLUE}5. 停止所有服务${NC}"
    echo -e "${BLUE}6. 退出但保持服务运行${NC}"
    echo -e "${YELLOW}请选择操作 [1-6]:${NC} "
}

# 运行负载测试
run_load_test() {
    echo -e "${BLUE}开始运行负载测试...${NC}"
    node new-loadtest.js > logs/loadtest.log 2>&1
    echo -e "${GREEN}负载测试完成。结果保存在 logs/loadtest.log${NC}"
    
    # 提示查看结果
    echo -e "${YELLOW}是否查看负载测试结果? (y/n)${NC}"
    read -n 1 -r view_results
    echo ""
    if [[ $view_results =~ ^[Yy]$ ]]; then
        less logs/loadtest.log
    fi
}

# 查看日志
view_logs() {
    local log_file=$1
    if [[ -f $log_file ]]; then
        less $log_file
    else
        echo -e "${RED}错误: 日志文件 $log_file 不存在${NC}"
    fi
}

# 生成弹性测试报告
generate_report() {
    echo -e "${BLUE}生成弹性测试报告...${NC}"
    node analyze-results.js
    
    # 检查报告是否生成
    if [[ -f logs/elasticity-report.txt ]]; then
        echo -e "${GREEN}报告生成完成。保存在 logs/elasticity-report.txt${NC}"
        
        # 提示查看报告
        echo -e "${YELLOW}是否查看弹性测试报告? (y/n)${NC}"
        read -n 1 -r view_report
        echo ""
        if [[ $view_report =~ ^[Yy]$ ]]; then
            less logs/elasticity-report.txt
        fi
    else
        echo -e "${RED}错误: 报告生成失败${NC}"
    fi
}

# 停止所有服务
stop_services() {
    echo -e "${YELLOW}正在停止所有服务...${NC}"
    
    # 停止服务器
    if [[ -n $server_pid ]]; then
        kill $server_pid 2>/dev/null || true
        echo -e "${GREEN}服务器已停止${NC}"
    fi
    
    # 停止自动扩展监控
    if [[ -n $autoscaler_pid ]]; then
        kill $autoscaler_pid 2>/dev/null || true
        echo -e "${GREEN}自动扩展监控已停止${NC}"
    fi
    
    # 检查是否有残留进程
    pkill -f "node server-with-scaling.js" || true
    pkill -f "node auto-scale.js" || true
    
    echo -e "${GREEN}所有服务已停止${NC}"
}

# 主循环
while true; do
    show_menu
    read -n 1 -r option
    echo ""
    
    case $option in
        1)
            run_load_test
            ;;
        2)
            view_logs "logs/server.log"
            ;;
        3)
            view_logs "logs/auto-scale.log"
            ;;
        4)
            generate_report
            ;;
        5)
            stop_services
            echo -e "${GREEN}谢谢使用!${NC}"
            exit 0
            ;;
        6)
            echo -e "${GREEN}退出但保持服务运行。${NC}"
            echo -e "${YELLOW}服务器进程ID: ${server_pid}${NC}"
            echo -e "${YELLOW}自动扩展监控进程ID: ${autoscaler_pid}${NC}"
            echo -e "${YELLOW}使用以下命令停止: kill ${server_pid} ${autoscaler_pid}${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选项，请重试${NC}"
            ;;
    esac
    
    # 在继续之前等待确认
    echo ""
    echo -e "${YELLOW}按任意键继续...${NC}"
    read -n 1 -r
    echo ""
done 