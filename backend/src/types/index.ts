export interface Container {
  id: string;
  name: string;
  bandwidth_limit: number | null;
  bandwidth_used: number;
  bandwidth_extra: number;
  reset_day: number;
  last_reset_at: number | null;
  expire_at: number | null;
  status: 'active' | 'stopped' | 'expired';
  share_token: string | null;
  share_token_expire: number | null;
  created_at: number;
  updated_at: number;
}

export interface TrafficLog {
  id?: number;
  container_id: string;
  rx_bytes: number;
  tx_bytes: number;
  total_bytes: number;
  timestamp: number;
}

export interface AuditLog {
  id?: number;
  container_id: string | null;
  action: 'start' | 'stop' | 'reset' | 'limit_exceeded' | 'expired' | 'config_update' | 'delete';
  details: string | null;
  timestamp: number;
}

export interface ContainerStats {
  id: string;
  name: string;
  status: string;
  rx_bytes: number;
  tx_bytes: number;
  total_bytes: number;
  memory_usage: number;
  memory_limit: number;
}

export interface UpdateContainerDto {
  bandwidth_limit?: number;
  bandwidth_extra?: number;
  reset_day?: number;
  expire_at?: number;
}
