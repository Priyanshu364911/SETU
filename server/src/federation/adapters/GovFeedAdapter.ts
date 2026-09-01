import { BaseAdapter } from './BaseAdapter';
import { AdapterType, CanonicalCameraMetadata } from '../types';

export interface SentinelFeedDescriptor {
  id?: string | number;
  externalId?: string;
  name?: string;
  location?: string | { lat?: number; lng?: number; latitude?: number; longitude?: number };
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  codec?: string; // 'h264' | 'h265'
  live?: boolean;
  status?: string;
  fps?: number;
  resolution?: string;
  streamProperties?: Record<string, unknown>;
  urls?: {
    rtsp?: string;
    webrtc?: string;
    whep?: string;
    hls?: string;
    stream?: string;
  };
  url?: string;
  protocol?: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
}

/**
 * Sentinel Camera Grid Adapter (Official Gujarat Police Innovation Challenge 2026).
 *
 * Auth model: POST /auth/login with password → session cookie → protected endpoints.
 * Catalogue:  GET  https://cctv.corp8.cloud/cameras.json  (returns [{id, name}])
 * HLS:        https://cctv.corp8.cloud/<id>/index.m3u8    (CDN, cookie-protected)
 * RTSP:       rtsp://103.250.160.189:8554/stream/<id>     (direct IP, no auth)
 * WebRTC:     http://103.250.160.189:8889/stream/<id>/whep (direct IP, no auth)
 */
export class GovFeedAdapter extends BaseAdapter {
  readonly id: string;
  readonly type: AdapterType = 'gov_feed';
  readonly displayName = 'Sentinel Grid / Government Feed Adapter';

  private baseUrl: string;   // https://cctv.corp8.cloud
  private rtspHost: string;  // 103.250.160.189
  private apiToken: string;  // access password for POST /auth/login
  private sessionCookie = '';
  private feeds: SentinelFeedDescriptor[] = [];

  constructor(
    systemId: string,
    baseUrl = '',
    staticFeeds: SentinelFeedDescriptor[] = [],
    apiToken = ''
  ) {
    super();
    this.id = systemId;
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    this.apiToken = apiToken;
    this.feeds = staticFeeds;

    // Resolve direct-IP host from env or default
    this.rtspHost = process.env.SENTINEL_RTSP_HOST || '103.250.160.189';
  }

  setFeeds(feeds: SentinelFeedDescriptor[]) {
    this.feeds = feeds;
  }

