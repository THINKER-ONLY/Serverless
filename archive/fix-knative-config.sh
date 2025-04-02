#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始修复Knative配置..."

# 创建缺失的configmap
echo -e "${GREEN}[INFO]${NC} 创建缺失的configmap..."

# 创建config-network configmap
kubectl create configmap config-network --namespace knative-serving || true
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

# 创建config-domain configmap
kubectl create configmap config-domain --namespace knative-serving || true
kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"example.com":""}}'

# 检查网络组件状态
echo -e "${GREEN}[INFO]${NC} 检查网络组件状态..."
kubectl get pods -n kourier-system

# 等待Knative组件启动
echo -e "${GREEN}[INFO]${NC} 等待Kourier组件启动..."
kubectl wait --for=condition=available --timeout=120s deployment/3scale-kourier-control -n kourier-system || true
kubectl wait --for=condition=available --timeout=120s deployment/3scale-kourier-gateway -n kourier-system || true

# 获取测试服务状态
echo -e "${GREEN}[INFO]${NC} 检查测试服务状态..."
kubectl get ksvc

echo -e "${GREEN}[INFO]${NC} Knative配置修复完成！"
echo -e "${YELLOW}[提示]${NC} 您可以使用以下命令访问测试服务:"
echo -e "  curl -H \"Host: hello.default.example.com\" http://\$(kubectl get svc kourier -n kourier-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')" 