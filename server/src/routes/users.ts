import { Router, Request, Response } from 'express';
import userService from '../services/UserService';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { UserCreateSchema, UserUpdateSchema } from '../schemas';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

// POST /api/users - Create new user
router.post('/', requirePermission('users' as any, 'MANAGE' as any), async (req: Request, res: Response) => {
  try {
    UserCreateSchema.parse(req.body);
    const user = await userService.create(req.body, req.user!);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Username already exists' || error.message === 'Email already exists') {
        return res.status(409).json({ error: error.message });
      }
      // Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(422).json({ error: JSON.parse(error.message) });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users - List users
router.get('/', requirePermission('users' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const users = await userService.list(req.user!);
    res.json(users);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', requirePermission('users' as any, 'READ' as any), async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await userService.getById(id, req.user!);
    res.json(user);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
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

// PUT /api/users/:id - Update user
router.put('/:id', requirePermission('users' as any, 'MANAGE' as any), async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    UserUpdateSchema.parse(req.body);
    const user = await userService.update(id, req.body, req.user!);
    res.json(user);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied' || error.message === 'Access denied: Cannot update role') {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:id/deactivate - Deactivate user
router.post('/:id/deactivate', requirePermission('users' as any, 'MANAGE' as any), async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await userService.deactivate(id, req.user!);
    res.json(user);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
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

// POST /api/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', requirePermission('users' as any, 'MANAGE' as any), async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    await userService.resetPassword(id, newPassword, req.user!);
    res.json({ success: true });
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
