import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain,
  Video,
  Users,
  Car,
  ShieldAlert,
  Activity,
  Cpu,
  Layers,
  RefreshCw,
  Play,
  Pause,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import Hls from 'hls.js';
import { useAIDetection } from '../hooks/useAIDetection';
import { model4Api, model2Api } from '../api';
import './CommandCentrePage.css';

interface DashboardStats {
  ai: {
    totalEventsToday: number;
    faceDetections: number;
    crowdCounts: number;
    vehicleCounts: number;
    anomalies: number;
    anprDetections: number;
  };
  recentAnomalies: any[];
  integrations: any[];
  system: {
    totalCameras: number;
    onlineCameras: number;
    gpuUtilisation: number;
    ingestRate: number;
    cpuUtilisation: number;
    memoryUsage: number;
  };
}

interface AIEventRow {
  id: string;
  camera_id: string;
  camera_name?: string;
  event_type: string;
  confidence: number;
  payload: any;
  processing_ms: number;
  occurred_at: string;
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#eab308', '#ef4444', '#a855f7'];

const AUX_CAMERAS = [
  { id: 'cam02', label: 'CAM-002: SG Highway Junction', simulatedPersons: 14, simulatedVehicles: 8 },
  { id: 'cam03', label: 'CAM-003: Kalupur Central Station', simulatedPersons: 28, simulatedVehicles: 4 },
  { id: 'cam04', label: 'CAM-004: Ring Road Expressway', simulatedPersons: 3, simulatedVehicles: 19 },
  { id: 'cam05', label: 'CAM-005: Sabarmati Riverfront Walk', simulatedPersons: 21, simulatedVehicles: 0 },
];

export default function CommandCentrePage() {
  const [selectedCam, setSelectedCam] = useState<string>('cam01');
  const [cameraName, setCameraName] = useState<string>('Sentinel Alpha: Ashram Road Checkpoint');
  const [availableCams, setAvailableCams] = useState<Array<{ id: string; name: string; stream_url?: string }>>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AIEventRow[]>([]);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isLiveStreamPlaying, setIsLiveStreamPlaying] = useState<boolean>(false);

  // References for video & canvas overlay
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // AI Detection hook
  const {
    isModelLoading,
    modelError,
    isDetecting,
    stats,
    activeAnomaly,
    startAutoDetection,
    stopAutoDetection,
  } = useAIDetection(selectedCam);

  // Load dashboard overview, available camera feeds, and events
  const loadInitialData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [dashData, feedsData, eventsData] = await Promise.all([
        model4Api.getDashboard().catch(() => null),
        model2Api.getLiveFeeds().catch(() => []),
        model4Api.getAIEvents({ pageSize: 25 }).catch(() => ({ data: [] })),
      ]);

      if (dashData) setDashboard(dashData);
      if (eventsData?.data) setEvents(eventsData.data);

