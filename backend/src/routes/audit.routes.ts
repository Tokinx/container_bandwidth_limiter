import { Router, Request, Response } from 'express';
import { AuditRepository } from '../db/repositories/audit.repository';
import { authMiddleware } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const auditRepo = new AuditRepository();

router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = auditRepo.findAll(limit, offset);
    const total = auditRepo.count();

    res.json({ logs, total, limit, offset });
  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const total = auditRepo.count();
    const recentLogs = auditRepo.findAll(10, 0);

    res.json({ total, recent: recentLogs });
  } catch (error) {
    logger.error('Failed to get audit stats:', error);
    res.status(500).json({ error: 'Failed to get audit stats' });
  }
});

export default router;