  /**
   * Authenticates against /auth/login using the access password.
   * Stores the session cookie for subsequent requests.
   */
  private async ensureSession(): Promise<void> {
    if (this.sessionCookie) return; // already authenticated

    if (!this.baseUrl || !this.apiToken) return;

    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `password=${encodeURIComponent(this.apiToken)}`,
        redirect: 'manual', // don't follow — we just need the Set-Cookie
        signal: AbortSignal.timeout(8000),
      });

      // Extract session cookie from Set-Cookie header
      const setCookie = res.headers.get('set-cookie') || '';
      if (setCookie) {
        // Only pass the cookie name=value part (strip path/domain/expires)
        this.sessionCookie = setCookie.split(';')[0].trim();
        console.log(`[GovFeedAdapter] Session established with Sentinel (${this.baseUrl})`);
      } else if (res.status === 200 || res.status === 302) {
        // Some servers don't set a cookie on 200, try reading from body or assume ok
        console.log(`[GovFeedAdapter] Login status ${res.status}, no cookie returned — may be IP-whitelisted`);
      } else {
        console.warn(`[GovFeedAdapter] Login failed: HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[GovFeedAdapter] Session login failed:`, err.message);
    }
  }

  /** Cookie headers for authenticated Sentinel CDN requests */
  private cookieHeaders(): Record<string, string> {
    return this.sessionCookie ? { Cookie: this.sessionCookie } : {};
  }

  async connect(): Promise<void> {
    await this.ensureSession();
    const health = await this.healthCheck();
    if (!health.ok) {
      console.warn(`[GovFeedAdapter] Connection check warning for ${this.id}: ${health.detail}`);
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.stopEventIngest();
    this.sessionCookie = '';
    this.connected = false;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    if (this.baseUrl) {
      await this.ensureSession();
      try {
        const res = await fetch(`${this.baseUrl}/cameras.json`, {
          signal: AbortSignal.timeout(5000),
          headers: this.cookieHeaders(),
        });
        if (res.ok) {
          const list = (await res.json()) as any[];
          return { ok: true, detail: `Catalogue reachable — ${list.length} cameras live` };
        }
        return { ok: false, detail: `HTTP ${res.status} from /cameras.json` };
      } catch (err: any) {
        return { ok: false, detail: `Catalogue unreachable: ${err.message}` };
      }
    }
    return { ok: true, detail: `${this.feeds.length} static feed(s) configured (sandbox mode)` };
  }

  /**
   * Fetches live camera catalogue from GET /cameras.json.
   * Returns all 30 cameras with HLS/RTSP/WHEP URLs pre-computed.
   * Falls back to static feeds if the endpoint is unreachable.
   */
  async listCameras(): Promise<CanonicalCameraMetadata[]> {
    if (this.baseUrl) {
      await this.ensureSession();
      try {
        const res = await fetch(`${this.baseUrl}/cameras.json`, {
          signal: AbortSignal.timeout(8000),
          headers: this.cookieHeaders(),
        });
        if (res.ok) {
          const data = (await res.json()) as any[];
          if (Array.isArray(data) && data.length > 0) {
            console.log(`[GovFeedAdapter] Discovered ${data.length} cameras from live catalogue.`);
            return data.map((item) => this.toCanonicalFromCatalogue(item));
          }
        }
      } catch (err: any) {
        console.warn(`[GovFeedAdapter] /cameras.json fetch failed, falling back to static feeds:`, err.message);
      }
    }

    // Static / fallback feeds
    return this.feeds.map((f) => this.toCanonicalFromStatic(f));
  }

  async getCamera(externalId: string): Promise<CanonicalCameraMetadata | null> {
    const all = await this.listCameras();
    return all.find((c) => c.externalCameraId === String(externalId)) || null;
  }

  /**
   * Returns stream URLs per the Sentinel Integrator's Guide §1:
   *  - HLS:  https://cctv.corp8.cloud/<id>/index.m3u8  (works everywhere, cookie required)
   *  - RTSP: rtsp://103.250.160.189:8554/stream/<id>   (AI inference)
   *  - WHEP: http://103.250.160.189:8889/stream/<id>/whep (low-latency browser)
   */
  async requestStream(externalId: string): Promise<{
    url: string;
    protocol: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
    expiresInSec: number;
    rtspUrl?: string;
    whepUrl?: string;
  } | null> {
    const cam = await this.getCamera(externalId);
    if (!cam) return null;

    return {
      url: this.hlsUrl(externalId),
      protocol: 'hls',
      expiresInSec: 3600,
      rtspUrl: this.rtspUrl(externalId),
      whepUrl: this.whepUrl(externalId),
    };
  }

  async startEventIngest(onEvent: Parameters<BaseAdapter['startEventIngest']>[0]): Promise<void> {
    await super.startEventIngest(onEvent);

    // Poll catalogue periodically to detect camera additions/outages
    this.ingestTimer = setInterval(async () => {
      try {
        const cameras = await this.listCameras();
        const onlineCount = cameras.filter((c) => c.status === 'online').length;

        this.emit({
          eventType: 'SystemHeartbeat',
          vmsSystemId: this.id,
          severity: 'info',
          payload: {
            totalCameras: cameras.length,
            onlineCameras: onlineCount,
            source: 'sentinel_catalogue_poll',
          },
          occurredAt: new Date().toISOString(),
        });
      } catch (err: any) {
        this.emit({
          eventType: 'AdapterError',
          vmsSystemId: this.id,
          severity: 'low',
          payload: { message: err.message, source: 'sentinel_poll' },
          occurredAt: new Date().toISOString(),
        });
      }
    }, 20000);
  }

  // ─── URL helpers (per Sentinel Integrator's Guide §1) ────────────────────

  private hlsUrl(id: string): string {
    return `/api/stream/sentinel/${id}/index.m3u8`;
  }

  private rtspUrl(id: string): string {
    return `rtsp://${this.rtspHost}:8554/stream/${id}`;
  }

  private whepUrl(id: string): string {
    return `http://${this.rtspHost}:8889/stream/${id}/whep`;
  }

  // ─── Stream Proxying (Bypasses browser CORS & session cookie restrictions) ───

  /**
   * Fetches the HLS playlist from Sentinel CDN with backend session cookie,
   * rewriting the AES-128 key URI to route through our proxy.
   */
  async getHlsManifest(externalId: string): Promise<string | null> {
    if (!this.baseUrl) return null;
    await this.ensureSession();

    const fetchManifest = async () => {
      return fetch(`${this.baseUrl}/${externalId}/index.m3u8`, {
        signal: AbortSignal.timeout(8000),
        headers: this.cookieHeaders(),
      });
    };

    let res = await fetchManifest();
    if (res.status === 401 || res.status === 403) {
      this.sessionCookie = '';
      await this.ensureSession();
      res = await fetchManifest();
    }

    if (!res.ok) {
      console.warn(`[GovFeedAdapter] Failed to fetch manifest for ${externalId}: HTTP ${res.status}`);
      return null;
    }

    let manifest = await res.text();
    // Rewrite AES-128 Key URI to route through our proxy endpoint
    manifest = manifest.replace(
      /#EXT-X-KEY:METHOD=AES-128,URI="\/enc\.key"/g,
      '#EXT-X-KEY:METHOD=AES-128,URI="/api/stream/sentinel/enc.key"'
    );
    manifest = manifest.replace(
      /#EXT-X-KEY:METHOD=AES-128,URI="([^"]*enc\.key)"/g,
      '#EXT-X-KEY:METHOD=AES-128,URI="/api/stream/sentinel/enc.key"'
    );

    return manifest;
  }

  /**
   * Fetches the AES-128 decryption key from Sentinel CDN using backend session.
   */
  async getHlsKey(): Promise<Buffer | null> {
    if (!this.baseUrl) return null;
    await this.ensureSession();

    const fetchKey = async () => {
      return fetch(`${this.baseUrl}/enc.key`, {
        signal: AbortSignal.timeout(8000),
        headers: this.cookieHeaders(),
      });
    };

    let res = await fetchKey();
    if (res.status === 401 || res.status === 403) {
      this.sessionCookie = '';
      await this.ensureSession();
      res = await fetchKey();
    }

    if (!res.ok) {
      console.warn(`[GovFeedAdapter] Failed to fetch AES key: HTTP ${res.status}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Fetches a TS video segment from Sentinel CDN using backend session.
   */
  async getHlsSegment(externalId: string, segment: string): Promise<{ data: Buffer; contentType: string } | null> {
    if (!this.baseUrl) return null;
    await this.ensureSession();

    const fetchSeg = async () => {
      return fetch(`${this.baseUrl}/${externalId}/${segment}`, {
        signal: AbortSignal.timeout(12000),
        headers: this.cookieHeaders(),
      });
    };

    let res = await fetchSeg();
    if (res.status === 401 || res.status === 403) {
      this.sessionCookie = '';
      await this.ensureSession();
      res = await fetchSeg();
    }

    if (!res.ok) {
      console.warn(`[GovFeedAdapter] Failed to fetch segment ${segment} for ${externalId}: HTTP ${res.status}`);
      return null;
    }

    const contentType = res.headers.get('content-type') || 'video/mp2t';
    const arrayBuffer = await res.arrayBuffer();
    return { data: Buffer.from(arrayBuffer), contentType };
  }


  // ─── Canonical mapping helpers ───────────────────────────────────────────

  /**
   * Maps a /cameras.json entry { id, name } to canonical metadata.
   * GPS coordinates are inferred from well-known Gujarat locations.
   */
  private toCanonicalFromCatalogue(item: { id: string; name: string }): CanonicalCameraMetadata {
    const extId = item.id;
    const coords = SENTINEL_CAM_COORDS[extId];

    return {
      externalCameraId: extId,
      vmsSystemId: this.id,
      name: item.name,
      status: 'online',
      latitude: coords?.lat,
      longitude: coords?.lng,
      streamPath: this.hlsUrl(extId),
      capabilities: {
        live: true,
        events: true,
        ptz: false,
        anpr: true,
        codec: 'h264',
        rtspUrl: this.rtspUrl(extId),
        whepUrl: this.whepUrl(extId),
        hlsUrl: this.hlsUrl(extId),
      },
      raw: item as unknown as Record<string, unknown>,
    };
  }

  private toCanonicalFromStatic(f: SentinelFeedDescriptor): CanonicalCameraMetadata {
    const extId = String(f.externalId ?? f.id ?? 'GOV-01');
    const lat = f.lat ?? f.latitude;
    const lng = f.lng ?? f.longitude;

    return {
      externalCameraId: extId,
      vmsSystemId: this.id,
      name: f.name || `Government Feed ${extId}`,
      status: (f.status === 'offline' ? 'offline' : 'online') as 'online' | 'offline',
      latitude: lat,
      longitude: lng,
      streamPath: f.url || f.urls?.hls || f.urls?.whep || f.urls?.rtsp,
      capabilities: {
        live: true,
        events: false,
        ptz: false,
        anpr: true,
        codec: f.codec || 'h264',
        rtspUrl: f.urls?.rtsp,
        whepUrl: f.urls?.whep,
        hlsUrl: f.urls?.hls,
      },
      raw: f as unknown as Record<string, unknown>,
    };
  }
}

/**
 * GPS coordinates for all 30 Sentinel cameras.
 * Derived from camera names (city/landmark mapping for Gujarat).
 */
const SENTINEL_CAM_COORDS: Record<string, { lat: number; lng: number }> = {
  cam01: { lat: 23.0225, lng: 72.5714 },  // Chimanbhai Bridge, Ahmedabad
  cam02: { lat: 23.0300, lng: 72.5800 },  // Janpath, Ahmedabad
  cam03: { lat: 23.0395, lng: 72.5519 },  // ONGC Office, Ahmedabad
  cam04: { lat: 23.0069, lng: 72.5620 },  // Paldi Circle, Ahmedabad
  cam05: { lat: 23.0951, lng: 72.6011 },  // Visat Teen Rasta, Ahmedabad
  cam06: { lat: 21.5222, lng: 70.4579 },  // Timbavadi Gate, Junagadh
  cam07: { lat: 20.9078, lng: 70.3730 },  // Hero Showroom, Gir Somnath
  cam08: { lat: 21.5220, lng: 70.4630 },  // Majewadi Gate, Junagadh
  cam09: { lat: 21.5370, lng: 70.4720 },  // New Bypass, Junagadh
  cam10: { lat: 21.5280, lng: 70.4560 },  // Char Chowk Road, Junagadh
  cam11: { lat: 21.5190, lng: 70.4510 },  // Dolatpara, Junagadh
  cam12: { lat: 23.1657, lng: 72.4822 },  // Tri Mandir Adalaj Tollnaka
  cam13: { lat: 23.0225, lng: 72.5714 },  // CN Vidhyalaya, Ahmedabad
  cam14: { lat: 23.0700, lng: 72.5850 },  // Delight RLVD, Ahmedabad
  cam15: { lat: 23.0450, lng: 72.5780 },  // Suvidha Park, Ahmedabad
  cam16: { lat: 23.1050, lng: 72.6200 },  // Visat P2, Ahmedabad
  cam17: { lat: 22.3039, lng: 70.8022 },  // Rajkot Bus Port
  cam18: { lat: 22.3119, lng: 70.7952 },  // Rajkot CCTV
  cam19: { lat: 20.7924, lng: 72.9616 },  // Khaparia, Navsari
  cam20: { lat: 22.4710, lng: 70.0680 },  // Mohanpura
  cam21: { lat: 23.8497, lng: 72.1320 },  // Patan Dethali Char Rasta
  cam22: { lat: 23.6300, lng: 72.1900 },  // BK Mervada, Gujarat
  cam23: { lat: 23.6100, lng: 72.5600 },  // Kheram
  cam24: { lat: 23.1786, lng: 73.1805 },  // Dehgam
  cam25: { lat: 23.1600, lng: 73.1500 },  // Dhanori
  cam26: { lat: 23.6130, lng: 72.5500 },  // Tankal
  cam27: { lat: 20.7710, lng: 72.9670 },  // Bilimora (1)
  cam28: { lat: 20.7720, lng: 72.9680 },  // Bilimora (2)
  cam29: { lat: 20.7730, lng: 72.9690 },  // Bilimora (3)
  cam30: { lat: 23.0720, lng: 70.1305 },  // Gandhidham Rambaugh
};
