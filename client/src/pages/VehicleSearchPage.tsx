import { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, List, Map as MapIcon, Clock, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import { model2Api } from '../api';
import 'leaflet/dist/leaflet.css';
import './VehicleSearchPage.css';

interface VehicleDetection {
  id: string;
  camera_id: string;
  plate_raw: string;
  plate: string;
  timestamp: string;
  confidence: number;
  snapshot_url: string | null;
  source: string;
  camera_name?: string;
  department_id?: string;
  district_id?: string;
  latitude?: number;
  longitude?: number;
}

interface PathWaypoint {
  sequence: number;
  camera_id: string;
  camera_name?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  confidence: number;
}

// Auto-fit map to vehicle trajectory waypoints
function TrajectoryBounds({ waypoints }: { waypoints: PathWaypoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length === 0) return;
    const lats = waypoints.map((w) => w.latitude);
    const lngs = waypoints.map((w) => w.longitude);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [50, 50], maxZoom: 14 }
    );
  }, [waypoints, map]);
  return null;
}

const SAMPLE_PLATES = [
  { plate: 'GJ01WL0001', label: 'GJ01WL0001 (Hotlist Stolen)' },
  { plate: 'GJ05WL0002', label: 'GJ05WL0002 (Wanted Vehicle)' },
  { plate: 'GJ01AB1234', label: 'GJ01AB1234 (Frequent Commuter)' },
  { plate: 'GJ05CD5678', label: 'GJ05CD5678 (Commercial Bus)' },
];

