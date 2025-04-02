FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# 使用gunicorn作为生产服务器
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "src.app:app"] 