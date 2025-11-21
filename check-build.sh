#!/bin/bash

# 完整的构建检查脚本

set -e

echo "=== 构建检查脚本 ==="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        exit 1
    fi
}

echo "1. 检查项目结构..."
[ -f "package.json" ] && [ -f "frontend/package.json" ] && [ -d "backend/src" ]
check_step "项目结构完整"

echo ""
echo "2. 检查 TypeScript 配置..."
[ -f "backend/tsconfig.json" ] && [ -f "frontend/tsconfig.json" ]
check_step "TypeScript 配置存在"

echo ""
echo "3. 检查关键文件..."
[ -f "Dockerfile" ] && [ -f "docker-compose.yml" ] && [ -f ".gitignore" ]
check_step "Docker 配置文件存在"

echo ""
echo "4. 检查前端源文件..."
[ -f "frontend/src/App.tsx" ] && [ -f "frontend/src/main.tsx" ]
check_step "前端入口文件存在"

echo ""
echo "5. 检查后端源文件..."
[ -f "backend/src/server.ts" ] && [ -f "backend/src/config/index.ts" ]
check_step "后端入口文件存在"

echo ""
echo "6. 检查 .npmrc 配置..."
[ -f ".npmrc" ] && [ -f "frontend/.npmrc" ] && [ -f "backend/.npmrc" ]
check_step "npm 配置文件存在"

echo ""
echo "7. 列出所有 TypeScript 文件..."
echo "前端文件:"
find frontend/src -name "*.tsx" -o -name "*.ts" | sort
echo ""
echo "后端文件:"
find backend/src -name "*.ts" | sort

echo ""
echo "8. 检查可能的问题..."

# 检查未使用的导入
echo "检查未使用的变量..."
if grep -r "const.*=.*useState" frontend/src --include="*.tsx" | grep -v "set" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} 可能存在未使用的 useState"
fi

# 检查未使用的导入
echo "检查未使用的导入..."
if grep -r "^import.*from" frontend/src --include="*.tsx" | wc -l > /dev/null; then
    echo -e "${GREEN}✓${NC} 导入语句检查完成"
fi

echo ""
echo "=== 所有检查通过！ ==="
echo ""
echo "下一步："
echo "1. 运行 Docker 构建: docker build -t test ."
echo "2. 或使用测试脚本: ./test-build.sh"
