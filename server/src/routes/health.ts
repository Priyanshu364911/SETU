import { Router, Request, Response } from 'express';
import healthMonitorService from '../services/HealthMonitorService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// All health monitor routes require authentication
router.use(authMiddleware);

// GET /api/health/flagged - Get flagged cameras
router.get('/flagged', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const flaggedCameras = await healthMonitorService.getFlaggedCameras(req.user!);
    res.json(flaggedCameras);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/health/trend - Get health trend data
router.get('/trend', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trendData = await healthMonitorService.getTrendData(days, req.user!);
    res.json(trendData);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/health/summary - Get alert summary
router.get('/summary', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const summary = await healthMonitorService.getAlertSummary(req.user!);
    res.json(summary);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/health/simulate - Simulate status change (for testing)
router.post('/simulate', requirePermission('cameras' as any, 'WRITE' as any), async (req: Request, res: Response) => {
  try {
    const { cameraId, newStatus } = req.body;
    await healthMonitorService.simulateStatusChange(cameraId, newStatus);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
