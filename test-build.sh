#!/bin/bash

# 本地 Docker 构建测试脚本

set -e

echo "=== Docker 构建测试 ==="
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误: 未安装 Docker"
    exit 1
fi

echo "1. 清理旧的构建缓存..."
docker builder prune -f

echo ""
echo "2. 开始构建镜像..."
docker build -t container-bandwidth-limiter:test .

echo ""
echo "3. 检查镜像大小..."
docker images container-bandwidth-limiter:test

echo ""
echo "=== 构建成功！ ==="
echo ""
echo "运行测试容器："
echo "docker run -d --name test-limiter -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock:ro -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=test123 container-bandwidth-limiter:test"
echo ""
echo "查看日志："
echo "docker logs -f test-limiter"
echo ""
echo "停止并删除："
echo "docker stop test-limiter && docker rm test-limiter"
