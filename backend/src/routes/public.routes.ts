import { Router, Request, Response } from 'express';
import { ContainerRepository } from '../db/repositories/container.repository';
import { DockerService } from '../services/docker.service';
import logger from '../utils/logger';

const router = Router();
const containerRepo = new ContainerRepository();
const dockerService = new DockerService();

router.get('/share/:token', async (req: Request, res: Response) => {
  try {
    const container = containerRepo.findByShareToken(req.params.token);

    if (!container) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    if (container.share_token_expire && container.share_token_expire < Date.now()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    const stats = await dockerService.getContainerStats(container.id);

    const totalLimit = (container.bandwidth_limit || 0) + container.bandwidth_extra;
    const remaining = Math.max(0, totalLimit - container.bandwidth_used);

    res.json({
      name: container.name,
      status: container.status,
      bandwidth: {
        used: container.bandwidth_used,
        limit: container.bandwidth_limit,
        extra: container.bandwidth_extra,
        total_limit: totalLimit,
        remaining,
      },
      reset_day: container.reset_day,
      last_reset_at: container.last_reset_at,
      expire_at: container.expire_at,
      memory: stats
        ? {
            usage: stats.memory_usage,
            limit: stats.memory_limit,
          }
        : null,
      network: stats
        ? {
            rx_bytes: stats.rx_bytes,
            tx_bytes: stats.tx_bytes,
            total_bytes: stats.total_bytes,
          }
        : null,
    });
  } catch (error) {
    logger.error('Failed to get share info:', error);
    res.status(500).json({ error: 'Failed to get share info' });
  }
});

export default router;
