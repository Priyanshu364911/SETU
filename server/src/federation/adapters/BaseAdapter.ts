import {
  AdapterType,
  CanonicalCameraMetadata,
  CanonicalEvent,
  VmsAdapter,
} from '../types';

export abstract class BaseAdapter implements VmsAdapter {
  abstract readonly id: string;
  abstract readonly type: AdapterType;
  abstract readonly displayName: string;

  protected connected = false;
  protected ingestTimer: NodeJS.Timeout | null = null;
  protected onEvent: ((event: CanonicalEvent) => void | Promise<void>) | null = null;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract healthCheck(): Promise<{ ok: boolean; detail?: string }>;
  abstract listCameras(): Promise<CanonicalCameraMetadata[]>;
  abstract getCamera(externalId: string): Promise<CanonicalCameraMetadata | null>;
  abstract requestStream(externalId: string): Promise<{
    url: string;
    protocol: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
    expiresInSec: number;
  } | null>;

  async startEventIngest(onEvent: (event: CanonicalEvent) => void | Promise<void>): Promise<void> {
    this.onEvent = onEvent;
  }

  async stopEventIngest(): Promise<void> {
    if (this.ingestTimer) {
      clearInterval(this.ingestTimer);
      this.ingestTimer = null;
    }
    this.onEvent = null;
  }

  protected emit(event: CanonicalEvent) {
    if (this.onEvent) {
      void Promise.resolve(this.onEvent(event));
    }
  }
}
