import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDate(timestamp: number | null): string {
  if (!timestamp) return '未设置';
  return new Date(timestamp).toLocaleString('zh-CN');
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'stopped':
      return 'text-red-600';
    case 'expired':
      return 'text-gray-600';
    default:
      return 'text-gray-400';
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'active':
      return '运行中';
    case 'stopped':
      return '已停止';
    case 'expired':
      return '已到期';
    default:
      return '未知';
  }
}