export default function VehicleSearchPage() {
  const [searchPlate, setSearchPlate] = useState('GJ01WL0001');
  const [activeQuery, setActiveQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [errorMsg, setErrorMsg] = useState('');

  const [detections, setDetections] = useState<VehicleDetection[]>([]);
  const [path, setPath] = useState<PathWaypoint[]>([]);

  const handleSearch = useCallback(async (plateToQuery?: string) => {
    const plate = (plateToQuery || searchPlate).trim().toUpperCase().replace(/[\s-]/g, '');
    if (!plate) {
      setErrorMsg('Please enter a plate number to search.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await model2Api.searchVehicle(plate);
      setActiveQuery(res.query || plate);
      setDetections(res.detections || []);
      setPath(res.movement_path || []);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error ?? err.message);
      setDetections([]);
      setPath([]);
    } finally {
      setLoading(false);
    }
  }, [searchPlate]);

  // Initial search on mount
  useEffect(() => {
    void handleSearch('GJ01WL0001');
  }, [handleSearch]);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

  // Polyline positions for Leaflet map: [lat, lng][]
  const polylineCoords: [number, number][] = path.map((w) => [w.latitude, w.longitude]);

  return (
    <div className="vs-page">
      {/* Header */}
      <div className="vs-header">
        <div>
          <div className="vs-header__title">
            <Search size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Vehicle Search & GIS Path Analytics (Model 2)
          </div>
          <div className="vs-header__subtitle">
            Search historical and real-time ANPR plate detections across all federated cameras and track movement paths
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="vs-view-switch">
          <button
            className={`vs-switch-btn ${viewMode === 'list' ? 'vs-switch-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={14} style={{ marginRight: 4, display: 'inline' }} />
            List View ({detections.length})
          </button>
          <button
            className={`vs-switch-btn ${viewMode === 'map' ? 'vs-switch-btn--active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            <MapIcon size={14} style={{ marginRight: 4, display: 'inline' }} />
            GIS Trajectory Map ({path.length} waypoints)
          </button>
        </div>
      </div>

      {/* Search Bar Widget */}
      <div className="vs-search-card">
        <div className="vs-search-row">
          <div className="vs-search-input-wrapper">
            <Search size={16} className="vs-search-icon" />
            <input
              type="text"
              className="vs-search-input"
              placeholder="Enter full or partial plate number (e.g. GJ01WL0001)"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            />
          </div>

          <button
            className="btn-sm btn-sm--primary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => void handleSearch()}
            disabled={loading}
          >
            {loading ? 'Searching…' : 'Search Vehicle'}
          </button>
        </div>

        {/* Sample Quick Selectors */}
        <div className="vs-preset-row">
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>QUICK SAMPLES:</span>
          {SAMPLE_PLATES.map((sample) => (
            <button
              key={sample.plate}
              className="vs-preset-chip"
              onClick={() => {
                setSearchPlate(sample.plate);
                void handleSearch(sample.plate);
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>

        {errorMsg && <div className="vs-error">{errorMsg}</div>}
      </div>

      {/* Results Content Area */}
      {activeQuery && (
        <div className="vs-results">
          {/* Summary Strip */}
          <div className="vs-summary-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="vs-summary-plate">{activeQuery}</span>
              <span className="vs-summary-text">
                Found <strong style={{ color: 'var(--accent)' }}>{detections.length}</strong> detection records across{' '}
                <strong style={{ color: 'var(--accent)' }}>{path.length}</strong> unique camera locations.
              </span>
            </div>

            {path.length > 1 && (
              <div className="vs-summary-badge">
                <Navigation size={12} style={{ marginRight: 4, display: 'inline' }} />
                Trajectory Path Computed ({path.length} Waypoints)
              </div>
            )}
          </div>

          {/* List View Mode */}
          {viewMode === 'list' && (
            <div className="vs-table-wrapper">
              {detections.length === 0 ? (
                <div className="vs-empty">
                  No detections recorded for plate <strong>"{activeQuery}"</strong>. Try selecting a quick sample above or inject a plate via Watchlist/Live View.
                </div>
              ) : (
                <table className="vs-table">
                  <thead>
                    <tr>
                      {['Time', 'Camera ID & Location', 'Department', 'Confidence', 'Source', 'GIS Coordinates', ''].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detections.map((d) => (
                      <tr key={d.id}>
                        <td className="vs-table__time">
                          <Clock size={12} style={{ marginRight: 4, color: 'var(--text-tertiary)', display: 'inline' }} />
                          {formatDateTime(d.timestamp)}
                        </td>
                        <td>
                          <div className="vs-table__cam-id">{d.camera_id}</div>
                          <div className="vs-table__cam-name">{d.camera_name || 'Checkpoint Camera'}</div>
                        </td>
                        <td>
                          <span className="vs-table__dept">{d.department_id || 'POL'}</span>
                        </td>
                        <td>
                          <span
                            className="vs-table__conf"
                            style={{
                              background: d.confidence > 0.9 ? 'rgba(22, 163, 74, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                              color: d.confidence > 0.9 ? '#16a34a' : '#eab308',
                            }}
                          >
                            {(d.confidence * 100).toFixed(0)}% Match
                          </span>
                        </td>
                        <td>
                          <span className="vs-table__source">{d.source || 'live'}</span>
                        </td>
                        <td className="vs-table__coords">
                          {d.latitude && d.longitude ? (
                            <span>
                              <MapPin size={11} style={{ marginRight: 3, display: 'inline', color: 'var(--accent)' }} />
                              {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-sm btn-sm--ghost"
                            style={{ fontSize: '11px' }}
                            onClick={() => setViewMode('map')}
                          >
                            View Trajectory
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* GIS Trajectory Map View Mode */}
          {viewMode === 'map' && (
            <div className="vs-map-container">
              <MapContainer
                center={[22.3, 71.8]}
                zoom={8}
                style={{ height: '520px', width: '100%', borderRadius: '8px' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Trajectory Polyline connecting sequence of camera waypoints */}
                {polylineCoords.length > 1 && (
                  <Polyline
                    positions={polylineCoords}
                    pathOptions={{
                      color: '#3b82f6',
                      weight: 4,
                      dashArray: '8, 8',
                      opacity: 0.8,
                    }}
                  />
                )}

                {/* Waypoint Camera Markers */}
                {path.map((wp) => (
                  <CircleMarker
                    key={`${wp.camera_id}_${wp.sequence}`}
                    center={[wp.latitude, wp.longitude]}
                    radius={8}
                    pathOptions={{
                      fillColor: wp.sequence === 1 ? '#10b981' : wp.sequence === path.length ? '#ef4444' : '#3b82f6',
                      fillOpacity: 0.9,
                      color: '#ffffff',
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="vs-map-popup">
                        <div className="vs-map-popup__seq">
                          Waypoint #{wp.sequence} of {path.length}
                        </div>
                        <div className="vs-map-popup__title">{wp.camera_name || wp.camera_id}</div>
                        <div className="vs-map-popup__time">{formatDateTime(wp.timestamp)}</div>
                        <div className="vs-map-popup__conf">Confidence: {(wp.confidence * 100).toFixed(0)}%</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                <TrajectoryBounds waypoints={path} />
              </MapContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
