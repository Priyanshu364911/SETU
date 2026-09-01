import { query } from '../../db';
import { AlertRecord } from '../types';

export class AlertService {
  async list(opts: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ data: AlertRecord[]; total: number }> {
    const page = opts.page || 1;
    const pageSize = Math.min(opts.pageSize || 50, 200);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (opts.status) {
      conditions.push(`a.status = $${i++}`);
      params.push(opts.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM alerts a ${where}`,
      params
    );

    const dataRes = await query(
      `SELECT
         a.*,
         c.name AS camera_name,
         w.entity_type AS wl_entity_type,
         w.display_name AS wl_display_name,
         w.priority AS wl_priority
       FROM alerts a
       LEFT JOIN cameras c ON c.id = a.camera_id
       LEFT JOIN watchlist_entries w ON w.id = a.watchlist_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, pageSize, offset]
    );

    return {
      data: dataRes.rows.map(this.mapRow),
      total: countRes.rows[0].total,
    };
  }

  async countOpen(): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS c FROM alerts WHERE status = 'open'`
    );
    return result.rows[0].c;
  }

  async acknowledge(id: string, userId: string, note?: string): Promise<AlertRecord | null> {
    const result = await query(
      `UPDATE alerts
       SET status = 'acknowledged',
           acknowledged_by = $2,
           acknowledged_at = NOW(),
           message = CASE WHEN $3::text IS NOT NULL THEN message || E'\nNote: ' || $3 ELSE message END
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [id, userId, note || null]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async close(id: string, userId: string): Promise<AlertRecord | null> {
    const result = await query(
      `UPDATE alerts
       SET status = 'closed',
           closed_at = NOW(),
           acknowledged_by = COALESCE(acknowledged_by, $2)
       WHERE id = $1 AND status IN ('open', 'acknowledged')
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: any): AlertRecord & {
    camera_name?: string;
    wl_entity_type?: string;
    wl_display_name?: string;
    wl_priority?: string;
  } {
    return {
      id: row.id,
      alert_type: row.alert_type,
      title: row.title,
      message: row.message,
      severity: row.severity,
      status: row.status,
      camera_id: row.camera_id,
      watchlist_id: row.watchlist_id,
      event_id: row.event_id,
      track_id: row.track_id,
      entity_value: row.entity_value,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {},
      acknowledged_by: row.acknowledged_by,
      acknowledged_at: row.acknowledged_at,
      closed_at: row.closed_at,
      created_at: row.created_at,
      // Display joins
      camera_name: row.camera_name,
      wl_entity_type: row.wl_entity_type,
      wl_display_name: row.wl_display_name,
      wl_priority: row.wl_priority,
    };
  }
}

export const alertService = new AlertService();
export default alertService;
