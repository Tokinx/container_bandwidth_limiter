import Docker from 'dockerode';
import { config } from '../config';
import logger from '../utils/logger';
import { ContainerStats } from '../types';

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: config.dockerSocket });
  }

  async getMonitoredContainers(): Promise<Docker.ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.filter((container) => {
        const labels = container.Labels || {};
        return labels[config.monitorLabel] === 'true';
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

      const stats = await container.stats({ stream: false });

      // 调试：输出网络接口信息
      if (stats.networks) {
        const networkNames = Object.keys(stats.networks);
        logger.debug(`[Docker] Container ${containerId} has ${networkNames.length} network interfaces: ${networkNames.join(', ')}`);
      } else {
        logger.warn(`[Docker] Container ${containerId} has no network stats`);
      }

      const rxBytes = stats.networks
        ? Object.values(stats.networks).reduce((sum, net: any) => sum + (net.rx_bytes || 0), 0)
        : 0;

      const txBytes = stats.networks
        ? Object.values(stats.networks).reduce((sum, net: any) => sum + (net.tx_bytes || 0), 0)
        : 0;

      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;

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
    } catch (error: any) {
      if (error.statusCode === 304) {
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
    } catch (error: any) {
      if (error.statusCode === 304) {
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
}
