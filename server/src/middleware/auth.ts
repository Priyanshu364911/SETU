import { Request, Response, NextFunction } from 'express';
import authService from '../services/AuthService';
import { TokenPayload } from '../types';

declare module 'express' {
  interface Request {
    user?: TokenPayload;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const payload = authService.validateToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
  
  req.user = payload;
  next();
}
