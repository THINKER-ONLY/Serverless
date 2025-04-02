#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 配置
const config = {
  functionsDir: path.join(__dirname, 'functions'),
  templatesDir: path.join(__dirname, 'templates'),
  serverPath: path.join(__dirname, 'server.js')
};

// 确保目录存在
if (!fs.existsSync(config.templatesDir)) {
  fs.mkdirSync(config.templatesDir, { recursive: true });
}

// 创建读取用户输入的接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 函数模板
const functionTemplates = {
  basic: `/**
 * 基础函数模板
 * 用法: /[FUNCTION_NAME]?参数=值
 */
module.exports = (req, res) => {
  // 获取查询参数
  const param = req.query.param || 'default';
  
  // 返回响应
  res.json({
    message: '这是一个基础函数',
    param: param,
    timestamp: new Date().toISOString()
  });
};`,

  db: `/**
 * 数据库操作函数模板
 * 用法: /[FUNCTION_NAME]?id=123
 */
module.exports = (req, res) => {
  // 获取ID参数
  const id = req.query.id;
  
  // 模拟数据库操作
  const mockDbOperation = (id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (id) {
          resolve({ 
            id: id, 
            name: '示例项目_' + id,
            created: new Date().toISOString() 
          });
        } else {
          reject(new Error('未提供ID'));
        }
      }, 100);
    });
  };
  
  // 执行数据库操作
  mockDbOperation(id)
    .then(data => {
      res.json({
        success: true,
        data: data
      });
    })
    .catch(error => {
      res.status(400).json({
        success: false,
        error: error.message
      });
    });
};`,

  api: `/**
 * 外部API调用函数模板
 * 用法: /[FUNCTION_NAME]?param=value
 */
module.exports = (req, res) => {
  // 获取查询参数
  const param = req.query.param;
  
  // 模拟API调用
  const mockApiCall = (param) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (param) {
          resolve({
            externalData: '来自外部API的数据 ' + param,
            source: '模拟外部API'
          });
        } else {
          reject(new Error('未提供必要参数'));
        }
      }, 200);
    });
  };
  
  // 调用外部API
  mockApiCall(param)
    .then(data => {
      res.json({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        error: error.message
      });
    });
};`
};

// 保存模板到文件
function saveTemplates() {
  Object.entries(functionTemplates).forEach(([name, content]) => {
    const templatePath = path.join(config.templatesDir, `${name}.js`);
    fs.writeFileSync(templatePath, content);
    console.log(`模板已保存: ${templatePath}`);
  });
}

// 列出所有可用函数
function listFunctions() {
  console.log('\n=== 当前可用函数 ===');
  
  try {
    const files = fs.readdirSync(config.functionsDir);
    const functionFiles = files.filter(file => file.endsWith('.js'));
    
    if (functionFiles.length === 0) {
      console.log('没有找到任何函数');
    } else {
      functionFiles.forEach(file => {
        const functionName = path.basename(file, '.js');
        const functionPath = path.join(config.functionsDir, file);
        const stats = fs.statSync(functionPath);
        console.log(`- ${functionName} (大小: ${stats.size} 字节, 修改时间: ${stats.mtime.toLocaleString()})`);
      });
    }
  } catch (error) {
    console.error('列出函数时出错:', error.message);
  }
}

// 列出所有可用模板
function listTemplates() {
  console.log('\n=== 可用函数模板 ===');
  Object.keys(functionTemplates).forEach(name => {
    console.log(`- ${name}`);
  });
}

// 创建新函数
function createFunction(name, template) {
  const functionPath = path.join(config.functionsDir, `${name}.js`);
  
  // 检查函数是否已存在
  if (fs.existsSync(functionPath)) {
    console.error(`错误: 函数 '${name}' 已存在。请使用不同名称或先删除现有函数。`);
    return false;
  }
  
  // 获取模板内容
  let templateContent = functionTemplates[template];
  if (!templateContent) {
    console.error(`错误: 无效的模板 '${template}'。请使用以下模板之一: ${Object.keys(functionTemplates).join(', ')}`);
    return false;
  }
  
  // 替换模板中的函数名
  templateContent = templateContent.replace(/\[FUNCTION_NAME\]/g, name);
  
  try {
    fs.writeFileSync(functionPath, templateContent);
    console.log(`函数 '${name}' 已成功创建并保存到 ${functionPath}`);
    return true;
  } catch (error) {
    console.error(`创建函数时出错:`, error.message);
    return false;
  }
}

