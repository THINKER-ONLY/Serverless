package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

var (
	// 从环境变量获取配置
	port       = getEnvOrDefault("PORT", "8080")
	renderTime = getEnvIntOrDefault("RENDER_TIME", 10) // 页面渲染时间（毫秒）
	hostname   = os.Getenv("HOSTNAME")
)

func main() {
	// 如果未设置主机名，使用默认值
	if hostname == "" {
		hostname = "unknown-host"
	}

	// 设置路由
	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/info", infoHandler)

	// 启动服务器
	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("Web应用启动在端口 %s", port)
	log.Printf("配置的渲染时间: %d毫秒", renderTime)
	log.Fatal(http.ListenAndServe(serverAddr, nil))
}

// 首页处理函数
func homeHandler(w http.ResponseWriter, r *http.Request) {
	// 模拟页面渲染时间
	time.Sleep(time.Duration(renderTime) * time.Millisecond)

	// 构建HTML响应
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <title>Knative Serverless 演示</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #333;
        }
        .info {
            margin-top: 20px;
            padding: 15px;
            background-color: #e9f7fe;
            border-left: 4px solid #2196F3;
        }
        .pod-info {
            margin-top: 10px;
            font-size: 0.9em;
            color: #666;
        }
        button {
            background-color: #4CAF50;
            border: none;
            color: white;
            padding: 10px 15px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            margin: 4px 2px;
            cursor: pointer;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Knative Serverless 演示</h1>
        
        <div class="info">
            <p>本页面由 Go Web 服务生成，使用 Knative 在 Kubernetes 上运行。</p>
            <p>服务会根据流量自动扩缩。</p>
            
            <div class="pod-info">
                <p><strong>服务器信息:</strong> 由 %s 提供服务</p>
                <p><strong>渲染时间:</strong> %d 毫秒</p>
                <p><strong>当前时间:</strong> %s</p>
            </div>
        </div>
        
        <h2>测试服务弹性扩缩</h2>
        <p>点击下面的按钮生成负载，观察服务如何扩展：</p>
        <button onclick="generateLoad()">生成测试负载</button>
        <div id="results"></div>

        <script>
        function generateLoad() {
            const results = document.getElementById('results');
            results.innerHTML = '<p>正在生成负载...</p>';
            
            // 模拟发送多个请求
            const requests = 10;
            let completed = 0;
            const startTime = new Date().getTime();
            
            for (let i = 0; i < requests; i++) {
                fetch('/api/info')
                    .then(response => response.json())
                    .then(data => {
                        completed++;
                        if (completed === requests) {
                            const duration = new Date().getTime() - startTime;
                            results.innerHTML = '<p>已完成 ' + requests + ' 个请求，总耗时: ' + duration + 'ms</p>';
                            results.innerHTML += '<p>服务由多个实例处理: ' + data.hostname + '</p>';
                        }
                    });
            }
        }
        </script>
    </div>
</body>
</html>
`, hostname, renderTime, time.Now().Format(time.RFC1123))

	// 发送响应
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, html)
}

// 健康检查处理函数
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "OK")
}

// API信息处理函数
func infoHandler(w http.ResponseWriter, r *http.Request) {
	// 模拟API处理时间
	time.Sleep(time.Duration(renderTime) * time.Millisecond)

	// 返回JSON格式的信息
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"service":"web-app","hostname":"%s","time":"%s"}`,
		hostname, time.Now().Format(time.RFC3339))
}

// 从环境变量获取字符串值，如果不存在则使用默认值
func getEnvOrDefault(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// 从环境变量获取整数值，如果不存在或无法解析则使用默认值
func getEnvIntOrDefault(key string, defaultValue int) int {
	if valueStr, exists := os.LookupEnv(key); exists {
		if value, err := strconv.Atoi(valueStr); err == nil {
			return value
		}
	}
	return defaultValue
} 