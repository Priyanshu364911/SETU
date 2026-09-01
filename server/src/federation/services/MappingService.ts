import { query } from '../../db';
import { CameraVmsBinding } from '../types';

export class MappingService {
  async listBindings(cameraId?: string): Promise<CameraVmsBinding[]> {
    if (cameraId) {
      const result = await query(
        `SELECT * FROM camera_vms_bindings WHERE camera_id = $1 ORDER BY created_at`,
        [cameraId]
      );
      return result.rows;
    }
    const result = await query(`SELECT * FROM camera_vms_bindings ORDER BY created_at DESC LIMIT 500`);
    return result.rows;
  }

  async createBinding(input: {
    camera_id: string;
    vms_system_id: string;
    external_camera_id: string;
    stream_path?: string;
    capabilities?: Record<string, unknown>;
  }): Promise<CameraVmsBinding> {
    const cam = await query(`SELECT id FROM cameras WHERE id = $1`, [input.camera_id]);
    if (!cam.rows[0]) throw Object.assign(new Error('Camera not found'), { status: 404 });

    const vms = await query(`SELECT id FROM vms_systems WHERE id = $1`, [input.vms_system_id]);
    if (!vms.rows[0]) throw Object.assign(new Error('VMS system not found'), { status: 404 });

    const result = await query(
      `INSERT INTO camera_vms_bindings
         (camera_id, vms_system_id, external_camera_id, stream_path, capabilities)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (camera_id, vms_system_id) DO UPDATE SET
         external_camera_id = EXCLUDED.external_camera_id,
         stream_path = EXCLUDED.stream_path,
         capabilities = EXCLUDED.capabilities,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING *`,
      [
        input.camera_id,
        input.vms_system_id,
        input.external_camera_id,
        input.stream_path || null,
        JSON.stringify(input.capabilities || { live: true, events: true }),
      ]
    );
    return result.rows[0];
  }

  async deleteBinding(id: string): Promise<void> {
    await query(`UPDATE camera_vms_bindings SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
  }

  async resolveByExternal(vmsSystemId: string, externalCameraId: string): Promise<string | null> {
    const result = await query(
      `SELECT camera_id FROM camera_vms_bindings
       WHERE vms_system_id = $1 AND external_camera_id = $2 AND is_active = TRUE`,
      [vmsSystemId, externalCameraId]
    );
    return result.rows[0]?.camera_id || null;
  }

  /**
   * Auto-map unbound simulator cameras to nearest approved registry cameras
   * (demo helper — creates bindings for first N unmatched cameras).
   */
  async autoMapDemo(): Promise<{ created: number }> {
    const unbound = await query(
      `SELECT e.vms_system_id, e.external_camera_id, e.payload
       FROM federated_events e
       WHERE e.event_type = 'CameraMetadataUpdated'
         AND e.external_camera_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM camera_vms_bindings b
           WHERE b.vms_system_id = e.vms_system_id
             AND b.external_camera_id = e.external_camera_id
             AND b.is_active = TRUE
         )
       ORDER BY e.ingested_at DESC
       LIMIT 20`
    );

    const registry = await query(
      `SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM cameras WHERE onboarding_status = 'Approved'
       ORDER BY id LIMIT 200`
    );

    let created = 0;
    const usedCameras = new Set<string>();

    for (const row of unbound.rows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const lat = payload?.latitude ?? payload?.lat;
      const lng = payload?.longitude ?? payload?.lng;

      let best: { id: string; dist: number } | null = null;
      for (const cam of registry.rows) {
        if (usedCameras.has(cam.id)) continue;
        const dist =
          lat != null && lng != null
            ? Math.hypot(parseFloat(cam.lat) - Number(lat), parseFloat(cam.lng) - Number(lng))
            : Math.random();
        if (!best || dist < best.dist) best = { id: cam.id, dist };
      }
      if (!best) break;

      await this.createBinding({
        camera_id: best.id,
        vms_system_id: row.vms_system_id,
        external_camera_id: row.external_camera_id,
        stream_path: payload?.streamPath,
        capabilities: payload?.capabilities,
      });
      usedCameras.add(best.id);
      created++;
    }

    return { created };
  }
}

export const mappingService = new MappingService();
export default mappingService;
