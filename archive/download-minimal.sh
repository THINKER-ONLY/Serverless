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

# 创建目录
mkdir -p minimal-files

# 尝试不同的镜像源下载k3s安装脚本
print_info "尝试从阿里云下载k3s安装脚本..."
curl -m 10 -L -o minimal-files/k3s-install-ali.sh https://rancher-mirror.oss-cn-beijing.aliyuncs.com/k3s/k3s-install.sh || \
print_warn "从阿里云下载失败"

print_info "尝试从腾讯云下载k3s安装脚本..."
curl -m 10 -L -o minimal-files/k3s-install-tencent.sh https://mirrors.cloud.tencent.com/k3s/k3s-install.sh || \
print_warn "从腾讯云下载失败"

print_info "尝试从官方源下载k3s安装脚本..."
curl -m 10 -L -o minimal-files/k3s-install-official.sh https://get.k3s.io || \
print_warn "从官方源下载失败"

# 下载测试YAML文件
print_info "下载测试用的YAML文件..."
curl -m 10 -L -o minimal-files/nginx-test.yaml https://k8s.io/examples/application/deployment.yaml || \
print_warn "下载测试YAML文件失败"

# 检查文件是否下载成功
print_info "检查下载文件..."
ls -lh minimal-files/

print_info "下载完成！" 