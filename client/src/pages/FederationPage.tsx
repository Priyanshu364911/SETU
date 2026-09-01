import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Network, Camera, Link, List, Play, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Hls from 'hls.js';
import { federationApi } from '../api';
import CctvLivePlayer from '../components/CctvLivePlayer';
import './FederationPage.css';

/** Lightweight HLS tile used in the cameras grid */
function SentinelVideoTile({ camId, hlsUrl }: { camId: string; hlsUrl: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus('loading');

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => { xhr.withCredentials = true; },
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { void video.play().catch(() => {}); setStatus('playing'); });
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setStatus('error'); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.oncanplay = () => { setStatus('playing'); void video.play().catch(() => {}); };
      video.onerror = () => setStatus('error');
    } else {
      setStatus('error');
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl]);

  return (
    <div className="sentinel-video-wrap">
      <video
        ref={videoRef}
        id={`tile-video-${camId}`}
        muted
        playsInline
        autoPlay
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {status === 'loading' && (
        <div className="sentinel-video-overlay">
          <div className="sentinel-video-spinner" />
        </div>
      )}
      {status === 'error' && (
        <div className="sentinel-video-overlay sentinel-video-overlay--error">
          <span>⚠ Stream unavailable</span>
        </div>
      )}
    </div>
  );
}



interface StreamSession {
  sessionToken: string;
  streamUrl: string;
  protocol: string;
  expiresAt: string;
  cameraId: string;
  vmsSystemId: string;
}

type Tab = 'systems' | 'cameras' | 'events' | 'bindings';

interface ConnectorStatus {
  vmsSystemId: string;
  name: string;
  vendor: string;
  adapterType: string;
  status: string;
  lastSyncAt: string | null;
  cameraCount: number;
  recentEventCount: number;
}

interface FederatedCamera {
  cameraId: string;
  name: string;
  departmentId: string | null;
  vmsSystemId: string;
  vmsName: string;
  externalCameraId: string;
  streamPath: string | null;
  streamAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  capabilities?: Record<string, unknown>;
}

interface FedEvent {
  id: string;
  event_type: string;
  vms_system_id: string | null;
  camera_id: string | null;
  external_camera_id: string | null;
  severity: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

interface Binding {
  id: string;
  camera_id: string;
  vms_system_id: string;
  external_camera_id: string;
  stream_path: string | null;
  is_active: boolean;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`fed-badge fed-badge--${status}`}>
      <span className="fed-badge__dot" />
      {status}
    </span>
  );
}

function SeverityChip({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: '#A23B33',
    high: '#B5792B',
    medium: '#245C8C',
    low: '#2E7D5B',
    info: '#5C6675',
  };
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 500,
      padding: '1px 6px',
      borderRadius: '10px',
      background: `${colors[severity] ?? '#5C6675'}18`,
      color: colors[severity] ?? '#5C6675',
    }}>
      {severity}
    </span>
  );
}

