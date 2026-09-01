import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, ChevronDown, ChevronRight, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { federationApi } from '../api';
import './CorrelationPage.css';

// Fix leaflet marker icon paths for Vite/React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeNumberedIcon(n: number, isFirst: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${isFirst ? '#2E7D5B' : '#245C8C'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.4)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

interface AnalyticsReport {
  generatedAt: string;
  totalEvents24h: number;
  plateDetections24h: number;
  uniquePlates24h: number;
  activeTracks: number;
  multiCameraTracks: number;
  eventsByVms: Array<{ vmsSystemId: string; count: number }>;
  topPlates: Array<{ plate: string; sightings: number; cameras: number }>;
}

interface CorrelationTrack {
  id: string;
  entity_type: string;
  entity_value: string;
  camera_ids: string[];
  event_ids: string[];
  first_seen_at: string;
  last_seen_at: string;
  point_count: number;
  metadata: Record<string, unknown>;
}

interface TrackHistoryPoint {
  cameraId: string;
  name: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  vmsSystemId: string | null;
  plate: string;
}

export default function CorrelationPage() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [tracks, setTracks] = useState<CorrelationTrack[]>([]);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [trackHistory, setTrackHistory] = useState<Record<string, TrackHistoryPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportData, tracksData] = await Promise.all([
        federationApi.getAnalyticsReport(),
        federationApi.getTracks(100),
      ]);
      setReport(reportData);
      setTracks(tracksData ?? []);
      setLastRefresh(new Date());
    } catch (_) {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const toggleTrack = async (id: string) => {
    if (expandedTrack === id) {
      setExpandedTrack(null);
      return;
    }
    setExpandedTrack(id);
    if (trackHistory[id]) return; // already loaded
    setLoadingHistory(id);
    try {
      const history = await federationApi.getTrackHistory(id);
      setTrackHistory((h) => ({ ...h, [id]: history ?? [] }));
    } catch (_) {
      setTrackHistory((h) => ({ ...h, [id]: [] }));
    } finally {
      setLoadingHistory(null);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });

  const maxVmsCount = Math.max(1, ...(report?.eventsByVms.map((r) => r.count) ?? [1]));

  return (
    <div className="corr-page">
      {/* Header */}
      <div className="corr-header">
        <div>
          <div className="corr-header__title">Event Correlation Dashboard</div>
          <div className="corr-header__subtitle">
            Cross-system plate tracking — Model 3 Phase 3 deliverable
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Updated {lastRefresh.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            className="btn-sm btn-sm--ghost"
            onClick={() => void loadData()}
            disabled={loading}
            id="btn-corr-refresh"
          >
            <RefreshCw size={13} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
            Refresh
          </button>
        </div>
      </div>

      <div className="corr-body">
        {/* ─── Analytics Summary Cards ─── */}
        {report && (
          <div className="stats-grid">
            {[
              { label: 'Total Events (24h)', value: report.totalEvents24h },
              { label: 'Plate Detections (24h)', value: report.plateDetections24h },
              { label: 'Unique Plates (24h)', value: report.uniquePlates24h },
              { label: 'Active Tracks', value: report.activeTracks },
              { label: 'Multi-Camera Tracks', value: report.multiCameraTracks },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-card__value">{s.value}</div>
                <div className="stat-card__label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Events by VMS ─── */}
        {report && report.eventsByVms.length > 0 && (
          <div className="vms-breakdown">
            <div className="vms-breakdown__title">Events by VMS System (24h)</div>
            {report.eventsByVms.map((r) => (
              <div key={r.vmsSystemId} className="vms-bar-row">
                <span className="vms-bar-label">{r.vmsSystemId}</span>
                <div className="vms-bar-track">
                  <div
                    className="vms-bar-fill"
                    style={{ width: `${(r.count / maxVmsCount) * 100}%` }}
                  />
                </div>
                <span className="vms-bar-count">{r.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─── Correlation Tracks ─── */}
        <div className="tracks-section">
          <div className="tracks-section__header">
            <span>Correlation Tracks ({tracks.length})</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Click a row to expand sighting history
            </span>
          </div>

          {tracks.length === 0 ? (
            <div className="empty-state">
              No correlation tracks yet. Plate events from VMS-B will appear here automatically.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt)', textAlign: 'left' }}>
                  {['', 'Plate / Entity', 'Type', 'Sightings', 'Cameras', 'First Seen', 'Last Seen'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <>
                    <tr
                      key={track.id}
                      onClick={() => void toggleTrack(track.id)}
                      style={{ borderBottom: '1px solid var(--surface-alt)', cursor: 'pointer' }}
                      className="track-row"
                    >
                      <td style={{ padding: '8px 8px 8px 16px', color: 'var(--text-tertiary)' }}>
                        {expandedTrack === track.id
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                        {track.entity_value}
                      </td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {track.entity_type.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                        {track.point_count}
                      </td>
                      <td style={{ padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                        {track.camera_ids.length}
                      </td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formatTime(track.first_seen_at)}
                      </td>
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formatTime(track.last_seen_at)}
                      </td>
                    </tr>

                    {/* Expanded sighting history */}
                    {expandedTrack === track.id && (
                      <tr key={`${track.id}-detail`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div className="track-detail-panel">
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Sighting History — {track.entity_value}
                            </div>
                            {loadingHistory === track.id ? (
                              <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading history…</div>
                            ) : !trackHistory[track.id]?.length ? (
                              <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                No GIS history available — cameras may not be bound to registry locations yet.
                              </div>
                            ) : (() => {
                              const pts = [...trackHistory[track.id]]
                                .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
                              const hasCoords = pts.some((p) => p.latitude && p.longitude);
                              const polyline: [number, number][] = pts
                                .filter((p) => p.latitude && p.longitude)
                                .map((p) => [p.latitude, p.longitude]);
                              const center: [number, number] = hasCoords
                                ? [pts[0].latitude, pts[0].longitude]
                                : [23.0225, 72.5714];

                              return (
                                <div className="track-history-layout">
                                  {hasCoords && (
                                    <div className="track-map-container">
                                      <MapContainer
                                        center={center}
                                        zoom={13}
                                        style={{ height: '220px', width: '100%', borderRadius: 'var(--radius-sm)' }}
                                        scrollWheelZoom={false}
                                        id={`track-map-${track.id}`}
                                      >
                                        <TileLayer
                                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                          attribution='&copy; OpenStreetMap contributors'
                                        />
                                        {polyline.length > 1 && (
                                          <Polyline positions={polyline} color="#245C8C" weight={3} opacity={0.7} />
                                        )}
                                        {pts
                                          .filter((p) => p.latitude && p.longitude)
                                          .map((point, i) => (
                                            <Marker
                                              key={i}
                                              position={[point.latitude, point.longitude]}
                                              icon={makeNumberedIcon(i + 1, i === 0)}
                                            >
                                              <Popup>
                                                <strong>#{i + 1} {point.name}</strong><br />
                                                {formatTime(point.occurredAt)}<br />
                                                <code style={{ fontSize: '11px' }}>{point.cameraId}</code>
                                              </Popup>
                                            </Marker>
                                          ))}
                                      </MapContainer>
                                      <div className="track-map-label">
                                        <MapIcon size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                        GIS path overlay · {polyline.length} location points
                                      </div>
                                    </div>
                                  )}
                                  <div className="track-sightings-list">
                                    {pts.map((point, i) => (
                                      <div key={i} className="track-sighting">
                                        <div className="track-sighting__idx">{i + 1}</div>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontWeight: 500, fontSize: '13px' }}>{point.name}</div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                            {point.cameraId} · {point.latitude?.toFixed(4)}, {point.longitude?.toFixed(4)}
                                          </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                          {formatTime(point.occurredAt)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Sample Federated Analytics Report Export ─── */}
        <div className="export-section">
          <div>
            <div className="export-section__title">Sample Federated Analytics Report</div>
            <div className="export-section__info">
              24-hour summary of all federated events, plate detections, and correlation tracks across VMS systems.
              {report && ` Generated: ${new Date(report.generatedAt).toLocaleString('en-IN')}`}
            </div>
          </div>
          <div className="export-btns">
            <button
              className="btn-sm btn-sm--ghost"
              onClick={async () => {
                const data = await federationApi.getAnalyticsReport();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `federation-analytics-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              id="btn-export-json"
            >
              <Download size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
              Export JSON
            </button>
            <button
              className="btn-sm btn-sm--primary"
              onClick={() => {
                const url = federationApi.downloadReportCsv();
                const a = document.createElement('a');
                a.href = url;
                a.download = `federation-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
              }}
              id="btn-export-csv"
            >
              <Download size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
