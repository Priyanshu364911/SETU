import { query } from '../db';
import { User, Role, TokenPayload } from '../types';
import authService from './AuthService';
import auditService from './AuditService';
import { UserCreateSchema, UserUpdateSchema } from '../schemas';

export class UserService {
  async create(input: {
    username: string;
    email: string;
    password: string;
    role: Role;
    department_id: string | null;
  }, actor: TokenPayload): Promise<User> {
    // Validate input
    UserCreateSchema.parse(input);

    // Check if username already exists
    const existingUsername = await query('SELECT id FROM users WHERE username = $1', [input.username]);
    if (existingUsername.rows.length > 0) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingEmail = await query('SELECT id FROM users WHERE email = $1', [input.email]);
    if (existingEmail.rows.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await authService.hashPassword(input.password);

    // Insert user
    const queryStr = `
      INSERT INTO users (username, email, password_hash, role, department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, role, department_id, is_active, created_at, last_login_at
    `;

    const result = await query(queryStr, [
      input.username,
      input.email,
      passwordHash,
      input.role,
      input.department_id,
    ]);

    const user = result.rows[0];

    // Audit log the user creation
    await auditService.logEntry(
      'USER_CREATE',
      actor,
      user.id,
      'user',
      null,
      { username: user.username, role: user.role, department_id: user.department_id },
      null,
      null,
    );

    return user;
  }

  async list(actor: TokenPayload): Promise<User[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC: Department Officers can only see users in their department
    if (actor.role === 'department_officer' && actor.departmentId) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(actor.departmentId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryStr = `
      SELECT id, username, email, role, department_id, is_active, created_at, last_login_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await query(queryStr, params);
    return result.rows;
  }

  async getById(id: string, actor: TokenPayload): Promise<User> {
    const queryStr = `
      SELECT id, username, email, role, department_id, is_active, created_at, last_login_at
      FROM users
      WHERE id = $1
    `;

    const result = await query(queryStr, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // RBAC check
    if (actor.role === 'department_officer' && actor.departmentId !== user.department_id) {
      throw new Error('Access denied');
    }

    return user;
  }

  async update(
    id: string,
    updates: {
      role?: Role;
      department_id?: string | null;
      is_active?: boolean;
    },
    actor: TokenPayload
  ): Promise<User> {
    // Only State Nodal Officer can update roles
    if (updates.role && actor.role !== 'state_nodal_officer') {
      throw new Error('Access denied: Cannot update role');
    }

    // Get existing user
    const existing = await this.getById(id, actor);

    // Validate updates
    UserUpdateSchema.parse(updates);

    // Build update SET clause
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramIndex}`);
      params.push(updates.role);
      paramIndex++;
    }

    if (updates.department_id !== undefined) {
      setClauses.push(`department_id = $${paramIndex}`);
      params.push(updates.department_id);
      paramIndex++;
    }

    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(updates.is_active);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(id);

    const queryStr = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, role, department_id, is_active, created_at, last_login_at
    `;

    const result = await query(queryStr, params);
    const updated = result.rows[0];

    // Audit log the update with before/after snapshots
    await auditService.logEntry(
      'USER_UPDATE',
      actor,
      id,
      'user',
      { role: existing.role, department_id: existing.department_id, is_active: existing.is_active },
      { role: updated.role, department_id: updated.department_id, is_active: updated.is_active },
      null,
      null,
    );

    return updated;
  }

  async deactivate(id: string, actor: TokenPayload): Promise<User> {
    // Only State Nodal Officer can deactivate users
    if (actor.role !== 'state_nodal_officer') {
      throw new Error('Access denied');
    }

    const queryStr = `
      UPDATE users
      SET is_active = false
      WHERE id = $1
      RETURNING id, username, email, role, department_id, is_active, created_at, last_login_at
    `;

    const result = await query(queryStr, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  async resetPassword(id: string, newPassword: string, actor: TokenPayload): Promise<void> {
    // Users can reset their own password, SNO can reset any password
    if (actor.role !== 'state_nodal_officer' && actor.userId !== id) {
      throw new Error('Access denied');
    }

    const passwordHash = await authService.hashPassword(newPassword);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  }
}

export default new UserService();
