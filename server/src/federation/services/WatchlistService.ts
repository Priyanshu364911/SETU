import { query } from '../../db';
import federationService from './FederationService';
import { WatchlistEntry, AlertRecord, CanonicalEvent } from '../types';

const ALERT_DEDUPE_WINDOW_MINUTES = 5;

export class WatchlistService {
  // ──────────────────────── Watchlist CRUD ────────────────────────

  async list(opts: { activeOnly?: boolean } = {}): Promise<WatchlistEntry[]> {
    const where = opts.activeOnly !== false ? 'WHERE is_active = TRUE' : '';
    const result = await query(
      `SELECT * FROM watchlist_entries ${where} ORDER BY priority DESC, created_at DESC`
    );
    return result.rows.map(this.mapWatchlistRow);
  }

  async getById(id: string): Promise<WatchlistEntry | null> {
    const result = await query(`SELECT * FROM watchlist_entries WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapWatchlistRow(result.rows[0]) : null;
  }

  async create(
    input: {
      entity_type: string;
      entity_value: string;
      display_name?: string;
      description?: string;
      priority?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    },
    userId?: string | null
  ): Promise<WatchlistEntry> {
    const result = await query(
      `INSERT INTO watchlist_entries
         (entity_type, entity_value, display_name, description, priority, source, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.entity_type,
        input.entity_value.toUpperCase().replace(/[\s-]/g, ''),
        input.display_name || null,
        input.description || null,
        input.priority || 'medium',
        input.source || 'manual',
        JSON.stringify(input.metadata || {}),
        userId || null,
      ]
    );
    return this.mapWatchlistRow(result.rows[0]);
  }

  async update(
    id: string,
    patch: Partial<{
      display_name: string;
      description: string;
      priority: string;
      source: string;
      metadata: Record<string, unknown>;
    }>
  ): Promise<WatchlistEntry | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (patch.display_name !== undefined) { sets.push(`display_name = $${i++}`); params.push(patch.display_name); }
    if (patch.description !== undefined) { sets.push(`description = $${i++}`); params.push(patch.description); }
    if (patch.priority !== undefined) { sets.push(`priority = $${i++}`); params.push(patch.priority); }
    if (patch.source !== undefined) { sets.push(`source = $${i++}`); params.push(patch.source); }
    if (patch.metadata !== undefined) { sets.push(`metadata = $${i++}`); params.push(JSON.stringify(patch.metadata)); }
    if (sets.length === 0) return this.getById(id);

