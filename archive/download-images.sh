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

# 检查 wget 是否安装
if ! command -v wget &> /dev/null; then
    print_error "wget 未安装，请先安装 wget"
    exit 1
fi

# 创建镜像目录
print_info "创建镜像目录..."
mkdir -p images

# 下载 k3s 镜像
print_info "下载 k3s 镜像..."
wget -c --progress=bar:force -O images/k3s-airgap-images-amd64.tar https://ghproxy.com/https://github.com/k3s-io/k3s/releases/download/v1.28.6%2Bk3s1/k3s-airgap-images-amd64.tar

# 下载 k3s 安装脚本
print_info "下载 k3s 安装脚本..."
wget -c --progress=bar:force -O images/k3s-install.sh https://get.k3s.io

# 下载 Knative 镜像
print_info "下载 Knative 镜像..."
wget -c --progress=bar:force -O images/knative-serving-crds.yaml https://ghproxy.com/https://github.com/knative/serving/releases/download/knative-v1.9.0/serving-crds.yaml
wget -c --progress=bar:force -O images/knative-serving-core.yaml https://ghproxy.com/https://github.com/knative/serving/releases/download/knative-v1.9.0/serving-core.yaml
wget -c --progress=bar:force -O images/knative-net-istio.yaml https://ghproxy.com/https://github.com/knative/net-istio/releases/download/knative-v1.9.0/release.yaml

# 下载 Istio 镜像
print_info "下载 Istio 镜像..."
wget -c --progress=bar:force -O images/istio-1.20.0-linux-amd64.tar.gz https://ghproxy.com/https://github.com/istio/istio/releases/download/1.20.0/istio-1.20.0-linux-amd64.tar.gz

print_info "所有镜像下载完成！"
print_info "镜像保存在 images 目录中。" 