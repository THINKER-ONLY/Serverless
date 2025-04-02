#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 打印信息
echo -e "${GREEN}[INFO]${NC} 开始修复k3s镜像配置..."

# 创建一个简单的Serverless应用进行测试
echo -e "${GREEN}[INFO]${NC} 创建一个简单的测试应用..."
cat << EOF > hello-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hello-app
  template:
    metadata:
      labels:
        app: hello-app
    spec:
      containers:
      - name: hello-app
        image: nginx:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: hello-app
  namespace: default
spec:
  selector:
    app: hello-app
  ports:
  - port: 80
    targetPort: 80
  type: NodePort
EOF

# 清理之前创建的资源
echo -e "${GREEN}[INFO]${NC} 清理之前创建的资源..."
kubectl delete namespace kourier-system || true
kubectl delete namespace knative-serving || true
kubectl delete -f hello-app.yaml || true

# 应用测试部署
echo -e "${GREEN}[INFO]${NC} 部署测试应用..."
kubectl apply -f hello-app.yaml

# 检查是否正在运行
echo -e "${GREEN}[INFO]${NC} 等待测试应用启动..."
kubectl wait --for=condition=available --timeout=60s deployment/hello-app

# 显示结果
echo -e "${GREEN}[INFO]${NC} 查看结果..."
kubectl get pods
kubectl get services

echo -e "${GREEN}[INFO]${NC} 测试完成！如果测试应用正常运行，说明k3s已可正常工作。"
echo -e "${YELLOW}[提示]${NC} 由于网络问题，Knative安装可能需要更好的网络环境才能完成。"
echo -e "${YELLOW}[提示]${NC} 您可以尝试使用以下命令访问测试应用:"
echo -e "  curl http://localhost:\$(kubectl get svc hello-app -o jsonpath='{.spec.ports[0].nodePort}')" 