import { getDatabase } from '../index';
import { Container, UpdateContainerDto } from '../../types';
import { generateToken } from '../../utils/helpers';

export class ContainerRepository {
  private db = getDatabase();

  findAll(): Container[] {
    const stmt = this.db.prepare('SELECT * FROM containers ORDER BY created_at DESC');
    return stmt.all() as Container[];
  }

  findById(id: string): Container | undefined {
    const stmt = this.db.prepare('SELECT * FROM containers WHERE id = ?');
    return stmt.get(id) as Container | undefined;
  }

  findByShareToken(token: string): Container | undefined {
    const stmt = this.db.prepare('SELECT * FROM containers WHERE share_token = ?');
    return stmt.get(token) as Container | undefined;
  }

  create(container: Omit<Container, 'created_at' | 'updated_at'>): Container {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO containers (
        id, name, bandwidth_limit, bandwidth_used, bandwidth_extra,
        reset_day, last_reset_at, expire_at, status, share_token,
        share_token_expire, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      container.id,
      container.name,
      container.bandwidth_limit,
      container.bandwidth_used,
      container.bandwidth_extra,
      container.reset_day,
      container.last_reset_at,
      container.expire_at,
      container.status,
      container.share_token,
      container.share_token_expire,
      now,
      now
    );

    return this.findById(container.id)!;
  }

  update(id: string, data: UpdateContainerDto): Container | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.bandwidth_limit !== undefined) {
      updates.push('bandwidth_limit = ?');
      values.push(data.bandwidth_limit);
    }
    if (data.bandwidth_extra !== undefined) {
      updates.push('bandwidth_extra = ?');
      values.push(data.bandwidth_extra);
    }
    if (data.reset_day !== undefined) {
      updates.push('reset_day = ?');
      values.push(data.reset_day);
    }
    if (data.expire_at !== undefined) {
      updates.push('expire_at = ?');
      values.push(data.expire_at);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE containers SET ${updates.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  updateBandwidthUsed(id: string, used: number): void {
    const stmt = this.db.prepare(`
      UPDATE containers SET bandwidth_used = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(used, Date.now(), id);
  }

  updateStatus(id: string, status: Container['status']): void {
    const stmt = this.db.prepare(`
      UPDATE containers SET status = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(status, Date.now(), id);
  }

  resetBandwidth(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE containers
      SET bandwidth_used = 0, last_reset_at = ?, updated_at = ?
      WHERE id = ?
    `);
    const now = Date.now();
    stmt.run(now, now, id);
  }

  generateShareToken(id: string, expireAt: number | null): string {
    const token = generateToken();
    const stmt = this.db.prepare(`
      UPDATE containers
      SET share_token = ?, share_token_expire = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(token, expireAt, Date.now(), id);
    return token;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM containers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
