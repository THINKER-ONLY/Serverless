const express = require("express");
const app = express();

// 环境变量，用于演示自动扩缩
const PORT = process.env.PORT || 8080;
const DELAY_MS = process.env.DELAY_MS || 0;

// 健康检查端点
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// 主要服务端点
app.get("/", (req, res) => {
  // 模拟处理负载 - 通过延迟参数
  setTimeout(() => {
    const name = req.query.name || "World";
    res.send(`Hello, ${name}! (from pod ${process.env.HOSTNAME || "unknown"})`);
  }, parseInt(DELAY_MS));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Hello service running on port ${PORT}`);
  console.log(`Configured delay: ${DELAY_MS}ms`);
}); 