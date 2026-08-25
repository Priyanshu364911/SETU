import { Router, Request, Response } from 'express';
import auditService from '../services/AuditService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// All audit routes require authentication
router.use(authMiddleware);

// GET /api/audit - Query audit log
router.get('/', requirePermission('audit_log' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const actor = req.user!;

    const filters = {
      action: req.query.action as any,
      // Field Officers may only see their own entries — override any actorId param
      actorId: actor.role === 'field_officer'
        ? actor.userId
        : req.query.actorId as string,
      targetId: req.query.targetId as string,
      targetType: req.query.targetType as 'camera' | 'user',
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await auditService.query(filters);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit/camera/:id - Get audit entries for a specific camera
router.get('/camera/:id', requirePermission('audit_log' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const cameraId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const entries = await auditService.getByTarget(cameraId, 'camera');
    res.json(entries);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit/recent - Get recent audit entries
router.get('/recent', requirePermission('audit_log' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const entries = await auditService.getRecent(limit);
    res.json(entries);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
