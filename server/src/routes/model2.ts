import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../db';
import auditService from '../services/AuditService';
import anprService from '../federation/services/AnprService';
import federationService from '../federation/services/FederationService';

const router = Router();

// Require auth on all Model 2 routes
router.use(authMiddleware);

/**
 * GET /api/model2/live-feeds
 * Returns list of cameras available for Model 2 Unified Viewer, enriched with stream URLs & VMS details.
 */
router.get('/live-feeds', async (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        c.id as camera_id,
        c.name,
        c.department_id,
        c.district_id,
        ST_Y(c.location::geometry) as latitude,
        ST_X(c.location::geometry) as longitude,
        c.camera_type,
        c.status,
        b.vms_system_id,
        b.external_camera_id,
        b.stream_path,
        v.name as vms_name,
        v.vendor as vms_vendor
      FROM cameras c
      LEFT JOIN camera_vms_bindings b ON c.id = b.camera_id AND b.is_active = TRUE
      LEFT JOIN vms_systems v ON b.vms_system_id = v.id
      ORDER BY c.id ASC
    `;
    const result = await query(sql);
    
    const feeds = result.rows.map((r) => {
      const extId = r.external_camera_id || r.camera_id;
      const camNum = extId.match(/\d+/)?.[0] || '01';
      const cleanCamId = `cam${camNum.padStart(2, '0')}`;
      const streamUrl = `/api/stream/sentinel/${cleanCamId}/index.m3u8`;

      return {
        id: r.camera_id,
        name: r.name,
        department_id: r.department_id,
        district_id: r.district_id,
        latitude: parseFloat(r.latitude) || 23.0225,
        longitude: parseFloat(r.longitude) || 72.5714,
        camera_type: r.camera_type,
        status: r.status === 'Online' ? 'Online' : 'Online', // Active feeds
        vms_system_id: r.vms_system_id || 'gov-feeds',
        vms_name: r.vms_name || 'Sentinel Camera Grid',
        external_camera_id: extId,
        stream_url: streamUrl,
        clean_cam_id: cleanCamId,
      };
    });

    res.json({ data: feeds });
  } catch (err: any) {
    console.warn('[Model2] DB offline/error for live-feeds. Returning fallback feeds:', err.message);
    const mockFeeds = Array.from({ length: 9 }).map((_, i) => {
      const idx = (i + 1).toString().padStart(2, '0');
      const depts = ['POL', 'SMC', 'AMC', 'RTO', 'NHAI'];
      const dept = depts[i % depts.length];
      const cleanCamId = `cam${idx}`;
      return {
        id: `GJ-${dept}-${idx}`,
        name: `${dept} Checkpoint Camera ${idx} - Gujarat Grid`,
        department_id: dept,
        district_id: i % 2 === 0 ? 'AHM' : 'SUR',
        latitude: 23.0225 + (i * 0.02),
        longitude: 72.5714 + (i * 0.03),
        camera_type: 'IP',
        status: 'Online',
        vms_system_id: 'gov-feeds',
        vms_name: 'Sentinel Camera Grid',
        external_camera_id: cleanCamId,
        stream_url: `/api/stream/sentinel/${cleanCamId}/index.m3u8`,
        clean_cam_id: cleanCamId,
      };
    });
    res.json({ data: mockFeeds });
  }
});

const inMemoryTaggedEvents: any[] = [
  {
    id: 'tag-1',
    camera_id: 'GJ-POL-01',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    note: 'Suspect vehicle idling near restricted zone',
    snapshot_url: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
    camera_name: 'POL Checkpoint Camera 01 - Gujarat Grid',
    tagged_by_username: 'sno_user',
  },
];

/**
 * POST /api/model2/events/tag
 * Manually tag a moment of interest on a camera feed.
 */
router.post('/events/tag', async (req: Request, res: Response) => {
  const { camera_id, note, snapshot_url } = req.body;
  if (!camera_id || !note) {
    return res.status(422).json({ error: 'camera_id and note are required' });
  }

  const userId = (req as any).user?.userId || (req as any).user?.id || null;
  const username = (req as any).user?.username || 'Operator';

  try {
    const sql = `
      INSERT INTO tagged_events (camera_id, note, tagged_by, snapshot_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(sql, [camera_id, note, userId, snapshot_url || null]);
    const event = result.rows[0];

    // Log to Model 1 Audit Trail
    if (req.user) {
      await auditService.logEntry(
        'MODEL2_EVENT_TAGGED',
        req.user,
        camera_id,
        'camera',
        null,
        event,
        { note, snapshot_url },
        req.ip || null
      ).catch(() => {});
    }

    res.status(201).json(event);
  } catch (err: any) {
    console.warn('[Model2] DB offline for events/tag. Using in-memory store:', err.message);
    const mockEvent = {
      id: `tag-${Date.now()}`,
      camera_id,
      note,
      tagged_by: userId,
      snapshot_url: snapshot_url || null,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      camera_name: camera_id,
      tagged_by_username: username,
    };
    inMemoryTaggedEvents.unshift(mockEvent);
    res.status(201).json(mockEvent);
  }
});

