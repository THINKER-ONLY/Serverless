#!/bin/bash

# 设置错误时立即退出
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 打印带颜色的信息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 检查必要的命令
print_info "检查必要的命令..."
check_command curl

# 配置 Docker 的 DNS
print_info "配置 Docker 的 DNS..."
cat << EOF | sudo tee /etc/docker/daemon.json
{
  "dns": ["8.8.8.8", "8.8.4.4", "223.5.5.5", "223.6.6.6"],
  "dns-opts": ["timeout:2", "attempts:3"]
}
EOF

print_info "重启 Docker 服务..."
sudo systemctl restart docker

# 安装 k3s
print_info "安装 k3s..."
curl -sfL https://rancher-mirror.oss-cn-beijing.aliyuncs.com/k3s/k3s-install.sh | \
    INSTALL_K3S_MIRROR=cn \
    K3S_KUBECONFIG_MODE="644" \
    sh -

# 等待 k3s 准备好
print_info "等待 k3s 准备好..."
sleep 10
until kubectl get nodes &>/dev/null; do
    print_info "等待 k3s 准备好..."
    sleep 5
done

print_info "k3s 已成功安装！"
kubectl get nodes