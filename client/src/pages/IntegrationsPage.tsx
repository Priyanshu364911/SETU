import { useState, useEffect, useCallback } from 'react';
import {
  Plug,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  FileText,
  Car,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { model4Api } from '../api';
import './IntegrationsPage.css';

interface ExternalIntegration {
  id: string;
  name: string;
  description: string;
  system_type: string;
  base_url?: string;
  status: 'connected' | 'degraded' | 'maintenance' | 'disconnected';
  last_sync_at: string | null;
  total_queries?: number;
  error_count?: number;
}

interface VahanVehicle {
  plate_number: string;
  owner_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_type: string;
  fuel_type: string;
  registration_date: string;
  rto_office: string;
  engine_number: string;
  chassis_number: string;
  insurance_status: string;
  insurance_valid_until: string;
  fitness_valid_until: string;
  is_stolen: boolean;
  stolen_fir_number?: string;
  challan_count: number;
}

interface QueryLogItem {
  id: string;
  integration_id: string;
  integration_name?: string;
  query_type: string;
  query_input: any;
  status: string;
  response_ms: number;
  created_at: string;
  queried_by_username?: string;
}

interface CapacityData {
  current_cameras: number;
  target_capacity: number;
  utilization_pct: number;
  projected_bandwidth_gbps: number;
  projected_storage_tb: number;
}

const SAMPLE_PLATES = [
  { plate: 'GJ01WL0001', label: 'GJ01WL0001 (Stolen Fortuner)', stolen: true },
  { plate: 'GJ05WL0002', label: 'GJ05WL0002 (Stolen Scorpio-N)', stolen: true },
  { plate: 'GJ01AB1234', label: 'GJ01AB1234 (Swift Dzire)', stolen: false },
  { plate: 'GJ05CD5678', label: 'GJ05CD5678 (Nexon EV)', stolen: false },
  { plate: 'GJ27ST4321', label: 'GJ27ST4321 (Bolero)', stolen: false },
  { plate: 'GJ18XY9999', label: 'GJ18XY9999 (Creta)', stolen: false },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [queryLog, setQueryLog] = useState<QueryLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // VAHAN Query State
  const [searchPlate, setSearchPlate] = useState<string>('GJ01WL0001');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [vehicleResult, setVehicleResult] = useState<VahanVehicle | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupMs, setLookupMs] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [integData, capData, logData] = await Promise.all([
        model4Api.getIntegrations().catch(() => []),
        model4Api.getCapacity().catch(() => null),
        model4Api.getQueryLog(20).catch(() => []),
      ]);

      setIntegrations(integData || []);
      setCapacity(capData);
      setQueryLog(logData || []);
    } catch (err) {
      console.error('[IntegrationsPage] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute VAHAN plate search
  const handleSearch = async (plateToSearch?: string) => {
    const target = (plateToSearch || searchPlate).trim().toUpperCase();
    if (!target) return;

    setLookupLoading(true);
    setLookupMessage(null);

    try {
      const res = await model4Api.vahanLookup(target);
      if (res.found && res.vehicle) {
        setVehicleResult(res.vehicle);
        setLookupMs(res.responseMs);
      } else {
        setVehicleResult(null);
        setLookupMessage(res.message || 'No record found in VAHAN registry for this registration plate.');
        setLookupMs(res.responseMs);
      }

      // Refresh query log
      const updatedLog = await model4Api.getQueryLog(20).catch(() => []);
      setQueryLog(updatedLog);
    } catch (err: any) {
      setVehicleResult(null);
      setLookupMessage(err.message || 'Error communicating with VAHAN endpoint.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Trigger sync on integration
  const handleSync = async (id: string) => {
    setSyncingId(id);
    setSyncNotice(null);
    try {
      const res = await model4Api.syncIntegration(id);
      setSyncNotice(res.message || `Successfully synchronized ${id.toUpperCase()}`);

      // Refresh list
      const updated = await model4Api.getIntegrations().catch(() => []);
      setIntegrations(updated);
    } catch (err: any) {
      setSyncNotice(`Sync failed: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="int-container">
      {/* ─── Header ─── */}
      <div className="int-header">
        <div className="int-title-area">
          <h1>
            <Plug className="text-emerald-500" size={28} />
            Government Integrations & VAHAN Hub
            <span className="int-title-badge">Model 4 Core</span>
          </h1>
          <p className="int-subtitle">
            Direct interoperability layer connecting SETU with MoRTH VAHAN/SARTHI, State Police CCTNS/eGujCop, and Central AFIS/NAFIS registries.
          </p>
        </div>

        <div className="int-header-actions">
          <button className="cc-btn" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh Status
          </button>
        </div>
      </div>

      {syncNotice && (
        <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} className="text-blue-400" />
          {syncNotice}
        </div>
      )}

      {/* ─── Main Two-Panel Layout ─── */}
      <div className="int-main-grid">
        {/* ─── Left Panel: Integration Registry & Capacity ─── */}
        <div className="int-panel">
          {/* Active Government Integrations */}
          <div className="int-card">
            <div className="int-card-header">
              <h2 className="int-card-title">
                <Server size={18} className="text-blue-400" />
                Inter-Agency Data Gateways
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {integrations.length} Systems Configured
              </span>
            </div>

            <div className="int-system-cards">
              {integrations.map((sys) => (
                <div key={sys.id} className="int-sys-card">
                  <div className="int-sys-top">
                    <div className="int-sys-title-group">
                      <div className="int-sys-name">
                        {sys.name}
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                          ({sys.id.toUpperCase()})
                        </span>
                      </div>
                      <span className="int-sys-type">
                        {sys.system_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <span className={`int-status-badge ${sys.status}`}>
                      ● {sys.status}
                    </span>
                  </div>

                  <p className="int-sys-desc">{sys.description}</p>

                  <div className="int-sys-meta">
                    <span>
                      LAST SYNC:{' '}
                      {sys.last_sync_at
                        ? new Date(sys.last_sync_at).toLocaleTimeString()
                        : 'Active Real-Time'}
                    </span>

                    <button
                      className="int-sys-sync-btn"
                      onClick={() => handleSync(sys.id)}
                      disabled={syncingId === sys.id}
                    >
                      <RefreshCw size={12} className={syncingId === sys.id ? 'animate-spin' : ''} />
                      {syncingId === sys.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statewide Scalability Gauge */}
          <div className="int-capacity-card">
            <div className="int-capacity-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} className="text-indigo-400" />
                <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
                  Statewide Ingestion Roadmap
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Target: 80,000 Nodes</span>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.5rem 0' }}>
              Phase 1 Proof of Concept deployment capacity vs. statewide production scale:
            </p>

            <div className="int-progress-bar-bg">
              <div
                className="int-progress-bar-fill"
                style={{ width: `${Math.max(4, capacity?.utilization_pct || 5)}%` }}
              />
            </div>

            <div className="int-capacity-metrics">
              <div>
                <div className="int-cap-val">{capacity?.current_cameras ?? 30}</div>
                <div className="int-cap-lbl">Active Nodes</div>
              </div>
              <div>
                <div className="int-cap-val">80,000</div>
                <div className="int-cap-lbl">Gujarat Target</div>
              </div>
              <div>
                <div className="int-cap-val">
                  {capacity?.projected_bandwidth_gbps ?? 320} Gbps
                </div>
                <div className="int-cap-lbl">Network Ingest</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right Panel: VAHAN Lookup & Query Trail ─── */}
        <div className="int-panel">
          {/* VAHAN Search Box */}
          <div className="int-card">
            <div className="int-card-header">
              <h2 className="int-card-title">
                <Car size={18} className="text-amber-400" />
                National Vehicle Registry (VAHAN) Lookup
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                MoRTH Real-Time API
              </span>
            </div>

            <div className="int-search-box">
              <div className="int-search-input-wrap">
                <Search size={18} className="int-search-icon" />
                <input
                  type="text"
                  className="int-search-input"
                  placeholder="Enter Gujarat Vehicle Plate (e.g. GJ01WL0001)"
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <button
                className="cc-btn cc-btn-primary"
                onClick={() => handleSearch()}
                disabled={lookupLoading}
              >
                {lookupLoading ? 'Querying...' : 'Search'}
              </button>
            </div>

            {/* Quick Demo Sample Badges */}
            <div className="int-sample-tags">
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Quick Test:</span>
              {SAMPLE_PLATES.map((sample) => (
                <button
                  key={sample.plate}
                  className={`int-sample-tag-btn ${sample.stolen ? 'stolen' : ''}`}
                  onClick={() => {
                    setSearchPlate(sample.plate);
                    handleSearch(sample.plate);
                  }}
                >
                  {sample.stolen ? '🚨 ' : ''}
                  {sample.plate}
                </button>
              ))}
            </div>

            {/* Negative Search Result Message */}
            {lookupMessage && !vehicleResult && (
              <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', padding: '1rem', color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center' }}>
                <AlertTriangle size={24} className="text-amber-400" style={{ margin: '0 auto 0.5rem auto' }} />
                <div>{lookupMessage}</div>
                {lookupMs && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Query executed in {lookupMs}ms</div>}
              </div>
            )}

            {/* Detailed Vehicle Information Card */}
            {vehicleResult && (
              <div className="int-vahan-result-card">
                {/* Stolen Alert Banner */}
                {vehicleResult.is_stolen && (
                  <div className="int-stolen-banner">
                    <ShieldAlert size={26} className="text-red-300" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '2px' }}>
                        CRIMINAL WATCHLIST HIT — STOLEN VEHICLE
                      </div>
                      <div style={{ fontSize: '0.8125rem', lineHeight: '1.4' }}>
                        Vehicle is actively flagged in State Police Crime Registry. FIR Number:{' '}
                        <span className="int-stolen-fir-code">{vehicleResult.stolen_fir_number}</span>.
                        Immediate checkpoint intercept recommended.
                      </div>
                    </div>
                  </div>
                )}

                <div className="int-vahan-plate-header">
                  <div>
                    <span className="int-plate-pill">{vehicleResult.plate_number}</span>
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                      Registered at RTO {vehicleResult.rto_office}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>API Latency</span>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#34d399', fontWeight: 600 }}>
                      {lookupMs ?? 18} ms
                    </div>
                  </div>
                </div>

                <div className="int-detail-sections">
                  {/* Vehicle Specs Box */}
                  <div className="int-detail-box">
                    <div className="int-box-title">
                      <Car size={13} /> Vehicle Details
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Make:</span>
                      <span className="int-field-val">{vehicleResult.vehicle_make}</span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Model:</span>
                      <span className="int-field-val">{vehicleResult.vehicle_model}</span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Color:</span>
                      <span className="int-field-val">{vehicleResult.vehicle_color}</span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Class:</span>
                      <span className="int-field-val">{vehicleResult.vehicle_type}</span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Fuel:</span>
                      <span className="int-field-val">{vehicleResult.fuel_type}</span>
                    </div>
                  </div>

                  {/* Ownership Box */}
                  <div className="int-detail-box">
                    <div className="int-box-title">
                      <FileText size={13} /> Ownership Record
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Registered Owner:</span>
                      <span className="int-field-val" style={{ color: '#60a5fa' }}>
                        {vehicleResult.owner_name}
                      </span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Reg. Date:</span>
                      <span className="int-field-val">
                        {vehicleResult.registration_date
                          ? new Date(vehicleResult.registration_date).toLocaleDateString('en-IN')
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Engine No:</span>
                      <span className="int-field-val" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                        {vehicleResult.engine_number}
                      </span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Chassis No:</span>
                      <span className="int-field-val" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                        {vehicleResult.chassis_number}
                      </span>
                    </div>
                  </div>

                  {/* Compliance & Safety Box */}
                  <div className="int-detail-box">
                    <div className="int-box-title">
                      <ShieldAlert size={13} /> Legal & Challans
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Insurance Status:</span>
                      <span className="int-field-val" style={{ color: vehicleResult.insurance_status === 'active' ? '#34d399' : '#f87171' }}>
                        {vehicleResult.insurance_status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Insurance Expiry:</span>
                      <span className="int-field-val">
                        {vehicleResult.insurance_valid_until
                          ? new Date(vehicleResult.insurance_valid_until).toLocaleDateString('en-IN')
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Fitness Valid:</span>
                      <span className="int-field-val">
                        {vehicleResult.fitness_valid_until
                          ? new Date(vehicleResult.fitness_valid_until).toLocaleDateString('en-IN')
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="int-field-row">
                      <span className="int-field-key">Pending Challans:</span>
                      <span className="int-field-val" style={{ color: vehicleResult.challan_count > 0 ? '#fbbf24' : '#94a3b8' }}>
                        {vehicleResult.challan_count} Infractions
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Query Audit Trail Table */}
          <div className="int-card">
            <div className="int-card-header">
              <h2 className="int-card-title">
                <Clock size={18} className="text-cyan-400" />
                Inter-Agency Query Audit Log
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Immutable Audit Trail
              </span>
            </div>

            <div className="int-query-table-wrap">
              <table className="int-query-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>System</th>
                    <th>Query Target</th>
                    <th>Status</th>
                    <th>Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {queryLog.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                        No external queries logged yet.
                      </td>
                    </tr>
                  ) : (
                    queryLog.map((q) => (
                      <tr key={q.id}>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                          {new Date(q.created_at).toLocaleTimeString()}
                        </td>
                        <td style={{ fontWeight: 600 }}>{q.integration_name || q.integration_id.toUpperCase()}</td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#93c5fd' }}>
                          {typeof q.query_input === 'object'
                            ? q.query_input.plate || JSON.stringify(q.query_input)
                            : String(q.query_input)}
                        </td>
                        <td>
                          <span
                            style={{
                              color: q.status === 'success' ? '#34d399' : '#f87171',
                              fontWeight: 600,
                            }}
                          >
                            ● {q.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {q.response_ms}ms
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
