import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, RefreshCw, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { federationApi } from '../api';
import './WatchlistPage.css';

interface WatchlistEntry {
  id: string;
  entity_type: string;
  entity_value: string;
  display_name: string | null;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  is_active: boolean;
  created_at: string;
}

interface FederatedCamera {
  cameraId: string;
  name: string;
  vmsName: string;
}

interface InjectResult {
  event: { id: string };
  track: { id: string; point_count: number } | null;
  alert: { id: string; severity: string; title: string } | null;
  matched: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#A23B33',
  high: '#B5792B',
  medium: '#245C8C',
  low: '#5C6675',
};

const ENTITY_TYPES = [
  'stolen_vehicle',
  'blacklisted_vehicle',
  'wanted_person',
  'missing_person',
  'suspect',
  'other',
];

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || '#5C6675';
  return (
    <span className="wl-priority-badge" style={{ background: `${color}22`, color }}>
      {priority.toUpperCase()}
    </span>
  );
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [cameras, setCameras] = useState<FederatedCamera[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Add form state
  const [addForm, setAddForm] = useState({
    entity_type: 'stolen_vehicle',
    entity_value: '',
    display_name: '',
    description: '',
    priority: 'high',
    source: 'manual',
  });
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // ANPR Inject state
  const [injectForm, setInjectForm] = useState({ camera_id: '', plate: '', confidence: '0.95' });
  const [injectResult, setInjectResult] = useState<InjectResult | null>(null);
  const [injectError, setInjectError] = useState('');
  const [injecting, setInjecting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wl, cams] = await Promise.all([
        federationApi.getWatchlist(false),
        federationApi.getCameras().catch(() => [] as FederatedCamera[]),
      ]);
      setEntries(wl ?? []);
      setCameras(cams ?? []);
      setLastRefresh(new Date());
    } catch (_) {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAdd = async () => {
    setAddError('');
    if (!addForm.entity_value.trim()) {
      setAddError('Plate / entity value is required');
      return;
    }
    setAddSubmitting(true);
    try {
      await federationApi.createWatchlistEntry({
        entity_type: addForm.entity_type,
        entity_value: addForm.entity_value.trim().toUpperCase(),
        display_name: addForm.display_name || undefined,
        description: addForm.description || undefined,
        priority: addForm.priority,
        source: addForm.source || 'manual',
      });
      setAddForm({ entity_type: 'stolen_vehicle', entity_value: '', display_name: '', description: '', priority: 'high', source: 'manual' });
      setShowAddForm(false);
      await loadData();
    } catch (err: any) {
      setAddError(err?.response?.data?.error ?? err.message);
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string, plate: string) => {
    if (!confirm(`Remove "${plate}" from active watchlist?`)) return;
    try {
      await federationApi.deleteWatchlistEntry(id);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    }
  };

  const handleInject = async () => {
    setInjectError('');
    setInjectResult(null);
    if (!injectForm.camera_id || !injectForm.plate.trim()) {
      setInjectError('Camera and plate are required');
      return;
    }
    setInjecting(true);
    try {
      const result = await federationApi.detectPlate({
        camera_id: injectForm.camera_id,
        plate: injectForm.plate.trim(),
        confidence: parseFloat(injectForm.confidence) || undefined,
      });
      setInjectResult(result);
    } catch (err: any) {
      setInjectError(err?.response?.data?.error ?? err.message);
    } finally {
      setInjecting(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  const activeEntries = entries.filter((e) => e.is_active);
  const inactiveEntries = entries.filter((e) => !e.is_active);

  return (
    <div className="wl-page">
      {/* Header */}
      <div className="wl-header">
        <div>
          <div className="wl-header__title">
            <Shield size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Watchlist Management
          </div>
          <div className="wl-header__subtitle">
            Active entities of interest — plates matched in real-time against VMS-B event stream
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Updated {lastRefresh.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button className="btn-sm btn-sm--ghost" onClick={() => void loadData()} disabled={loading} id="btn-wl-refresh">
            <RefreshCw size={13} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
            Refresh
          </button>
          <button
            className="btn-sm btn-sm--primary"
            onClick={() => setShowAddForm((v) => !v)}
            id="btn-wl-add"
          >
            <Plus size={13} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
            {showAddForm ? 'Cancel' : 'Add Entry'}
          </button>
        </div>
      </div>

      <div className="wl-body">
        {/* ─── ANPR Inject Widget ─── */}
        <div className="wl-inject-card">
          <div className="wl-inject-card__title">
            <Zap size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            ANPR Plate Inject — Demo / Evaluator Tool
          </div>
          <div className="wl-inject-card__subtitle">
            Simulate a plate detection through the northbound federation pipeline. Watchlisted plates will trigger real-time alerts.
          </div>
          <div className="wl-inject-row">
            <div className="wl-inject-field">
              <label className="wl-label">Camera</label>
              <select
                value={injectForm.camera_id}
                onChange={(e) => setInjectForm((f) => ({ ...f, camera_id: e.target.value }))}
                id="inject-camera-select"
              >
                <option value="">Select a federated camera…</option>
                {cameras.map((c) => (
                  <option key={c.cameraId} value={c.cameraId}>
                    {c.name} ({c.cameraId})
                  </option>
                ))}
              </select>
            </div>
            <div className="wl-inject-field">
              <label className="wl-label">Plate Number</label>
              <input
                placeholder="e.g. GJ01WL0001"
                value={injectForm.plate}
                onChange={(e) => setInjectForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
                id="inject-plate-input"
                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
              />
            </div>
            <div className="wl-inject-field wl-inject-field--sm">
              <label className="wl-label">Confidence</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={injectForm.confidence}
                onChange={(e) => setInjectForm((f) => ({ ...f, confidence: e.target.value }))}
                id="inject-confidence-input"
              />
            </div>
            <div className="wl-inject-field wl-inject-field--action">
              <label className="wl-label">&nbsp;</label>
              <button
                className="btn-sm btn-sm--primary"
                onClick={() => void handleInject()}
                disabled={injecting}
                id="btn-inject-plate"
              >
                {injecting ? 'Injecting…' : 'Inject Plate'}
              </button>
            </div>
          </div>

          {injectError && (
            <div className="wl-inject-error">
              <AlertTriangle size={13} style={{ marginRight: 4, display: 'inline' }} />
              {injectError}
            </div>
          )}

          {injectResult && (
            <div className={`wl-inject-result ${injectResult.matched ? 'wl-inject-result--alert' : 'wl-inject-result--ok'}`}>
              <CheckCircle size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
              <strong>Event ingested</strong> — ID: {injectResult.event.id.slice(0, 8)}…
              {injectResult.track && (
                <span> · Track sightings: {injectResult.track.point_count}</span>
              )}
              {injectResult.matched && injectResult.alert && (
                <span className="wl-inject-result__match">
                  🚨 WATCHLIST HIT → Alert: {injectResult.alert.title}
                </span>
              )}
              {!injectResult.matched && (
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                  No watchlist match (or deduped within 5 min)
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Add Entry Form ─── */}
        {showAddForm && (
          <div className="wl-form-card">
            <div className="wl-form-card__title">Add Watchlist Entry</div>
            <div className="wl-form-grid">
              <div className="wl-form-field">
                <label className="wl-label">Plate / Entity Value *</label>
                <input
                  placeholder="GJ01AB1234"
                  value={addForm.entity_value}
                  onChange={(e) => setAddForm((f) => ({ ...f, entity_value: e.target.value.toUpperCase() }))}
                  id="wl-form-value"
                  style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                />
              </div>
              <div className="wl-form-field">
                <label className="wl-label">Type</label>
                <select
                  value={addForm.entity_type}
                  onChange={(e) => setAddForm((f) => ({ ...f, entity_type: e.target.value }))}
                  id="wl-form-type"
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="wl-form-field">
                <label className="wl-label">Priority</label>
                <select
                  value={addForm.priority}
                  onChange={(e) => setAddForm((f) => ({ ...f, priority: e.target.value }))}
                  id="wl-form-priority"
                >
                  {['low', 'medium', 'high', 'critical'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="wl-form-field">
                <label className="wl-label">Display Name</label>
                <input
                  placeholder="Optional label"
                  value={addForm.display_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                  id="wl-form-name"
                />
              </div>
              <div className="wl-form-field wl-form-field--full">
                <label className="wl-label">Description</label>
                <input
                  placeholder="Optional description"
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  id="wl-form-desc"
                />
              </div>
            </div>
            {addError && <div className="wl-form-error">{addError}</div>}
            <div className="wl-form-actions">
              <button className="btn-sm btn-sm--primary" onClick={() => void handleAdd()} disabled={addSubmitting} id="btn-wl-submit">
                {addSubmitting ? 'Saving…' : 'Add to Watchlist'}
              </button>
              <button className="btn-sm btn-sm--ghost" onClick={() => { setShowAddForm(false); setAddError(''); }} id="btn-wl-cancel">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ─── Active Entries Table ─── */}
        <div className="wl-table-section">
          <div className="wl-table-section__header">
            <span>Active Watchlist ({activeEntries.length})</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              These plates trigger real-time alerts when detected by any VMS adapter
            </span>
          </div>

          {activeEntries.length === 0 ? (
            <div className="wl-empty">
              No active watchlist entries. Server seeds GJ01WL0001 and GJ05WL0002 on first boot.
            </div>
          ) : (
            <table className="wl-table">
              <thead>
                <tr>
                  {['Plate / Value', 'Type', 'Priority', 'Display Name', 'Source', 'Added', ''].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="wl-table__plate">{e.entity_value}</td>
                    <td className="wl-table__type">{e.entity_type.replace(/_/g, ' ')}</td>
                    <td><PriorityBadge priority={e.priority} /></td>
                    <td className="wl-table__name">{e.display_name || '—'}</td>
                    <td className="wl-table__source">{e.source}</td>
                    <td className="wl-table__date">{formatTime(e.created_at)}</td>
                    <td>
                      <button
                        className="btn-sm btn-sm--ghost"
                        onClick={() => void handleDeactivate(e.id, e.entity_value)}
                        style={{ color: 'var(--status-offline)' }}
                        id={`btn-wl-remove-${e.id}`}
                        title="Remove from watchlist"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Inactive Entries ─── */}
        {inactiveEntries.length > 0 && (
          <div className="wl-table-section wl-table-section--inactive">
            <div className="wl-table-section__header">
              <span style={{ color: 'var(--text-tertiary)' }}>Inactive Entries ({inactiveEntries.length})</span>
            </div>
            <table className="wl-table wl-table--dim">
              <thead>
                <tr>
                  {['Plate / Value', 'Type', 'Priority', 'Source', 'Removed'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inactiveEntries.map((e) => (
                  <tr key={e.id} style={{ opacity: 0.5 }}>
                    <td className="wl-table__plate">{e.entity_value}</td>
                    <td className="wl-table__type">{e.entity_type.replace(/_/g, ' ')}</td>
                    <td><PriorityBadge priority={e.priority} /></td>
                    <td className="wl-table__source">{e.source}</td>
                    <td className="wl-table__date">{formatTime((e as any).updated_at || e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
