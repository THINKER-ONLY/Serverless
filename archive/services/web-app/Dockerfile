FROM golang:1.19-alpine AS builder

WORKDIR /app

# 复制Go模块定义
COPY go.mod ./
COPY go.sum ./

# 下载依赖项（如果存在）
RUN go mod download

# 复制源代码
COPY . ./

# 构建应用程序
RUN CGO_ENABLED=0 GOOS=linux go build -o web-app ./src

# 最终运行阶段使用更小的镜像
FROM alpine:3.17

WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/web-app .

# 暴露端口
EXPOSE 8080

# 运行应用
CMD ["./web-app"] 