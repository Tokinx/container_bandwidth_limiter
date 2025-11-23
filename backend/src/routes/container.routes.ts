import { Router, Request, Response } from 'express';
import { ContainerRepository } from '../db/repositories/container.repository';
import { AuditRepository } from '../db/repositories/audit.repository';
import { DockerService } from '../services/docker.service';
import { TrafficService } from '../services/traffic.service';
import { authMiddleware } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// 延迟初始化，避免在模块加载时访问未初始化的数据库
const getContainerRepo = () => new ContainerRepository();
const getAuditRepo = () => new AuditRepository();
const dockerService = new DockerService();

let trafficService: TrafficService;

export function setTrafficService(service: TrafficService) {
  trafficService = service;
}

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const containers = getContainerRepo().findAll();
    res.json(containers);
  } catch (error) {
    logger.error('Failed to get containers:', error);
    res.status(500).json({ error: 'Failed to get containers' });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const container = getContainerRepo().findById(req.params.id);
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const stats = await dockerService.getContainerStats(req.params.id);

    res.json({ ...container, currentStats: stats });
  } catch (error) {
    logger.error('Failed to get container:', error);
    res.status(500).json({ error: 'Failed to get container' });
  }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bandwidth_limit, bandwidth_extra, reset_day, expire_at } = req.body;

    const updated = getContainerRepo().update(req.params.id, {
      bandwidth_limit,
      bandwidth_extra,
      reset_day,
      expire_at,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Container not found' });
    }

    getAuditRepo().create({
      container_id: req.params.id,
      action: 'config_update',
      details: JSON.stringify(req.body),
      timestamp: Date.now(),
    });

    res.json(updated);
  } catch (error) {
    logger.error('Failed to update container:', error);
    res.status(500).json({ error: 'Failed to update container' });
  }
});

router.post('/:id/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dockerService.startContainer(req.params.id);
    getContainerRepo().updateStatus(req.params.id, 'active');

    getAuditRepo().create({
      container_id: req.params.id,
      action: 'start',
      details: 'Container started manually',
      timestamp: Date.now(),
    });

    res.json({ message: 'Container started' });
  } catch (error) {
    logger.error('Failed to start container:', error);
    res.status(500).json({ error: 'Failed to start container' });
  }
});

router.post('/:id/stop', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dockerService.stopContainer(req.params.id);
    getContainerRepo().updateStatus(req.params.id, 'stopped');

    getAuditRepo().create({
      container_id: req.params.id,
      action: 'stop',
      details: 'Container stopped manually',
      timestamp: Date.now(),
    });

    res.json({ message: 'Container stopped' });
  } catch (error) {
    logger.error('Failed to stop container:', error);
    res.status(500).json({ error: 'Failed to stop container' });
  }
});

router.post('/:id/reset', authMiddleware, async (req: Request, res: Response) => {
  try {
    await trafficService.resetContainerTraffic(req.params.id);
    res.json({ message: 'Traffic reset successfully' });
  } catch (error) {
    logger.error('Failed to reset traffic:', error);
    res.status(500).json({ error: 'Failed to reset traffic' });
  }
});

router.post('/refresh', authMiddleware, async (_req: Request, res: Response) => {
  try {
    if (!trafficService) {
      return res.status(503).json({ error: 'Traffic service not initialized' });
    }

    await trafficService.refreshNow();
    getAuditRepo().create({
      container_id: null,
      action: 'reset',
      details: 'Manual traffic refresh triggered',
      timestamp: Date.now(),
    });
    res.json({ message: 'Refresh triggered successfully' });
  } catch (error) {
    logger.error('Failed to refresh traffic:', error);
    res.status(500).json({ error: 'Failed to refresh traffic' });
  }
});

router.get('/:id/share', authMiddleware, async (req: Request, res: Response) => {
  try {
    const containerRepo = getContainerRepo();
    const container = containerRepo.findById(req.params.id);
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    let token = container.share_token;
    if (!token) {
      token = containerRepo.generateShareToken(req.params.id, container.expire_at);
    }

    res.json({ token, url: `/share/${token}` });
  } catch (error) {
    logger.error('Failed to generate share token:', error);
    res.status(500).json({ error: 'Failed to generate share token' });
  }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { confirmName } = req.body;
    const containerRepo = getContainerRepo();
    const container = containerRepo.findById(req.params.id);

    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    if (confirmName !== container.name) {
      return res.status(400).json({ error: 'Container name does not match' });
    }

    await dockerService.removeContainer(req.params.id, true);
    containerRepo.delete(req.params.id);

    getAuditRepo().create({
      container_id: req.params.id,
      action: 'delete',
      details: `Container ${container.name} deleted`,
      timestamp: Date.now(),
    });

    res.json({ message: 'Container deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete container:', error);
    res.status(500).json({ error: 'Failed to delete container' });
  }
});

export default router;
