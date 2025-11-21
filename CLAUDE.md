# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Docker 容器流量管理系统 - 监控和管理 Docker 容器网络流量，支持流量限制、自动停止、流量重置和容器到期管理。

技术栈：
- 后端：Node.js 20+ (TypeScript) + Express + SQLite (WAL 模式) + dockerode
- 前端：React 18 + TypeScript + Vite + shadcn/ui + TailwindCSS

## 常用命令

### 开发环境

```bash
# 后端开发（热重载）
npm run dev

# 前端开发
cd frontend && npm run dev

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 构建

```bash
# 构建后端（TypeScript 编译到 dist/）
npm run build:backend

# 构建前端（输出到 frontend/dist/）
npm run build:frontend

# 构建全部
npm run build

# 验证构建（检查编译错误）
./check-build.sh
```

### 部署

```bash
# 使用 Docker Compose 部署
docker-compose up -d

# 使用预构建镜像部署
docker-compose -f docker-compose.ghcr.yml up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 核心架构

### 启动流程与初始化顺序

**关键问题**：数据库必须在路由模块加载前完成初始化。

启动顺序（[server.ts:39-59](backend/src/server.ts#L39-L59)）：
1. `initDatabase()` - 初始化 SQLite 数据库（WAL 模式）
2. 创建 `TrafficService` 实例并启动流量采集
3. 创建 `SchedulerService` 实例并启动定时任务
4. 启动 Express 服务器

**重要**：路由模块中的 Repository 实例化必须使用工厂函数（延迟初始化），避免在模块加载时立即访问数据库。参考 [container.routes.ts](backend/src/routes/container.routes.ts)、[audit.routes.ts](backend/src/routes/audit.routes.ts)、[public.routes.ts](backend/src/routes/public.routes.ts) 的实现模式。

### 数据库层（Repository 模式）

位置：`backend/src/db/repositories/`

- `ContainerRepository` - 容器信息 CRUD
- `TrafficRepository` - 流量日志批量写入
- `AuditRepository` - 审计日志记录

所有 Repository 通过 `getDatabase()` 获取数据库实例，该函数会检查数据库是否已初始化。

### 服务层

#### TrafficService（流量采集核心）

位置：[backend/src/services/traffic.service.ts](backend/src/services/traffic.service.ts)

工作流程：
1. **同步容器**：启动时从 Docker API 获取带 `bandwidth.monitor=true` 标签的容器，同步到数据库
2. **流量采集**：每 1 秒（`COLLECT_INTERVAL`）采集一次容器网络统计
   - 计算 rx/tx 增量（处理计数器重置情况）
   - 累加到内存缓存 `trafficCache`
   - 添加到待持久化队列 `pendingLogs`
3. **批量持久化**：每 30 秒（`PERSIST_INTERVAL`）批量写入数据库
   - 使用 `batchCreate` 减少数据库写入次数
   - 更新容器累计流量 `bandwidth_used`
4. **流量限制检查**：每次采集后检查是否超限
   - 超限自动调用 `docker stop` 停止容器
   - 记录审计日志

**性能优化**：
- 内存缓存减少数据库访问
- 批量写入优化 I/O
- SQLite WAL 模式支持并发读写

#### SchedulerService（定时任务）

位置：[backend/src/services/scheduler.service.ts](backend/src/services/scheduler.service.ts)

定时任务（每小时执行）：
1. **流量重置检查**：根据 `reset_day` 自动重置流量统计
2. **容器到期检查**：检查 `expire_at`，到期自动停止容器

#### DockerService（Docker API 封装）

位置：[backend/src/services/docker.service.ts](backend/src/services/docker.service.ts)

封装 dockerode 操作：
- `getMonitoredContainers()` - 获取带监控标签的容器
- `getContainerStats()` - 获取容器网络统计
- `startContainer()` / `stopContainer()` - 容器控制
- `isContainerRunning()` - 状态检查

### API 路由

- `/api/auth` - 认证（JWT）
- `/api/containers` - 容器管理（需认证）
- `/api/audit` - 审计日志（需认证）
- `/api/public` - 公开分享链接（无需认证）

### 前端架构

- 使用 TanStack Query 管理服务端状态
- shadcn/ui 组件库 + TailwindCSS
- React Router 处理路由
- Axios 封装 API 请求

## 配置说明

环境变量（参考 [.env.example](.env.example)）：

关键配置：
- `COLLECT_INTERVAL` - 流量采集间隔（毫秒，默认 1000）
- `PERSIST_INTERVAL` - 数据持久化间隔（毫秒，默认 30000）
- `MONITOR_LABEL` - Docker 容器监控标签（默认 `bandwidth.monitor`）
- `DB_PATH` - SQLite 数据库路径（默认 `/data/bandwidth.db`）

## 开发注意事项

### 数据库初始化

- 所有 Repository 实例化必须在 `initDatabase()` 之后
- 路由模块中使用工厂函数延迟创建 Repository 实例
- 避免在模块顶层直接实例化 Repository

### 流量统计

- 流量单位统一使用字节（bytes）
- 前端显示时转换为 GB/MB
- 处理 Docker 网络计数器重置（容器重启）

### 审计日志

所有关键操作必须记录审计日志：
- 容器启动/停止
- 流量超限
- 流量重置
- 容器到期
- 配置变更

### TypeScript 编译

- 后端编译输出到 `dist/`
- 前端编译输出到 `frontend/dist/`
- 生产环境前端静态文件由后端 Express 服务
