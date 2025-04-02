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
echo -e "${GREEN}      Serverless 弹性测试演示启动           ${NC}"
echo -e "${GREEN}=============================================${NC}"

# 检查是否安装了Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到Node.js。请先安装Node.js。${NC}"
    echo -e "${YELLOW}可以使用以下命令安装:${NC}"
    echo -e "${BLUE}sudo apt install nodejs npm${NC}"
    exit 1
fi

# 设置文件权限
echo -e "${YELLOW}设置文件权限...${NC}"
chmod +x *.sh
chmod +x *.js

# 停止可能正在运行的先前实例
echo -e "${YELLOW}停止可能正在运行的已有服务...${NC}"
pkill -f "node server-with-scaling.js" || true
pkill -f "node auto-scale.js" || true
pkill -f "node monitor-scaling.js" || true
pkill -f "node wave-loadtest.js" || true
sleep 1

# 创建TMUX会话
SESSION_NAME="serverless-demo"
WINDOW_NAME="serverless"

# 检查TMUX是否已安装
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}未检测到tmux，将在标准终端中启动服务。${NC}"
    echo -e "${YELLOW}建议安装tmux以获得更好的体验: sudo apt install tmux${NC}"
    
    # 启动服务器
    echo -e "${BLUE}启动Serverless服务器...${NC}"
    node server-with-scaling.js > logs/server.log 2>&1 &
    SERVER_PID=$!
    
    # 等待服务器启动
    echo -e "${YELLOW}等待服务器启动...${NC}"
    sleep 2
    
    # 启动自动扩展监控
    echo -e "${BLUE}启动自动扩展监控...${NC}"
    node auto-scale.js > logs/auto-scale.log 2>&1 &
    AUTOSCALER_PID=$!
    
    # 等待自动扩展监控启动
    echo -e "${YELLOW}等待自动扩展监控启动...${NC}"
    sleep 2
    
    # 启动弹性扩缩容监控器
    echo -e "${BLUE}启动弹性扩缩容监控器...${NC}"
    node monitor-scaling.js
    
    # 当监控器退出后，运行负载测试
    echo -e "${BLUE}开始运行波动负载测试...${NC}"
    node wave-loadtest.js
    
    # 生成报告
    echo -e "${BLUE}生成弹性测试报告...${NC}"
    node analyze-results.js
    
    # 清理
    echo -e "${YELLOW}停止服务...${NC}"
    kill $SERVER_PID $AUTOSCALER_PID
else
    # 检查是否已存在会话
    if tmux has-session -t $SESSION_NAME 2>/dev/null; then
        echo -e "${YELLOW}已存在Serverless演示会话，正在关闭...${NC}"
        tmux kill-session -t $SESSION_NAME
    fi
    
    # 创建会话
    echo -e "${BLUE}创建tmux会话: ${SESSION_NAME}${NC}"
    tmux new-session -d -s $SESSION_NAME -n $WINDOW_NAME
    
    # 创建窗口和面板布局
    tmux split-window -h -t $SESSION_NAME:$WINDOW_NAME
    tmux split-window -v -t $SESSION_NAME:$WINDOW_NAME.1
    tmux split-window -v -t $SESSION_NAME:$WINDOW_NAME.0
    
    # 面板0: 服务器
    tmux send-keys -t $SESSION_NAME:$WINDOW_NAME.0 "echo -e '${GREEN}启动Serverless服务器...${NC}'; node server-with-scaling.js | tee logs/server.log" C-m
    
    # 等待服务器启动
    sleep 2
    
    # 面板1: 自动扩展监控
    tmux send-keys -t $SESSION_NAME:$WINDOW_NAME.1 "echo -e '${GREEN}启动自动扩展监控...${NC}'; node auto-scale.js | tee logs/auto-scale.log" C-m
    
    # 等待自动扩展监控启动
    sleep 2
    
    # 面板2: 弹性扩缩容监控器
    tmux send-keys -t $SESSION_NAME:$WINDOW_NAME.2 "echo -e '${GREEN}启动弹性扩缩容监控器...${NC}'; node monitor-scaling.js" C-m
    
    # 面板3: 波动负载测试
    tmux send-keys -t $SESSION_NAME:$WINDOW_NAME.3 "echo -e '${GREEN}准备负载测试...${NC}'; echo -e '${YELLOW}按回车键开始波动负载测试${NC}'; read; node wave-loadtest.js | tee logs/wave-loadtest.log; echo -e '${GREEN}负载测试完成。按任意键继续...${NC}'; read -n 1; node analyze-results.js" C-m
    
    # 选择监控面板
    tmux select-pane -t $SESSION_NAME:$WINDOW_NAME.2
    
    # 附加到会话
    echo -e "${GREEN}启动完成，正在附加到tmux会话...${NC}"
    echo -e "${YELLOW}使用Ctrl+B然后按D可以分离会话${NC}"
    echo -e "${YELLOW}使用'tmux attach -t ${SESSION_NAME}'可以重新连接会话${NC}"
    sleep 1
    tmux attach-session -t $SESSION_NAME
fi

echo -e "${GREEN}测试完成，服务已停止。${NC}"
echo -e "${BLUE}测试报告已保存到 logs/elasticity-report.txt${NC}" 