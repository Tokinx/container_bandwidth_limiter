import crypto from 'crypto';

export function generateToken(): string {
  return crypto.randomUUID();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function parseBytes(str: string): number {
  const units: { [key: string]: number } = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const match = str.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
  if (!match) throw new Error('Invalid byte string format');

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (!units[unit]) throw new Error('Invalid unit');

  return Math.floor(value * units[unit]);
}

export function getResetTimestamp(resetDay: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let resetDate = new Date(year, month, resetDay, 0, 0, 0, 0);

  if (resetDate <= now) {
    resetDate = new Date(year, month + 1, resetDay, 0, 0, 0, 0);
  }

  return resetDate.getTime();
}

export function shouldReset(lastResetAt: number | null, resetDay: number): boolean {
  if (!lastResetAt) return true;

  const now = new Date();
  const lastReset = new Date(lastResetAt);

  if (now.getDate() === resetDay && lastReset.getDate() !== resetDay) {
    return true;
  }

  if (now.getMonth() > lastReset.getMonth() || now.getFullYear() > lastReset.getFullYear()) {
    if (now.getDate() >= resetDay) {
      return true;
    }
  }

  return false;
}
