import { getDatabase } from '../index';
import { TrafficLog } from '../../types';

export class TrafficRepository {
  private db = getDatabase();

  create(log: Omit<TrafficLog, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO traffic_logs (container_id, rx_bytes, tx_bytes, total_bytes, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(log.container_id, log.rx_bytes, log.tx_bytes, log.total_bytes, log.timestamp);
  }

  batchCreate(logs: Omit<TrafficLog, 'id'>[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO traffic_logs (container_id, rx_bytes, tx_bytes, total_bytes, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((logs: Omit<TrafficLog, 'id'>[]) => {
      for (const log of logs) {
        stmt.run(log.container_id, log.rx_bytes, log.tx_bytes, log.total_bytes, log.timestamp);
      }
    });

    transaction(logs);
  }

  findByContainer(containerId: string, limit = 100): TrafficLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM traffic_logs
      WHERE container_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(containerId, limit) as TrafficLog[];
  }

  findByTimeRange(containerId: string, startTime: number, endTime: number): TrafficLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM traffic_logs
      WHERE container_id = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(containerId, startTime, endTime) as TrafficLog[];
  }

  deleteOldLogs(beforeTimestamp: number): number {
    const stmt = this.db.prepare('DELETE FROM traffic_logs WHERE timestamp < ?');
    const result = stmt.run(beforeTimestamp);
    return result.changes;
  }
}
