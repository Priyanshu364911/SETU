import { Router, Request, Response } from 'express';
import departmentService from '../services/DepartmentService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// All department routes require authentication
router.use(authMiddleware);

// GET /api/departments - List all departments
router.get('/', requirePermission('departments' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const departments = await departmentService.list();
    res.json(departments);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/departments/:id - Get department by ID
router.get('/:id', requirePermission('departments' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const department = await departmentService.getById(id);
    res.json(department);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Department not found') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/departments/:id/camera-count - Get camera count for department
router.get('/:id/camera-count', requirePermission('departments' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const count = await departmentService.getCameraCount(id);
    res.json({ department_id: id, camera_count: count });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
