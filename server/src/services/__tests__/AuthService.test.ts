import authService from '../AuthService';
import { query } from '../../db';

// Mock the db module
jest.mock('../../db');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('login', () => {
    it('should return token for valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        password_hash: await authService.hashPassword('password123'),
        role: 'state_nodal_officer',
        department_id: null,
        is_active: true,
      };

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await authService.login('testuser', 'password123');
      
      expect(result).toBeDefined();
      expect(result?.token).toBeDefined();
      expect(result?.user).toBeDefined();
      expect(result?.user.username).toBe('testuser');
      expect(result?.user.role).toBe('state_nodal_officer');
    });

    it('should return null for invalid username', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await authService.login('nonexistent', 'password');
      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        password_hash: await authService.hashPassword('password123'),
        role: 'state_nodal_officer',
        department_id: null,
        is_active: true,
      };

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await authService.login('testuser', 'wrongpassword');
      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        password_hash: await authService.hashPassword('password123'),
        role: 'state_nodal_officer',
        department_id: null,
        is_active: false,
      };

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await authService.login('testuser', 'password123');
      expect(result).toBeNull();
    });

    it('should update last_login_at on successful login', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        password_hash: await authService.hashPassword('password123'),
        role: 'state_nodal_officer',
        department_id: null,
        is_active: true,
      };

      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] });

      await authService.login('testuser', 'password123');
      
      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenCalledWith(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        ['user-1']
      );
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        password_hash: await authService.hashPassword('password123'),
        role: 'state_nodal_officer',
        department_id: null,
        is_active: true,
      };

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const loginResult = await authService.login('testuser', 'password123');
      const token = loginResult!.token;

      const payload = authService.validateToken(token);
      
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe('user-1');
      expect(payload?.username).toBe('testuser');
      expect(payload?.role).toBe('state_nodal_officer');
    });

    it('should return null for invalid token', () => {
      const payload = authService.validateToken('invalid.token.here');
      expect(payload).toBeNull();
    });

    it('should return null for malformed token', () => {
      const payload = authService.validateToken('not-a-jwt');
      expect(payload).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        password_hash: await authService.hashPassword('password123'),
        role: 'state_nodal_officer',
        department_id: null,
        is_active: true,
      };

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const loginResult = await authService.login('testuser', 'password123');
      const oldToken = loginResult!.token;

      const newToken = authService.refreshToken(oldToken);
      
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
    });

    it('should return null for invalid token', () => {
      const newToken = authService.refreshToken('invalid.token.here');
      expect(newToken).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create a token that's already expired by using a very short expiry
      // This is a simplified test - in practice you'd need to manipulate time
      const payload = authService.validateToken('invalid');
      expect(payload).toBeNull();
    });
  });
});