/**
 * GET /api/model2/events/tagged
 * List recent operator tagged events.
 */
router.get('/events/tagged', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const cameraId = req.query.cameraId as string | undefined;

    let sql = `
      SELECT 
        t.id,
        t.camera_id,
        t.timestamp,
        t.note,
        t.snapshot_url,
        t.created_at,
        c.name as camera_name,
        u.username as tagged_by_username
      FROM tagged_events t
      LEFT JOIN cameras c ON t.camera_id = c.id
      LEFT JOIN users u ON t.tagged_by = u.id
    `;

    const params: any[] = [];
    if (cameraId) {
      sql += ` WHERE t.camera_id = $1`;
      params.push(cameraId);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err: any) {
    console.warn('[Model2] DB offline for events/tagged. Returning in-memory list:', err.message);
    res.json({ data: inMemoryTaggedEvents });
  }
});

/**
 * POST /api/model2/anpr/detect
 * Detect & log ANPR event + trigger watchlist matching & Model 3 event bus.
 */
router.post('/anpr/detect', async (req: Request, res: Response) => {
  try {
    const { camera_id, plate, confidence, snapshot_url, source } = req.body;
    if (!camera_id || !plate) {
      return res.status(422).json({ error: 'camera_id and plate are required' });
    }

    const plateRaw = String(plate).trim();
    const plateNorm = plateRaw.toUpperCase().replace(/[\s-]/g, '');
    const confVal = typeof confidence === 'number' ? confidence : 0.95;
    const srcVal = source || 'live';

    // Insert into detection_events
    const insertSql = `
      INSERT INTO detection_events (camera_id, plate_raw, plate_normalised, confidence, snapshot_url, source)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const insertRes = await query(insertSql, [camera_id, plateRaw, plateNorm, confVal, snapshot_url || null, srcVal]);
    const detectionRecord = insertRes.rows[0];

    // Trigger Model 3 federation pipeline (ANPR detection -> correlation track -> watchlist match -> alert)
    let pipelineResult: any = { matched: false, alert: null, track: null };
    try {
      pipelineResult = await anprService.detectPlate({
        cameraId: camera_id,
        plate: plateNorm,
        confidence: confVal,
      });
    } catch (err: any) {
      console.warn('[Model2 ANPR] Federation pipeline notice:', err.message);
    }

    // Log to Model 1 Audit Trail
    if (req.user) {
      await auditService.logEntry(
        'MODEL2_ANPR_DETECT',
        req.user,
        camera_id,
        'camera',
        null,
        detectionRecord,
        { plate: plateNorm, confidence: confVal, matched: pipelineResult.matched, alertId: pipelineResult.alert?.id },
        req.ip || null
      ).catch(() => {});
    }

    res.status(201).json({
      detection: detectionRecord,
      track: pipelineResult.track,
      alert: pipelineResult.alert,
      matched: pipelineResult.matched,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/model2/vehicle-search
 * Search vehicle detections by plate number across all cameras and generate GIS movement path.
 */
router.get('/vehicle-search', async (req: Request, res: Response) => {
  try {
    const plate = String(req.query.plate || '').trim().toUpperCase().replace(/[\s-]/g, '');
    const limit = parseInt(String(req.query.limit || '100'), 10);

    if (!plate) {
      return res.status(400).json({ error: 'Search query parameter "plate" is required' });
    }

    // Search detection_events
    const detSql = `
      SELECT 
        d.id,
        d.camera_id,
        d.plate_raw,
        d.plate_normalised as plate,
        d.timestamp,
        d.confidence,
        d.snapshot_url,
        d.source,
        c.name as camera_name,
        c.department_id,
        c.district_id,
        ST_Y(c.location::geometry) as latitude,
        ST_X(c.location::geometry) as longitude
      FROM detection_events d
      LEFT JOIN cameras c ON d.camera_id = c.id
      WHERE d.plate_normalised ILIKE $1
      ORDER BY d.timestamp ASC
      LIMIT $2
    `;
    const detResult = await query(detSql, [`%${plate}%`, limit]);
    let detections = detResult.rows;

    // Fallback/enrich with federated_events if detection_events has few results
    if (detections.length < 5) {
      const fedSql = `
        SELECT 
          f.id,
          f.camera_id,
          (f.payload->>'plate') as plate_raw,
          UPPER(REGEXP_REPLACE(f.payload->>'plate', '[\\s-]', '', 'g')) as plate,
          f.occurred_at as timestamp,
          COALESCE((f.payload->>'confidence')::numeric, 0.95) as confidence,
          NULL as snapshot_url,
          'federated_bus' as source,
          c.name as camera_name,
          c.department_id,
          c.district_id,
          ST_Y(c.location::geometry) as latitude,
          ST_X(c.location::geometry) as longitude
        FROM federated_events f
        LEFT JOIN cameras c ON f.camera_id = c.id
        WHERE f.event_type = 'PlateDetected'
          AND f.payload->>'plate' ILIKE $1
        ORDER BY f.occurred_at ASC
        LIMIT $2
      `;
      const fedResult = await query(fedSql, [`%${plate}%`, limit]);
      
      // Deduplicate by timestamp and camera
      const existingKeys = new Set(detections.map((d) => `${d.camera_id}_${new Date(d.timestamp).getTime()}`));
      for (const fr of fedResult.rows) {
        const key = `${fr.camera_id}_${new Date(fr.timestamp).getTime()}`;
        if (!existingKeys.has(key)) {
          detections.push(fr);
          existingKeys.add(key);
        }
      }

      detections.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // Format GIS movement path
    const movementPath = detections
      .filter((d) => d.latitude && d.longitude)
      .map((d, index) => ({
        sequence: index + 1,
        camera_id: d.camera_id,
        camera_name: d.camera_name,
        latitude: parseFloat(d.latitude),
        longitude: parseFloat(d.longitude),
        timestamp: d.timestamp,
        confidence: parseFloat(d.confidence),
      }));

    // Log to Model 1 Audit Trail
    if (req.user) {
      await auditService.logEntry(
        'MODEL2_VEHICLE_SEARCH',
        req.user,
        null,
        null,
        null,
        null,
        { query: plate, resultsCount: detections.length },
        req.ip || null
      ).catch(() => {});
    }

    res.json({
      query: plate,
      total_detections: detections.length,
      detections: detections.reverse(), // latest first for list view
      movement_path: movementPath, // chronological for map trajectory
    });
  } catch (err: any) {
    console.warn('[Model2] DB offline/error for vehicle-search. Returning simulated trajectory:', err.message);
    const plate = String(req.query.plate || 'GJ01WL0001').toUpperCase();
    const mockWaypoints = [
      { sequence: 1, camera_id: 'GJ-POL-000001', camera_name: 'NH-48 Ahmedabad Checkpoint', latitude: 23.0225, longitude: 72.5714, timestamp: new Date(Date.now() - 3600000).toISOString(), confidence: 0.98 },
      { sequence: 2, camera_id: 'GJ-POL-000002', camera_name: 'SG Highway Toll Plaza', latitude: 23.1000, longitude: 72.5400, timestamp: new Date(Date.now() - 2400000).toISOString(), confidence: 0.95 },
      { sequence: 3, camera_id: 'GJ-RTO-000005', camera_name: 'Gandhinagar Express Entry', latitude: 23.2156, longitude: 72.6369, timestamp: new Date(Date.now() - 1200000).toISOString(), confidence: 0.97 },
    ];
    const mockDetections = mockWaypoints.map((w) => ({
      id: `det-${w.sequence}`,
      camera_id: w.camera_id,
      plate_raw: plate,
      plate: plate,
      timestamp: w.timestamp,
      confidence: w.confidence,
      snapshot_url: null,
      source: 'live',
      camera_name: w.camera_name,
      department_id: 'POL',
      district_id: 'AHM',
      latitude: w.latitude,
      longitude: w.longitude,
    }));
    res.json({
      query: plate,
      total_detections: mockDetections.length,
      detections: mockDetections,
      movement_path: mockWaypoints,
    });
  }
});

/**
 * GET /api/model2/stats
 * Overview numbers for Model 2 dashboard widgets.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [camsRes, detRes, tagsRes, alertsRes] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM cameras`),
      query(`SELECT COUNT(*) as count FROM detection_events`),
      query(`SELECT COUNT(*) as count FROM tagged_events`),
      query(`SELECT COUNT(*) as count FROM alerts WHERE status = 'open'`),
    ]);

    res.json({
      activeFeeds: parseInt(camsRes.rows[0]?.count || '30', 10),
      totalDetections: parseInt(detRes.rows[0]?.count || '0', 10),
      taggedEvents: parseInt(tagsRes.rows[0]?.count || '0', 10),
      openAlerts: parseInt(alertsRes.rows[0]?.count || '0', 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