    sets.push(`updated_at = NOW()`);
    params.push(id);
    const result = await query(
      `UPDATE watchlist_entries SET ${sets.join(', ')} WHERE id = $${i} AND is_active = TRUE RETURNING *`,
      params
    );
    return result.rows[0] ? this.mapWatchlistRow(result.rows[0]) : null;
  }

  async deactivate(id: string): Promise<void> {
    await query(
      `UPDATE watchlist_entries SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  /**
   * Seeds default watchlist entries if the table is empty.
   * Only seeds GJ01WL0001 and GJ05WL0002 (per plan §2.3).
   */
  async seedDefaultsIfEmpty(): Promise<void> {
    const count = await query('SELECT COUNT(*)::int AS c FROM watchlist_entries WHERE is_active = TRUE');
    if (count.rows[0].c > 0) return;

    const seeds = [
      {
        entity_type: 'stolen_vehicle',
        entity_value: 'GJ01WL0001',
        display_name: 'Stolen Vehicle – Demo Seed',
        description: 'Demo seed: stolen vehicle reported in VMS-B zone',
        priority: 'critical',
        source: 'demo',
      },
      {
        entity_type: 'blacklisted_vehicle',
        entity_value: 'GJ05WL0002',
        display_name: 'Blacklisted Vehicle – Demo Seed',
        description: 'Demo seed: blacklisted vehicle for checkpoint enforcement',
        priority: 'high',
        source: 'demo',
      },
    ];

    for (const seed of seeds) {
      try {
        await this.create(seed);
      } catch (_) {
        // ignore duplicates on re-seed
      }
    }
    console.log('[WatchlistService] Seeded default watchlist entries');
  }

  // ──────────────────────── Plate Matching ────────────────────────

  /**
   * Normalized plate → find active watchlist match → dedupe → insert alert if new.
   * Returns the alert record if created, or null if no match or deduped.
   */
  async matchPlate(input: {
    plate: string;
    cameraId?: string | null;
    eventId?: string | null;
    trackId?: string | null;
    vmsSystemId?: string;
    confidence?: unknown;
  }): Promise<AlertRecord | null> {
    const normalizedPlate = String(input.plate || '')
      .toUpperCase()
      .replace(/[\s-]/g, '');
    if (!normalizedPlate || normalizedPlate.length < 4) return null;

    // Find active watchlist match
    const wlResult = await query(
      `SELECT * FROM watchlist_entries
       WHERE is_active = TRUE
         AND upper(replace(replace(entity_value, ' ', ''), '-', '')) = $1
       LIMIT 1`,
      [normalizedPlate]
    );
    if (!wlResult.rows[0]) return null;

    const wlEntry = this.mapWatchlistRow(wlResult.rows[0]);

    // Alert dedupe: check for existing open/acknowledged alert within 5 minutes
    const dedupeRes = await query(
      `SELECT id FROM alerts
       WHERE entity_value = $1
         AND status IN ('open', 'acknowledged')
         AND created_at > NOW() - ($2 || ' minutes')::interval
       LIMIT 1`,
      [normalizedPlate, String(ALERT_DEDUPE_WINDOW_MINUTES)]
    );
    if (dedupeRes.rows[0]) return null; // dedupe hit — skip

    // Map watchlist priority → alert severity (no 'info' in alerts)
    const severity =
      wlEntry.priority === 'critical' ? 'critical'
      : wlEntry.priority === 'high' ? 'high'
      : 'medium';

    const title = `${wlEntry.entity_type.replace(/_/g, ' ')} detected — ${normalizedPlate}`;
    const message = `Plate ${normalizedPlate} matched watchlist entry: ${wlEntry.display_name || wlEntry.entity_value}. Source: ${wlEntry.source}.`;

    const alertResult = await query(
      `INSERT INTO alerts
         (alert_type, title, message, severity, status, camera_id, watchlist_id, event_id, track_id, entity_value, payload)
       VALUES ('watchlist_hit', $1, $2, $3, 'open', $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        message,
        severity,
        input.cameraId || null,
        wlEntry.id,
        input.eventId || null,
        input.trackId || null,
        normalizedPlate,
        JSON.stringify({
          confidence: input.confidence,
          vmsSystemId: input.vmsSystemId,
        }),
      ]
    );
    const alertRecord = this.mapAlertRow(alertResult.rows[0]);

    // Publish WatchlistMatch canonical event on the federation bus
    try {
      const matchEvent: CanonicalEvent = {
        eventType: 'WatchlistMatch',
        vmsSystemId: input.vmsSystemId || 'setu-federation',
        cameraId: input.cameraId || null,
        severity,
        payload: {
          plate: normalizedPlate,
          watchlistId: wlEntry.id,
          alertId: alertRecord.id,
          entityType: wlEntry.entity_type,
          confidence: input.confidence,
        },
        occurredAt: new Date().toISOString(),
      };
      await federationService.ingestEvent(matchEvent);
    } catch (err: any) {
      console.warn('[WatchlistService] WatchlistMatch event publish failed:', err.message);
    }

    console.log(`[WatchlistService] Alert created for plate ${normalizedPlate} (${severity})`);

    return alertRecord;
  }

  // ──────────────────────── Helpers ────────────────────────

  private mapWatchlistRow(row: any): WatchlistEntry {
    return {
      id: row.id,
      entity_type: row.entity_type,
      entity_value: row.entity_value,
      display_name: row.display_name,
      description: row.description,
      priority: row.priority,
      source: row.source,
      is_active: row.is_active,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapAlertRow(row: any): AlertRecord {
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
    };
  }
}

export const watchlistService = new WatchlistService();
export default watchlistService;
