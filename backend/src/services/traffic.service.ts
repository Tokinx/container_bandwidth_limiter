import { DockerService } from './docker.service';
import { ContainerRepository } from '../db/repositories/container.repository';
import { TrafficRepository } from '../db/repositories/traffic.repository';
import { AuditRepository } from '../db/repositories/audit.repository';
import { config } from '../config';
import logger from '../utils/logger';
import { Container, TrafficLog } from '../types';

interface TrafficCache {
  [containerId: string]: {
    lastRxBytes: number;
    lastTxBytes: number;
    accumulatedBytes: number;
    lastResetCheck: number;
  };
}

export class TrafficService {
  private dockerService: DockerService;
  private containerRepo: ContainerRepository;
  private trafficRepo: TrafficRepository;
  private auditRepo: AuditRepository;
  private trafficCache: TrafficCache = {};
  private pendingLogs: Omit<TrafficLog, 'id'>[] = [];
  private collectInterval?: NodeJS.Timeout;
  private persistInterval?: NodeJS.Timeout;

  constructor() {
    this.dockerService = new DockerService();
    this.containerRepo = new ContainerRepository();
    this.trafficRepo = new TrafficRepository();
    this.auditRepo = new AuditRepository();
  }

  async start(): Promise<void> {
    logger.info('Starting traffic collection service...');

    await this.syncContainers();

    this.collectInterval = setInterval(() => {
      this.collectTraffic().catch((error) => {
        logger.error('Error in traffic collection:', error);
      });
    }, config.collectInterval);

    this.persistInterval = setInterval(() => {
      this.persistTraffic();
    }, config.persistInterval);

    logger.info(
      `Traffic service started (collect: ${config.collectInterval}ms, persist: ${config.persistInterval}ms)`
    );
  }

  stop(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
    }
    this.persistTraffic();
    logger.info('Traffic service stopped');
  }

  private async syncContainers(): Promise<void> {
    try {
      const dockerContainers = await this.dockerService.getMonitoredContainers();
      const dbContainers = this.containerRepo.findAll();
      const dbContainerIds = new Set(dbContainers.map((c) => c.id));

      for (const dockerContainer of dockerContainers) {
        if (!dbContainerIds.has(dockerContainer.Id)) {
          const name = dockerContainer.Names[0]?.replace(/^\//, '') || dockerContainer.Id;
          this.containerRepo.create({
            id: dockerContainer.Id,
            name,
            bandwidth_limit: null,
            bandwidth_used: 0,
            bandwidth_extra: 0,
            reset_day: 1,
            last_reset_at: null,
            expire_at: null,
            status: dockerContainer.State === 'running' ? 'active' : 'stopped',
            share_token: null,
            share_token_expire: null,
          });

          this.auditRepo.create({
            container_id: dockerContainer.Id,
            action: 'start',
            details: `Container discovered and added to monitoring`,
            timestamp: Date.now(),
          });

          logger.info(`New container added to monitoring: ${name} (${dockerContainer.Id})`);
        }
      }
    } catch (error) {
      logger.error('Failed to sync containers:', error);
    }
  }

  private async collectTraffic(): Promise<void> {
    const containers = this.containerRepo.findAll();

    for (const container of containers) {
      try {
        const isRunning = await this.dockerService.isContainerRunning(container.id);

        if (!isRunning) {
          continue;
        }

        const stats = await this.dockerService.getContainerStats(container.id);
        if (!stats) {
          continue;
        }

        const cache = this.trafficCache[container.id];

        if (!cache) {
          this.trafficCache[container.id] = {
            lastRxBytes: stats.rx_bytes,
            lastTxBytes: stats.tx_bytes,
            accumulatedBytes: container.bandwidth_used,
            lastResetCheck: Date.now(),
          };
          continue;
        }

        let rxDelta = stats.rx_bytes - cache.lastRxBytes;
        let txDelta = stats.tx_bytes - cache.lastTxBytes;

        if (rxDelta < 0 || txDelta < 0) {
          logger.warn(`Container ${container.name} network counters reset, recalculating...`);
          rxDelta = stats.rx_bytes;
          txDelta = stats.tx_bytes;
        }

        const totalDelta = rxDelta + txDelta;
        cache.accumulatedBytes += totalDelta;
        cache.lastRxBytes = stats.rx_bytes;
        cache.lastTxBytes = stats.tx_bytes;

        this.pendingLogs.push({
          container_id: container.id,
          rx_bytes: rxDelta,
          tx_bytes: txDelta,
          total_bytes: totalDelta,
          timestamp: Date.now(),
        });

        await this.checkLimits(container, cache.accumulatedBytes);
      } catch (error) {
        logger.error(`Error collecting traffic for container ${container.name}:`, error);
      }
    }
  }

  private persistTraffic(): void {
    if (this.pendingLogs.length === 0) {
      return;
    }

    try {
      this.trafficRepo.batchCreate(this.pendingLogs);

      const containerUpdates = new Map<string, number>();
      for (const log of this.pendingLogs) {
        const current = containerUpdates.get(log.container_id) || 0;
        containerUpdates.set(log.container_id, current + log.total_bytes);
      }

      for (const [containerId, totalBytes] of containerUpdates) {
        const cache = this.trafficCache[containerId];
        if (cache) {
          this.containerRepo.updateBandwidthUsed(containerId, cache.accumulatedBytes);
        }
      }

      logger.debug(`Persisted ${this.pendingLogs.length} traffic logs`);
      this.pendingLogs = [];
    } catch (error) {
      logger.error('Failed to persist traffic logs:', error);
    }
  }

  private async checkLimits(container: Container, currentUsage: number): Promise<void> {
    if (!container.bandwidth_limit) {
      return;
    }

    const totalLimit = container.bandwidth_limit + container.bandwidth_extra;

    if (currentUsage > totalLimit && container.status === 'active') {
      try {
        await this.dockerService.stopContainer(container.id);
        this.containerRepo.updateStatus(container.id, 'stopped');

        this.auditRepo.create({
          container_id: container.id,
          action: 'limit_exceeded',
          details: JSON.stringify({
            used: currentUsage,
            limit: totalLimit,
          }),
          timestamp: Date.now(),
        });

        logger.warn(
          `Container ${container.name} stopped due to bandwidth limit exceeded (${currentUsage}/${totalLimit})`
        );
      } catch (error) {
        logger.error(`Failed to stop container ${container.name}:`, error);
      }
    }
  }

  async resetContainerTraffic(containerId: string): Promise<void> {
    this.containerRepo.resetBandwidth(containerId);

    if (this.trafficCache[containerId]) {
      this.trafficCache[containerId].accumulatedBytes = 0;
    }

    this.auditRepo.create({
      container_id: containerId,
      action: 'reset',
      details: 'Bandwidth manually reset',
      timestamp: Date.now(),
    });

    logger.info(`Traffic reset for container ${containerId}`);
  }
}
