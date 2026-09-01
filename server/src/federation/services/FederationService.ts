import { query } from '../../db';
import eventBus from '../bus/EventBus';
import adapterRegistry from '../adapters/AdapterRegistry';
import {
  CanonicalEvent,
  ConnectorStatus,
  FederatedCameraView,
  FederatedEventRecord,
  VmsSystemRecord,
} from '../types';

export class FederationService {
  /**
   * Persist canonical event, resolve registry camera_id via binding, publish on bus.
   */
  async ingestEvent(event: CanonicalEvent): Promise<FederatedEventRecord> {
    let cameraId = event.cameraId || null;

    if (!cameraId && event.externalCameraId && event.vmsSystemId) {
      const bind = await query(
        `SELECT camera_id FROM camera_vms_bindings
         WHERE vms_system_id = $1 AND external_camera_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [event.vmsSystemId, event.externalCameraId]
      );
      if (bind.rows[0]) cameraId = bind.rows[0].camera_id;
    }

    const result = await query(
      `INSERT INTO federated_events
         (event_type, vms_system_id, camera_id, external_camera_id, severity, payload, occurred_at, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        event.eventType,
        event.vmsSystemId,
        cameraId,
        event.externalCameraId || null,
        event.severity || 'info',
        JSON.stringify(event.payload || {}),
        event.occurredAt || new Date().toISOString(),
        event.correlationId || null,
      ]
    );

    const record = this.mapEvent(result.rows[0]);
    const enriched: CanonicalEvent = {
      ...event,
      id: record.id,
      cameraId,
    };
    await eventBus.publish('federation.events', enriched);
    await eventBus.publish(`federation.events.${event.eventType}`, enriched);
    return record;
  }

  async listSystems(): Promise<(VmsSystemRecord & { camera_count: number })[]> {
    const result = await query(
      `SELECT v.*,
              (SELECT COUNT(*)::int FROM camera_vms_bindings b WHERE b.vms_system_id = v.id AND b.is_active) AS camera_count
       FROM vms_systems v
       ORDER BY v.name`
    );
    return result.rows;
  }

  async getConnectorStatuses(): Promise<ConnectorStatus[]> {
    const systems = await this.listSystems();
    const statuses: ConnectorStatus[] = [];
    for (const s of systems) {
      const events = await query(
        `SELECT COUNT(*)::int AS c FROM federated_events
         WHERE vms_system_id = $1 AND ingested_at > NOW() - INTERVAL '1 hour'`,
        [s.id]
      );
      statuses.push({
        vmsSystemId: s.id,
        name: s.name,
        vendor: s.vendor,
        adapterType: s.adapter_type,
        status: s.status,
        lastSyncAt: s.last_sync_at ? new Date(s.last_sync_at).toISOString() : null,
        cameraCount: s.camera_count,
        recentEventCount: events.rows[0]?.c || 0,
      });
    }
    return statuses;
  }

  async updateSystemStatus(id: string, status: string, lastSync = true) {
    await query(
      `UPDATE vms_systems SET status = $2, last_sync_at = CASE WHEN $3 THEN NOW() ELSE last_sync_at END, updated_at = NOW()
       WHERE id = $1`,
      [id, status, lastSync]
    );
  }

  async listFederatedCameras(): Promise<FederatedCameraView[]> {
    // 1. DB-registered cameras (camera_vms_bindings joined to cameras table)
    const result = await query(
      `SELECT c.id AS camera_id, c.name, c.department_id, c.district_id, c.status,
              ST_Y(c.location::geometry) AS latitude,
              ST_X(c.location::geometry) AS longitude,
              b.vms_system_id, v.name AS vms_name, b.external_camera_id,
              b.stream_path, b.stream_path IS NOT NULL AS stream_available,
              b.capabilities
       FROM camera_vms_bindings b
       JOIN cameras c ON c.id = b.camera_id
       JOIN vms_systems v ON v.id = b.vms_system_id
       WHERE b.is_active = TRUE AND c.onboarding_status = 'Approved'
       ORDER BY c.id`
    );
    const dbCameras: FederatedCameraView[] = result.rows.map((r: any) => ({
      cameraId: r.camera_id,
      name: r.name,
      departmentId: r.department_id,
      districtId: r.district_id,
      status: r.status,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      vmsSystemId: r.vms_system_id,
      vmsName: r.vms_name,
      externalCameraId: r.external_camera_id,
      streamPath: r.stream_path,
      streamAvailable: r.stream_available,
      capabilities: r.capabilities || {},
    }));

    // 2. Live Sentinel cameras pulled directly from the adapter (no DB join needed)
    // These appear as-is from /cameras.json — all 30 cameras, always fresh.
    const liveAdapterCameras: FederatedCameraView[] = [];
    try {
      const govAdapter = adapterRegistry.get('gov-feeds');
      if (govAdapter) {
        const liveCams = await govAdapter.listCameras();
        for (const cam of liveCams) {
          // Skip if already present via DB binding
          if (dbCameras.some((d) => d.externalCameraId === cam.externalCameraId)) continue;
          const caps = cam.capabilities || {};
          liveAdapterCameras.push({
            cameraId: cam.externalCameraId,       // use external ID as display ID
            name: cam.name,
            departmentId: null as any,
            districtId: null as any,
            status: cam.status || 'online',
            latitude: cam.latitude ?? null as any,
            longitude: cam.longitude ?? null as any,
            vmsSystemId: cam.vmsSystemId,
            vmsName: 'Sentinel Camera Grid',
            externalCameraId: cam.externalCameraId,
            streamPath: cam.streamPath ?? null as any,
            streamAvailable: !!cam.streamPath,
            capabilities: caps,
          });
        }
      }
    } catch (_) {
      // Non-fatal — DB cameras still returned
    }

    return [...dbCameras, ...liveAdapterCameras];
  }

  async listEvents(opts: {
    page?: number;
    pageSize?: number;
    eventType?: string;
    cameraId?: string;
    vmsSystemId?: string;
  }): Promise<{ data: FederatedEventRecord[]; total: number }> {
    const page = opts.page || 1;
    const pageSize = Math.min(opts.pageSize || 50, 200);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (opts.eventType) {
      conditions.push(`event_type = $${i++}`);
      params.push(opts.eventType);
    }
    if (opts.cameraId) {
      conditions.push(`camera_id = $${i++}`);
      params.push(opts.cameraId);
    }
    if (opts.vmsSystemId) {
      conditions.push(`vms_system_id = $${i++}`);
      params.push(opts.vmsSystemId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM federated_events ${where}`, params);
    const dataRes = await query(
      `SELECT * FROM federated_events ${where}
       ORDER BY occurred_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, pageSize, offset]
    );

    return {
      data: dataRes.rows.map((r: any) => this.mapEvent(r)),
      total: countRes.rows[0].total,
    };
  }

  async syncSystem(systemId: string): Promise<{ imported: number }> {
    const sysRes = await query(`SELECT * FROM vms_systems WHERE id = $1`, [systemId]);
    if (!sysRes.rows[0]) throw new Error('VMS system not found');
    const sys = sysRes.rows[0];

    let adapter = adapterRegistry.get(systemId);
    if (!adapter) {
      adapter = adapterRegistry.create(sys.adapter_type, sys.id, sys.base_url, sys.config);
      adapterRegistry.register(adapter);
    }

    await this.updateSystemStatus(systemId, 'syncing', false);
    try {
      await adapter.connect();
      const cameras = await adapter.listCameras();
      for (const cam of cameras) {
        await this.ingestEvent({
          eventType: 'CameraMetadataUpdated',
          vmsSystemId: systemId,
          externalCameraId: cam.externalCameraId,
          severity: 'info',
          payload: cam as unknown as Record<string, unknown>,
          occurredAt: new Date().toISOString(),
        });
      }
      await this.updateSystemStatus(systemId, 'connected', true);
      return { imported: cameras.length };
    } catch (err) {
      await this.updateSystemStatus(systemId, 'error', false);
      throw err;
    }
  }

  /**
   * Bootstrap adapters for all registered systems and start event ingest.
   */
  async startAllAdapters(onPlate?: (event: CanonicalEvent) => Promise<void>): Promise<void> {
    const systems = await query(`SELECT * FROM vms_systems`);
    for (const sys of systems.rows) {
      try {
        let adapter = adapterRegistry.get(sys.id);
        if (!adapter) {
          adapter = adapterRegistry.create(sys.adapter_type, sys.id, sys.base_url, sys.config || {});
          adapterRegistry.register(adapter);
        }
        await adapter.connect();
        await adapter.startEventIngest(async (event) => {
          const record = await this.ingestEvent(event);
          if (event.eventType === 'PlateDetected' && onPlate) {
            await onPlate({ ...event, id: record.id, cameraId: record.camera_id });
          }
        });
        await this.updateSystemStatus(sys.id, 'connected', true);
        console.log(`[Federation] Adapter started: ${sys.id} (${sys.adapter_type})`);
      } catch (err: any) {
        console.warn(`[Federation] Adapter start failed for ${sys.id}:`, err.message);
        await this.updateSystemStatus(sys.id, 'disconnected', false);
      }
    }
  }

  private mapEvent(row: any): FederatedEventRecord {
    return {
      id: row.id,
      event_type: row.event_type,
      vms_system_id: row.vms_system_id,
      camera_id: row.camera_id,
      external_camera_id: row.external_camera_id,
      severity: row.severity,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {},
      occurred_at: row.occurred_at,
      ingested_at: row.ingested_at,
      correlation_id: row.correlation_id,
    };
  }
}

export const federationService = new FederationService();
export default federationService;
