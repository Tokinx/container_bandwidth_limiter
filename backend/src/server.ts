import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { initDatabase, closeDatabase } from './db';
import { TrafficService } from './services/traffic.service';
import { SchedulerService } from './services/scheduler.service';
import logger from './utils/logger';

import authRoutes from './routes/auth.routes';
import containerRoutes, { setTrafficService } from './routes/container.routes';
import auditRoutes from './routes/audit.routes';
import publicRoutes from './routes/public.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/public', publicRoutes);

const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

let trafficService: TrafficService;
let schedulerService: SchedulerService;

async function start() {
  try {
    initDatabase();
    logger.info('Database initialized');

    trafficService = new TrafficService();
    setTrafficService(trafficService);
    await trafficService.start();

    schedulerService = new SchedulerService();
    schedulerService.start();

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function shutdown() {
  logger.info('Shutting down gracefully...');

  if (trafficService) {
    trafficService.stop();
  }

  if (schedulerService) {
    schedulerService.stop();
  }

  closeDatabase();

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
