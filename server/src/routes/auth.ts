import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import authService from '../services/AuthService';
import { LoginSchema } from '../schemas';

const router = Router();

// Rate limiter for login endpoint: 10 requests per minute per IP
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);
    const result = await authService.login(username, password);

    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const newToken = authService.refreshToken(token);

    if (!newToken) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.json({ token: newToken });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
