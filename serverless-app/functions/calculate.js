module.exports = function(req, query) {
  // 获取参数
  const a = parseFloat(query.a);
  const b = parseFloat(query.b);
  const op = query.op || "add"; // 默认操作是加法
  
  // 校验参数
  if (isNaN(a) || isNaN(b)) {
    return {
      error: "Invalid parameters",
      message: "参数 a 和 b 必须是数字"
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
          error: "Division by zero",
          message: "除数不能为0"
        };
      }
      result = a / b;
      operation = "除法";
      break;
    default:
      return {
        error: "Invalid operation",
        message: "无效的操作类型，支持的操作: add, subtract, multiply, divide"
      };
  }
  
  return {
    success: true,
    operation: operation,
    a: a,
    b: b,
    result: result,
    timestamp: new Date().toISOString()
  };
};
