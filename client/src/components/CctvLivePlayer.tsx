import { useEffect, useRef, useState } from 'react';
import { Camera, Zap } from 'lucide-react';
import Hls from 'hls.js';
import { federationApi } from '../api';

interface CctvLivePlayerProps {
  cameraId: string;
  cameraName?: string;
  vmsSystemId?: string;
  streamUrl?: string;
  protocol?: string;
}

type StreamMode = 'webrtc' | 'hls' | 'canvas';

interface Vehicle {
  x: number;
  y: number;
  speed: number;
  lane: number;
  color: string;
  type: 'car' | 'suv' | 'truck' | 'police' | 'bus';
  plate: string;
  isWatchlist: boolean;
  detected: boolean;
  boxAlpha: number;
}

const VEHICLE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6b7280', '#ffffff', '#1e293b'];
const PLATES = ['GJ01AB1234', 'GJ05CD5678', 'GJ18XY9999', 'GJ27ST4321', 'MH12DE3456', 'GJ01WL0001', 'GJ05WL0002'];

export default function CctvLivePlayer({
  cameraId,
  cameraName = 'Sentinel Surveillance Checkpoint',
  streamUrl = '',
}: CctvLivePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Extract clean camId (e.g. cam01)
  const camId = cameraId.startsWith('GJ-') ? (streamUrl.match(/cam\d+/i)?.[0] || 'cam01') : cameraId;

  // Stream endpoints
  const whepEndpoint = `http://103.250.160.189:8889/stream/${camId}/whep`;
  const hlsEndpoint = `/api/stream/sentinel/${camId}/index.m3u8`;

  // Start with WebRTC for ultra-low latency, with automatic HLS fallback
  const [streamMode, setStreamMode] = useState<StreamMode>('webrtc');
  const [activeProtocol, setActiveProtocol] = useState<'webrtc' | 'hls' | 'sim'>('webrtc');
  const [status, setStatus] = useState<'connecting' | 'playing' | 'fallback' | 'error'>('connecting');
  const [injecting, setInjecting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-IN', { hour12: false }));
  const [latencyText, setLatencyText] = useState('<200ms (Real-Time)');

  // Live time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup helper
  const cleanUpStreams = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
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

  // ─── Attach WebRTC WHEP ──────────────────────────────────────────────────
  const startWebRTC = async () => {
    cleanUpStreams();
    setStatus('connecting');
    setActiveProtocol('webrtc');
    setLatencyText('<200ms (Real-Time)');

    const video = videoRef.current;
    if (!video) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
          setStatus('playing');
          setActiveProtocol('webrtc');
          setLatencyText('<200ms (Real-Time)');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout before HLS fallback

      const res = await fetch(whepEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const answerSdp = await res.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        setStatus('playing');
      } else {
        console.warn(`[CctvLivePlayer] WebRTC WHEP returned HTTP ${res.status}, falling back to HLS`);
        startHLS();
      }
    } catch (err: any) {
      console.warn(`[CctvLivePlayer] WebRTC connection failed (${err.message}), falling back to HLS`);
      startHLS();
    }
  };

  // ─── Attach HLS Stream ───────────────────────────────────────────────────
  const startHLS = () => {
    cleanUpStreams();
    setStatus('connecting');
    setActiveProtocol('hls');
    setLatencyText('~2.0s (Proxied HLS)');

    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsEndpoint);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setStatus('playing');
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          console.warn('[CctvLivePlayer] Fatal HLS error:', data.type);
          setStatus('error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsEndpoint;
      video.oncanplay = () => {
        video.play().catch(() => {});
        setStatus('playing');
      };
      video.onerror = () => setStatus('error');
    } else {
      setStatus('error');
    }
  };

  // ─── Stream lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (streamMode === 'webrtc') {
      void startWebRTC();
    } else if (streamMode === 'hls') {
      startHLS();
    } else {
      cleanUpStreams();
      setActiveProtocol('sim');
    }

    return () => {
      cleanUpStreams();
    };
  }, [streamMode, camId]);

  // ─── Canvas Animation Loop (AI Simulation Mode) ──────────────────────────
  useEffect(() => {
    if (streamMode !== 'canvas') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let scanY = 50;
    let scanDirection = 1;

    const lanes = [70, 130, 190];
    const vehicles: Vehicle[] = [
      { x: 50, y: 70, speed: 2.2, lane: 0, color: '#3b82f6', type: 'car', plate: 'GJ01AB1234', isWatchlist: false, detected: false, boxAlpha: 0 },
      { x: 220, y: 130, speed: 2.8, lane: 1, color: '#ef4444', type: 'suv', plate: 'GJ01WL0001', isWatchlist: true, detected: false, boxAlpha: 0 },
      { x: 400, y: 190, speed: 1.8, lane: 2, color: '#10b981', type: 'truck', plate: 'GJ05CD5678', isWatchlist: false, detected: false, boxAlpha: 0 },
      { x: -120, y: 130, speed: 2.5, lane: 1, color: '#f59e0b', type: 'car', plate: 'GJ05WL0002', isWatchlist: true, detected: false, boxAlpha: 0 },
    ];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Road background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 40, width, 180);

      // Road dividers
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 16]);
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(width, 100);
      ctx.moveTo(0, 160);
      ctx.lineTo(width, 160);
      ctx.stroke();
      ctx.setLineDash([]);

      // ANPR Trigger Line
      const triggerX = width * 0.55;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(triggerX, 40);
      ctx.lineTo(triggerX, 220);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vehicles
      for (const v of vehicles) {
        v.x += v.speed;
        if (v.x > width + 80) {
          v.x = -100 - Math.random() * 80;
          v.lane = Math.floor(Math.random() * 3);
          v.y = lanes[v.lane];
          v.speed = 1.8 + Math.random() * 1.5;
          v.color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
          v.plate = PLATES[Math.floor(Math.random() * PLATES.length)];
          v.isWatchlist = v.plate.includes('WL');
          v.detected = false;
          v.boxAlpha = 0;
        }

        const vLength = v.type === 'truck' ? 70 : v.type === 'suv' ? 52 : 46;
        const vWidth = v.type === 'truck' ? 28 : 22;

        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.roundRect(v.x, v.y - vWidth / 2, vLength, vWidth, 4);
        ctx.fill();

        if (v.x + vLength > triggerX - 10 && v.x < triggerX + 40) {
          v.detected = true;
          v.boxAlpha = 1.0;
        }

        if (v.boxAlpha > 0.05) {
          ctx.save();
          const boxColor = v.isWatchlist ? 'rgba(239, 68, 68, ' : 'rgba(34, 197, 94, ';
          ctx.strokeStyle = `${boxColor}${v.boxAlpha})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(v.x - 4, v.y - vWidth / 2 - 4, vLength + 8, vWidth + 8);

          ctx.fillStyle = v.isWatchlist ? '#dc2626' : '#16a34a';
          ctx.fillRect(v.x - 4, v.y - vWidth / 2 - 20, 110, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${v.plate} ${v.isWatchlist ? '🚨 HIT' : '✓ OK'}`, v.x, v.y - vWidth / 2 - 8);

          ctx.restore();
          v.boxAlpha -= 0.015;
        }
      }

      // Scanning line
      scanY += scanDirection * 1.5;
      if (scanY > 215) scanDirection = -1;
      if (scanY < 45) scanDirection = 1;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [streamMode]);

  const handleQuickInject = async () => {
    setInjecting(true);
    try {
      await federationApi.detectPlate({
        camera_id: cameraId,
        plate: 'GJ01WL0001',
        confidence: 0.98,
      });
      alert(`Plate GJ01WL0001 injected successfully through camera ${cameraId}! Check Alerts.`);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err.message);
    } finally {
      setInjecting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* CCTV Screen Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          background: '#090d16',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #1e2a3b',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* CCTV Top OSD Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                animation: 'pulse 1.2s infinite',
                boxShadow: '0 0 6px #ef4444',
              }}
            />
            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', fontFamily: 'monospace' }}>
              REC · LIVE
            </span>
            <span style={{ color: '#7fd1ff', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(56,189,248,0.15)', padding: '2px 6px', borderRadius: '3px' }}>
              {camId}
            </span>
            <span style={{ color: '#cbd5e1', fontSize: '11px', fontWeight: 500 }}>
              {cameraName}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f8fafc', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
            <span>{currentTime} IST</span>
            <span style={{
              color: activeProtocol === 'webrtc' ? '#4ade80' : '#fbbf24',
              background: activeProtocol === 'webrtc' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '10px',
            }}>
              {activeProtocol === 'webrtc' ? '● WebRTC <200ms' : activeProtocol === 'hls' ? '● HLS ~2s' : '● SIM'}
            </span>
            <span style={{ color: '#94a3b8' }}>1080p · 30 FPS</span>
          </div>
        </div>

        {/* Video stream render */}
        {streamMode !== 'canvas' ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <video
              ref={videoRef}
              controls
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              onPlaying={() => setStatus('playing')}
              onLoadedData={() => setStatus('playing')}
              onError={() => {
                if (streamMode === 'webrtc') {
                  startHLS();
                } else {
                  setStatus('error');
                }
              }}
            />
            {status === 'connecting' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10, 14, 20, 0.85)',
                  color: '#94a3b8',
                  gap: '8px',
                  zIndex: 10,
                }}
              >
                <div style={{ width: 28, height: 28, border: '2px solid #1e2a3b', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: '12px' }}>Connecting to {activeProtocol.toUpperCase()} stream…</span>
              </div>
            )}
            {status === 'error' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#94a3b8',
                  padding: '20px',
                  textAlign: 'center',
                  zIndex: 15,
                }}
              >
                <Camera size={32} style={{ marginBottom: '8px', color: '#f59e0b' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  Stream Standby
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', maxWidth: '380px', color: '#cbd5e1' }}>
                  HLS proxy and WebRTC endpoints are ready. You can toggle protocols below.
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn-sm btn-sm--primary" onClick={startHLS} style={{ fontSize: '11px' }}>
                    Retry HLS
                  </button>
                  <button className="btn-sm btn-sm--ghost" onClick={() => setStreamMode('canvas')} style={{ fontSize: '11px' }}>
                    View Simulation
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={720}
            height={320}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        )}
      </div>

      {/* Control bar: Protocol Switcher & AI Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--surface-alt)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {/* Protocol Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Protocol:
          </span>
          <button
            className={`btn-sm ${streamMode === 'webrtc' ? 'btn-sm--primary' : 'btn-sm--ghost'}`}
            onClick={() => setStreamMode('webrtc')}
            style={{ fontSize: '11px', padding: '2px 8px' }}
            title="WebRTC (WHEP) for real-time sub-200ms latency"
          >
            ⚡ WebRTC (&lt;200ms)
          </button>
          <button
            className={`btn-sm ${streamMode === 'hls' ? 'btn-sm--primary' : 'btn-sm--ghost'}`}
            onClick={() => setStreamMode('hls')}
            style={{ fontSize: '11px', padding: '2px 8px' }}
            title="HLS via secure backend proxy"
          >
            📺 HLS Proxy
          </button>
          <button
            className={`btn-sm ${streamMode === 'canvas' ? 'btn-sm--primary' : 'btn-sm--ghost'}`}
            onClick={() => setStreamMode('canvas')}
            style={{ fontSize: '11px', padding: '2px 8px' }}
            title="AI Detection Simulation"
          >
            🤖 AI Sim
          </button>
        </div>

        {/* Live Status & Quick Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Latency: <strong style={{ color: 'var(--accent)' }}>{latencyText}</strong>
          </span>
          <button
            className="btn-sm btn-sm--ghost"
            onClick={handleQuickInject}
            disabled={injecting}
            style={{ fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
            title="Simulate ANPR Hotlist match event"
          >
            <Zap size={11} style={{ marginRight: 3, display: 'inline', verticalAlign: 'middle' }} />
            {injecting ? 'Testing…' : 'Test Hotlist Hit'}
          </button>
        </div>
      </div>
    </div>
  );
}
