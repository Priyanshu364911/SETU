import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('setu_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('setu_token');
      localStorage.removeItem('setu_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Federation API helpers (Model 3) ─────────────────────────────────────────

export const federationApi = {
  /** List VMS systems */
  getSystems: () => api.get('/federation/systems').then((r) => r.data.data),

  /** Live connector health statuses */
  getConnectors: () => api.get('/federation/connectors').then((r) => r.data.data),

  /** Trigger on-demand sync for a system */
  syncSystem: (id: string) => api.post(`/federation/systems/${id}/sync`).then((r) => r.data),

  /** Federated camera list (registry + VMS binding joined) */
  getCameras: () => api.get('/federation/cameras').then((r) => r.data.data),

  /** Paginated federated event log */
  getEvents: (params?: { page?: number; pageSize?: number; eventType?: string; cameraId?: string; vmsSystemId?: string }) =>
    api.get('/federation/events', { params }).then((r) => r.data),

  /** List camera↔VMS bindings */
  getBindings: (cameraId?: string) =>
    api.get('/federation/bindings', { params: cameraId ? { cameraId } : {} }).then((r) => r.data.data),

  /** Create a camera↔VMS binding */
  createBinding: (data: {
    camera_id: string;
    vms_system_id: string;
    external_camera_id: string;
    stream_path?: string;
    capabilities?: Record<string, unknown>;
  }) => api.post('/federation/bindings', data).then((r) => r.data),

  /** Deactivate a binding */
  deleteBinding: (id: string) => api.delete(`/federation/bindings/${id}`),

  /** Run auto-map (demo helper) */
  autoMap: () => api.post('/federation/bindings/auto-map').then((r) => r.data),

  /** List correlation tracks */
  getTracks: (limit = 50) => api.get('/federation/tracks', { params: { limit } }).then((r) => r.data.data),

  /** GIS movement history for a track */
  getTrackHistory: (id: string) => api.get(`/federation/tracks/${id}/history`).then((r) => r.data.data),

  /** Sample federated analytics report (JSON) */
  getAnalyticsReport: () => api.get('/federation/analytics/report').then((r) => r.data),

  /** Download analytics report as CSV */
  downloadReportCsv: () => `${API_BASE}/api/federation/analytics/report.csv`,

  // ── Phase 4: Stream Sessions ──────────────────────────────────────────────

  /** Request a mediated stream session for a registry camera */
  requestStream: (cameraId: string) =>
    api.post('/federation/streams', { camera_id: cameraId }).then((r) => r.data),

  /** Retrieve an active stream session by token */
  getStreamSession: (token: string) =>
    api.get(`/federation/streams/${token}`).then((r) => r.data),

  // ── Phase 4: ANPR Inject ─────────────────────────────────────────────────

  /** Inject a plate detection event through the federation pipeline */
  detectPlate: (payload: {
    camera_id: string;
    plate: string;
    confidence?: number;
    occurred_at?: string;
  }) => api.post('/federation/anpr/detect', payload).then((r) => r.data),

  // ── Phase 4: Watchlist ───────────────────────────────────────────────────

  /** List watchlist entries */
  getWatchlist: (activeOnly = true) =>
    api.get('/federation/watchlist', { params: { activeOnly } }).then((r) => r.data.data),

  /** Create a watchlist entry */
  createWatchlistEntry: (data: {
    entity_type: string;
    entity_value: string;
    display_name?: string;
    description?: string;
    priority?: string;
    source?: string;
  }) => api.post('/federation/watchlist', data).then((r) => r.data),

  /** Update a watchlist entry */
  updateWatchlistEntry: (
    id: string,
    patch: { display_name?: string; description?: string; priority?: string }
  ) => api.put(`/federation/watchlist/${id}`, patch).then((r) => r.data),

  /** Soft-deactivate a watchlist entry */
  deleteWatchlistEntry: (id: string) => api.delete(`/federation/watchlist/${id}`),

  // ── Phase 4: Alerts ──────────────────────────────────────────────────────

  /** List alerts with optional status filter */
  getAlerts: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/federation/alerts', { params }).then((r) => r.data),

  /** Get open alert count (for nav badge) */
  getAlertCount: () =>
    api.get('/federation/alerts/count').then((r) => r.data as { open: number }),

  /** Acknowledge an alert */
  ackAlert: (id: string, note?: string) =>
    api.post(`/federation/alerts/${id}/ack`, { note }).then((r) => r.data),

  /** Close/resolve an alert */
  closeAlert: (id: string) =>
    api.post(`/federation/alerts/${id}/close`).then((r) => r.data),
};

export default api;

