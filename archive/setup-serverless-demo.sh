#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # 无颜色

# 显示标题
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}      Serverless 模拟环境设置               ${NC}"
echo -e "${GREEN}=============================================${NC}"

# 检查是否安装了Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到Node.js。请先安装Node.js。${NC}"
    echo -e "${YELLOW}可以使用以下命令安装:${NC}"
    echo -e "${BLUE}sudo apt install nodejs npm${NC}"
    exit 1
fi

# 创建目录结构
echo -e "${BLUE}创建目录结构...${NC}"
BASE_DIR="serverless-app"
mkdir -p $BASE_DIR/{functions,logs,public}

# 设置文件列表
echo -e "${BLUE}准备创建必要的文件...${NC}"

# 创建示例函数
cat > $BASE_DIR/functions/hello.js << 'EOL'
module.exports = function(req, query) {
  return {
    message: "你好，世界！",
    timestamp: new Date().toISOString(),
    query: query
  };
};
EOL

cat > $BASE_DIR/functions/echo.js << 'EOL'
module.exports = function(req, query) {
  return {
    message: "回声服务",
    echo: query.text || "没有提供文本",
    timestamp: new Date().toISOString(),
    query: query
  };
};
EOL

cat > $BASE_DIR/functions/weather.js << 'EOL'
module.exports = function(req, query) {
  const city = query.city || "北京";
  
  // 模拟天气数据
  const weatherData = {
    "北京": {
      temperature: 22,
      condition: "晴",
      humidity: 45,
      wind: "东北风3级"
    },
    "上海": {
      temperature: 26,
      condition: "多云",
      humidity: 65,
      wind: "东南风2级"
    },
    "广州": {
      temperature: 30,
      condition: "阵雨",
      humidity: 80,
      wind: "南风4级"
    },
    "深圳": {
      temperature: 31,
      condition: "雷阵雨",
      humidity: 85,
      wind: "南风3级"
    },
    "杭州": {
      temperature: 25,
      condition: "阴",
      humidity: 60,
      wind: "东风2级"
    }
  };
  
  // 获取请求的城市天气
  const cityWeather = weatherData[city];
  
  if (!cityWeather) {
    return {
      error: "城市不存在",
      message: `没有找到城市 "${city}" 的天气数据`,
      supportedCities: Object.keys(weatherData)
    };
  }
  
  // 生成未来3天的预报
  const forecast = [];
  const conditions = ["晴", "多云", "阴", "小雨", "阵雨", "雷阵雨"];
  const today = new Date();
  
  for (let i = 1; i <= 3; i++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(today.getDate() + i);
    
    forecast.push({
      date: forecastDate.toISOString().split('T')[0],
      temperature: Math.round(cityWeather.temperature + (Math.random() * 6 - 3)),
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      humidity: Math.round(cityWeather.humidity + (Math.random() * 10 - 5)),
      wind: cityWeather.wind
    });
  }
  
  return {
    city: city,
    currentWeather: cityWeather,
    forecast: forecast,
    timestamp: new Date().toISOString()
  };
};
EOL

cat > $BASE_DIR/functions/calculate.js << 'EOL'
module.exports = function(req, query) {
  // 获取参数
  const a = parseFloat(query.a);
  const b = parseFloat(query.b);
  const op = query.op || "add"; // 默认操作是加法
  
  // 校验参数
  if (isNaN(a) || isNaN(b)) {
    return {
      error: "参数错误",
      message: "请提供有效的数字参数 'a' 和 'b'"
    };
  }
  
  let result;
  let operation;
  
  // 执行计算
  switch (op.toLowerCase()) {
    case "add":
      result = a + b;
      operation = "加法";
      break;
    case "subtract":
      result = a - b;
      operation = "减法";
      break;
    case "multiply":
      result = a * b;
      operation = "乘法";
      break;
    case "divide":
      if (b === 0) {
        return {
          error: "计算错误",
          message: "不能除以零"
        };
      }
      result = a / b;
      operation = "除法";
      break;
    default:
      return {
        error: "不支持的操作",
        message: `操作 '${op}' 不受支持`,
        supportedOperations: ["add", "subtract", "multiply", "divide"]
      };
  }
  
  return {
    operation: operation,
    a: a,
    b: b,
    result: result,
    timestamp: new Date().toISOString()
  };
};
EOL

# 制作可执行文件
echo -e "${YELLOW}给脚本添加可执行权限...${NC}"
chmod +x $BASE_DIR/start-elasticity-test.sh || true

# 添加README
cat > $BASE_DIR/README.md << 'EOL'
# Serverless 模拟环境

这是一个简单的Serverless功能模拟环境，用于演示和测试Serverless的自动扩展和弹性功能。

## 功能

- 基本的Serverless函数执行
- 自动扩展和缩容
- 负载测试
- 弹性分析
- 冷启动模拟
- 性能监控

## 入门

1. 确保已安装Node.js
2. 运行启动脚本：`./start-elasticity-test.sh`
3. 访问 http://localhost:3000 查看Web界面

## 可用函数

- `/hello` - 返回简单的问候消息
- `/echo` - 回显提供的参数 (参数: `text`)
- `/weather` - 返回城市天气信息 (参数: `city`)
- `/calculate` - 执行数学计算 (参数: `a`, `b`, `op`)

## 负载测试

使用启动脚本中的菜单选项运行负载测试。测试会生成对各个函数的大量请求，以测试系统的弹性能力。

## 弹性报告

运行负载测试后，可以通过启动脚本中的菜单生成弹性测试报告，该报告将分析系统的自动扩展能力和整体性能。
EOL

echo -e "${GREEN}环境设置完成！${NC}"
echo -e "${BLUE}启动说明:${NC}"
echo -e "1. 进入目录: ${YELLOW}cd $BASE_DIR${NC}"
echo -e "2. 启动环境: ${YELLOW}./start-elasticity-test.sh${NC}"
echo -e "3. 访问服务: ${YELLOW}http://localhost:3000${NC}"
echo -e ""
echo -e "${CYAN}是否现在进入目录并启动环境？(y/n)${NC}"
read -n 1 -r response
echo ""

if [[ $response =~ ^[Yy]$ ]]; then
    cd $BASE_DIR
    ./start-elasticity-test.sh
else
    echo -e "${GREEN}环境已经设置完毕，可以稍后启动。${NC}"
    echo -e "${YELLOW}目录: ${PWD}/$BASE_DIR${NC}"
fi 