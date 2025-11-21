# Docker 容器流量管理系统

一个用于监控和管理 Docker 容器网络流量的完整解决方案，支持流量限制、自动停止、流量重置和容器到期管理。

## 功能特性

- ✅ **流量监控**：实时采集容器网络流量（入站+出站）
- ✅ **流量限制**：设置流量配额，超限自动停止容器
- ✅ **自动重置**：按月自动重置流量统计
- ✅ **到期管理**：容器到期自动停止
- ✅ **临时配额**：支持临时增加流量配额
- ✅ **分享功能**：生成公开分享链接查看容器状态
- ✅ **审计日志**：完整记录所有操作和事件
- ✅ **Web 界面**：基于 React + shadcn/ui 的现代化管理界面

## 技术栈

### 后端
- Node.js 20+ (TypeScript)
- Express.js
- SQLite + WAL 模式
- dockerode (Docker SDK)
- better-sqlite3

### 前端
- React 18+
- TypeScript
- Vite
- shadcn/ui + TailwindCSS
- TanStack Query

## 快速开始

### 方式一：使用预构建镜像（推荐）

#### 1. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  bandwidth-limiter:
    image: ghcr.io/YOUR_USERNAME/container_bandwidth_limiter:latest
    container_name: bandwidth-limiter
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./data:/data
      - ./logs:/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TZ=Asia/Shanghai
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=your_secure_password
      - JWT_SECRET=your_jwt_secret_key_change_this
      - COLLECT_INTERVAL=1000
      - PERSIST_INTERVAL=30000
      - DB_PATH=/data/bandwidth.db
      - DOCKER_SOCKET=/var/run/docker.sock
      - MONITOR_LABEL=bandwidth.monitor
    labels:
      - "bandwidth.monitor=false"
```

**注意**：将 `YOUR_USERNAME` 替换为实际的 GitHub 用户名。

#### 2. 启动服务

```bash
docker-compose up -d
```

#### 3. 访问系统

打开浏览器访问：`http://localhost:3000`

默认账号：
- 用户名：`admin`
- 密码：docker-compose.yml 中设置的密码

### 方式二：从源码构建

#### 1. 克隆项目

```bash
git clone <repository-url>
cd container_bandwidth_limiter
```

#### 2. 配置环境变量

复制示例配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置管理员账号密码：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key
```

#### 3. 使用 Docker Compose 部署

```bash
docker-compose up -d
```

#### 4. 访问系统

打开浏览器访问：`http://localhost:3000`

## 标记需要监控的容器

要监控某个容器的流量，需要为其添加标签：

```bash
# 启动容器时添加标签
docker run -d --label bandwidth.monitor=true nginx

# 或在 docker-compose.yml 中添加
services:
  myapp:
    image: nginx
    labels:
      - "bandwidth.monitor=true"
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 服务端口 | `3000` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `admin123` |
| `JWT_SECRET` | JWT 密钥 | `change-this-secret-key` |
| `COLLECT_INTERVAL` | 采集间隔（毫秒） | `1000` |
| `PERSIST_INTERVAL` | 持久化间隔（毫秒） | `30000` |
| `DB_PATH` | 数据库路径 | `/data/bandwidth.db` |
| `DOCKER_SOCKET` | Docker Socket 路径 | `/var/run/docker.sock` |
| `MONITOR_LABEL` | 监控标签 | `bandwidth.monitor` |

### 数据持久化

系统使用以下目录存储数据：

- `/data`：SQLite 数据库文件
- `/logs`：应用日志文件

确保这些目录已在 `docker-compose.yml` 中正确挂载。

## 使用指南

### 1. 容器管理

在管理界面中，您可以：

- 查看所有被监控容器的流量使用情况
- 启动/停止容器
- 重置容器流量统计
- 配置流量限制和到期时间
- 删除容器（需二次确认）

### 2. 设置流量限制

点击容器的"配置"按钮，可以设置：

- **流量限制**：容器的总流量配额（字节）
- **临时配额**：额外的临时流量配额
- **重置日期**：每月的哪一天重置流量（1-31）
- **到期时间**：容器的到期时间戳

### 3. 分享容器信息

点击"分享"按钮生成公开链接，无需登录即可查看：

- 容器状态
- 流量使用情况
- 内存使用情况
- 网络统计
- 重置时间和到期时间

分享链接的有效期与容器到期时间一致。

### 4. 查看审计日志

系统自动记录以下事件：

- 容器启动/停止
- 流量超限
- 流量重置
- 容器到期
- 配置变更
- 容器删除

## 工作原理

### 流量采集

1. 每 1 秒（可配置）采集一次容器网络统计
2. 计算流量增量并累加到内存缓存
3. 每 30 秒（可配置）批量写入数据库
4. 使用 SQLite WAL 模式优化写入性能

### 流量限制

- 实时检查流量使用是否超过限制（基础配额 + 临时配额）
- 超限后自动调用 `docker stop` 停止容器
- 记录审计日志

### 自动重置

- 每小时检查一次是否到达重置日期
- 到达后自动重置流量统计为 0
- 记录审计日志

### 到期检查

- 每小时检查一次容器是否到期
- 到期后自动停止容器
- 更新容器状态为 `expired`

## 开发指南

### 本地开发

#### 后端

```bash
cd backend
npm install
npm run dev
```

#### 前端

```bash
cd frontend
npm install
npm run dev
```

### 构建

```bash
# 构建后端
npm run build:backend

# 构建前端
npm run build:frontend

# 构建全部
npm run build
```

### 项目结构

```
container_bandwidth_limiter/
├── backend/                 # 后端代码
│   ├── src/
│   │   ├── config/         # 配置
│   │   ├── db/             # 数据库
│   │   ├── middleware/     # 中间件
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── types/          # 类型定义
│   │   ├── utils/          # 工具函数
│   │   └── server.ts       # 入口文件
│   └── tsconfig.json
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── lib/            # 工具库
│   │   ├── pages/          # 页面
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── vite.config.ts
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile              # Docker 镜像构建
└── README.md
```

## 常见问题

### Q: 容器重启后流量统计会重置吗？

A: 不会。系统在数据库中持久化累计流量，容器重启后会继续累加。

### Q: 如何修改管理员密码？

A: 修改 `.env` 文件中的 `ADMIN_PASSWORD`，然后重启容器。

### Q: 流量统计包括哪些流量？

A: 包括容器的所有网络接口的入站（rx）和出站（tx）流量总和。

### Q: 可以监控所有容器吗？

A: 需要为容器添加 `bandwidth.monitor=true` 标签才会被监控。

### Q: 数据库文件在哪里？

A: 默认在 `./data/bandwidth.db`，可通过 `DB_PATH` 环境变量修改。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持

如有问题，请提交 Issue 或联系维护者。
