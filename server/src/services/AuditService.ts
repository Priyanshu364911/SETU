import { query } from '../db';
import { AuditLog, AuditAction, TokenPayload } from '../types';

export class AuditService {
  async logEntry(
    action: AuditAction,
    actor: TokenPayload,
    targetId: string | null,
    targetType: 'camera' | 'user' | null,
    beforeState: object | null,
    afterState: object | null,
    metadata: object | null,
    ipAddress: string | null
  ): Promise<AuditLog> {
    const queryStr = `
      INSERT INTO audit_log (
        action, actor_id, actor_role, target_id, target_type,
        before_state, after_state, metadata, ip_address
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `;

    const result = await query(queryStr, [
      action,
      actor.userId,
      actor.role,
      targetId,
      targetType,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress,
    ]);

    return result.rows[0];
  }

  async query(filters: {
    action?: AuditAction;
    actorId?: string;
    targetId?: string;
    targetType?: 'camera' | 'user';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.targetId) {
      conditions.push(`target_id = $${paramIndex}`);
      params.push(filters.targetId);
      paramIndex++;
    }

    if (filters.targetType) {
      conditions.push(`target_type = $${paramIndex}`);
      params.push(filters.targetType);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_log
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const dataQuery = `
      SELECT *
      FROM audit_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const dataResult = await query(dataQuery, params);

    return {
      data: dataResult.rows,
      total,
    };
  }

  async getByTarget(targetId: string, targetType: 'camera' | 'user'): Promise<AuditLog[]> {
    const queryStr = `
      SELECT *
      FROM audit_log
      WHERE target_id = $1 AND target_type = $2
      ORDER BY created_at DESC
    `;

    const result = await query(queryStr, [targetId, targetType]);
    return result.rows;
  }

  async getRecent(limit: number = 50): Promise<AuditLog[]> {
    const queryStr = `
      SELECT *
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await query(queryStr, [limit]);
    return result.rows;
  }

  // Enforce append-only by preventing updates/deletes
  // This is enforced at the database level with REVOKE UPDATE, DELETE
  // This method is for documentation and potential future checks
  async enforceAppendOnly(): Promise<boolean> {
    // In production, this would be enforced by database permissions
    // For now, we return true to indicate the service enforces append-only
    return true;
  }
}

export default new AuditService();
