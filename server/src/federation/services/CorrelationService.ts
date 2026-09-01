import { query } from '../../db';
import { CanonicalEvent, CorrelationTrack } from '../types';

/**
 * Cross-system event correlation — joins plate/entity sightings across cameras/VMS.
 */
export class CorrelationService {
  private readonly windowMinutes = 120;

  async correlatePlateEvent(event: CanonicalEvent & { id?: string }): Promise<CorrelationTrack | null> {
    const plate = String(event.payload?.plate || '')
      .toUpperCase()
      .replace(/[\s-]/g, '');
    if (!plate || plate.length < 4) return null;

    const cameraId = event.cameraId;
    if (!cameraId || !event.id) return null;

    const existing = await query(
      `SELECT * FROM correlation_tracks
       WHERE entity_type = 'vehicle_plate'
         AND upper(replace(replace(entity_value, ' ', ''), '-', '')) = $1
         AND last_seen_at > NOW() - ($2 || ' minutes')::interval
       ORDER BY last_seen_at DESC
       LIMIT 1`,
      [plate, String(this.windowMinutes)]
    );

    if (existing.rows[0]) {
      const track = existing.rows[0];
      const cameraIds: string[] = Array.from(new Set([...(track.camera_ids || []), cameraId]));
      const eventIds: string[] = [...(track.event_ids || []), event.id];
      const result = await query(
        `UPDATE correlation_tracks SET
           camera_ids = $2,
           event_ids = $3,
           last_seen_at = $4,
           point_count = $5,
           metadata = metadata || $6::jsonb
         WHERE id = $1
         RETURNING *`,
        [
          track.id,
          cameraIds,
          eventIds,
          event.occurredAt || new Date().toISOString(),
          eventIds.length,
          JSON.stringify({
            last_confidence: event.payload?.confidence,
            last_vms: event.vmsSystemId,
          }),
        ]
      );
      return this.mapTrack(result.rows[0]);
    }

    const result = await query(
      `INSERT INTO correlation_tracks
         (entity_type, entity_value, camera_ids, event_ids, first_seen_at, last_seen_at, point_count, metadata)
       VALUES ('vehicle_plate', $1, $2, $3, $4, $4, 1, $5)
       RETURNING *`,
      [
        plate,
        [cameraId],
        [event.id],
        event.occurredAt || new Date().toISOString(),
        JSON.stringify({
          first_vms: event.vmsSystemId,
          first_confidence: event.payload?.confidence,
        }),
      ]
    );
    return this.mapTrack(result.rows[0]);
  }

  async listTracks(limit = 50): Promise<CorrelationTrack[]> {
    const result = await query(
      `SELECT * FROM correlation_tracks ORDER BY last_seen_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map((r: any) => this.mapTrack(r));
  }

  async getTrack(id: string): Promise<CorrelationTrack | null> {
    const result = await query(`SELECT * FROM correlation_tracks WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapTrack(result.rows[0]) : null;
  }

  /** GIS-ready movement history for a plate / track */
  async getTrackHistory(trackId: string): Promise<
    Array<{
      cameraId: string;
      name: string;
      latitude: number;
      longitude: number;
      occurredAt: string;
      vmsSystemId: string | null;
      plate: string;
    }>
  > {
    const track = await this.getTrack(trackId);
    if (!track) return [];

    const result = await query(
      `SELECT e.id, e.camera_id, e.vms_system_id, e.occurred_at, e.payload,
              c.name,
              ST_Y(c.location::geometry) AS latitude,
              ST_X(c.location::geometry) AS longitude
       FROM federated_events e
       JOIN cameras c ON c.id = e.camera_id
       WHERE e.id = ANY($1::uuid[])
       ORDER BY e.occurred_at ASC`,
      [track.event_ids]
    );

    return result.rows.map((r: any) => ({
      cameraId: r.camera_id,
      name: r.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      occurredAt: new Date(r.occurred_at).toISOString(),
      vmsSystemId: r.vms_system_id,
      plate: track.entity_value,
    }));
  }

  async analyticsReport(): Promise<{
    generatedAt: string;
    totalEvents24h: number;
    plateDetections24h: number;
    uniquePlates24h: number;
    activeTracks: number;
    multiCameraTracks: number;
    eventsByVms: Array<{ vmsSystemId: string; count: number }>;
    topPlates: Array<{ plate: string; sightings: number; cameras: number }>;
  }> {
    const total = await query(
      `SELECT COUNT(*)::int AS c FROM federated_events WHERE ingested_at > NOW() - INTERVAL '24 hours'`
    );
    const plates = await query(
      `SELECT COUNT(*)::int AS c FROM federated_events
       WHERE event_type = 'PlateDetected' AND ingested_at > NOW() - INTERVAL '24 hours'`
    );
    const unique = await query(
      `SELECT COUNT(DISTINCT upper(payload->>'plate'))::int AS c FROM federated_events
       WHERE event_type = 'PlateDetected' AND ingested_at > NOW() - INTERVAL '24 hours'
         AND payload->>'plate' IS NOT NULL`
    );
    const tracks = await query(
      `SELECT COUNT(*)::int AS c FROM correlation_tracks WHERE last_seen_at > NOW() - INTERVAL '24 hours'`
    );
    const multi = await query(
      `SELECT COUNT(*)::int AS c FROM correlation_tracks
       WHERE last_seen_at > NOW() - INTERVAL '24 hours' AND point_count > 1`
    );
    const byVms = await query(
      `SELECT vms_system_id, COUNT(*)::int AS count FROM federated_events
       WHERE ingested_at > NOW() - INTERVAL '24 hours' AND vms_system_id IS NOT NULL
       GROUP BY vms_system_id ORDER BY count DESC`
    );
    const top = await query(
      `SELECT entity_value AS plate, point_count AS sightings, cardinality(camera_ids) AS cameras
       FROM correlation_tracks
       ORDER BY last_seen_at DESC LIMIT 10`
    );

    return {
      generatedAt: new Date().toISOString(),
      totalEvents24h: total.rows[0].c,
      plateDetections24h: plates.rows[0].c,
      uniquePlates24h: unique.rows[0].c,
      activeTracks: tracks.rows[0].c,
      multiCameraTracks: multi.rows[0].c,
      eventsByVms: byVms.rows.map((r: any) => ({
        vmsSystemId: r.vms_system_id,
        count: r.count,
      })),
      topPlates: top.rows.map((r: any) => ({
        plate: r.plate,
        sightings: r.sightings,
        cameras: r.cameras,
      })),
    };
  }

  private mapTrack(row: any): CorrelationTrack {
    return {
      id: row.id,
      entity_type: row.entity_type,
      entity_value: row.entity_value,
      camera_ids: row.camera_ids || [],
      event_ids: row.event_ids || [],
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      point_count: row.point_count,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      created_at: row.created_at,
    };
  }
}

export const correlationService = new CorrelationService();
export default correlationService;
