import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const derivedSelfContainerId =
  process.env.SELF_CONTAINER_ID ||
  (process.env.HOSTNAME && /^[0-9a-f]{12,64}$/i.test(process.env.HOSTNAME) ? process.env.HOSTNAME : null);

export const config = {
  // 服务配置
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  timezone: process.env.TZ || 'Asia/Shanghai',

  // 管理员认证
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret-key',

  // 采集配置
  collectInterval: parseInt(process.env.COLLECT_INTERVAL || '1000', 10),
  persistInterval: parseInt(process.env.PERSIST_INTERVAL || '30000', 10),

  // 数据库
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'bandwidth.db'),

  // Docker
  dockerSocket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  monitorLabel: process.env.MONITOR_LABEL || 'bandwidth.monitor',
  selfContainerId: derivedSelfContainerId,
  selfContainerName: process.env.SELF_CONTAINER_NAME || null,
};
