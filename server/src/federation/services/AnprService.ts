import { query } from '../../db';
import federationService from './FederationService';
import correlationService from './CorrelationService';
import watchlistService from './WatchlistService';
import { AlertRecord, CanonicalEvent, CorrelationTrack } from '../types';

export class AnprService {
  /**
   * Shared plate pipeline used by both adapter callbacks and the manual inject endpoint.
   * Requires an active camera_vms_bindings row for the given camera_id.
   */
  async detectPlate(input: {
    cameraId: string;
    plate: string;
    confidence?: number;
    occurredAt?: string;
    vmsSystemId?: string;
  }): Promise<{
    event: { id: string };
    track: CorrelationTrack | null;
    alert: AlertRecord | null;
    matched: boolean;
  }> {
    const plate = input.plate.toUpperCase().replace(/[\s-]/g, '');

    // Resolve VMS binding to get vmsSystemId + externalCameraId
    let vmsSystemId = input.vmsSystemId;
    let externalCameraId: string | null = null;

    if (!vmsSystemId) {
      const bindResult = await query(
        `SELECT vms_system_id, external_camera_id FROM camera_vms_bindings
         WHERE camera_id = $1 AND is_active = TRUE LIMIT 1`,
        [input.cameraId]
      );
      if (!bindResult.rows[0]) {
        throw Object.assign(
          new Error(`No active VMS binding for camera ${input.cameraId}. Provide vms_system_id in body or bind the camera first.`),
          { status: 422 }
        );
      }
      vmsSystemId = bindResult.rows[0].vms_system_id;
      externalCameraId = bindResult.rows[0].external_camera_id;
    }

    const occurredAt = input.occurredAt || new Date().toISOString();

    // Step 1: Ingest canonical PlateDetected event
    const plateEvent: CanonicalEvent = {
      eventType: 'PlateDetected',
      vmsSystemId: vmsSystemId!,
      cameraId: input.cameraId,
      externalCameraId,
      severity: 'info',
      payload: {
        plate,
        confidence: input.confidence ?? null,
        source: 'anpr_inject',
      },
      occurredAt,
    };

    const eventRecord = await federationService.ingestEvent(plateEvent);

    // Step 2: Correlate to a track
    const enrichedEvent: CanonicalEvent & { id: string } = {
      ...plateEvent,
      id: eventRecord.id,
    };
    const track = await correlationService.correlatePlateEvent(enrichedEvent);

    // Step 3: Watchlist match + alert dedupe
    const alert = await watchlistService.matchPlate({
      plate,
      cameraId: input.cameraId,
      eventId: eventRecord.id,
      trackId: track?.id || null,
      vmsSystemId: vmsSystemId!,
      confidence: input.confidence,
    });

    return {
      event: { id: eventRecord.id },
      track,
      alert,
      matched: alert !== null,
    };
  }
}

export const anprService = new AnprService();
export default anprService;
