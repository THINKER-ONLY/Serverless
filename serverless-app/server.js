#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 端口配置
const PORT = process.env.PORT || 3000;

// 函数目录
const FUNCTIONS_DIR = path.join(__dirname, 'functions');

// 加载所有函数
function loadFunctions() {
  const functions = {};
  
  if (fs.existsSync(FUNCTIONS_DIR)) {
    const files = fs.readdirSync(FUNCTIONS_DIR);
    
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const name = path.basename(file, '.js');
        const functionPath = path.join(FUNCTIONS_DIR, file);
        console.log(`加载函数: ${name} 从 ${functionPath}`);
        functions[name] = require(functionPath);
      }
    });
  }
  
  return functions;
}

// 解析请求体
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    const bodyParts = [];
    req.on('data', (chunk) => {
      bodyParts.push(chunk);
    }).on('end', () => {
      const body = Buffer.concat(bodyParts).toString();
      if (body && req.headers['content-type'] === 'application/json') {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      } else {
        resolve(body || {});
      }
    }).on('error', reject);
  });
}

// 解析查询参数
function parseQuery(reqUrl) {
  const parsedUrl = url.parse(reqUrl, true);
  return parsedUrl.query;
}

// 创建HTTP响应对象
function createResponseObject(res) {
  const responseObj = {
    status: (code) => {
      res.statusCode = code;
      return responseObj;
    },
    json: (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data, null, 2));
    },
    send: (data) => {
      if (typeof data === 'object') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } else {
        res.setHeader('Content-Type', 'text/plain');
        res.end(data);
      }
    },
    html: (data) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(data);
    }
  };
  return responseObj;
}

// 加载所有函数
const functions = loadFunctions();
console.log(`已加载 ${Object.keys(functions).length} 个函数`);

// 创建服务器
const server = http.createServer(async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // 解析路径
  const parsedUrl = url.parse(req.url, true);
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  
  // 解析请求体
  req.body = await parseBody(req);
  
  // 解析查询参数
  req.query = parseQuery(req.url);
  
  // 创建响应对象
  const responseObj = createResponseObject(res);
  
  if (pathSegments.length === 0 || pathSegments[0] === '') {
    // 处理根路径
    responseObj.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>简易Serverless框架</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            .function { background: #f5f5f5; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
            .function h3 { margin-top: 0; }
            a { color: #0066cc; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>简易Serverless框架</h1>
          <p>可用函数列表:</p>
          ${Object.keys(functions).map(name => `
            <div class="function">
              <h3>${name}</h3>
              <p>
                <a href="/${name}" target="_blank">GET /${name}</a>
              </p>
            </div>
          `).join('')}
        </body>
      </html>
    `);
    return;
  }
  
  // 获取函数名称
  const functionName = pathSegments[0];
  
  // 检查函数是否存在
  if (functions[functionName]) {
    try {
      // 调用函数
      functions[functionName](req, responseObj);
    } catch (error) {
      console.error(`函数 ${functionName} 执行错误:`, error);
      responseObj.status(500).json({ error: '函数执行错误', message: error.message });
    }
  } else {
    // 函数不存在
    responseObj.status(404).json({ error: '函数不存在', message: `找不到函数: ${functionName}` });
  }
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('可用函数:');
  Object.keys(functions).forEach(name => {
    console.log(`  - ${name}: http://localhost:${PORT}/${name}`);
  });
});
