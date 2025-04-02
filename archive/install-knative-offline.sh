#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始使用本地文件安装Knative..."

# 验证k3s是否正常运行
echo -e "${GREEN}[INFO]${NC} 验证k3s状态..."
kubectl get nodes
if [ $? -ne 0 ]; then
  echo -e "${RED}[ERROR]${NC} k3s未正常运行，请先安装k3s"
  exit 1
fi

# 安装 Knative Serving CRDs
echo -e "${GREEN}[INFO]${NC} 安装 Knative Serving CRDs..."
kubectl apply -f serving-crds.yaml

# 等待CRDs准备好
echo -e "${GREEN}[INFO]${NC} 等待 Knative CRDs 准备好..."
sleep 5

# 创建serving-core.yaml文件
echo -e "${GREEN}[INFO]${NC} 创建serving-core.yaml文件..."
cat <<EOF > serving-core.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: knative-serving
  labels:
    app.kubernetes.io/name: knative-serving
    app.kubernetes.io/version: "1.9.0"
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: controller
  namespace: knative-serving
  labels:
    app.kubernetes.io/version: "1.9.0"
    app.kubernetes.io/name: knative-serving
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: knative-serving-controller-admin
  labels:
    app.kubernetes.io/version: "1.9.0"
    app.kubernetes.io/name: knative-serving
subjects:
  - kind: ServiceAccount
    name: controller
    namespace: knative-serving
roleRef:
  kind: ClusterRole
  name: knative-serving-admin
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: knative-serving-admin
  labels:
    app.kubernetes.io/version: "1.9.0"
    app.kubernetes.io/name: knative-serving
    rbac.authorization.k8s.io/aggregate-to-admin: "true"
    rbac.authorization.k8s.io/aggregate-to-edit: "true"
rules:
  - apiGroups: ["serving.knative.dev"]
    resources: ["*"]
    verbs: ["*"]
EOF

# 安装 Knative Serving 核心组件
echo -e "${GREEN}[INFO]${NC} 安装 Knative Serving 核心组件..."
kubectl apply -f serving-core.yaml

# 安装 Kourier 网络层
echo -e "${GREEN}[INFO]${NC} 安装 Kourier 网络层..."
kubectl apply -f kourier-release.yaml

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

# 创建一个测试服务
echo -e "${GREEN}[INFO]${NC} 创建测试服务..."
cat <<EOF > test-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: hello
  namespace: default
spec:
  template:
    spec:
      containers:
        - image: registry.cn-hangzhou.aliyuncs.com/knative-sample/helloworld-go:latest
          env:
            - name: TARGET
              value: "World"
EOF

# 部署测试服务
echo -e "${GREEN}[INFO]${NC} 部署测试服务..."
kubectl apply -f test-service.yaml

# 验证安装
echo -e "${GREEN}[INFO]${NC} 验证 Knative 安装..."
kubectl get pods -n knative-serving
kubectl get ksvc

echo -e "${GREEN}[INFO]${NC} Knative 安装完成！"
echo -e "${YELLOW}[提示]${NC} 您可以使用以下命令访问测试服务:"
echo -e "  curl -H \"Host: hello.default.example.com\" http://\$(kubectl get svc kourier -n kourier-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"