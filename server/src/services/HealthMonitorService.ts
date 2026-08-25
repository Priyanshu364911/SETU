import { query } from '../db';
import { Camera, FlaggedCamera, HealthTrendPoint, AlertSummary, TokenPayload } from '../types';

export class HealthMonitorService {
  async getFlaggedCameras(actor: TokenPayload): Promise<FlaggedCamera[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC scoping
    if (actor.scopedTo) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(actor.scopedTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryStr = `
      SELECT 
        id, name, department_id, district_id,
        ST_Y(location) as latitude, ST_X(location) as longitude,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by,
        onboarded_at, last_verified_at, notes, created_at, updated_at
      FROM cameras
      ${whereClause}
      ORDER BY created_at ASC
    `;

    const result = await query(queryStr, params);
    const cameras = result.rows;

    const flaggedCameras: FlaggedCamera[] = [];
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const camera of cameras) {
      let flagReason: 'Offline' | 'Maintenance' | 'Not_Verified_90d' | 'Retention_Expiring' | null = null;
      let severity: 'high' | 'medium' | 'low' = 'low';

      // Check conditions in priority order
      if (camera.status === 'Offline') {
        flagReason = 'Offline';
        severity = 'high';
      } else if (camera.status === 'Maintenance') {
        flagReason = 'Maintenance';
        severity = 'medium';
      } else if (!camera.last_verified_at || new Date(camera.last_verified_at) < ninetyDaysAgo) {
        flagReason = 'Not_Verified_90d';
        severity = 'medium';
      } else if (camera.retention_days < 7) {
        flagReason = 'Retention_Expiring';
        severity = 'low';
      }

      if (flagReason) {
        flaggedCameras.push({
          camera,
          flag_reason: flagReason,
          flagged_at: now,
          severity,
        });
      }
    }

    // Sort by severity (high > medium > low) then by flagged_at ascending
    const severityOrder = { high: 3, medium: 2, low: 1 };
    flaggedCameras.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.flagged_at.getTime() - b.flagged_at.getTime();
    });

    return flaggedCameras;
  }

  async getTrendData(days: number = 30, actor: TokenPayload): Promise<HealthTrendPoint[]> {
    // Validate days to prevent injection — must be a positive integer
    const safeDays = Math.max(1, Math.floor(Number(days)));

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Date range condition using parameterized interval via multiplication
    conditions.push(`created_at >= NOW() - ($${paramIndex} * INTERVAL '1 day')`);
    params.push(safeDays);
    paramIndex++;

    // RBAC scoping
    if (actor.scopedTo) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(actor.scopedTo);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const queryStr = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'Online') as online,
        COUNT(*) FILTER (WHERE status = 'Offline') as offline,
        COUNT(*) FILTER (WHERE status = 'Maintenance') as maintenance
      FROM cameras
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const result = await query(queryStr, params);
    
    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      online: parseInt(row.online),
      offline: parseInt(row.offline),
      maintenance: parseInt(row.maintenance),
    }));
  }

  async getAlertSummary(actor: TokenPayload): Promise<AlertSummary> {
    const flaggedCameras = await this.getFlaggedCameras(actor);

    const summary: AlertSummary = {
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const flagged of flaggedCameras) {
      summary[flagged.severity]++;
    }

    return summary;
  }

  async simulateStatusChange(cameraId: string, newStatus: 'Online' | 'Maintenance' | 'Offline'): Promise<void> {
    await query(
      'UPDATE cameras SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, cameraId]
    );
  }
}

export default new HealthMonitorService();
