import { BaseAdapter } from './BaseAdapter';
import { AdapterType, CanonicalCameraMetadata } from '../types';

/**
 * Adapter for VMS-A: REST inventory + health polling.
 * Simulates a typical municipal/cloud VMS with JSON REST API.
 */
export class VmsAAdapter extends BaseAdapter {
  readonly id: string;
  readonly type: AdapterType = 'vms_a_rest';
  readonly displayName = 'VMS-A REST Adapter';
  private baseUrl: string;

  constructor(systemId: string, baseUrl: string) {
    super();
    this.id = systemId;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async connect(): Promise<void> {
    const health = await this.healthCheck();
    if (!health.ok) throw new Error(`VMS-A connect failed: ${health.detail}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.stopEventIngest();
    this.connected = false;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      return { ok: true, detail: 'VMS-A reachable' };
    } catch (err: any) {
      return { ok: false, detail: err.message };
    }
  }

  async listCameras(): Promise<CanonicalCameraMetadata[]> {
    const res = await fetch(`${this.baseUrl}/api/cameras`);
    if (!res.ok) throw new Error(`VMS-A listCameras failed: ${res.status}`);
    const data = (await res.json()) as any[];
    return data.map((c) => this.toCanonical(c));
  }

  async getCamera(externalId: string): Promise<CanonicalCameraMetadata | null> {
    const res = await fetch(`${this.baseUrl}/api/cameras/${encodeURIComponent(externalId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`VMS-A getCamera failed: ${res.status}`);
    return this.toCanonical(await res.json());
  }

  async requestStream(externalId: string) {
    const res = await fetch(`${this.baseUrl}/api/cameras/${encodeURIComponent(externalId)}/stream`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url: string; protocol: string; expiresInSec: number };
    return {
      url: data.url,
      protocol: (data.protocol as 'hls' | 'snapshot') || 'snapshot',
      expiresInSec: data.expiresInSec || 300,
    };
  }

  async startEventIngest(onEvent: Parameters<BaseAdapter['startEventIngest']>[0]): Promise<void> {
    await super.startEventIngest(onEvent);
    // Poll health every 15s and emit CameraHealthChanged
    this.ingestTimer = setInterval(async () => {
      try {
        const cameras = await this.listCameras();
        for (const cam of cameras.slice(0, 3)) {
          this.emit({
            eventType: 'CameraHealthChanged',
            vmsSystemId: this.id,
            externalCameraId: cam.externalCameraId,
            severity: cam.status === 'online' ? 'info' : 'medium',
            payload: { status: cam.status, source: 'vms_a_poll' },
            occurredAt: new Date().toISOString(),
          });
        }
        this.emit({
          eventType: 'SystemHeartbeat',
          vmsSystemId: this.id,
          severity: 'info',
          payload: { cameraCount: cameras.length },
          occurredAt: new Date().toISOString(),
        });
      } catch (err: any) {
        this.emit({
          eventType: 'AdapterError',
          vmsSystemId: this.id,
          severity: 'high',
          payload: { message: err.message },
          occurredAt: new Date().toISOString(),
        });
      }
    }, 15000);
  }

  private toCanonical(c: any): CanonicalCameraMetadata {
    return {
      externalCameraId: c.id || c.cameraId,
      vmsSystemId: this.id,
      name: c.name || c.label || c.id,
      status: (c.status || 'online').toLowerCase(),
      latitude: c.lat ?? c.latitude,
      longitude: c.lng ?? c.longitude,
      streamPath: c.streamPath || c.stream_url,
      capabilities: { live: true, events: true, ptz: !!c.ptz, anpr: !!c.anpr },
      raw: c,
    };
  }
}
