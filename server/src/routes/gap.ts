import { Router, Request, Response } from 'express';
import gapAnalysisService from '../services/GapAnalysisService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// All gap analysis routes require authentication
router.use(authMiddleware);

// GET /api/gap/zones - Get low coverage zones
router.get('/zones', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const threshold = parseFloat(req.query.threshold as string) || 0.5;
    const zones = await gapAnalysisService.getLowCoverageZones(threshold);
   res.json(zones);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/gap/ageing - Get ageing infrastructure
router.get('/ageing', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const thresholdDays = parseInt(req.query.days as string) || 90;
    const cameras = await gapAnalysisService.getAgeingInfrastructure(thresholdDays);
    res.json(cameras);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/gap/districts - Get below average districts
router.get('/districts', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const rankings = await gapAnalysisService.getBelowAverageDistricts();
    res.json(rankings);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/gap/export - Export gap analysis report
router.get('/export', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf') || 'csv';
    const buffer = await gapAnalysisService.exportReport(format);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=gap-analysis-report.csv');
    res.send(buffer);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
