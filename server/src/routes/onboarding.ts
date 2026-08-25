import { Router, Request, Response } from 'express';
import onboardingService from '../services/OnboardingService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { CameraFiltersSchema, PaginationSchema } from '../schemas';
import multer from 'multer';

const router = Router();

// All onboarding routes require authentication
router.use(authMiddleware);

// Configure multer for CSV upload (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// POST /api/onboarding - Submit manual onboarding
router.post('/', requirePermission('cameras' as any, 'WRITE' as any), async (req: Request, res: Response) => {
  try {
    const result = await onboardingService.submitManual(req.body, req.user!);
    res.status(201).json(result);
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

// POST /api/onboarding/bulk - Submit bulk CSV onboarding
router.post('/bulk', requirePermission('cameras' as any, 'WRITE' as any), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await onboardingService.submitBulkCSV(req.file.buffer, req.user!);
    // 207 Multi-Status: some rows may have been accepted, others rejected
    res.status(207).json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/onboarding - Get onboarding queue
router.get('/', requirePermission('cameras' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const filters = CameraFiltersSchema.parse(req.query);
    const pagination = PaginationSchema.parse(req.query);
    
    const result = await onboardingService.getQueue(filters, pagination, req.user!);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/onboarding/:id/approve - Approve onboarding
router.patch('/:id/approve', requirePermission('cameras' as any, 'APPROVE' as any), async (req: Request, res: Response) => {
  try {
    const cameraId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await onboardingService.approve(cameraId, req.user!);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Camera not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied' || error.message === 'Invalid status transition') {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/onboarding/:id/reject - Reject onboarding
router.patch('/:id/reject', requirePermission('cameras' as any, 'APPROVE' as any), async (req: Request, res: Response) => {
  try {
    const cameraId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = req.body;
    const result = await onboardingService.reject(cameraId, reason || 'No reason provided', req.user!);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Camera not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied' || error.message === 'Invalid status transition') {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