// 删除函数
function deleteFunction(name) {
  const functionPath = path.join(config.functionsDir, `${name}.js`);
  
  // 检查函数是否存在
  if (!fs.existsSync(functionPath)) {
    console.error(`错误: 函数 '${name}' 不存在。`);
    return false;
  }
  
  try {
    fs.unlinkSync(functionPath);
    console.log(`函数 '${name}' 已成功删除`);
    return true;
  } catch (error) {
    console.error(`删除函数时出错:`, error.message);
    return false;
  }
}

// 构建部署包
function buildDeployPackage() {
  console.log('\n=== 构建部署包 ===');
  
  const deployDir = path.join(__dirname, 'deploy');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }
  
  try {
    // 复制服务器文件
    fs.copyFileSync(config.serverPath, path.join(deployDir, 'server.js'));
    console.log('已复制服务器文件');
    
    // 创建函数目录
    const deployFunctionsDir = path.join(deployDir, 'functions');
    if (!fs.existsSync(deployFunctionsDir)) {
      fs.mkdirSync(deployFunctionsDir, { recursive: true });
    }
    
    // 复制所有函数
    const files = fs.readdirSync(config.functionsDir);
    const functionFiles = files.filter(file => file.endsWith('.js'));
    
    functionFiles.forEach(file => {
      fs.copyFileSync(
        path.join(config.functionsDir, file),
        path.join(deployFunctionsDir, file)
      );
    });
    
    console.log(`已复制 ${functionFiles.length} 个函数`);
    
    // 创建package.json
    const packageJson = {
      name: 'serverless-app',
      version: '1.0.0',
      description: '简单的Serverless应用',
      main: 'server.js',
      scripts: {
        start: 'node server.js'
      },
      dependencies: {}
    };
    
    fs.writeFileSync(
      path.join(deployDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    console.log('已创建package.json');
    console.log(`部署包已成功构建到 ${deployDir}`);
    return true;
  } catch (error) {
    console.error('构建部署包时出错:', error.message);
    return false;
  }
}

// 显示主菜单
function showMainMenu() {
  console.log('\n===== Serverless函数管理 =====');
  console.log('1. 列出所有函数');
  console.log('2. 创建新函数');
  console.log('3. 删除函数');
  console.log('4. 构建部署包');
  console.log('5. 列出可用模板');
  console.log('0. 退出');
  console.log('=========================');
  
  rl.question('请选择操作 [0-5]: ', answer => {
    switch (answer.trim()) {
      case '1':
        listFunctions();
        setTimeout(showMainMenu, 500);
        break;
      case '2':
        createFunctionPrompt();
        break;
      case '3':
        deleteFunctionPrompt();
        break;
      case '4':
        buildDeployPackage();
        setTimeout(showMainMenu, 500);
        break;
      case '5':
        listTemplates();
        setTimeout(showMainMenu, 500);
        break;
      case '0':
        console.log('再见!');
        rl.close();
        break;
      default:
        console.log('无效选择，请重试');
        showMainMenu();
    }
  });
}

// 创建函数提示
function createFunctionPrompt() {
  rl.question('\n请输入新函数的名称: ', name => {
    if (!name.trim()) {
      console.log('函数名不能为空');
      showMainMenu();
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      console.log('函数名只能包含字母、数字、下划线和连字符');
      showMainMenu();
      return;
    }
    
    listTemplates();
    rl.question('请选择模板: ', template => {
      if (!functionTemplates[template]) {
        console.log(`无效的模板 '${template}'`);
        showMainMenu();
        return;
      }
      
      const success = createFunction(name, template);
      if (success) {
        console.log(`\n可通过 http://localhost:3000/${name} 访问新函数`);
      }
      
      setTimeout(showMainMenu, 500);
    });
  });
}

// 删除函数提示
function deleteFunctionPrompt() {
  listFunctions();
  rl.question('\n请输入要删除的函数名称: ', name => {
    if (!name.trim()) {
      console.log('函数名不能为空');
      showMainMenu();
      return;
    }
    
    rl.question(`确认删除函数 '${name}'? (y/n): `, confirm => {
      if (confirm.toLowerCase() === 'y') {
        deleteFunction(name);
      } else {
        console.log('已取消删除');
      }
      
      setTimeout(showMainMenu, 500);
    });
  });
}

// 入口
function main() {
  console.log('初始化Serverless函数管理工具...');
  
  // 确保函数目录存在
  if (!fs.existsSync(config.functionsDir)) {
    console.log(`创建函数目录: ${config.functionsDir}`);
    fs.mkdirSync(config.functionsDir, { recursive: true });
  }
  
  // 保存模板
  saveTemplates();
  
  // 显示主菜单
  showMainMenu();
}

// 启动程序
main(); 