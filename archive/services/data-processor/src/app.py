import os
import json
import time
import random
from flask import Flask, request, jsonify

app = Flask(__name__)

# 环境变量配置
PORT = int(os.environ.get('PORT', 8080))
PROCESSING_TIME = int(os.environ.get('PROCESSING_TIME', 100))  # 模拟处理时间(毫秒)

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return 'OK', 200

@app.route('/process', methods=['POST'])
def process_data():
    """处理提交的数据"""
    # 获取请求数据
    data = request.get_json() or {}
    
    # 模拟数据处理 - 根据PROCESSING_TIME变量设置延迟
    # 这可以用来模拟高负载场景
    time.sleep(PROCESSING_TIME / 1000.0)
    
    # 添加处理结果
    result = {
        'original_data': data,
        'processed_by': os.environ.get('HOSTNAME', 'unknown'),
        'timestamp': time.time(),
        'processing_duration_ms': PROCESSING_TIME,
        'status': 'completed',
        'results': {
            'analysis': random.random(),
            'confidence': random.random(),
        }
    }
    
    return jsonify(result)

@app.route('/', methods=['GET'])
def home():
    """首页"""
    return jsonify({
        'service': 'Data Processor',
        'version': '1.0',
        'endpoints': {
            '/process': 'POST - 处理数据',
            '/health': 'GET - 健康检查'
        }
    })

if __name__ == '__main__':
    print(f"Data Processor 服务启动在端口 {PORT}")
    print(f"配置的处理时间: {PROCESSING_TIME}ms")
    app.run(host='0.0.0.0', port=PORT) 