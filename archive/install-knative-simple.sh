#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始安装Knative..."

# 验证k3s是否正常运行
echo -e "${GREEN}[INFO]${NC} 验证k3s状态..."
kubectl get nodes
if [ $? -ne 0 ]; then
  echo -e "${RED}[ERROR]${NC} k3s未正常运行，请先安装k3s"
  exit 1
fi

# 安装 Knative Serving CRDs
echo -e "${GREEN}[INFO]${NC} 安装 Knative Serving CRDs..."
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.9.0/serving-crds.yaml

# 等待CRDs准备好
echo -e "${GREEN}[INFO]${NC} 等待 Knative CRDs 准备好..."
sleep 5

# 安装 Knative Serving 核心组件
echo -e "${GREEN}[INFO]${NC} 安装 Knative Serving 核心组件..."
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.9.0/serving-core.yaml

# 等待Knative Serving准备好
echo -e "${GREEN}[INFO]${NC} 等待 Knative Serving 准备好..."
kubectl wait pods --for=condition=Ready -n knative-serving -l '!job-name' --timeout=120s

# 安装 Kourier 网络层
echo -e "${GREEN}[INFO]${NC} 安装 Kourier 网络层..."
kubectl apply -f https://github.com/knative/net-kourier/releases/download/knative-v1.9.0/kourier.yaml

# 将 Kourier 设置为默认网关
echo -e "${GREEN}[INFO]${NC} 将 Kourier 设置为默认网关..."
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

# 配置 Knative 域名
echo -e "${GREEN}[INFO]${NC} 配置 Knative 域名..."
kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"example.com":""}}'

# 验证安装
echo -e "${GREEN}[INFO]${NC} 验证 Knative 安装..."
kubectl get pods -n knative-serving

echo -e "${GREEN}[INFO]${NC} Knative 安装完成！"
echo -e "${YELLOW}[提示]${NC} 您可以使用以下命令部署一个测试服务:"
echo -e "  kubectl apply -f https://raw.githubusercontent.com/knative/docs/main/docs/serving/autoscaling/autoscale-go/service.yaml" 