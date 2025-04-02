#!/bin/bash

# Knative on Kind安装脚本
# 本脚本基于Kind创建Kubernetes集群并安装Knative Serving

set -e

# 颜色编码
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # 无颜色

# 检查所需命令是否存在
echo -e "${YELLOW}[1/7]${NC} 检查所需工具..."
for cmd in kind docker kubectl curl; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${RED}错误: 未找到命令 '$cmd'. 请先安装此工具.${NC}"
    exit 1
  fi
done
echo -e "${GREEN}✓ 所有必需工具都已安装${NC}"

# 创建Kind集群（如果尚不存在）
echo -e "${YELLOW}[2/7]${NC} 创建Kind集群..."
if kind get clusters | grep -q "^knative$"; then
  echo -e "${YELLOW}Kind 集群'knative'已存在, 跳过创建${NC}"
else
  echo "使用配置创建新集群..."
  kind create cluster --name knative --config=kind-config.yaml
  echo -e "${GREEN}✓ Kind 集群已创建${NC}"
fi

# 设置kubectl上下文
kubectl cluster-info --context kind-knative
echo -e "${GREEN}✓ Kubectl 已配置为使用Kind集群${NC}"

# 安装Knative Serving CRDs
echo -e "${YELLOW}[3/7]${NC} 安装Knative Serving CRDs..."
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.10.1/serving-crds.yaml
echo -e "${GREEN}✓ Knative Serving CRDs 已安装${NC}"

# 安装Knative Serving核心组件
echo -e "${YELLOW}[4/7]${NC} 安装Knative Serving核心组件..."
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.10.1/serving-core.yaml
echo -e "${GREEN}✓ Knative Serving 核心组件已安装${NC}"

# 等待Knative控制平面就绪
echo -e "${YELLOW}[5/7]${NC} 等待Knative控制平面就绪..."
kubectl wait --for=condition=Available --timeout=300s deployment --all -n knative-serving
echo -e "${GREEN}✓ Knative 控制平面已就绪${NC}"

# 安装Kourier作为Ingress控制器
echo -e "${YELLOW}[6/7]${NC} 安装Kourier Ingress..."
kubectl apply -f https://github.com/knative/net-kourier/releases/download/knative-v1.10.0/kourier.yaml
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'
echo -e "${GREEN}✓ Kourier已安装并配置${NC}"

# 配置DNS（使用 sslip.io 作为简单方法）
echo -e "${YELLOW}[7/7]${NC} 配置DNS..."
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.10.1/serving-default-domain.yaml
kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"sslip.io":""}}'

echo -e "${GREEN}完成! Knative已安装在Kind集群上.${NC}"
echo -e "可以使用以下命令验证安装:"
echo "kubectl get pods -n knative-serving"
echo "kubectl get ksvc"
echo ""
echo -e "${YELLOW}提示: 构建您的serverless服务并使用 kubectl apply -f <service.yaml> 部署它们${NC}" 