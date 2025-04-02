# 简易Serverless应用框架

这是一个轻量级的本地Serverless函数框架，支持函数的自动扩缩容和性能监控。

## 项目结构

```
serverless/
├── serverless-app/    # 主要应用代码
│   ├── functions/     # 可调用的函数
│   ├── public/        # 静态资源
│   ├── logs/          # 日志文件
│   ├── server.js      # 基础HTTP服务器
│   ├── server-with-scaling.js  # 支持自动扩缩容的服务器
│   ├── auto-scale.js  # 自动扩缩容监控服务
│   ├── monitor-scaling.js  # 实时监控工具
│   └── wave-loadtest.js  # 波动负载测试工具
├── archive/           # 归档的旧脚本和配置
├── backup/            # 备份文件
└── README.md          # 本文件
```

## 快速开始

进入 `serverless-app` 目录，运行快速启动脚本:

```bash
cd serverless-app
./quick-elasticity-test.sh
```

## 详细文档

请参阅 `serverless-app/README.md` 获取详细的使用说明和功能介绍。

## 开发者

本框架仅供学习和测试使用，所有数据和功能都在本地运行，无需网络连接。

## 更新日志

参见 `serverless-app/changelog.md` 获取最近更新详情。 