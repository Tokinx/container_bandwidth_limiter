import cron from 'node-cron';
import { ContainerRepository } from '../db/repositories/container.repository';
import { AuditRepository } from '../db/repositories/audit.repository';
import { DockerService } from './docker.service';
import { shouldReset } from '../utils/helpers';
import logger from '../utils/logger';

export class SchedulerService {
  private containerRepo: ContainerRepository;
  private auditRepo: AuditRepository;
  private dockerService: DockerService;
  private resetTask?: cron.ScheduledTask;
  private expireTask?: cron.ScheduledTask;

  constructor() {
    this.containerRepo = new ContainerRepository();
    this.auditRepo = new AuditRepository();
    this.dockerService = new DockerService();
  }

  start(): void {
    this.resetTask = cron.schedule('0 * * * *', () => {
      this.checkBandwidthReset().catch((error) => {
        logger.error('Error in bandwidth reset check:', error);
      });
    });

    this.expireTask = cron.schedule('0 * * * *', () => {
      this.checkExpiredContainers().catch((error) => {
        logger.error('Error in expiration check:', error);
      });
    });

    logger.info('Scheduler service started (hourly checks)');
  }

  stop(): void {
    if (this.resetTask) {
      this.resetTask.stop();
    }
    if (this.expireTask) {
      this.expireTask.stop();
    }
    logger.info('Scheduler service stopped');
  }

  private async checkBandwidthReset(): Promise<void> {
    const containers = this.containerRepo.findAll();

    for (const container of containers) {
      try {
        if (shouldReset(container.last_reset_at, container.reset_day)) {
          this.containerRepo.resetBandwidth(container.id);

          this.auditRepo.create({
            container_id: container.id,
            action: 'reset',
            details: `Automatic bandwidth reset on day ${container.reset_day}`,
            timestamp: Date.now(),
          });

          logger.info(`Bandwidth reset for container ${container.name} (${container.id})`);
        }
      } catch (error) {
        logger.error(`Error resetting bandwidth for container ${container.name}:`, error);
      }
    }
  }

  private async checkExpiredContainers(): Promise<void> {
    const containers = this.containerRepo.findAll();
    const now = Date.now();

    for (const container of containers) {
      try {
        if (container.expire_at && container.expire_at <= now && container.status !== 'expired') {
          const isRunning = await this.dockerService.isContainerRunning(container.id);

          if (isRunning) {
            await this.dockerService.stopContainer(container.id);
          }

          this.containerRepo.updateStatus(container.id, 'expired');

          this.auditRepo.create({
            container_id: container.id,
            action: 'expired',
            details: `Container expired at ${new Date(container.expire_at).toISOString()}`,
            timestamp: now,
          });

          logger.info(`Container ${container.name} (${container.id}) expired and stopped`);
        }
      } catch (error) {
        logger.error(`Error checking expiration for container ${container.name}:`, error);
      }
    }
  }
}
