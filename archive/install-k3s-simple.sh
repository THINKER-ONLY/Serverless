#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始安装k3s..."

# 直接使用阿里云镜像安装k3s
curl -sfL https://rancher-mirror.oss-cn-beijing.aliyuncs.com/k3s/k3s-install.sh | \
  INSTALL_K3S_MIRROR=cn \
  sh -

# 设置kubeconfig
echo -e "${GREEN}[INFO]${NC} 设置kubeconfig..."
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config

# 验证安装
echo -e "${GREEN}[INFO]${NC} 验证安装..."
kubectl get nodes

echo -e "${GREEN}[INFO]${NC} k3s安装完成！" 