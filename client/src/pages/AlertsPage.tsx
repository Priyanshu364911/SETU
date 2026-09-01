import { useState, useEffect, useCallback } from 'react';
import { Bell, RefreshCw, CheckCheck, XCircle, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { federationApi } from '../api';
import './AlertsPage.css';

interface AlertRecord {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'closed';
  camera_id: string | null;
  camera_name?: string;
  watchlist_id: string | null;
  event_id: string | null;
  track_id: string | null;
  entity_value: string | null;
  payload: Record<string, unknown>;
  acknowledged_at: string | null;
  closed_at: string | null;
  created_at: string;
  wl_entity_type?: string;
  wl_display_name?: string;
  wl_priority?: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: '#A23B33',
  high: '#B5792B',
  medium: '#245C8C',
  low: '#5C6675',
};

type TabFilter = 'all' | 'open' | 'acknowledged' | 'closed';

function SevBadge({ severity }: { severity: string }) {
  const c = SEV_COLORS[severity] || '#5C6675';
  return (
    <span className="alert-sev" style={{ background: `${c}22`, color: c }}>
      {severity}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: '#A23B33',
    acknowledged: '#B5792B',
    closed: '#5C6675',
  };
  return <span className="alert-status-dot" style={{ background: colors[status] || '#5C6675' }} />;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<TabFilter>('open');
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [ackNote, setAckNote] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await federationApi.getAlerts({
        status: tab === 'all' ? undefined : tab,
        pageSize: 100,
      });
      setAlerts(result?.data ?? []);
      setTotal(result?.total ?? 0);
      setLastRefresh(new Date());
    } catch (_) {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadAlerts();
    const interval = setInterval(() => void loadAlerts(), 5000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleAck = async (id: string) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      await federationApi.ackAlert(id, ackNote[id]);
      await loadAlerts();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  };

  const handleClose = async (id: string) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      await federationApi.closeAlert(id);
      await loadAlerts();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  };

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }) : '—';

  const TABS: { id: TabFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'acknowledged', label: 'Acknowledged' },
    { id: 'closed', label: 'Closed' },
  ];

  return (
    <div className="alerts-page">
      {/* Header */}
      <div className="alerts-header">
        <div>
          <div className="alerts-header__title">
            <Bell size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Real-Time Alerts
          </div>
          <div className="alerts-header__subtitle">
            Live watchlist hit alerts — polling every 5s · {total} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {lastRefresh.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button className="btn-sm btn-sm--ghost" onClick={() => void loadAlerts()} disabled={loading} id="btn-alerts-refresh">
            <RefreshCw size={13} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="alerts-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`alerts-tab ${tab === t.id ? 'alerts-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
            id={`tab-alerts-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="alerts-body">
        {alerts.length === 0 && !loading && (
          <div className="alerts-empty">
            {tab === 'open'
              ? 'No open alerts. VMS-B will trigger alerts when GJ01WL0001 or GJ05WL0002 are detected.'
              : `No ${tab} alerts.`}
          </div>
        )}

        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert-card alert-card--${alert.severity} ${alert.status !== 'open' ? 'alert-card--dim' : ''}`}
            onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
          >
            <div className="alert-card__top">
              <div className="alert-card__left">
                <StatusDot status={alert.status} />
                <div>
                  <div className="alert-card__title">{alert.title}</div>
                  {alert.entity_value && (
                    <span className="alert-card__plate">{alert.entity_value}</span>
                  )}
                  {alert.camera_name && (
                    <span className="alert-card__camera">
                      &nbsp;· {alert.camera_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="alert-card__right">
                <SevBadge severity={alert.severity} />
                <span className="alert-card__time">{formatTime(alert.created_at)}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === alert.id && (
              <div className="alert-card__detail" onClick={(e) => e.stopPropagation()}>
                {alert.message && (
                  <div className="alert-card__message">{alert.message}</div>
                )}

                <div className="alert-card__meta">
                  <div>
                    <span className="alert-meta-label">Status</span>
                    <span className="alert-meta-value">{alert.status}</span>
                  </div>
                  <div>
                    <span className="alert-meta-label">Type</span>
                    <span className="alert-meta-value">{alert.alert_type}</span>
                  </div>
                  {alert.camera_id && (
                    <div>
                      <span className="alert-meta-label">Camera</span>
                      <span className="alert-meta-value" style={{ fontFamily: 'var(--font-mono)' }}>
                        {alert.camera_id}
                      </span>
                    </div>
                  )}
                  {alert.acknowledged_at && (
                    <div>
                      <span className="alert-meta-label">Acknowledged</span>
                      <span className="alert-meta-value">{formatTime(alert.acknowledged_at)}</span>
                    </div>
                  )}
                  {alert.closed_at && (
                    <div>
                      <span className="alert-meta-label">Closed</span>
                      <span className="alert-meta-value">{formatTime(alert.closed_at)}</span>
                    </div>
                  )}
                </div>

                <div className="alert-card__actions">
                  {/* Link to correlation track */}
                  {alert.track_id && (
                    <button
                      className="btn-sm btn-sm--ghost"
                      onClick={() => navigate('/correlation')}
                      id={`btn-alert-track-${alert.id}`}
                    >
                      <Link size={12} style={{ marginRight: 4, display: 'inline' }} />
                      View Track
                    </button>
                  )}

                  {/* Acknowledge */}
                  {alert.status === 'open' && (
                    <div className="alert-ack-row">
                      <input
                        placeholder="Acknowledgement note (optional)"
                        value={ackNote[alert.id] || ''}
                        onChange={(e) => setAckNote((n) => ({ ...n, [alert.id]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="alert-ack-note"
                        id={`ack-note-${alert.id}`}
                      />
                      <button
                        className="btn-sm btn-sm--primary"
                        onClick={(e) => { e.stopPropagation(); void handleAck(alert.id); }}
                        disabled={acting[alert.id]}
                        id={`btn-ack-${alert.id}`}
                      >
                        <CheckCheck size={12} style={{ marginRight: 4, display: 'inline' }} />
                        {acting[alert.id] ? '…' : 'Acknowledge'}
                      </button>
                    </div>
                  )}

                  {/* Close */}
                  {(alert.status === 'open' || alert.status === 'acknowledged') && (
                    <button
                      className="btn-sm btn-sm--ghost"
                      onClick={(e) => { e.stopPropagation(); void handleClose(alert.id); }}
                      disabled={acting[alert.id]}
                      style={{ color: 'var(--text-tertiary)' }}
                      id={`btn-close-${alert.id}`}
                    >
                      <XCircle size={12} style={{ marginRight: 4, display: 'inline' }} />
                      {acting[alert.id] ? '…' : 'Close'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
