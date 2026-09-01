import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import TopBar from '../components/TopBar';
import CctvLivePlayer from '../components/CctvLivePlayer';
import api, { federationApi } from '../api';
import type { GeoJSONFeatureCollection, GeoJSONFeature, CameraStats, Department } from '../types';
import 'leaflet/dist/leaflet.css';
import './GISPage.css';

const STATUS_COLORS: Record<string, string> = {
  Online: '#2E7D5B',
  online: '#2E7D5B',
  Maintenance: '#B5792B',
  Offline: '#A23B33',
  offline: '#A23B33',
  Pending: '#8A93A3',
};

const GUJARAT_CENTER: [number, number] = [22.3, 71.8];
const GUJARAT_ZOOM = 7;

interface SentinelCam {
  cameraId: string;
  externalCameraId: string;
  name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  streamPath: string | null;
  capabilities: Record<string, unknown>;
}

interface StreamModal {
  cam: SentinelCam;
  hlsUrl: string;
}

// Auto-fit to Sentinel cameras after they load
function FitBounds({ cameras }: { cameras: SentinelCam[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = cameras.filter(c => c.latitude && c.longitude);
    if (valid.length === 0) return;
    const lats = valid.map(c => c.latitude as number);
    const lngs = valid.map(c => c.longitude as number);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40], maxZoom: 10 }
    );
  }, [cameras, map]);
  return null;
}

