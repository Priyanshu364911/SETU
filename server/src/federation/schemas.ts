import { z } from 'zod';

export const CanonicalEventSchema = z.object({
  eventType: z.enum([
    'CameraMetadataUpdated',
    'CameraHealthChanged',
    'StreamAvailable',
    'AnalyticsEvent',
    'PlateDetected',
    'WatchlistMatch',
    'SystemHeartbeat',
    'AdapterError',
  ]),
  vmsSystemId: z.string().min(1),
  cameraId: z.string().nullable().optional(),
  externalCameraId: z.string().nullable().optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  correlationId: z.string().uuid().nullable().optional(),
});

export const BindingCreateSchema = z.object({
  camera_id: z.string().regex(/^GJ-[A-Z]{2,6}-\d{6}$/),
  vms_system_id: z.string().min(1),
  external_camera_id: z.string().min(1).max(100),
  stream_path: z.string().max(500).optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
});

export const WatchlistCreateSchema = z.object({
  entity_type: z.enum([
    'stolen_vehicle',
    'blacklisted_vehicle',
    'wanted_person',
    'missing_person',
    'suspect',
    'other',
  ]),
  entity_value: z.string().min(1).max(100),
  display_name: z.string().max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  source: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AlertAckSchema = z.object({
  note: z.string().max(500).optional(),
});

export const PlateDetectSchema = z.object({
  camera_id: z.string().regex(/^GJ-[A-Z]{2,6}-\d{6}$/),
  plate: z.string().min(3).max(20),
  confidence: z.number().min(0).max(1).optional(),
  occurred_at: z.string().optional(),
});

export const StreamRequestSchema = z.object({
  camera_id: z.string().regex(/^GJ-[A-Z]{2,6}-\d{6}$/),
});
