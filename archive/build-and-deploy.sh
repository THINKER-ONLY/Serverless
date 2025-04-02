#!/bin/bash

# 构建和部署Serverless服务到Knative
# 此脚本构建所有服务的Docker镜像，并将它们部署到Knative

set -e

# 颜色编码
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # 无颜色

# 确保Kind集群存在
if ! kind get clusters | grep -q "^knative$"; then
  echo -e "${RED}错误: Kind集群'knative'不存在. 请先运行 ./install-knative.sh${NC}"
  exit 1
fi

# 检查当前目录是否包含services目录
if [ ! -d "services" ]; then
  echo -e "${RED}错误: 没有找到services目录. 请在项目根目录运行此脚本.${NC}"
  exit 1
fi

# 为本地开发设置registry URL (kind集群)
export REGISTRY_URL="localhost:5000"

# 检查是否已存在本地registry
if [ "$(docker ps -q -f name=local-registry)" ]; then
  echo -e "${YELLOW}本地Docker registry已运行${NC}"
else
  echo -e "${YELLOW}创建本地Docker registry...${NC}"
  docker run -d -p 5000:5000 --name local-registry registry:2
fi

# 确保kind集群可以访问本地registry
echo -e "${YELLOW}确保Kind集群可以访问本地registry...${NC}"
if ! kubectl get configmap/local-registry-hosting -n kube-public > /dev/null 2>&1; then
  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:5000"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF
fi

# 构建和推送所有服务
echo -e "${YELLOW}开始构建和推送所有服务...${NC}"

# 处理服务目录下的所有服务
for service_dir in services/*/; do
  service_name=$(basename $service_dir)
  echo -e "${YELLOW}处理服务: $service_name${NC}"
  
  if [ ! -f "$service_dir/Dockerfile" ]; then
    echo -e "${RED}错误: $service_dir 中没有找到Dockerfile. 跳过该服务.${NC}"
    continue
  fi
  
  # 构建Docker镜像
  echo -e "构建镜像 $REGISTRY_URL/$service_name..."
  docker build -t $REGISTRY_URL/$service_name $service_dir
  
  # 推送到本地registry
  echo -e "推送镜像到本地registry..."
  docker push $REGISTRY_URL/$service_name
  
  # 检查是否有服务定义文件
  if [ -f "$service_dir/service.yaml" ]; then
    echo -e "应用Knative服务配置..."
    # 替换环境变量并应用配置
    envsubst < $service_dir/service.yaml | kubectl apply -f -
    echo -e "${GREEN}✓ 已部署 $service_name 到 Knative${NC}"
  else
    echo -e "${RED}错误: $service_dir 中没有找到service.yaml. 跳过部署.${NC}"
  fi
  
  echo ""
done

echo -e "${GREEN}所有服务已构建并部署!${NC}"
echo -e "使用以下命令查看部署的服务:"
echo "kubectl get ksvc"
echo ""
echo -e "${YELLOW}服务URL可以通过下列命令获取:${NC}"
echo "kubectl get ksvc <服务名> -o jsonpath='{.status.url}'" 