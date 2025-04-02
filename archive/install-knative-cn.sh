#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始安装Knative(国内镜像版)..."

# 验证k3s是否正常运行
echo -e "${GREEN}[INFO]${NC} 验证k3s状态..."
kubectl get nodes
if [ $? -ne 0 ]; then
  echo -e "${RED}[ERROR]${NC} k3s未正常运行，请先安装k3s"
  exit 1
fi

# 创建临时目录
TEMP_DIR=$(mktemp -d)
echo -e "${GREEN}[INFO]${NC} 创建临时目录: $TEMP_DIR"

# 下载Knative YAML文件
echo -e "${GREEN}[INFO]${NC} 下载Knative YAML文件(超时设置为30秒)..."
curl -m 30 -L -o $TEMP_DIR/serving-crds.yaml https://github.com/knative/serving/releases/download/knative-v1.9.0/serving-crds.yaml
curl -m 30 -L -o $TEMP_DIR/serving-core.yaml https://github.com/knative/serving/releases/download/knative-v1.9.0/serving-core.yaml
curl -m 30 -L -o $TEMP_DIR/kourier.yaml https://github.com/knative/net-kourier/releases/download/knative-v1.9.0/kourier.yaml

# 检查文件是否下载成功
for file in serving-crds.yaml serving-core.yaml kourier.yaml; do
  if [ ! -s "$TEMP_DIR/$file" ]; then
    echo -e "${RED}[ERROR]${NC} 下载 $file 失败，文件为空"
    exit 1
  fi
done

# 修改镜像地址为阿里云镜像
echo -e "${GREEN}[INFO]${NC} 修改镜像地址为阿里云镜像..."
sed -i 's/gcr.io/registry.cn-hangzhou.aliyuncs.com\/google_containers/g' $TEMP_DIR/*.yaml
sed -i 's/docker.io/registry.cn-hangzhou.aliyuncs.com/g' $TEMP_DIR/*.yaml
sed -i 's/registry.k8s.io/registry.cn-hangzhou.aliyuncs.com\/google_containers/g' $TEMP_DIR/*.yaml

# 安装 Knative Serving CRDs
echo -e "${GREEN}[INFO]${NC} 安装 Knative Serving CRDs..."
kubectl apply -f $TEMP_DIR/serving-crds.yaml

# 等待CRDs准备好
echo -e "${GREEN}[INFO]${NC} 等待 Knative CRDs 准备好..."
sleep 5

# 安装 Knative Serving 核心组件
echo -e "${GREEN}[INFO]${NC} 安装 Knative Serving 核心组件..."
kubectl apply -f $TEMP_DIR/serving-core.yaml

# 等待Knative Serving准备好
echo -e "${GREEN}[INFO]${NC} 等待 Knative Serving 准备好..."
kubectl wait pods --for=condition=Ready -n knative-serving -l '!job-name' --timeout=120s || true

# 安装 Kourier 网络层
echo -e "${GREEN}[INFO]${NC} 安装 Kourier 网络层..."
kubectl apply -f $TEMP_DIR/kourier.yaml

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

# 清理临时目录
echo -e "${GREEN}[INFO]${NC} 清理临时目录..."
rm -rf $TEMP_DIR

# 验证安装
echo -e "${GREEN}[INFO]${NC} 验证 Knative 安装..."
kubectl get pods -n knative-serving

echo -e "${GREEN}[INFO]${NC} Knative 安装完成！"
echo -e "${YELLOW}[提示]${NC} 您可以使用以下命令部署一个测试服务:"
echo -e "  kubectl create -f https://raw.githubusercontent.com/knative/docs/main/docs/serving/autoscaling/autoscale-go/service.yaml" 