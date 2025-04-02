#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}[INFO]${NC} 创建基本的函数计算平台..."

# 1. 创建function-runtime命名空间
echo -e "${GREEN}[INFO]${NC} 创建函数计算运行时命名空间..."
kubectl create namespace function-runtime

# 2. 创建简单的函数部署控制器
echo -e "${GREEN}[INFO]${NC} 创建函数部署控制器配置..."

cat <<EOF > function-crd.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: functions.serverless.example.com
spec:
  group: serverless.example.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                image:
                  type: string
                env:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      value:
                        type: string
                replicas:
                  type: integer
                  minimum: 1
                  default: 1
      additionalPrinterColumns:
      - name: Image
        type: string
        jsonPath: .spec.image
      - name: Replicas
        type: integer
        jsonPath: .spec.replicas
      - name: Age
        type: date
        jsonPath: .metadata.creationTimestamp
  scope: Namespaced
  names:
    plural: functions
    singular: function
    kind: Function
    shortNames:
    - fn
EOF

kubectl apply -f function-crd.yaml

# 3. 创建函数控制器
echo -e "${GREEN}[INFO]${NC} 创建函数控制器..."

cat <<EOF > function-controller.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: function-controller
  namespace: function-runtime
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: function-controller
rules:
- apiGroups: ["serverless.example.com"]
  resources: ["functions"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: function-controller
subjects:
- kind: ServiceAccount
  name: function-controller
  namespace: function-runtime
roleRef:
  kind: ClusterRole
  name: function-controller
  apiGroup: rbac.authorization.k8s.io
EOF

kubectl apply -f function-controller.yaml

# 4. 创建示例函数
echo -e "${GREEN}[INFO]${NC} 创建一个示例函数..."

cat <<EOF > example-function.yaml
apiVersion: serverless.example.com/v1
kind: Function
metadata:
  name: hello-world
spec:
  image: nginx:stable-alpine
  replicas: 1
EOF

kubectl apply -f example-function.yaml

# 5. 创建简单的函数部署操作器
echo -e "${GREEN}[INFO]${NC} 创建函数部署操作器脚本..."

cat <<EOF > deploy-function.sh
#!/bin/bash

# 使用传入的函数名称和命名空间(默认为default)
FUNCTION_NAME=\${1:-hello-world}
NAMESPACE=\${2:-default}

# 获取函数定义
FUNCTION_DEF=\$(kubectl get function \$FUNCTION_NAME -n \$NAMESPACE -o json)
if [ \$? -ne 0 ]; then
  echo "无法找到函数 \$FUNCTION_NAME"
  exit 1
fi

# 提取信息
IMAGE=\$(echo \$FUNCTION_DEF | jq -r .spec.image)
REPLICAS=\$(echo \$FUNCTION_DEF | jq -r '.spec.replicas // 1')

# 使用提取的信息创建部署和服务
cat <<EOFDEPLOY > \${FUNCTION_NAME}-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: \${FUNCTION_NAME}
  namespace: \${NAMESPACE}
spec:
  replicas: \${REPLICAS}
  selector:
    matchLabels:
      function: \${FUNCTION_NAME}
  template:
    metadata:
      labels:
        function: \${FUNCTION_NAME}
    spec:
      containers:
      - name: function
        image: \${IMAGE}
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: \${FUNCTION_NAME}
  namespace: \${NAMESPACE}
spec:
  selector:
    function: \${FUNCTION_NAME}
  ports:
  - port: 80
    targetPort: 80
  type: NodePort
EOFDEPLOY

kubectl apply -f \${FUNCTION_NAME}-deployment.yaml
EOF

chmod +x deploy-function.sh

# 部署示例函数
echo -e "${GREEN}[INFO]${NC} 部署示例函数..."
./deploy-function.sh hello-world default

# 等待函数部署就绪
echo -e "${GREEN}[INFO]${NC} 等待函数部署就绪..."
kubectl rollout status deployment/hello-world

# 显示函数访问信息
echo -e "${GREEN}[INFO]${NC} 获取函数访问信息..."
NODE_PORT=$(kubectl get svc hello-world -o jsonpath='{.spec.ports[0].nodePort}')
HOST_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}[INFO]${NC} 函数计算平台安装完成！"
echo -e "${YELLOW}[提示]${NC} 您可以通过以下地址访问示例函数:"
echo -e "  http://${HOST_IP}:${NODE_PORT}"
echo -e "${YELLOW}[提示]${NC} 使用以下命令查看函数列表:"
echo -e "  kubectl get functions"
echo -e "${YELLOW}[提示]${NC} 使用以下命令部署其他函数:"
echo -e "  ./deploy-function.sh <函数名称> <命名空间>" 