function MapMarkers({ features, onMarkerClick }: { features: GeoJSONFeature[]; onMarkerClick: (f: GeoJSONFeature) => void }) {
  return (
    <>
      {features.map((feature) => (
        <CircleMarker
          key={feature.properties.id}
          center={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
          radius={5}
          pathOptions={{
            fillColor: STATUS_COLORS[feature.properties.status] || '#8A93A3',
            fillOpacity: 0.85,
            color: '#FFFFFF',
            weight: 1,
          }}
          eventHandlers={{ click: () => onMarkerClick(feature) }}
        >
          <Popup>
            <div className="map-popup">
              <div className="map-popup__id mono">{feature.properties.id}</div>
              <div className="map-popup__row"><span>Status:</span><span style={{ color: STATUS_COLORS[feature.properties.status] }}>{feature.properties.status}</span></div>
              <div className="map-popup__row"><span>Type:</span><span>{feature.properties.cameraType}</span></div>
              <div className="map-popup__row"><span>Dept:</span><span>{feature.properties.departmentId}</span></div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

function SentinelMarkers({ cameras, onSelect }: { cameras: SentinelCam[]; onSelect: (c: SentinelCam) => void }) {
  return (
    <>
      {cameras.filter(c => c.latitude && c.longitude).map((cam) => (
        <CircleMarker
          key={cam.externalCameraId}
          center={[cam.latitude as number, cam.longitude as number]}
          radius={7}
          pathOptions={{
            fillColor: '#3b82f6',
            fillOpacity: 0.9,
            color: '#1d4ed8',
            weight: 2,
          }}
          eventHandlers={{ click: () => onSelect(cam) }}
        >
          <Popup>
            <div className="map-popup map-popup--sentinel">
              <div className="map-popup__badge">🔴 LIVE · Sentinel</div>
              <div className="map-popup__name">{cam.name}</div>
              <div className="map-popup__id mono">{cam.externalCameraId}</div>
              <div className="map-popup__row">
                <span>Status:</span>
                <span style={{ color: STATUS_COLORS[cam.status] || '#2E7D5B', fontWeight: 600 }}>{cam.status}</span>
              </div>
              <button
                className="map-popup__play-btn"
                onClick={() => onSelect(cam)}
              >
                ▶ Watch Live
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export default function GISPage() {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [stats, setStats] = useState<CameraStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [showSentinel, setShowSentinel] = useState(true);

  const [sentinelCams, setSentinelCams] = useState<SentinelCam[]>([]);
  const [sentinelLoading, setSentinelLoading] = useState(true);
  const [streamModal, setStreamModal] = useState<StreamModal | null>(null);

  // Load Sentinel live cameras
  const loadSentinel = useCallback(async () => {
    setSentinelLoading(true);
    try {
      const data = await federationApi.getCameras();
      const sentinel = (data ?? []).filter((c: any) => c.vmsSystemId === 'gov-feeds');
      setSentinelCams(sentinel);
    } catch (_) {}
    setSentinelLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/cameras/stats'),
      api.get('/departments'),
    ]).then(([statsRes, deptRes]) => {
      setStats(statsRes.data);
      setDepartments(deptRes.data.data || deptRes.data);
    }).catch(() => {});

    void loadSentinel();
  }, [loadSentinel]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterDept !== 'all') params.set('departmentId', filterDept);
    api.get(`/cameras/geojson?${params.toString()}`)
      .then(res => setGeojson(res.data))
      .catch(() => {});
  }, [filterStatus, filterDept]);

  const features = geojson?.features || [];

  const openStream = (cam: SentinelCam) => {
    const hlsUrl = cam.streamPath || `/api/stream/sentinel/${cam.externalCameraId}/index.m3u8`;
    setStreamModal({ cam, hlsUrl });
  };

  return (
    <div className="gis-page">
      <TopBar title="GIS Dashboard" />
      <div className="gis-page__content">
        <div className="gis-page__map-area">
          <div className="gis-page__filters">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} id="gis-filter-status">
              <option value="all">All Statuses</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} id="gis-filter-dept">
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <label className="gis-sentinel-toggle" htmlFor="gis-toggle-sentinel">
              <input
                id="gis-toggle-sentinel"
                type="checkbox"
                checked={showSentinel}
                onChange={e => setShowSentinel(e.target.checked)}
              />
              <span className="gis-sentinel-toggle__dot" />
              <span>Sentinel Live ({sentinelCams.length})</span>
            </label>
            <span className="gis-page__count mono">
              {features.length.toLocaleString()} registry + {sentinelCams.filter(c => c.latitude).length} live
            </span>
          </div>

          <div className="gis-page__map" id="gis-map">
            <MapContainer
              center={GUJARAT_CENTER}
              zoom={GUJARAT_ZOOM}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapMarkers features={features} onMarkerClick={() => {}} />
              {showSentinel && (
                <>
                  <SentinelMarkers cameras={sentinelCams} onSelect={openStream} />
                  <FitBounds cameras={sentinelCams} />
                </>
              )}
            </MapContainer>
          </div>
        </div>

        <div className="gis-page__sidebar">
          {stats && (
            <div className="gis-sidebar__section">
              <h3 className="gis-sidebar__heading">Camera Overview</h3>
              <div className="gis-sidebar__stats">
                <div className="gis-stat">
                  <span className="gis-stat__value mono">{stats.total.toLocaleString()}</span>
                  <span className="gis-stat__label">Total</span>
                </div>
                <div className="gis-stat">
                  <span className="gis-stat__value mono" style={{ color: 'var(--status-online)' }}>{stats.online.toLocaleString()}</span>
                  <span className="gis-stat__label">Online</span>
                </div>
                <div className="gis-stat">
                  <span className="gis-stat__value mono" style={{ color: 'var(--status-offline)' }}>{stats.offline.toLocaleString()}</span>
                  <span className="gis-stat__label">Offline</span>
                </div>
                <div className="gis-stat">
                  <span className="gis-stat__value mono" style={{ color: 'var(--status-warning)' }}>{stats.maintenance.toLocaleString()}</span>
                  <span className="gis-stat__label">Maintenance</span>
                </div>
              </div>
            </div>
          )}

          {/* Sentinel Live Cameras Panel */}
          <div className="gis-sidebar__section gis-sidebar__sentinel">
            <h3 className="gis-sidebar__heading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="gis-sentinel-live-dot" />
              Sentinel Live Cameras
              {sentinelLoading && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>loading…</span>}
            </h3>
            <div className="gis-sentinel-list">
              {sentinelCams.slice(0, 30).map(cam => (
                <button
                  key={cam.externalCameraId}
                  className="gis-sentinel-item"
                  onClick={() => openStream(cam)}
                  id={`gis-sentinel-${cam.externalCameraId}`}
                >
                  <div className="gis-sentinel-item__left">
                    <span className="gis-sentinel-item__dot" style={{ background: STATUS_COLORS[cam.status] || '#2E7D5B' }} />
                    <div>
                      <div className="gis-sentinel-item__id mono">{cam.externalCameraId}</div>
                      <div className="gis-sentinel-item__name">{cam.name}</div>
                    </div>
                  </div>
                  <span className="gis-sentinel-item__play">▶</span>
                </button>
              ))}
            </div>
          </div>

          <div className="gis-sidebar__section">
            <h3 className="gis-sidebar__heading">Status Legend</h3>
            <div className="gis-legend">
              {[['Online', '#2E7D5B'], ['Offline', '#A23B33'], ['Maintenance', '#B5792B']].map(([status, color]) => (
                <div key={status} className="gis-legend__item">
                  <span className="gis-legend__dot" style={{ backgroundColor: color }} />
                  <span>{status}</span>
                </div>
              ))}
              <div className="gis-legend__item">
                <span className="gis-legend__dot" style={{ backgroundColor: '#3b82f6' }} />
                <span>Sentinel Live</span>
              </div>
            </div>
          </div>

          <div className="gis-sidebar__section">
            <h3 className="gis-sidebar__heading">Departments</h3>
            <div className="gis-sidebar__dept-list">
              {departments.slice(0, 12).map(dept => (
                <div key={dept.id} className="gis-dept-row">
                  <span className="gis-dept-row__name">{dept.name}</span>
                  <span className="gis-dept-row__count mono">{dept.camera_count ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stream Modal */}
      {streamModal && (
        <div className="gis-stream-overlay" onClick={() => setStreamModal(null)}>
          <div className="gis-stream-modal" onClick={e => e.stopPropagation()}>
            <div className="gis-stream-modal__header">
              <div>
                <div className="gis-stream-modal__title">{streamModal.cam.name}</div>
                <div className="gis-stream-modal__sub">
                  <span className="gis-sentinel-live-dot" style={{ marginRight: 4 }} />
                  LIVE · {streamModal.cam.externalCameraId} · Sentinel Camera Grid
                </div>
              </div>
              <button className="gis-stream-modal__close" onClick={() => setStreamModal(null)}>✕</button>
            </div>
            <div className="gis-stream-modal__player" style={{ padding: '0 16px 12px' }}>
              <CctvLivePlayer
                cameraId={streamModal.cam.externalCameraId}
                cameraName={streamModal.cam.name}
                vmsSystemId="gov-feeds"
                streamUrl={streamModal.hlsUrl}
              />
            </div>


            <div className="gis-stream-modal__urls">
              <div className="gis-stream-url-row">
                <span className="gis-stream-url-label">HLS</span>
                <code className="gis-stream-url">{streamModal.hlsUrl}</code>
              </div>
              <div className="gis-stream-url-row">
                <span className="gis-stream-url-label">RTSP</span>
                <code className="gis-stream-url">
                  rtsp://103.250.160.189:8554/stream/{streamModal.cam.externalCameraId}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
