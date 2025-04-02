#!/bin/bash

# 负载测试脚本，用于测试Knative服务的弹性扩展能力

set -e

# 默认参数
SERVICE_URL=${1:-"http://localhost:8080"}
CONCURRENCY=${2:-10}
REQUESTS=${3:-500}
RATE=${4:-20}  # 每秒请求数
TIMEOUT=${5:-10s}  # 超时时间

# 打印测试参数
echo "========================================"
echo "     Knative 服务弹性扩展负载测试      "
echo "========================================"
echo "服务URL: $SERVICE_URL"
echo "并发数: $CONCURRENCY"
echo "总请求数: $REQUESTS"
echo "请求速率: $RATE rps"
echo "超时时间: $TIMEOUT"
echo "========================================"

# 确认是否继续
read -p "是否开始测试? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "测试取消"
    exit 1
fi

# 检查是否安装了hey
if ! command -v hey &> /dev/null
then
    echo "未找到负载测试工具'hey'。正在安装..."
    # 为不同的操作系统安装hey
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        wget -q https://hey-release.s3.us-east-2.amazonaws.com/hey_linux_amd64 -O hey
        chmod +x hey
        sudo mv hey /usr/local/bin/
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install hey
    else
        echo "不支持的操作系统。请手动安装 hey: https://github.com/rakyll/hey"
        exit 1
    fi
fi

# 执行负载测试
echo "开始执行负载测试..."
hey -n $REQUESTS -c $CONCURRENCY -q $RATE -z $TIMEOUT $SERVICE_URL

echo "测试完成。请检查Knative服务的伸缩情况。"
echo "使用以下命令查看Pod扩缩情况:"
echo "kubectl get pods -w"
echo "或者:"
echo "kubectl get ksvc" 