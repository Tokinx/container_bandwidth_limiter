import Docker from 'dockerode';
import { Readable } from 'stream';
import { config } from '../config';
import logger from '../utils/logger';
import { ContainerStats } from '../types';

type DockerNetworkStats = {
  rx_bytes?: number;
  tx_bytes?: number;
};

export class DockerService {
  private docker: Docker;
  private readonly selfContainerId?: string | null;
  private readonly selfContainerName?: string | null;

  constructor() {
    this.docker = new Docker({ socketPath: config.dockerSocket });
    this.selfContainerId = config.selfContainerId;
    this.selfContainerName = config.selfContainerName;
  }

  async getMonitoredContainers(): Promise<Docker.ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.filter((container) => {
        if (this.isSelfContainer(container)) {
          return false;
        }

        const labels = container.Labels || {};
        const labelValue = labels[config.monitorLabel];

        if (labelValue && typeof labelValue === 'string') {
          const normalized = labelValue.toLowerCase();
          if (normalized === 'false' || normalized === '0') {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      logger.error('Failed to list containers:', error);
      throw error;
    }
  }

  async getContainerStats(containerId: string): Promise<ContainerStats | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      if (!info.State.Running) {
        logger.debug(`[Docker] Container ${containerId} is not running`);
        return null;
      }

      const statsResult = await container.stats({ stream: false });
      const stats = await this.normalizeStats(statsResult);

      // 调试：输出网络接口信息
      if (stats.networks) {
        const networkNames = Object.keys(stats.networks);
        logger.debug(`[Docker] Container ${containerId} has ${networkNames.length} network interfaces: ${networkNames.join(', ')}`);
      } else {
        logger.warn(`[Docker] Container ${containerId} has no network stats`);
      }

      const networkStats = stats.networks
        ? Object.values(stats.networks as Record<string, DockerNetworkStats>)
        : [];

      const rxBytes = networkStats.reduce((sum, net) => sum + (net.rx_bytes ?? 0), 0);
      const txBytes = networkStats.reduce((sum, net) => sum + (net.tx_bytes ?? 0), 0);

      const memoryUsage = stats.memory_stats?.usage || 0;
      const memoryLimit = stats.memory_stats?.limit || 0;

      return {
        id: containerId,
        name: info.Name.replace(/^\//, ''),
        status: info.State.Status,
        rx_bytes: rxBytes,
        tx_bytes: txBytes,
        total_bytes: rxBytes + txBytes,
        memory_usage: memoryUsage,
        memory_limit: memoryLimit,
      };
    } catch (error) {
      logger.error(`Failed to get stats for container ${containerId}:`, error);
      return null;
    }
  }

  async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      logger.info(`Container ${containerId} started`);
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err?.statusCode === 304) {
        logger.debug(`Container ${containerId} already started`);
        return;
      }
      logger.error(`Failed to start container ${containerId}:`, error);
      throw error;
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      logger.info(`Container ${containerId} stopped`);
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err?.statusCode === 304) {
        logger.debug(`Container ${containerId} already stopped`);
        return;
      }
      logger.error(`Failed to stop container ${containerId}:`, error);
      throw error;
    }
  }

  async removeContainer(containerId: string, force = false): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force });
      logger.info(`Container ${containerId} removed`);
    } catch (error) {
      logger.error(`Failed to remove container ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerInfo(containerId: string): Promise<Docker.ContainerInspectInfo | null> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      logger.error(`Failed to inspect container ${containerId}:`, error);
      return null;
    }
  }

  async isContainerRunning(containerId: string): Promise<boolean> {
    try {
      const info = await this.getContainerInfo(containerId);
      return info?.State.Running || false;
    } catch (error) {
      return false;
    }
  }

  private isSelfContainer(container: Docker.ContainerInfo): boolean {
    if (this.selfContainerName) {
      const names = container.Names || [];
      if (names.some((name) => name.replace(/^\//, '') === this.selfContainerName)) {
        return true;
      }
    }

    if (this.selfContainerId) {
      if (container.Id === this.selfContainerId || container.Id.startsWith(this.selfContainerId)) {
        return true;
      }
    }

    return false;
  }

  private async normalizeStats(result: Docker.ContainerStats | Readable): Promise<Docker.ContainerStats> {
    if (this.isReadableStream(result)) {
      return this.readStream(result);
    }
    return result;
  }

  private isReadableStream(value: unknown): value is Readable {
    return value instanceof Readable || (!!value && typeof (value as Readable).on === 'function' && typeof (value as Readable).read === 'function');
  }

  private readStream(stream: Readable): Promise<Docker.ContainerStats> {
    return new Promise((resolve, reject) => {
      let raw = '';
      stream.setEncoding('utf8');

      stream.on('data', (chunk: string) => {
        raw += chunk;
      });

      stream.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }
}