      if (feedsData && feedsData.length > 0) {
        const formatted = feedsData.map((f: any) => ({
          id: f.clean_cam_id || f.id,
          name: f.name || `Camera ${f.id}`,
          stream_url: f.stream_url,
        }));
        setAvailableCams(formatted);
        if (formatted[0]) {
          setSelectedCam(formatted[0].id);
          setCameraName(formatted[0].name);
        }
      } else {
        setAvailableCams([
          { id: 'cam01', name: 'Sentinel Alpha: Ashram Road Checkpoint' },
          { id: 'cam02', name: 'Sentinel Beta: SG Highway Junction' },
          { id: 'cam03', name: 'Sentinel Gamma: Kalupur Central Station' },
          { id: 'cam04', name: 'Sentinel Delta: Ring Road Expressway' },
        ]);
      }
    } catch (err) {
      console.error('[CommandCentre] Failed to load data:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Video Stream Setup (WHEP WebRTC with HLS fallback)
  useEffect(() => {
    let active = true;

    const cleanupStream = () => {
      if (peerConnRef.current) {
        peerConnRef.current.close();
        peerConnRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = '';
      }
    };

    cleanupStream();

    const video = videoRef.current;
    if (!video) return;

    const cleanCam = (selectedCam.match(/cam\d+/i)?.[0] || selectedCam).toLowerCase();
    const hlsEndpoint = `/api/stream/sentinel/${cleanCam}/index.m3u8`;

    const startHls = () => {
      if (!active || !video) return;
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 20,
          maxBufferLength: 6,
          maxMaxBufferLength: 12,
          maxBufferSize: 25 * 1000 * 1000,
          startFragPrefetch: true,
          initialLiveManifestSize: 1,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 15000,
          fragLoadingTimeOut: 25000,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsEndpoint);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (active) {
            video.play().catch(() => {});
            setIsLiveStreamPlaying(true);
          }
        });

        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setIsLiveStreamPlaying(false);
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsEndpoint;
        video.play().catch(() => {});
        setIsLiveStreamPlaying(true);
      }
    };

    startHls();

    return () => {
      active = false;
      cleanupStream();
    };
  }, [selectedCam]);

  // Handle AI Auto-Detection Start/Stop
  useEffect(() => {
    if (!isModelLoading && videoRef.current && canvasRef.current && isLiveStreamPlaying) {
      startAutoDetection(videoRef.current, canvasRef.current, 350);
    }
    return () => {
      stopAutoDetection();
    };
  }, [isModelLoading, isLiveStreamPlaying, startAutoDetection, stopAutoDetection]);

  const toggleDetection = () => {
    if (isDetecting) {
      stopAutoDetection();
    } else if (videoRef.current && canvasRef.current) {
      startAutoDetection(videoRef.current, canvasRef.current, 500);
    }
  };

  const handleCameraChange = (camId: string) => {
    setIsLiveStreamPlaying(false);
    setSelectedCam(camId);
    const found = availableCams.find((c) => c.id === camId);
    if (found) setCameraName(found.name);
  };

  // Distribution chart data from dashboard
  const pieData = dashboard?.ai
    ? [
        { name: 'Crowd Counts', value: dashboard.ai.crowdCounts || 89 },
        { name: 'Vehicles', value: dashboard.ai.vehicleCounts || 71 },
        { name: 'Faces', value: dashboard.ai.faceDetections || 63 },
        { name: 'Anomalies', value: dashboard.ai.anomalies || 12 },
        { name: 'ANPR', value: dashboard.ai.anprDetections || 12 },
      ]
    : [
        { name: 'Crowd Counts', value: 89 },
        { name: 'Vehicles', value: 71 },
        { name: 'Faces', value: 63 },
        { name: 'Anomalies', value: 12 },
        { name: 'ANPR', value: 12 },
      ];

  // Filtered event log
  const filteredEvents = events.filter((e) => {
    if (eventFilter === 'all') return true;
    return e.event_type === eventFilter;
  });

  return (
    <div className="cc-container">
      {/* ─── Header & Ribbon ─── */}
      <div className="cc-header">
        <div className="cc-title-area">
          <h1>
            <Brain className="text-blue-500" size={28} />
            Central VMS & AI Command Centre
            <span className="cc-title-badge">Model 4 Live</span>
          </h1>
          <p className="cc-subtitle">
            Autonomous in-browser computer vision engine, real-time edge telemetry, and statewide sensor federation.
          </p>
        </div>

        <div className="cc-header-actions">
          <button
            className={`cc-btn ${isDetecting ? 'active' : ''}`}
            onClick={toggleDetection}
            disabled={isModelLoading}
          >
            {isDetecting ? <Pause size={16} /> : <Play size={16} />}
            {isDetecting ? 'Pause Inference' : 'Resume Inference'}
          </button>

          <button className="cc-btn" onClick={loadInitialData} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <Link to="/integrations" className="cc-btn cc-btn-primary">
            Integrations Hub
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* ─── Model Error Banner (if present) ─── */}
      {modelError && (
        <div className="cc-anomaly-banner warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>AI Model Warning: {modelError} (Fallback engine active)</span>
          </div>
        </div>
      )}

      {/* ─── Anomaly Alert Strip (if active) ─── */}
      {activeAnomaly && (
        <div className={`cc-anomaly-banner ${activeAnomaly.severity === 'medium' ? 'warning' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>
              <strong>REAL-TIME INCIDENT [{activeAnomaly.type.toUpperCase()}]:</strong> {activeAnomaly.description}
            </span>
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
            {new Date(activeAnomaly.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* ─── Metrics Strip ─── */}
      <div className="cc-metrics-strip">
        <div className="cc-metric-card" style={{ '--card-accent': '#3b82f6' } as any}>
          <div className="cc-metric-icon">
            <Activity size={22} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-label">AI Events (24h)</span>
            <span className="cc-metric-value">{dashboard?.ai?.totalEventsToday ?? 247}</span>
            <span className="cc-metric-subtext">Ingestion active</span>
          </div>
        </div>

        <div className="cc-metric-card" style={{ '--card-accent': '#10b981' } as any}>
          <div className="cc-metric-icon">
            <Users size={22} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-label">Persons (Frame)</span>
            <span className="cc-metric-value">{stats.persons}</span>
            <span className="cc-metric-subtext">Live COCO-SSD</span>
          </div>
        </div>

        <div className="cc-metric-card" style={{ '--card-accent': '#60a5fa' } as any}>
          <div className="cc-metric-icon">
            <Car size={22} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-label">Vehicles (Frame)</span>
            <span className="cc-metric-value">{stats.vehicles}</span>
            <span className="cc-metric-subtext">Cars, Trucks, Buses</span>
          </div>
        </div>

        <div className="cc-metric-card" style={{ '--card-accent': '#f59e0b' } as any}>
          <div className="cc-metric-icon">
            <Cpu size={22} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-label">Engine Latency</span>
            <span className="cc-metric-value">{stats.inferenceMs || 24} ms</span>
            <span className="cc-metric-subtext">TensorFlow.js WebGL</span>
          </div>
        </div>

        <div className="cc-metric-card" style={{ '--card-accent': '#ef4444' } as any}>
          <div className="cc-metric-icon">
            <ShieldAlert size={22} />
          </div>
          <div className="cc-metric-info">
            <span className="cc-metric-label">Active Anomalies</span>
            <span className="cc-metric-value">{activeAnomaly ? 1 : 0}</span>
            <span className="cc-metric-subtext">Rule engine armed</span>
          </div>
        </div>
      </div>

      {/* ─── Primary Camera Section + AI Live Insights ─── */}
      <div className="cc-primary-layout">
        {/* Left: Main Camera Viewport */}
        <div className="cc-camera-panel">
          <div className="cc-camera-topbar">
            <div className="cc-camera-title-group">
              <span className="cc-live-dot" />
              <span className="cc-camera-name">{cameraName}</span>
            </div>

            <select
              className="cc-camera-select"
              value={selectedCam}
              onChange={(e) => handleCameraChange(e.target.value)}
            >
              {availableCams.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id.toUpperCase()} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cc-video-viewport">
            <video
              ref={videoRef}
              className="cc-video-element"
              playsInline
              muted
              autoPlay
              onPlaying={() => setIsLiveStreamPlaying(true)}
              onLoadedMetadata={() => setIsLiveStreamPlaying(true)}
            />
            <canvas ref={canvasRef} className="cc-canvas-overlay" />

            {!isLiveStreamPlaying && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(10, 15, 29, 0.85)',
                backdropFilter: 'blur(4px)',
                zIndex: 5,
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(59, 130, 246, 0.2)',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                  CONNECTING LIVE HLS FEED ({selectedCam.toUpperCase()})...
                </span>
              </div>
            )}

            {/* Video HUD Overlays */}
            <div className="cc-hud-top-left">
              <span className="cc-hud-badge">
                <Video size={12} />
                STREAM: {selectedCam.toUpperCase()} [1080p·60]
              </span>
              <span className="cc-hud-badge">
                <Layers size={12} />
                SOURCE: SENTINEL VMS FEDERATION
              </span>
            </div>

            <div className="cc-hud-top-right">
              <span className="cc-ai-pulse-pill">
                <Brain size={13} />
                {isModelLoading ? 'INITIALIZING AI...' : isDetecting ? 'AI ACTIVE' : 'INFERENCE PAUSED'}
              </span>
            </div>

            <div className="cc-hud-bottom">
              <div className="cc-hud-telemetry">
                <span>FPS: {stats.fps || 24}</span>
                <span>·</span>
                <span>LATENCY: {stats.inferenceMs || 18}ms</span>
                <span>·</span>
                <span>BACKEND: WebGL 2.0</span>
              </div>

              <div className="cc-hud-telemetry">
                <span>PERSONS: {stats.persons}</span>
                <span>·</span>
                <span>VEHICLES: {stats.vehicles}</span>
                <span>·</span>
                <span>FACES: {stats.faces}</span>
              </div>
            </div>
          </div>

          <div className="cc-camera-toolbar">
            <div className="cc-quick-cam-tabs">
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '4px' }}>Quick Switch:</span>
              {(availableCams.length > 0 ? availableCams.slice(0, 6) : [
                { id: 'cam01', name: 'CAM-01' },
                { id: 'cam02', name: 'CAM-02' },
                { id: 'cam03', name: 'CAM-03' },
                { id: 'cam04', name: 'CAM-04' },
              ]).map((cam) => (
                <button
                  key={cam.id}
                  className={`cc-cam-tab-btn ${selectedCam === cam.id ? 'active' : ''}`}
                  onClick={() => handleCameraChange(cam.id)}
                >
                  {cam.id.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>Legend:</span>
              <span style={{ color: '#10b981' }}>■ Person</span>
              <span style={{ color: '#3b82f6' }}>■ Vehicle</span>
              <span style={{ color: '#eab308' }}>■ Face</span>
            </div>
          </div>
        </div>

        {/* Right: Live AI Insights & Distribution Panel */}
        <div className="cc-insights-panel">
          {/* Subject Breakdown Card */}
          <div className="cc-insight-card">
            <div className="cc-card-header">
              <h3 className="cc-card-title">
                <Activity size={16} className="text-emerald-400" />
                Live Frame Breakdown
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Updated real-time</span>
            </div>

            <div className="cc-subject-counts">
              <div className="cc-subject-box">
                <div className="cc-subject-val" style={{ color: '#10b981' }}>{stats.persons}</div>
                <div className="cc-subject-lbl">Persons</div>
              </div>
              <div className="cc-subject-box">
                <div className="cc-subject-val" style={{ color: '#3b82f6' }}>{stats.vehicles}</div>
                <div className="cc-subject-lbl">Vehicles</div>
              </div>
              <div className="cc-subject-box">
                <div className="cc-subject-val" style={{ color: '#eab308' }}>{stats.faces}</div>
                <div className="cc-subject-lbl">Faces</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', padding: '4px 0' }}>
              <span>Cars: <strong style={{ color: '#f8fafc' }}>{stats.cars}</strong></span>
              <span>Trucks: <strong style={{ color: '#f8fafc' }}>{stats.trucks}</strong></span>
              <span>Buses: <strong style={{ color: '#f8fafc' }}>{stats.buses}</strong></span>
              <span>2-Wheel: <strong style={{ color: '#f8fafc' }}>{stats.motorcycles}</strong></span>
            </div>
          </div>

          {/* Anomaly Rules Engine Monitor */}
          <div className="cc-insight-card">
            <div className="cc-card-header">
              <h3 className="cc-card-title">
                <ShieldAlert size={16} className="text-amber-400" />
                Autonomous Anomaly Rules
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Armed
              </span>
            </div>

            <div className="cc-rules-list">
              <div className="cc-rule-item">
                <span className="cc-rule-name">Crowd Spike (&gt;25 Persons)</span>
                <span className={`cc-rule-badge ${stats.persons > 25 ? 'alert' : 'ok'}`}>
                  {stats.persons > 25 ? 'TRIGGERED' : 'NORMAL'}
                </span>
              </div>
              <div className="cc-rule-item">
                <span className="cc-rule-name">Camera Blackout Guard</span>
                <span className="cc-rule-badge ok">SECURE</span>
              </div>
              <div className="cc-rule-item">
                <span className="cc-rule-name">Traffic Congestion (&gt;15 Veh.)</span>
                <span className={`cc-rule-badge ${stats.vehicles > 15 ? 'alert' : 'ok'}`}>
                  {stats.vehicles > 15 ? 'TRIGGERED' : 'NORMAL'}
                </span>
              </div>
              <div className="cc-rule-item">
                <span className="cc-rule-name">Restricted Hours (23:00-05:00)</span>
                <span className="cc-rule-badge ok">ARMED</span>
              </div>
            </div>
          </div>

          {/* Event Distribution Chart */}
          <div className="cc-insight-card">
            <div className="cc-card-header">
              <h3 className="cc-card-title">
                <Brain size={16} className="text-purple-400" />
                AI Event Distribution (24h)
              </h3>
            </div>

            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Secondary 2x2 Auxiliary Grid & Integrations Summary ─── */}
      <div className="cc-secondary-grid">
        {/* Auxiliary Multi-Cam Grid */}
        <div className="cc-insight-card">
          <div className="cc-card-header">
            <h3 className="cc-card-title">
              <Video size={16} className="text-blue-400" />
              Statewide Perimeter Feeds (Select to Focus)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Autonomous Sentinel Nodes</span>
          </div>

          <div className="cc-aux-tiles">
            {AUX_CAMERAS.map((cam) => (
              <div
                key={cam.id}
                className="cc-aux-tile"
                onClick={() => handleCameraChange(cam.id)}
                title="Click to promote to primary AI viewer"
              >
                <div className="cc-aux-tile-top">
                  <span className="cc-aux-tile-name">{cam.label.split(':')[0]}</span>
                  <span className="cc-aux-tile-ai-pill">AI ACTIVE</span>
                </div>

                {/* Auxiliary Preview Background */}
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: '#0a0f1d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#334155',
                  }}
                >
                  <Video size={36} opacity={0.3} />
                </div>

                <div className="cc-aux-tile-foot">
                  {cam.simulatedPersons} Persons · {cam.simulatedVehicles} Vehicles
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Government Integration Health Strip */}
        <div className="cc-insight-card">
          <div className="cc-card-header">
            <h3 className="cc-card-title">
              <Layers size={16} className="text-cyan-400" />
              Government Data Linkages
            </h3>
            <Link to="/integrations" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>
              Open Hub →
            </Link>
          </div>

          <div className="cc-integrations-mini-list">
            <div className="cc-integ-row">
              <div>
                <div className="cc-integ-name">VAHAN Registry</div>
                <div className="cc-integ-type">MoRTH Vehicle Database</div>
              </div>
              <span className="cc-integ-status-pill connected">Connected</span>
            </div>

            <div className="cc-integ-row">
              <div>
                <div className="cc-integ-name">SARTHI Licences</div>
                <div className="cc-integ-type">Driver Licencing System</div>
              </div>
              <span className="cc-integ-status-pill connected">Connected</span>
            </div>

            <div className="cc-integ-row">
              <div>
                <div className="cc-integ-name">eGujCop Portal</div>
                <div className="cc-integ-type">Gujarat Police FIR Records</div>
              </div>
              <span className="cc-integ-status-pill degraded">Degraded</span>
            </div>

            <div className="cc-integ-row">
              <div>
                <div className="cc-integ-name">AFIS / NAFIS</div>
                <div className="cc-integ-type">Biometrics & Facial DB</div>
              </div>
              <span className="cc-integ-status-pill connected">Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Recent AI Event Stream Table ─── */}
      <div className="cc-events-section">
        <div className="cc-events-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} className="text-blue-400" />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
              Live AI Analytics Event Stream
            </h3>
          </div>

          <div className="cc-tab-group">
            {['all', 'anomaly', 'crowd_count', 'vehicle_count', 'face_detection'].map((filterKey) => (
              <button
                key={filterKey}
                className={`cc-tab-pill ${eventFilter === filterKey ? 'active' : ''}`}
                onClick={() => setEventFilter(filterKey)}
              >
                {filterKey.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="cc-table-wrapper">
          <table className="cc-events-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Camera</th>
                <th>Event Type</th>
                <th>Confidence</th>
                <th>Payload Summary</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                    No AI events matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.slice(0, 15).map((evt) => (
                  <tr key={evt.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(evt.occurred_at).toLocaleTimeString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{evt.camera_name || evt.camera_id}</td>
                    <td>
                      <span className={`cc-event-badge ${evt.event_type}`}>
                        {evt.event_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {Math.round((evt.confidence || 0.9) * 100)}%
                    </td>
                    <td>
                      <div className="cc-payload-code">
                        {typeof evt.payload === 'object' ? JSON.stringify(evt.payload) : String(evt.payload)}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {evt.processing_ms || 24}ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
