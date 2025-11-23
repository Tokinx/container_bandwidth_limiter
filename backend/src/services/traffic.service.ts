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
  private containerSyncInterval?: NodeJS.Timeout;
  private ongoingSync: Promise<void> | null = null;

  constructor() {
    this.dockerService = new DockerService();
    this.containerRepo = new ContainerRepository();
    this.trafficRepo = new TrafficRepository();
    this.auditRepo = new AuditRepository();
  }

  async start(): Promise<void> {
    logger.info('Starting traffic collection service...');

    await this.syncContainers(true);

    // 立即执行一次采集，便于调试
    logger.info('[Traffic] Running initial traffic collection...');
    await this.collectTraffic().catch((error) => {
      logger.error('Error in initial traffic collection:', error);
    });

    this.collectInterval = setInterval(() => {
      this.collectTraffic().catch((error) => {
        logger.error('Error in traffic collection:', error);
      });
    }, config.collectInterval);

    this.persistInterval = setInterval(() => {
      this.persistTraffic();
    }, config.persistInterval);

    this.containerSyncInterval = setInterval(() => {
      this.syncContainers().catch((error) => {
        logger.error('Error in scheduled container sync:', error);
      });
    }, config.containerSyncInterval);

    logger.info(
      `Traffic service started (collect: ${config.collectInterval}ms, persist: ${config.persistInterval}ms, sync: ${config.containerSyncInterval}ms)`
    );
  }

  stop(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
    }
    if (this.containerSyncInterval) {
      clearInterval(this.containerSyncInterval);
    }
    this.persistTraffic();
    logger.info('Traffic service stopped');
  }

  private async syncContainers(force = false): Promise<void> {
    if (this.ongoingSync) {
      if (!force) {
        logger.debug('[Traffic] Container sync already in progress, skipping');
        return this.ongoingSync;
      }
      logger.debug('[Traffic] Waiting for ongoing container sync to finish (forced run)');
      await this.ongoingSync;
    }

    const syncTask = (async () => {
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
        throw error;
      } finally {
        this.ongoingSync = null;
      }
    })();

    this.ongoingSync = syncTask;
    return syncTask;
  }

  async refreshNow(): Promise<void> {
    logger.info('[Traffic] Manual refresh triggered');
    try {
      await this.syncContainers(true);
      await this.collectTraffic();
      this.persistTraffic();
      logger.info('[Traffic] Manual refresh completed');
    } catch (error) {
      logger.error('[Traffic] Manual refresh failed:', error);
      throw error;
    }
  }

  private async collectTraffic(): Promise<void> {
    const containers = this.containerRepo.findAll();
    logger.debug(`[Traffic] Collecting traffic for ${containers.length} containers`);

    for (const container of containers) {
      try {
        const isRunning = await this.dockerService.isContainerRunning(container.id);

        if (container.status !== 'expired') {
          const desiredStatus: Container['status'] = isRunning ? 'active' : 'stopped';
          if (container.status !== desiredStatus) {
            this.containerRepo.updateStatus(container.id, desiredStatus);
            container.status = desiredStatus;
            logger.info(`[Traffic] Container ${container.name} status updated to ${desiredStatus}`);
          }
        }

        if (!isRunning) {
          logger.debug(`[Traffic] Container ${container.name} is not running, skipping`);
          continue;
        }

        const stats = await this.dockerService.getContainerStats(container.id);
        if (!stats) {
          logger.warn(`[Traffic] Failed to get stats for container ${container.name}`);
          continue;
        }

        logger.debug(`[Traffic] Container ${container.name} stats: rx=${stats.rx_bytes}, tx=${stats.tx_bytes}`);

        const cache = this.trafficCache[container.id];

        if (!cache) {
          logger.info(`[Traffic] Initializing cache for container ${container.name}, bandwidth_used=${container.bandwidth_used}`);
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

        if (totalDelta > 0) {
          logger.debug(`[Traffic] Container ${container.name} delta: rx=${rxDelta}, tx=${txDelta}, total=${totalDelta}, accumulated=${cache.accumulatedBytes}`);
        }

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
      logger.info(`[Persist] Persisting ${this.pendingLogs.length} traffic logs`);
      this.trafficRepo.batchCreate(this.pendingLogs);

      const containerUpdates = new Map<string, number>();
      for (const log of this.pendingLogs) {
        const current = containerUpdates.get(log.container_id) || 0;
        containerUpdates.set(log.container_id, current + log.total_bytes);
      }

      logger.debug(`[Persist] Updating bandwidth for ${containerUpdates.size} containers`);
      for (const [containerId] of containerUpdates) {
        const cache = this.trafficCache[containerId];
        if (cache) {
          logger.info(`[Persist] Container ${containerId}: updating bandwidth_used to ${cache.accumulatedBytes} bytes (${(cache.accumulatedBytes / 1024 / 1024 / 1024).toFixed(3)} GB)`);
          this.containerRepo.updateBandwidthUsed(containerId, cache.accumulatedBytes);
        } else {
          logger.warn(`[Persist] No cache found for container ${containerId}`);
        }
      }

      logger.debug(`[Persist] Successfully persisted ${this.pendingLogs.length} traffic logs`);
      this.pendingLogs = [];
    } catch (error) {
      logger.error('[Persist] Failed to persist traffic logs:', error);
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
