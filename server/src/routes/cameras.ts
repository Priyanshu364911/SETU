import { Router, Request, Response } from 'express';
import cameraService from '../services/CameraService';
import auditService from '../services/AuditService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { CameraFiltersSchema, PaginationSchema } from '../schemas';

const router = Router();

// All camera routes require authentication
router.use(authMiddleware);

// GET /api/cameras - List cameras with filters and pagination
router.get('/', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const filters = CameraFiltersSchema.parse(req.query);
    const pagination = PaginationSchema.parse(req.query);
    
    // Convert date strings to Date objects
    const cameraFilters = {
      ...filters,
      onboardedAfter: filters.onboardedAfter ? new Date(filters.onboardedAfter) : undefined,
      onboardedBefore: filters.onboardedBefore ? new Date(filters.onboardedBefore) : undefined,
    };
    
    const result = await cameraService.list(cameraFilters, pagination, req.user!);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cameras/geojson - Get cameras as GeoJSON
router.get('/geojson', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const filters = CameraFiltersSchema.parse(req.query);
    const cameraFilters = {
      ...filters,
      onboardedAfter: filters.onboardedAfter ? new Date(filters.onboardedAfter) : undefined,
      onboardedBefore: filters.onboardedBefore ? new Date(filters.onboardedBefore) : undefined,
    };
    const geojson = await cameraService.getGeoJSON(cameraFilters, req.user!);
    res.json(geojson);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cameras/stats - Get camera statistics
router.get('/stats', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const stats = await cameraService.getStats(req.user!);
    res.json(stats);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cameras/export - Export cameras as CSV (SNO, DO, Auditor only — not Field Officer)
router.get('/export', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    // Field Officers are not allowed to export
    if (req.user!.role === 'field_officer') {
      return res.status(403).json({ error: 'Forbidden: Field Officers cannot export camera data' });
    }

    const filters = CameraFiltersSchema.parse(req.query);
    const cameraFilters = {
      ...filters,
      onboardedAfter: filters.onboardedAfter ? new Date(filters.onboardedAfter) : undefined,
      onboardedBefore: filters.onboardedBefore ? new Date(filters.onboardedBefore) : undefined,
    };

    // Fetch all matching cameras (no pagination limit for export)
    const result = await cameraService.list(cameraFilters, { page: 1, pageSize: 500 }, req.user!);
    const cameras = result.data;

    // Build CSV
    const header = [
      'id', 'name', 'department_id', 'district_id',
      'latitude', 'longitude', 'camera_type', 'connectivity',
      'storage_type', 'retention_days', 'ownership', 'status',
      'onboarding_status', 'onboarding_method', 'onboarded_at',
      'last_verified_at', 'notes', 'created_at', 'updated_at',
    ].join(',');

    const rows = cameras.map(c => [
      c.id,
      `"${(c.name ?? '').replace(/"/g, '""')}"`,
      c.department_id,
      c.district_id,
      c.latitude,
      c.longitude,
      c.camera_type,
      c.connectivity,
      c.storage_type,
      c.retention_days,
      c.ownership,
      c.status,
      c.onboarding_status,
      c.onboarding_method,
      c.onboarded_at ?? '',
      c.last_verified_at ?? '',
      `"${(c.notes ?? '').replace(/"/g, '""')}"`,
      c.created_at ?? '',
      c.updated_at ?? '',
    ].join(','));

    const csv = [header, ...rows].join('\n');

    // Audit log the export
    await auditService.logEntry(
      'EXPORT' as any,
      req.user!,
      null,
      null,
      null,
      null,
      { format: 'csv', count: cameras.length, filters: cameraFilters },
      req.ip ?? null,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cameras-export.csv"');
    res.status(200).send(csv);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cameras/:id - Get camera by ID
router.get('/:id', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const cameraId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const camera = await cameraService.getById(cameraId, req.user!);
    res.json(camera);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Camera not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cameras - Create new camera
router.post('/', requirePermission('cameras' as any, 'WRITE' as any), async (req: Request, res: Response) => {
  try {
    const camera = await cameraService.create(req.body, req.user!);
    res.status(201).json(camera);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_ID') {
        return res.status(409).json({ error: 'Camera ID already exists' });
      }
      if (error.message.startsWith('[')) {
        return res.status(422).json({ error: JSON.parse(error.message) });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/cameras/:id - Update camera
router.put('/:id', requirePermission('cameras' as any, 'WRITE' as any), async (req: Request, res: Response) => {
  try {
    const cameraId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const camera = await cameraService.update(cameraId, req.body, req.user!);
    res.json(camera);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Camera not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.startsWith('[')) {
        return res.status(422).json({ error: JSON.parse(error.message) });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cameras/:id - Delete camera
router.delete('/:id', requirePermission('cameras' as any, 'MANAGE' as any), async (req: Request, res: Response) => {
  try {
    const cameraId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await cameraService.delete(cameraId, req.user!);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
