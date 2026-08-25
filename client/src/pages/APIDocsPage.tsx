import TopBar from '../components/TopBar';
import './APIDocsPage.css';

const ENDPOINTS = [
  { method: 'POST', path: '/api/auth/login', desc: 'Authenticate, receive JWT', roles: 'All',
    body: '{ "username": "string", "password": "string" }',
    response: '{ "token": "eyJ...", "user": { "id": "...", "role": "state_nodal_officer" } }' },
  { method: 'POST', path: '/api/auth/refresh', desc: 'Refresh token', roles: 'All',
    body: '–', response: '{ "token": "eyJ..." }' },
  { method: 'GET', path: '/api/cameras', desc: 'List cameras (paginated, filtered)', roles: 'All',
    body: 'Query: ?status=Online&departmentId=POL&page=1&pageSize=50',
    response: '{ "data": [Camera], "total": 3, "page": 1, "pageSize": 50 }' },
  { method: 'GET', path: '/api/cameras/geojson', desc: 'GeoJSON for map', roles: 'All',
    body: 'Query: ?status=Online,Offline',
    response: '{ "type": "FeatureCollection", "features": [...] }' },
  { method: 'GET', path: '/api/cameras/stats', desc: 'Aggregate stats for stat strip', roles: 'All',
    body: '–', response: '{ "total": 80000, "online": 48000, "offline": 16000, "maintenance": 16000, "pending": 0 }' },
  { method: 'GET', path: '/api/cameras/:id', desc: 'Camera detail', roles: 'All',
    body: '–', response: '{ Camera object }' },
  { method: 'POST', path: '/api/cameras', desc: 'Create camera (API onboarding)', roles: 'SNO, DO',
    body: '{ CameraInput }', response: '{ Camera }' },
  { method: 'PATCH', path: '/api/cameras/:id', desc: 'Update camera fields', roles: 'SNO, DO',
    body: '{ Partial<CameraInput> }', response: '{ Camera }' },
  { method: 'DELETE', path: '/api/cameras/:id', desc: 'Delete camera', roles: 'SNO only',
    body: '–', response: '204 No Content' },
  { method: 'GET', path: '/api/onboarding', desc: 'Get onboarding queue', roles: 'SNO, DO',
    body: 'Query: ?page=1&pageSize=50', response: '{ "data": [Camera], "total": N }' },
  { method: 'POST', path: '/api/onboarding', desc: 'Submit manual entry', roles: 'All',
    body: '{ CameraInput }', response: '{ "id": "GJ-POL-000043", "onboardingStatus": "Pending" }' },
  { method: 'POST', path: '/api/onboarding/bulk', desc: 'Bulk CSV upload', roles: 'SNO, DO, FO',
    body: 'multipart/form-data (file)', response: '{ "accepted": 45, "rejected": 3, "errors": [...] }' },
  { method: 'PATCH', path: '/api/onboarding/:id/approve', desc: 'Approve entry', roles: 'SNO, DO',
    body: '–', response: '{ Camera }' },
  { method: 'PATCH', path: '/api/onboarding/:id/reject', desc: 'Reject entry', roles: 'SNO, DO',
    body: '{ "reason": "string" }', response: '204' },
  { method: 'GET', path: '/api/departments', desc: 'List departments', roles: 'All',
    body: '–', response: '[{ Department }]' },
  { method: 'GET', path: '/api/departments/:id', desc: 'Department detail + camera count', roles: 'All',
    body: '–', response: '{ Department }' },
  { method: 'GET', path: '/api/gap-analysis', desc: 'Low-coverage zones', roles: 'All',
    body: 'Query: ?threshold=0.5', response: '{ "zones": [GapZone] }' },
  { method: 'GET', path: '/api/gap-analysis/ageing', desc: 'Ageing infrastructure list', roles: 'All',
    body: '–', response: '{ "cameras": [Camera] }' },
  { method: 'GET', path: '/api/gap-analysis/export', desc: 'Export gap report (CSV)', roles: 'SNO, DO, AUD',
    body: '–', response: 'CSV file download' },
  { method: 'GET', path: '/api/health/flagged', desc: 'Flagged cameras', roles: 'All',
    body: '–', response: '{ "flagged": [FlaggedCamera], "summary": AlertSummary }' },
  { method: 'GET', path: '/api/health/trend', desc: 'Status trend data', roles: 'All',
    body: 'Query: ?days=30', response: '{ "trend": [HealthTrendPoint] }' },
  { method: 'GET', path: '/api/audit', desc: 'Audit log (paginated)', roles: 'SNO, AUD',
    body: 'Query: ?action=LOGIN&page=1', response: '{ "data": [AuditLog], "total": N }' },
  { method: 'GET', path: '/api/audit/camera/:id', desc: 'Audit history for camera', roles: 'SNO, DO, AUD',
    body: '–', response: '[AuditLog]' },
  { method: 'GET', path: '/api/users', desc: 'List users', roles: 'SNO',
    body: '–', response: '[User]' },
  { method: 'POST', path: '/api/users', desc: 'Create user', roles: 'SNO',
    body: '{ "username", "email", "password", "role", "department_id" }', response: '{ User }' },
  { method: 'PATCH', path: '/api/users/:id', desc: 'Update user', roles: 'SNO',
    body: '{ "role"?, "department_id"?, "is_active"? }', response: '{ User }' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--status-online)',
  POST: 'var(--accent)',
  PATCH: 'var(--status-warning)',
  DELETE: 'var(--status-offline)',
};

export default function APIDocsPage() {
  return (
    <div className="api-docs-page">
      <TopBar title="Registry API" />
      <div className="api-docs-page__content">
        <div className="api-docs__header">
          <h2>SETU Registry REST API Reference</h2>
          <p className="text-secondary">All endpoints require JWT authentication via <code>Authorization: Bearer {'<token>'}</code> header unless noted otherwise.</p>
        </div>

        <div className="api-docs__list">
          {ENDPOINTS.map((ep, i) => (
            <div key={i} className="api-endpoint" id={`endpoint-${i}`}>
              <div className="api-endpoint__header">
                <span className="api-endpoint__method" style={{ color: METHOD_COLORS[ep.method] || 'var(--text-primary)' }}>
                  {ep.method}
                </span>
                <code className="api-endpoint__path">{ep.path}</code>
                <span className="api-endpoint__roles">{ep.roles}</span>
              </div>
              <p className="api-endpoint__desc">{ep.desc}</p>
              <div className="api-endpoint__details">
                <div className="api-endpoint__section">
                  <span className="api-endpoint__section-label">Request:</span>
                  <code className="api-endpoint__code">{ep.body}</code>
                </div>
                <div className="api-endpoint__section">
                  <span className="api-endpoint__section-label">Response:</span>
                  <code className="api-endpoint__code">{ep.response}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
