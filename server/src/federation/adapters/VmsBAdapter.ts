import { BaseAdapter } from './BaseAdapter';
import { AdapterType, CanonicalCameraMetadata } from '../types';

/**
 * Adapter for VMS-B: event/webhook oriented vendor API.
 * Different ID scheme and event push model than VMS-A (heterogeneity demo).
 */
export class VmsBAdapter extends BaseAdapter {
  readonly id: string;
  readonly type: AdapterType = 'vms_b_events';
  readonly displayName = 'VMS-B Events Adapter';
  private baseUrl: string;

  constructor(systemId: string, baseUrl: string) {
    super();
    this.id = systemId;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async connect(): Promise<void> {
    const health = await this.healthCheck();
    if (!health.ok) throw new Error(`VMS-B connect failed: ${health.detail}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.stopEventIngest();
    this.connected = false;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/status`);
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      return { ok: true, detail: 'VMS-B reachable' };
    } catch (err: any) {
      return { ok: false, detail: err.message };
    }
  }

  async listCameras(): Promise<CanonicalCameraMetadata[]> {
    const res = await fetch(`${this.baseUrl}/v1/devices`);
    if (!res.ok) throw new Error(`VMS-B listCameras failed: ${res.status}`);
    const body = (await res.json()) as { devices: any[] };
    return (body.devices || []).map((d) => this.toCanonical(d));
  }

  async getCamera(externalId: string): Promise<CanonicalCameraMetadata | null> {
    const all = await this.listCameras();
    return all.find((c) => c.externalCameraId === externalId) || null;
  }

  async requestStream(externalId: string) {
    const res = await fetch(`${this.baseUrl}/v1/devices/${encodeURIComponent(externalId)}/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'mjpeg' }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { feedUrl: string; ttl: number };
    return {
      url: data.feedUrl,
      protocol: 'hls' as const,
      expiresInSec: data.ttl || 180,
    };
  }

  async startEventIngest(onEvent: Parameters<BaseAdapter['startEventIngest']>[0]): Promise<void> {
    await super.startEventIngest(onEvent);
    // Subscribe to VMS-B event feed (long-poll simulation)
    this.ingestTimer = setInterval(async () => {
      try {
        const res = await fetch(`${this.baseUrl}/v1/events/poll?limit=5`);
        if (!res.ok) return;
        const body = (await res.json()) as { events: any[] };
        for (const ev of body.events || []) {
          this.emit({
            eventType: ev.type === 'plate' ? 'PlateDetected' : 'AnalyticsEvent',
            vmsSystemId: this.id,
            externalCameraId: ev.deviceId,
            severity: ev.priority === 'high' ? 'high' : 'info',
            payload: {
              plate: ev.plate,
              confidence: ev.confidence,
              vendorEventId: ev.id,
              rawType: ev.type,
            },
            occurredAt: ev.ts || new Date().toISOString(),
          });
        }
      } catch (err: any) {
        this.emit({
          eventType: 'AdapterError',
          vmsSystemId: this.id,
          severity: 'medium',
          payload: { message: err.message },
          occurredAt: new Date().toISOString(),
        });
      }
    }, 8000);
  }

  private toCanonical(d: any): CanonicalCameraMetadata {
    return {
      externalCameraId: d.deviceId || d.id,
      vmsSystemId: this.id,
      name: d.deviceName || d.name,
      status: d.state === 'UP' ? 'online' : d.state === 'DOWN' ? 'offline' : 'maintenance',
      latitude: d.geo?.lat,
      longitude: d.geo?.lon,
      streamPath: d.livePath,
      capabilities: { live: true, events: true, ptz: false, anpr: true },
      raw: d,
    };
  }
}
