#!/bin/bash

# 重新构建并部署容器流量管理系统

set -e

echo "=== 停止现有容器 ==="
docker compose down || true

echo ""
echo "=== 重新构建镜像 ==="
docker compose build --no-cache

echo ""
echo "=== 启动服务 ==="
docker compose up -d

echo ""
echo "=== 等待服务启动 ==="
sleep 5

echo ""
echo "=== 查看容器状态 ==="
docker compose ps

echo ""
echo "=== 查看最新日志 ==="
docker compose logs --tail=50

echo ""
echo "=== 完成！==="
echo "使用以下命令查看实时日志："
echo "  docker compose logs -f"
echo ""
echo "使用以下命令查看流量相关日志："
echo "  docker compose logs -f | grep -E 'Traffic|Persist|Docker'"
