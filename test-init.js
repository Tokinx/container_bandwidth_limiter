// 测试数据库初始化顺序
const path = require('path');

// 模拟环境变量
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.JWT_SECRET = 'test-secret';

console.log('测试 1: 导入路由模块（数据库未初始化）...');
try {
  // 这应该不会报错，因为我们使用了延迟初始化
  const containerRoutes = require('./dist/routes/container.routes.js');
  const auditRoutes = require('./dist/routes/audit.routes.js');
  const publicRoutes = require('./dist/routes/public.routes.js');
  console.log('✓ 路由模块导入成功（未触发数据库访问）');
} catch (error) {
  console.error('✗ 路由模块导入失败:', error.message);
  process.exit(1);
}

console.log('\n测试 2: 初始化数据库...');
try {
  const { initDatabase } = require('./dist/db/index.js');
  initDatabase();
  console.log('✓ 数据库初始化成功');
} catch (error) {
  console.error('✗ 数据库初始化失败:', error.message);
  process.exit(1);
}

console.log('\n测试 3: 使用 Repository（数据库已初始化）...');
try {
  const { ContainerRepository } = require('./dist/db/repositories/container.repository.js');
  const repo = new ContainerRepository();
  const containers = repo.findAll();
  console.log('✓ Repository 使用成功，找到', containers.length, '个容器');
} catch (error) {
  console.error('✗ Repository 使用失败:', error.message);
  process.exit(1);
}

console.log('\n✓ 所有测试通过！数据库初始化顺序问题已修复。');