export default function FederationPage() {
  const [tab, setTab] = useState<Tab>('systems');
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [cameras, setCameras] = useState<FederatedCamera[]>([]);
  const [events, setEvents] = useState<FedEvent[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const eventPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Binding form state
  const [bindForm, setBindForm] = useState({ camera_id: '', vms_system_id: '', external_camera_id: '' });
  const [bindFormOpen, setBindFormOpen] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);

  // Stream modal state
  const [streamModal, setStreamModal] = useState<StreamSession | null>(null);
  const [streamLoading, setStreamLoading] = useState<Record<string, boolean>>({});
  const [streamCountdown, setStreamCountdown] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Video Wall matrix state
  const [wallLayout, setWallLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4' | 'grid'>('grid');
  const [wallSearch, setWallSearch] = useState('');
  const [wallCity, setWallCity] = useState('all');
  const [wallPage, setWallPage] = useState(0);
  const [spotlightCamId, setSpotlightCamId] = useState<string>('cam01');

  // Filtered cameras
  const filteredCameras = cameras.filter((c) => {
    const matchSearch = !wallSearch ||
      c.name.toLowerCase().includes(wallSearch.toLowerCase()) ||
      c.externalCameraId.toLowerCase().includes(wallSearch.toLowerCase());
    const matchCity = wallCity === 'all' || c.name.toLowerCase().includes(wallCity.toLowerCase());
    return matchSearch && matchCity;
  });

  // Calculate layout pagination
  const pageSize = wallLayout === '1x1' ? 1 : wallLayout === '2x2' ? 4 : wallLayout === '3x3' ? 9 : wallLayout === '4x4' ? 16 : filteredCameras.length;
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / pageSize));
  const safePage = Math.min(wallPage, totalPages - 1);
  const visibleCameras = wallLayout === 'grid'
    ? filteredCameras
    : filteredCameras.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Available cities in dataset
  const CITIES = ['all', 'Ahmedabad', 'Junagadh', 'Rajkot', 'Navsari', 'Dehgam', 'Bilimora', 'Gandhidham', 'Patan'];


  const handleRequestStream = async (cameraId: string) => {
    setStreamLoading((s) => ({ ...s, [cameraId]: true }));
    try {
      const session: StreamSession = await federationApi.requestStream(cameraId);
      setStreamModal(session);
      // Start expiry countdown
      const expiresAt = new Date(session.expiresAt).getTime();
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setStreamCountdown(remaining);
        if (remaining <= 0 && countdownRef.current) clearInterval(countdownRef.current);
      }, 1000);
      setStreamCountdown(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setStreamLoading((s) => ({ ...s, [cameraId]: false }));
    }
  };

  const closeStreamModal = () => {
    setStreamModal(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const loadConnectors = useCallback(async () => {
    try {
      const data = await federationApi.getConnectors();
      setConnectors(data ?? []);
    } catch (_) { /* non-fatal */ }
  }, []);

  const loadCameras = useCallback(async () => {
    try {
      const data = await federationApi.getCameras();
      setCameras(data ?? []);
    } catch (_) { /* non-fatal */ }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const data = await federationApi.getEvents({ pageSize: 60 });
      setEvents(data?.data ?? []);
    } catch (_) { /* non-fatal */ }
  }, []);

  const loadBindings = useCallback(async () => {
    try {
      const data = await federationApi.getBindings();
      setBindings(data ?? []);
    } catch (_) { /* non-fatal */ }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadConnectors(), loadCameras(), loadEvents(), loadBindings()]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [loadConnectors, loadCameras, loadEvents, loadBindings]);

  useEffect(() => {
    void loadAll();
    // Poll events every 5s for live updates
    eventPollRef.current = setInterval(() => {
      void loadEvents();
      void loadConnectors();
    }, 5000);
    return () => {
      if (eventPollRef.current) clearInterval(eventPollRef.current);
    };
  }, [loadAll, loadEvents, loadConnectors]);

  const handleSync = async (id: string) => {
    setSyncing((s) => ({ ...s, [id]: true }));
    try {
      await federationApi.syncSystem(id);
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setSyncing((s) => ({ ...s, [id]: false }));
    }
  };

  const handleAutoMap = async () => {
    setAutoMapping(true);
    try {
      const result = await federationApi.autoMap();
      await loadBindings();
      await loadCameras();
      alert(`Auto-mapped ${result.created} camera binding(s)`);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setAutoMapping(false);
    }
  };

  const handleCreateBinding = async () => {
    if (!bindForm.camera_id || !bindForm.vms_system_id || !bindForm.external_camera_id) return;
    try {
      await federationApi.createBinding(bindForm);
      setBindForm({ camera_id: '', vms_system_id: '', external_camera_id: '' });
      setBindFormOpen(false);
      await loadBindings();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    }
  };

  const handleDeleteBinding = async (id: string) => {
    if (!confirm('Deactivate this binding?')) return;
    try {
      await federationApi.deleteBinding(id);
      await loadBindings();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'systems', label: 'Systems', icon: <Network size={14} /> },
    { id: 'cameras', label: `Cameras (${cameras.length})`, icon: <Camera size={14} /> },
    { id: 'events', label: `Events (${events.length})`, icon: <List size={14} /> },
    { id: 'bindings', label: `Bindings (${bindings.length})`, icon: <Link size={14} /> },
  ];

  return (
    <div className="federation-page">
      {/* Header */}
      <div className="federation-header">
        <div>
          <div className="federation-header__title">Federation Hub</div>
          <div className="federation-header__subtitle">
            Model 3 — VMS Federation &amp; Middleware Integration Layer
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {lastRefresh && (
            <span className="refresh-indicator">
              Updated {formatTime(lastRefresh.toISOString())}
            </span>
          )}
          <button
            className="btn-sm btn-sm--ghost"
            onClick={() => void loadAll()}
            disabled={loading}
            id="btn-federation-refresh"
            title="Refresh"
          >
            <RefreshCw size={13} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="federation-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`federation-tab ${tab === t.id ? 'federation-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
            id={`tab-federation-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="federation-body">
        {/* ─── Systems Tab ─── */}
        {tab === 'systems' && (
          <>
            <div className="systems-grid">
              {connectors.length === 0 && (
                <div className="empty-state">No VMS systems registered. Waiting for server bootstrap…</div>
              )}
              {connectors.map((c) => (
                <div key={c.vmsSystemId} className="system-card">
                  <div className="system-card__header">
                    <div>
                      <div className="system-card__name">{c.name}</div>
                      <div className="system-card__vendor">{c.vendor} · {c.adapterType}</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="system-card__stats">
                    <div className="system-card__stat">
                      <span className="system-card__stat-label">Cameras</span>
                      <span className="system-card__stat-value">{c.cameraCount}</span>
                    </div>
                    <div className="system-card__stat">
                      <span className="system-card__stat-label">Events (1h)</span>
                      <span className="system-card__stat-value">{c.recentEventCount}</span>
                    </div>
                    <div className="system-card__stat" style={{ gridColumn: '1 / -1' }}>
                      <span className="system-card__stat-label">Last Sync</span>
                      <span className="system-card__stat-value">
                        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString('en-IN') : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="system-card__footer">
                    <button
                      className="btn-sm btn-sm--primary"
                      onClick={() => void handleSync(c.vmsSystemId)}
                      disabled={syncing[c.vmsSystemId]}
                      id={`btn-sync-${c.vmsSystemId}`}
                    >
                      {syncing[c.vmsSystemId] ? 'Syncing…' : 'Sync Cameras'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick status legend */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
              {(['connected', 'disconnected', 'syncing', 'error'] as const).map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
              <span className="refresh-indicator">Status auto-refreshes every 5s</span>
            </div>
          </>
        )}

        {/* ─── Cameras Tab (Command Center Video Wall) ─── */}
        {tab === 'cameras' && (
          <div className="cameras-section" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Wall Toolbar */}
            <div className="wall-toolbar">
              <div className="wall-toolbar__left">
                {/* Layout matrix switcher */}
                <div className="wall-layouts">
                  {(['1x1', '2x2', '3x3', '4x4', 'grid'] as const).map((l) => (
                    <button
                      key={l}
                      className={`wall-layout-btn ${wallLayout === l ? 'wall-layout-btn--active' : ''}`}
                      onClick={() => { setWallLayout(l); setWallPage(0); }}
                      id={`btn-wall-layout-${l}`}
                    >
                      {l === '1x1' ? '1x1 Spotlight' : l === 'grid' ? 'All (30)' : l}
                    </button>
                  ))}
                </div>

                {/* City Filter */}
                <select
                  className="wall-filter-select"
                  value={wallCity}
                  onChange={(e) => { setWallCity(e.target.value); setWallPage(0); }}
                  id="wall-city-filter"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'All Gujarat Regions' : c}
                    </option>
                  ))}
                </select>

                {/* Search */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="wall-search-input"
                    placeholder="Search cameras (e.g. cam04, Paldi)…"
                    value={wallSearch}
                    onChange={(e) => { setWallSearch(e.target.value); setWallPage(0); }}
                    style={{ paddingLeft: 26, width: 220 }}
                    id="wall-search-input"
                  />
                </div>
              </div>

              <div className="wall-toolbar__right">
                {/* Pagination for matrix views */}
                {wallLayout !== 'grid' && totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn-sm btn-sm--ghost"
                      onClick={() => setWallPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      style={{ padding: '3px 8px' }}
                      id="btn-wall-prev"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {safePage + 1} / {totalPages}
                    </span>
                    <button
                      className="btn-sm btn-sm--ghost"
                      onClick={() => setWallPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      style={{ padding: '3px 8px' }}
                      id="btn-wall-next"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}

                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {filteredCameras.length} camera(s)
                </span>
              </div>
            </div>

            {/* 1x1 Spotlight View (Interactive WebRTC <200ms Player) */}
            {wallLayout === '1x1' ? (
              <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sentinel-live-dot" />
                      <strong style={{ color: '#fff', fontSize: '14px' }}>
                        {cameras.find((c) => c.externalCameraId === spotlightCamId)?.name || `Camera ${spotlightCamId}`}
                      </strong>
                    </div>
                    <select
                      className="wall-filter-select"
                      value={spotlightCamId}
                      onChange={(e) => setSpotlightCamId(e.target.value)}
                      style={{ width: 260 }}
                      id="spotlight-cam-select"
                    >
                      {cameras.map((c) => (
                        <option key={c.externalCameraId} value={c.externalCameraId}>
                          {c.externalCameraId} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <CctvLivePlayer
                    cameraId={spotlightCamId}
                    cameraName={cameras.find((c) => c.externalCameraId === spotlightCamId)?.name || 'Spotlight Camera'}
                    vmsSystemId="gov-feeds"
                    streamUrl={`/api/stream/sentinel/${spotlightCamId}/index.m3u8`}
                    protocol="webrtc"
                  />
                </div>
              </div>
            ) : (
              /* Multi-Grid Matrix View */
              <div className={`sentinel-grid sentinel-grid--${wallLayout}`}>
                {visibleCameras.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    No cameras match current filter.
                  </div>
                ) : (
                  visibleCameras.map((cam) => {
                    const hlsUrl = cam.streamPath ||
                      (cam.vmsSystemId === 'gov-feeds' ? `/api/stream/sentinel/${cam.externalCameraId}/index.m3u8` : null);
                    return (
                      <div key={cam.cameraId} className="sentinel-tile">
                        <div className="sentinel-tile__header">
                          <div className="sentinel-tile__live"><span className="sentinel-live-dot" /> LIVE</div>
                          <div className="sentinel-tile__id mono">{cam.externalCameraId}</div>
                        </div>
                        <div className="sentinel-tile__video">
                          {hlsUrl ? (
                            <SentinelVideoTile
                              key={cam.externalCameraId}
                              camId={cam.externalCameraId}
                              hlsUrl={hlsUrl}
                            />
                          ) : (
                            <div className="sentinel-tile__nostream">No stream</div>
                          )}
                        </div>
                        <div className="sentinel-tile__footer">
                          <span className="sentinel-tile__name" title={cam.name}>{cam.name}</span>
                          {hlsUrl && (
                            <button
                              className="btn-sm btn-sm--ghost"
                              style={{ fontSize: '10px', padding: '2px 6px' }}
                              onClick={() => void handleRequestStream(cam.cameraId)}
                              disabled={streamLoading[cam.cameraId]}
                              id={`btn-grid-stream-${cam.cameraId}`}
                              title="Open full WebRTC player"
                            >
                              <Play size={10} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} />
                              Full
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}


        {/* ─── Events Tab ─── */}
        {tab === 'events' && (
          <div className="event-log">
            <div className="event-log__header">
              <span>Live Event Log</span>
              <span className="refresh-indicator">Polling every 5s · {events.length} events</span>
            </div>
            {events.length === 0 ? (
              <div className="empty-state">No events yet. Sync a VMS system to start ingesting events.</div>
            ) : (
              <div className="event-log__list">
                {/* Column headers */}
                <div className="event-log__row" style={{ background: 'var(--surface-alt)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                  <span>Time</span><span>Event Type</span><span>Camera / Source</span><span>Severity</span>
                </div>
                {events.map((ev) => (
                  <div key={ev.id} className="event-log__row">
                    <span className="event-log__time">{formatTime(ev.occurred_at)}</span>
                    <span className="event-log__type">{ev.event_type}</span>
                    <span className="event-log__camera">
                      {ev.camera_id ?? ev.external_camera_id ?? ev.vms_system_id ?? '—'}
                      {(ev.payload as any)?.plate && (
                        <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600 }}>
                          [{(ev.payload as any).plate}]
                        </span>
                      )}
                    </span>
                    <SeverityChip severity={ev.severity} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Bindings Tab ─── */}
        {tab === 'bindings' && (
          <div className="bindings-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <span className="page-section-title">Camera ↔ VMS Bindings (Phase 2)</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn-sm btn-sm--ghost"
                  onClick={() => void handleAutoMap()}
                  disabled={autoMapping}
                  id="btn-auto-map"
                >
                  {autoMapping ? 'Mapping…' : 'Auto-Map (Demo)'}
                </button>
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={() => setBindFormOpen((v) => !v)}
                  id="btn-create-binding"
                >
                  {bindFormOpen ? 'Cancel' : '+ Add Binding'}
                </button>
              </div>
            </div>

            {bindFormOpen && (
              <div className="inline-form">
                <div>
                  <label className="inline-form__label">Registry Camera ID</label>
                  <input
                    placeholder="GJ-XX-000001"
                    value={bindForm.camera_id}
                    onChange={(e) => setBindForm((f) => ({ ...f, camera_id: e.target.value }))}
                    style={{ width: '100%' }}
                    id="input-bind-camera-id"
                  />
                </div>
                <div>
                  <label className="inline-form__label">VMS System ID</label>
                  <select
                    value={bindForm.vms_system_id}
                    onChange={(e) => setBindForm((f) => ({ ...f, vms_system_id: e.target.value }))}
                    style={{ width: '100%' }}
                    id="select-bind-vms"
                  >
                    <option value="">Select system…</option>
                    {connectors.map((c) => (
                      <option key={c.vmsSystemId} value={c.vmsSystemId}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="inline-form__label">External Camera ID</label>
                  <input
                    placeholder="MUNI-CAM-001"
                    value={bindForm.external_camera_id}
                    onChange={(e) => setBindForm((f) => ({ ...f, external_camera_id: e.target.value }))}
                    style={{ width: '100%' }}
                    id="input-bind-external-id"
                  />
                </div>
                <div className="inline-form__actions">
                  <button className="btn-sm btn-sm--primary" onClick={() => void handleCreateBinding()} id="btn-submit-binding">
                    Create Binding
                  </button>
                </div>
              </div>
            )}

            <div className="bindings-table-wrap">
              {bindings.length === 0 ? (
                <div className="empty-state">
                  No bindings yet. Use "Auto-Map (Demo)" to create bindings from nearest cameras,
                  or add manually above.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-alt)', textAlign: 'left' }}>
                      {['Registry Camera', 'VMS System', 'External ID', 'Stream Path', 'Active', ''].map((h) => (
                        <th key={h} style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bindings.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                        <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{b.camera_id}</td>
                        <td style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{b.vms_system_id}</td>
                        <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-tertiary)' }}>{b.external_camera_id}</td>
                        <td style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>{b.stream_path ?? '—'}</td>
                        <td style={{ padding: '8px 16px' }}>
                          <span style={{ color: b.is_active ? 'var(--status-online)' : 'var(--text-tertiary)', fontSize: '12px', fontWeight: 500 }}>
                            {b.is_active ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                          <button
                            className="btn-sm btn-sm--ghost"
                            onClick={() => void handleDeleteBinding(b.id)}
                            style={{ color: 'var(--status-offline)' }}
                            id={`btn-del-binding-${b.id}`}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Stream Session Modal (Phase 4) ─── */}
      {streamModal && (
        <div className="stream-modal-overlay" onClick={closeStreamModal} id="stream-modal-overlay">
          <div className="stream-modal" onClick={(e) => e.stopPropagation()} id="stream-modal">
            <div className="stream-modal__header">
              <div>
                <div className="stream-modal__title">Mediated Stream Preview</div>
                <div className="stream-modal__subtitle">Camera: {streamModal.cameraId}</div>
              </div>
              <button className="stream-modal__close" onClick={closeStreamModal} id="btn-stream-modal-close">
                <X size={16} />
              </button>
            </div>

            <div className="stream-modal__meta">
              <div className="stream-modal__pill">Protocol: {streamModal.protocol.toUpperCase()}</div>
              <div className="stream-modal__pill">VMS: {streamModal.vmsSystemId}</div>
              <div className={`stream-modal__pill ${streamCountdown < 30 ? 'stream-modal__pill--warn' : ''}`}>
                Expires in: {streamCountdown}s
              </div>
            </div>

            {/* CCTV Live Player with Real-Time AI Detection */}
            <div style={{ padding: '0 16px 12px' }}>
              <CctvLivePlayer
                cameraId={streamModal.cameraId}
                vmsSystemId={streamModal.vmsSystemId}
                streamUrl={streamModal.streamUrl}
                protocol={streamModal.protocol}
              />
            </div>


            <div className="stream-modal__url-row">
              <span className="stream-modal__url-label">Stream URL (mediated):</span>
              <code className="stream-modal__url">{streamModal.streamUrl}</code>
              <button
                className="btn-sm btn-sm--ghost"
                onClick={() => { void navigator.clipboard.writeText(streamModal.streamUrl); }}
                style={{ fontSize: '11px' }}
                id="btn-copy-stream-url"
              >
                Copy
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

