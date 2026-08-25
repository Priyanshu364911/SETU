import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { TokenPayload, AuthResult, UserProfile, Role } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const JWT_EXPIRY = '8h';

export class AuthService {
  async login(username: string, password: string): Promise<AuthResult | null> {
    const result = await query(
      'SELECT id, username, email, password_hash, role, department_id, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return null;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return null;
    }

    // Update last_login_at
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id,
      exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // 8 hours
    };

    const token = jwt.sign(payload, JWT_SECRET);

    const userProfile: UserProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as Role,
      department_id: user.department_id,
    };

    return { token, user: userProfile };
  }

  validateToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      
      // Check if token is expired
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  refreshToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      
      // Check if token is expired
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      // Issue new token with same claims
      const newPayload: TokenPayload = {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        departmentId: decoded.departmentId,
        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // 8 hours
      };

      return jwt.sign(newPayload, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export default new AuthService();
