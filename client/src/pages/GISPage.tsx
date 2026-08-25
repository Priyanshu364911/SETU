import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import TopBar from '../components/TopBar';
import api from '../api';
import type { GeoJSONFeatureCollection, GeoJSONFeature, CameraStats, Department } from '../types';
import 'leaflet/dist/leaflet.css';
import './GISPage.css';

const STATUS_COLORS: Record<string, string> = {
  Online: '#2E7D5B',
  Maintenance: '#B5792B',
  Offline: '#A23B33',
  Pending: '#8A93A3',
};

const GUJARAT_CENTER: [number, number] = [22.3, 71.8];
const GUJARAT_ZOOM = 7;

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
          eventHandlers={{
            click: () => onMarkerClick(feature),
          }}
        >
          <Popup>
            <div className="map-popup">
              <div className="map-popup__id mono">{feature.properties.id}</div>
              <div className="map-popup__row">
                <span>Status:</span>
                <span style={{ color: STATUS_COLORS[feature.properties.status] }}>
                  {feature.properties.status}
                </span>
              </div>
              <div className="map-popup__row">
                <span>Type:</span>
                <span>{feature.properties.cameraType}</span>
              </div>
              <div className="map-popup__row">
                <span>Dept:</span>
                <span>{feature.properties.departmentId}</span>
              </div>
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

  useEffect(() => {
    Promise.all([
      api.get('/cameras/stats'),
      api.get('/departments'),
    ]).then(([statsRes, deptRes]) => {
      setStats(statsRes.data);
      setDepartments(deptRes.data.data || deptRes.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterDept !== 'all') params.set('departmentId', filterDept);
    api.get(`/cameras/geojson?${params.toString()}`)
      .then(res => setGeojson(res.data))
      .catch(() => {});
  }, [filterStatus, filterDept]);

  const features = geojson?.features || [];

  return (
    <div className="gis-page">
      <TopBar title="GIS Dashboard" />
      <div className="gis-page__content">
        <div className="gis-page__map-area">
          <div className="gis-page__filters">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              id="gis-filter-status"
            >
              <option value="all">All Statuses</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              id="gis-filter-dept"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <span className="gis-page__count mono">
              {features.length.toLocaleString()} cameras
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
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <MapMarkers features={features} onMarkerClick={() => {}} />
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

          <div className="gis-sidebar__section">
            <h3 className="gis-sidebar__heading">Status Legend</h3>
            <div className="gis-legend">
              {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'Pending').map(([status, color]) => (
                <div key={status} className="gis-legend__item">
                  <span className="gis-legend__dot" style={{ backgroundColor: color }} />
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
