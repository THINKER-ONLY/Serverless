#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始修复网络和镜像问题..."

# 设置Docker加速器
echo -e "${GREEN}[INFO]${NC} 配置Docker镜像加速..."
sudo mkdir -p /etc/docker
cat << EOF | sudo tee /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://registry.docker-cn.com",
    "https://hub-mirror.c.163.com",
    "https://docker.mirrors.ustc.edu.cn"
  ],
  "dns": ["8.8.8.8", "114.114.114.114", "223.5.5.5"],
  "insecure-registries": ["registry.cn-hangzhou.aliyuncs.com"]
}
EOF

# 重启Docker服务
echo -e "${GREEN}[INFO]${NC} 重启Docker服务..."
sudo systemctl restart docker
sleep 5

# 预先拉取pause镜像
echo -e "${GREEN}[INFO]${NC} 预先拉取pause镜像..."
sudo docker pull registry.cn-hangzhou.aliyuncs.com/google_containers/pause:3.6
sudo docker tag registry.cn-hangzhou.aliyuncs.com/google_containers/pause:3.6 rancher/mirrored-pause:3.6

# 重启k3s服务
echo -e "${GREEN}[INFO]${NC} 重启k3s服务..."
sudo systemctl restart k3s
sleep 10

echo -e "${GREEN}[INFO]${NC} 删除失败的Pod，让它们自动重新创建..."
kubectl delete pod --all -n kourier-system

echo -e "${GREEN}[INFO]${NC} 等待服务恢复..."
sleep 10
kubectl get pods -n kourier-system

echo -e "${GREEN}[INFO]${NC} 网络和镜像问题修复完成！" 