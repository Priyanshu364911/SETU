import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import federationService from '../federation/services/FederationService';
import correlationService from '../federation/services/CorrelationService';
import mappingService from '../federation/services/MappingService';
import streamSessionService from '../federation/services/StreamSessionService';
import watchlistService from '../federation/services/WatchlistService';
import alertService from '../federation/services/AlertService';
import anprService from '../federation/services/AnprService';
import {
  BindingCreateSchema,
  StreamRequestSchema,
  WatchlistCreateSchema,
  AlertAckSchema,
  PlateDetectSchema,
} from '../federation/schemas';

const router = Router();

// All federation routes require authentication
router.use(authMiddleware);

// ─── Systems ─────────────────────────────────────────────────────────────────

/** GET /api/federation/systems — list registered VMS systems */
router.get('/systems', async (_req: Request, res: Response) => {
  try {
    const systems = await federationService.listSystems();
    res.json({ data: systems });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/federation/connectors — live connector health statuses */
router.get('/connectors', async (_req: Request, res: Response) => {
  try {
    const statuses = await federationService.getConnectorStatuses();
    res.json({ data: statuses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/federation/systems/:id/sync — trigger on-demand camera sync */
router.post('/systems/:id/sync', async (req: Request, res: Response) => {
  try {
    const result = await federationService.syncSystem(String(req.params.id));
    res.json(result);
  } catch (err: any) {
    const status = (err as any).status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── Cameras ─────────────────────────────────────────────────────────────────

/** GET /api/federation/cameras — federated camera list (registry + binding joined) */
router.get('/cameras', async (_req: Request, res: Response) => {
  try {
    const cameras = await federationService.listFederatedCameras();
    res.json({ data: cameras });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Events ──────────────────────────────────────────────────────────────────

/** GET /api/federation/events — paginated event log */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const pageSize = parseInt(String(req.query.pageSize || '50'), 10);
    const eventType = req.query.eventType as string | undefined;
    const cameraId = req.query.cameraId as string | undefined;
    const vmsSystemId = req.query.vmsSystemId as string | undefined;

    const result = await federationService.listEvents({ page, pageSize, eventType, cameraId, vmsSystemId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Bindings ─────────────────────────────────────────────────────────────────

/** GET /api/federation/bindings — list camera↔VMS bindings */
router.get('/bindings', async (req: Request, res: Response) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    const bindings = await mappingService.listBindings(cameraId);
    res.json({ data: bindings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/federation/bindings — create camera↔VMS binding */
router.post('/bindings', async (req: Request, res: Response) => {
  try {
    const parsed = BindingCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.issues });
    }
    const binding = await mappingService.createBinding(parsed.data);
    res.status(201).json(binding);
  } catch (err: any) {
    const status = (err as any).status || 500;
    res.status(status).json({ error: err.message });
  }
});

/** DELETE /api/federation/bindings/:id — deactivate binding */
router.delete('/bindings/:id', async (req: Request, res: Response) => {
  try {
    await mappingService.deleteBinding(String(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/federation/bindings/auto-map — demo auto-map helper */
router.post('/bindings/auto-map', async (_req: Request, res: Response) => {
  try {
    const result = await mappingService.autoMapDemo();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Correlation Tracks ───────────────────────────────────────────────────────

/** GET /api/federation/tracks — correlation tracks list */
router.get('/tracks', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const tracks = await correlationService.listTracks(limit);
    res.json({ data: tracks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/federation/tracks/:id/history — GIS movement history for a track */
router.get('/tracks/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await correlationService.getTrackHistory(String(req.params.id));
    if (!history.length) {
      return res.status(404).json({ error: 'Track not found or no history' });
    }
    res.json({ data: history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Analytics Report ─────────────────────────────────────────────────────────

/** GET /api/federation/analytics/report — sample federated analytics report (JSON) */
router.get('/analytics/report', async (_req: Request, res: Response) => {
  try {
    const report = await correlationService.analyticsReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/federation/analytics/report.csv — CSV export of analytics report */
router.get('/analytics/report.csv', async (_req: Request, res: Response) => {
  try {
    const report = await correlationService.analyticsReport();

    const lines: string[] = [
      'metric,value',
      `Generated At,${report.generatedAt}`,
      `Total Events (24h),${report.totalEvents24h}`,
      `Plate Detections (24h),${report.plateDetections24h}`,
      `Unique Plates (24h),${report.uniquePlates24h}`,
      `Active Tracks,${report.activeTracks}`,
      `Multi-Camera Tracks,${report.multiCameraTracks}`,
      '',
      'vms_system_id,event_count',
      ...report.eventsByVms.map((r) => `${r.vmsSystemId},${r.count}`),
      '',
      'plate,sightings,cameras',
      ...report.topPlates.map((p) => `${p.plate},${p.sightings},${p.cameras}`),
    ];

    const csv = lines.join('\n');
    const ts = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="federation-analytics-${ts}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stream Sessions (Phase 4) ────────────────────────────────────────────────

/** POST /api/federation/streams — request a mediated stream session */
router.post('/streams', async (req: Request, res: Response) => {
  try {
    const parsed = StreamRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.issues });
    }
    const userId = (req as any).user?.id || null;
    const session = await streamSessionService.createSession({
      cameraId: parsed.data.camera_id,
      userId,
    });
    res.status(201).json(session);
  } catch (err: any) {
    const status = (err as any).status || 500;
    res.status(status).json({ error: err.message });
  }
});

/** GET /api/federation/streams/:token — validate and retrieve a stream session */
router.get('/streams/:token', async (req: Request, res: Response) => {
  try {
    const session = await streamSessionService.getSession(String(req.params.token));
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Watchlist (Phase 4) ──────────────────────────────────────────────────────

/** GET /api/federation/watchlist — list watchlist entries */
router.get('/watchlist', async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const entries = await watchlistService.list({ activeOnly });
    res.json({ data: entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/federation/watchlist — create watchlist entry */
router.post('/watchlist', async (req: Request, res: Response) => {
  try {
    const parsed = WatchlistCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.issues });
    }
    const userId = (req as any).user?.id || null;
    const entry = await watchlistService.create(parsed.data, userId);
    res.status(201).json(entry);
  } catch (err: any) {
    const status = (err as any).status || 500;
    // Unique constraint violation (duplicate active plate)
    if ((err as any).code === '23505') {
      return res.status(409).json({ error: 'An active watchlist entry for this plate already exists' });
    }
    res.status(status).json({ error: err.message });
  }
});

/** PUT /api/federation/watchlist/:id — update watchlist entry */
router.put('/watchlist/:id', async (req: Request, res: Response) => {
  try {
    const entry = await watchlistService.update(String(req.params.id), req.body);
    if (!entry) return res.status(404).json({ error: 'Watchlist entry not found' });
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/federation/watchlist/:id — soft-deactivate watchlist entry */
router.delete('/watchlist/:id', async (req: Request, res: Response) => {
  try {
    await watchlistService.deactivate(String(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Alerts (Phase 4) ─────────────────────────────────────────────────────────

/** GET /api/federation/alerts — paginated alerts list */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const pageSize = parseInt(String(req.query.pageSize || '50'), 10);
    const status = req.query.status as string | undefined;
    const result = await alertService.list({ status, page, pageSize });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/federation/alerts/count — open alert count (for badge) */
router.get('/alerts/count', async (_req: Request, res: Response) => {
  try {
    const count = await alertService.countOpen();
    res.json({ open: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/federation/alerts/:id/ack — acknowledge an alert */
router.post('/alerts/:id/ack', async (req: Request, res: Response) => {
  try {
    const parsed = AlertAckSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.issues });
    }
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const alert = await alertService.acknowledge(String(req.params.id), userId, parsed.data.note);
    if (!alert) return res.status(404).json({ error: 'Alert not found or already processed' });
    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/federation/alerts/:id/close — close/resolve an alert */
router.post('/alerts/:id/close', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const alert = await alertService.close(String(req.params.id), userId);
    if (!alert) return res.status(404).json({ error: 'Alert not found or already closed' });
    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ANPR / Plate Inject (Phase 4) ───────────────────────────────────────────

/** POST /api/federation/anpr/detect — demo/manual plate inject through federation */
router.post('/anpr/detect', async (req: Request, res: Response) => {
  try {
    const parsed = PlateDetectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.issues });
    }
    const result = await anprService.detectPlate({
      cameraId: parsed.data.camera_id,
      plate: parsed.data.plate,
      confidence: parsed.data.confidence,
      occurredAt: parsed.data.occurred_at,
    });
    res.status(201).json(result);
  } catch (err: any) {
    const status = (err as any).status || 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;

