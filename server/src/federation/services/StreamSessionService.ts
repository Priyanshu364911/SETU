import { randomBytes } from 'crypto';
import { query } from '../../db';
import adapterRegistry from '../adapters/AdapterRegistry';
import { StreamSession } from '../types';

const SESSION_TTL_SEC = 300;

export class StreamSessionService {
  /**
   * Creates a mediated stream session for a registry camera.
   * Resolves the VMS binding, calls adapter.requestStream(), persists to stream_sessions.
   */
  async createSession(input: {
    cameraId: string;
    userId?: string | null;
  }): Promise<{
    sessionToken: string;
    streamUrl: string;
    protocol: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
    expiresAt: string;
    cameraId: string;
    vmsSystemId: string;
  }> {
    // Find active binding
    const bindResult = await query(
      `SELECT b.vms_system_id, b.external_camera_id, b.stream_path, b.capabilities
       FROM camera_vms_bindings b
       WHERE b.camera_id = $1 AND b.is_active = TRUE
       LIMIT 1`,
      [input.cameraId]
    );
    if (!bindResult.rows[0]) {
      throw Object.assign(new Error('No active VMS binding for this camera'), { status: 404 });
    }
    const binding = bindResult.rows[0];
    const vmsSystemId: string = binding.vms_system_id;
    const externalCameraId: string = binding.external_camera_id;

    // Ask adapter for stream handle
    const adapter = adapterRegistry.get(vmsSystemId);
    if (!adapter) {
      throw Object.assign(new Error(`Adapter ${vmsSystemId} not running`), { status: 503 });
    }

    const streamHandle = await adapter.requestStream(externalCameraId);
    if (!streamHandle) {
      throw Object.assign(new Error('Adapter could not resolve stream URL'), { status: 502 });
    }

    const sessionToken = randomBytes(32).toString('hex'); // 64 hex chars
    const ttlSec = streamHandle.expiresInSec || SESSION_TTL_SEC;
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

    await query(
      `INSERT INTO stream_sessions
         (camera_id, vms_system_id, session_token, stream_url, protocol, expires_at, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.cameraId,
        vmsSystemId,
        sessionToken,
        streamHandle.url,
        streamHandle.protocol,
        expiresAt,
        input.userId || null,
      ]
    );

    return {
      sessionToken,
      streamUrl: streamHandle.url,
      protocol: streamHandle.protocol,
      expiresAt,
      cameraId: input.cameraId,
      vmsSystemId,
    };
  }

  /**
   * Retrieves an active (non-expired) stream session by token.
   */
  async getSession(token: string): Promise<StreamSession | null> {
    const result = await query(
      `SELECT * FROM stream_sessions WHERE session_token = $1 AND expires_at > NOW() LIMIT 1`,
      [token]
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): StreamSession {
    return {
      id: row.id,
      camera_id: row.camera_id,
      vms_system_id: row.vms_system_id,
      session_token: row.session_token,
      stream_url: row.stream_url,
      protocol: row.protocol,
      expires_at: row.expires_at,
      requested_by: row.requested_by,
      created_at: row.created_at,
    };
  }
}

export const streamSessionService = new StreamSessionService();
export default streamSessionService;
