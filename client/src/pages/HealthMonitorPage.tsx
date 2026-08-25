import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import api from '../api';
import type { FlaggedCamera, HealthTrendPoint, AlertSummary } from '../types';
import { AlertTriangle } from 'lucide-react';
import './HealthMonitorPage.css';

const SEVERITY_COLORS = { high: 'var(--status-offline)', medium: 'var(--status-warning)', low: 'var(--text-tertiary)' };

export default function HealthMonitorPage() {
  const [flagged, setFlagged] = useState<FlaggedCamera[]>([]);
  const [trend, setTrend] = useState<HealthTrendPoint[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/health/flagged'),
      api.get('/health/trend?days=30'),
    ]).then(([flaggedRes, trendRes]) => {
      const flaggedData = flaggedRes.data.flagged || flaggedRes.data || [];
      setFlagged(flaggedData);
      setTrend(trendRes.data.trend || trendRes.data || []);
      // Calculate alert summary from flagged data
      const summary = { high: 0, medium: 0, low: 0 };
      flaggedData.forEach((f: FlaggedCamera) => { summary[f.severity]++; });
      setAlertSummary(flaggedRes.data.summary || summary);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<FlaggedCamera>[] = [
    { key: 'camera', label: 'Camera ID', width: '160px',
      render: (row) => <span className="mono">{row.camera?.id || '–'}</span> },
    { key: 'severity', label: 'Severity', width: '100px',
      render: (row) => (
        <span className="severity-chip" style={{ color: SEVERITY_COLORS[row.severity] }}>
          <AlertTriangle size={12} />
          {row.severity}
        </span>
      )},
    { key: 'flag_reason', label: 'Reason', width: '160px',
      render: (row) => row.flag_reason.replace(/_/g, ' ') },
    { key: 'status', label: 'Status', width: '120px',
      render: (row) => row.camera ? <StatusBadge status={row.camera.status} /> : '–' },
    { key: 'department', label: 'Department', width: '100px',
      render: (row) => row.camera?.department_id || '–' },
    { key: 'district', label: 'District', width: '100px',
      render: (row) => row.camera?.district_id || '–' },
    { key: 'last_verified', label: 'Last Verified', width: '120px',
      render: (row) => row.camera?.last_verified_at ? new Date(row.camera.last_verified_at).toLocaleDateString() : 'Never' },
  ];

  return (
    <div className="health-page">
      <TopBar title="Health Monitor" />
      <div className="health-page__content">
        {/* Alert Summary */}
        {alertSummary && (
          <div className="health-alerts">
            <div className="health-alert health-alert--high">
              <span className="health-alert__count mono">{alertSummary.high}</span>
              <span className="health-alert__label">High</span>
            </div>
            <div className="health-alert health-alert--medium">
              <span className="health-alert__count mono">{alertSummary.medium}</span>
              <span className="health-alert__label">Medium</span>
            </div>
            <div className="health-alert health-alert--low">
              <span className="health-alert__count mono">{alertSummary.low}</span>
              <span className="health-alert__label">Low</span>
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {trend.length > 0 && (
          <div className="health-chart-container">
            <h3 className="section-heading">Status Trend (30 days)</h3>
            <div className="health-chart">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-tertiary)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--text-tertiary)" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      fontSize: '13px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="online" stroke="#2E7D5B" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="offline" stroke="#A23B33" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="maintenance" stroke="#B5792B" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Flagged Cameras */}
        <div className="health-section">
          <h3 className="section-heading">Flagged Cameras ({flagged.length})</h3>
          <DataTable
            columns={columns}
            data={flagged}
            total={flagged.length}
            loading={loading}
            emptyMessage="No cameras flagged for attention."
            id="flagged-cameras-table"
          />
        </div>
      </div>
    </div>
  );
}
