import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
  timeout: 30000,
});

// Request interceptor – nothing to add (cookies handled automatically)
api.interceptors.request.use((config) => config);

// Response interceptor – redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── API HELPERS ───────────────────────────────────────────────────────────────

export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const reports = {
  list: (params) => api.get('/reports', { params }),
  get: (ticketNumber) => api.get(`/reports/${ticketNumber}`),
  create: (formData) => api.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  confirm: (id) => api.post(`/reports/${id}/confirm`),
  dispute: (id, reason) => api.post(`/reports/${id}/dispute`, { reason }),
  reopen: (id, reason) => api.post(`/reports/${id}/reopen`, { reason }),
  feedback: (id, data) => api.post(`/reports/${id}/feedback`, data),
  similar: (params) => api.get('/reports/check/similar', { params }),
};

export const incidents = {
  list: (params) => api.get('/incidents', { params }),
  get: (id) => api.get(`/incidents/${id}`),
  updateStatus: (id, data) => api.patch(`/incidents/${id}/status`, data),
  assign: (id, data) => api.patch(`/incidents/${id}/assign`, data),
  transfer: (id, data) => api.patch(`/incidents/${id}/transfer`, data),
  unassigned: () => api.get('/incidents/admin/unassigned'),
};

export const departments = {
  list: () => api.get('/departments'),
  get: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.patch(`/departments/${id}`, data),
  workload: (id) => api.get(`/departments/${id}/workload`),
};

export const categories = {
  list: () => api.get('/categories'),
  get: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
};

export const locations = {
  list: (params) => api.get('/locations', { params }),
  get: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.patch(`/locations/${id}`, data),
  bulkAdd: (data) => api.post('/locations/bulk-add', data),
  bulkAssignOwner: (data) => api.post('/locations/bulk-assign-owner', data),
  propose: (data) => api.post('/locations/propose', data),
  approve: (id, data) => api.patch(`/locations/${id}/approve`, data),
};

export const users = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  setLeave: (onLeave) => api.patch('/users/me/leave', { onLeave }),
};

export const notifications = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const adminApi = {
  overview: () => api.get('/admin/overview'),
  auditLog: (params) => api.get('/admin/audit-log', { params }),
  escalated: () => api.get('/admin/escalated'),
  pendingLocations: () => api.get('/admin/pending-locations'),
  analytics: () => api.get('/admin/analytics'),
  exportCsv: () => api.get('/admin/export/csv', { responseType: 'blob' }),
};

export const settingsApi = {
  list: () => api.get('/settings'),
  update: (data) => api.patch('/settings', data),
  public: () => api.get('/settings/public'),
};
