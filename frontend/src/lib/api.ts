import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

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

export interface AuditLog {
  id: number;
  container_id: string | null;
  action: string;
  details: string | null;
  timestamp: number;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  verify: () => api.get('/auth/verify'),
  logout: () => api.post('/auth/logout'),
};

export const containerApi = {
  getAll: () => api.get<Container[]>('/containers'),
  getById: (id: string) => api.get<Container>(`/containers/${id}`),
  update: (id: string, data: Partial<Container>) => api.put(`/containers/${id}`, data),
  start: (id: string) => api.post(`/containers/${id}/start`),
  stop: (id: string) => api.post(`/containers/${id}/stop`),
  reset: (id: string) => api.post(`/containers/${id}/reset`),
  getShareToken: (id: string) => api.get<{ token: string; url: string }>(`/containers/${id}/share`),
  delete: (id: string, confirmName: string) =>
    api.delete(`/containers/${id}`, { data: { confirmName } }),
};

export const auditApi = {
  getLogs: (limit = 100, offset = 0) =>
    api.get<{ logs: AuditLog[]; total: number }>('/audit/logs', { params: { limit, offset } }),
  getStats: () => api.get('/audit/stats'),
};

export const publicApi = {
  getShareInfo: (token: string) => axios.get(`/api/public/share/${token}`),
};
