import { getDatabase } from '../index';
import { AuditLog } from '../../types';

export class AuditRepository {
  private db = getDatabase();

  create(log: Omit<AuditLog, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (container_id, action, details, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(log.container_id, log.action, log.details, log.timestamp);
  }

  findAll(limit = 100, offset = 0): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as AuditLog[];
  }

  findByContainer(containerId: string, limit = 50): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE container_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(containerId, limit) as AuditLog[];
  }

  findByAction(action: AuditLog['action'], limit = 50): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE action = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(action, limit) as AuditLog[];
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  deleteOldLogs(beforeTimestamp: number): number {
    const stmt = this.db.prepare('DELETE FROM audit_logs WHERE timestamp < ?');
    const result = stmt.run(beforeTimestamp);
    return result.changes;
  }
}
