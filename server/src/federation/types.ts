/**
 * Model 3 Federation — Canonical contracts
 * Event schemas, adapter interface types, northbound API shapes.
 */

export type AdapterType = 'vms_a_rest' | 'vms_b_events' | 'gov_feed' | 'onvif_rtsp';

export type VmsSystemStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export type CanonicalEventType =
  | 'CameraMetadataUpdated'
  | 'CameraHealthChanged'
  | 'StreamAvailable'
  | 'AnalyticsEvent'
  | 'PlateDetected'
  | 'WatchlistMatch'
  | 'SystemHeartbeat'
  | 'AdapterError';

export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type WatchlistEntityType =
  | 'stolen_vehicle'
  | 'blacklisted_vehicle'
  | 'wanted_person'
  | 'missing_person'
  | 'suspect'
  | 'other';

export type AlertStatus = 'open' | 'acknowledged' | 'closed';

/** Canonical camera metadata exchanged on the federation bus */
export interface CanonicalCameraMetadata {
  externalCameraId: string;
  vmsSystemId: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  latitude?: number;
  longitude?: number;
  streamPath?: string;
  capabilities?: {
    live?: boolean;
    events?: boolean;
    ptz?: boolean;
    anpr?: boolean;
    codec?: string;
    fps?: number;
    resolution?: string;
    rtspUrl?: string;
    whepUrl?: string;
    hlsUrl?: string;
    [key: string]: unknown;
  };
  raw?: Record<string, unknown>;
}

/** Envelope for all federated events */
export interface CanonicalEvent {
  id?: string;
  eventType: CanonicalEventType;
  vmsSystemId: string;
  cameraId?: string | null;
  externalCameraId?: string | null;
  severity?: EventSeverity;
  payload: Record<string, unknown>;
  occurredAt: string; // ISO
  correlationId?: string | null;
}

export interface VmsSystemRecord {
  id: string;
  name: string;
  vendor: string;
  adapter_type: AdapterType;
  base_url: string;
  department_id: string | null;
  status: VmsSystemStatus;
  last_sync_at: Date | null;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CameraVmsBinding {
  id: string;
  camera_id: string;
  vms_system_id: string;
  external_camera_id: string;
  stream_path: string | null;
  capabilities: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FederatedEventRecord {
  id: string;
  event_type: string;
  vms_system_id: string | null;
  camera_id: string | null;
  external_camera_id: string | null;
  severity: EventSeverity;
  payload: Record<string, unknown>;
  occurred_at: Date;
  ingested_at: Date;
  correlation_id: string | null;
}

export interface CorrelationTrack {
  id: string;
  entity_type: string;
  entity_value: string;
  camera_ids: string[];
  event_ids: string[];
  first_seen_at: Date;
  last_seen_at: Date;
  point_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface WatchlistEntry {
  id: string;
  entity_type: WatchlistEntityType;
  entity_value: string;
  display_name: string | null;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AlertRecord {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: AlertStatus;
  camera_id: string | null;
  watchlist_id: string | null;
  event_id: string | null;
  track_id: string | null;
  entity_value: string | null;
  payload: Record<string, unknown>;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
}

export interface StreamSession {
  id: string;
  camera_id: string;
  vms_system_id: string;
  session_token: string;
  stream_url: string;
  protocol: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
  expires_at: Date;
  requested_by: string | null;
  created_at: Date;
}

/** Adapter plugin contract — each VMS vendor implements this */
export interface VmsAdapter {
  readonly id: string;
  readonly type: AdapterType;
  readonly displayName: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
  listCameras(): Promise<CanonicalCameraMetadata[]>;
  getCamera(externalId: string): Promise<CanonicalCameraMetadata | null>;
  /** Request a mediated stream handle (URL/token) for a camera */
  requestStream(externalId: string): Promise<{
    url: string;
    protocol: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
    expiresInSec: number;
  } | null>;
  /** Start polling or webhook listener; emit canonical events via callback */
  startEventIngest(onEvent: (event: CanonicalEvent) => void | Promise<void>): Promise<void>;
  stopEventIngest(): Promise<void>;
}

/** Northbound federation API response shapes */
export interface FederatedCameraView {
  cameraId: string;
  name: string;
  departmentId: string | null;
  districtId: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  vmsSystemId: string;
  vmsName: string;
  externalCameraId: string;
  streamPath: string | null;
  streamAvailable: boolean;
  capabilities: Record<string, unknown>;
}

export interface ConnectorStatus {
  vmsSystemId: string;
  name: string;
  vendor: string;
  adapterType: AdapterType;
  status: VmsSystemStatus;
  lastSyncAt: string | null;
  cameraCount: number;
  recentEventCount: number;
}
