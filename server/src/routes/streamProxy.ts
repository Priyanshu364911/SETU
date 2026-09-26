import { Router, Request, Response } from 'express';
import adapterRegistry from '../federation/adapters/AdapterRegistry';
import { GovFeedAdapter } from '../federation/adapters/GovFeedAdapter';

const router = Router();

// Helper to get GovFeedAdapter
function getGovAdapter(): GovFeedAdapter | null {
  const adapter = adapterRegistry.get('gov-feeds');
  if (adapter instanceof GovFeedAdapter) {
    return adapter;
  }
  return null;
}

/**
 * GET /api/stream/sentinel/enc.key
 * Serves the AES-128 HLS decryption key fetched from Sentinel using backend session.
 */
router.get('/sentinel/enc.key', async (_req: Request, res: Response) => {
  const adapter = getGovAdapter();
  if (!adapter) {
    return res.status(503).json({ error: 'Sentinel adapter not active' });
  }

  try {
    const key = await adapter.getHlsKey();
    if (!key) {
      return res.status(502).json({ error: 'Failed to fetch decryption key' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(key);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stream/sentinel/:camId/index.m3u8
 * Proxies and rewrites the HLS playlist so AES key and segments route through this server.
 */
router.get('/sentinel/:camId/index.m3u8', async (req: Request, res: Response) => {
  const camId = String(req.params.camId);
  const adapter = getGovAdapter();
  if (!adapter) {
    return res.status(503).json({ error: 'Sentinel adapter not active' });
  }

  try {
    const manifest = await adapter.getHlsManifest(camId);
    if (!manifest) {
      return res.status(502).json({ error: `Failed to fetch HLS manifest for ${camId}` });
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(manifest);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stream/sentinel/:camId/:file
 * Serves TS video segments (e.g. seg00000.ts) and handles enc.key fallback.
 */
router.get('/sentinel/:camId/:file', async (req: Request, res: Response) => {
  const camId = String(req.params.camId);
  const file = String(req.params.file);
  const adapter = getGovAdapter();
  if (!adapter) {
    return res.status(503).json({ error: 'Sentinel adapter not active' });
  }

  try {
    // If client requested enc.key with camId prefix
    if (file === 'enc.key') {
      const key = await adapter.getHlsKey();
      if (!key) return res.status(502).json({ error: 'Failed to fetch decryption key' });
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(key);
    }

    const segment = await adapter.getHlsSegment(camId, file);
    if (!segment) {
      return res.status(502).json({ error: `Failed to fetch segment ${file}` });
    }

    const contentType = file.endsWith('.ts') ? 'video/mp2t' : segment.contentType;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(segment.data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── WebRTC WHEP Signaling Proxy ────────────────────────────────────────────
// Proxies only the SDP exchange (tiny text payloads) to avoid CORS.
// The actual video media flows directly via WebRTC (browser ↔ media server).

const SENTINEL_WHEP_HOST = process.env.SENTINEL_RTSP_HOST || '103.250.160.189';
const SENTINEL_WHEP_PORT = 8889;
const SENTINEL_EMAIL = process.env.SENTINEL_EMAIL || 'nothingat18@gmail.com';
const SENTINEL_TOKEN = process.env.SENTINEL_API_TOKEN || 'JLDM-52CX-6C9R';

/**
 * OPTIONS /api/stream/sentinel/:camId/whep — CORS preflight
 */
router.options('/sentinel/:camId/whep', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.sendStatus(204);
});

/**
 * POST /api/stream/sentinel/:camId/whep
 * Proxies the WHEP signaling handshake:
 *   Browser --SDP offer--> Express --SDP offer--> Sentinel media server
 *   Browser <--SDP answer-- Express <--SDP answer-- Sentinel media server
 *
 * After this, the WebRTC media flows directly between browser and 103.250.160.189.
 */
import express from 'express';

router.post('/sentinel/:camId/whep', express.text({ type: '*/*' }), async (req: Request, res: Response) => {
  const camId = String(req.params.camId);
  const whepUrl = `http://${SENTINEL_WHEP_HOST}:${SENTINEL_WHEP_PORT}/stream/${camId}/whep`;

  try {
    // Read the SDP offer from the browser
    let sdpOffer = '';
    if (typeof req.body === 'string') {
      sdpOffer = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      sdpOffer = req.body.toString('utf-8');
    } else {
      // Body parser may have parsed it as JSON or other format
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      sdpOffer = Buffer.concat(chunks).toString('utf-8');
    }

    if (!sdpOffer || !sdpOffer.includes('v=0')) {
      return res.status(400).json({ error: 'Invalid SDP offer' });
    }

    // Build auth header matching what the Sentinel media server expects
    const authHeader = 'Basic ' + Buffer.from(`${SENTINEL_EMAIL}:${SENTINEL_TOKEN}`).toString('base64');

    // Forward SDP offer to the Sentinel WHEP endpoint
    const upstream = await fetch(whepUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authHeader,
        'User-Agent': 'SETU-Platform/1.0',
      },
      body: sdpOffer,
      signal: AbortSignal.timeout(5000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.warn(`[WHEP Proxy] Sentinel returned HTTP ${upstream.status}: ${errText}`);
      return res.status(upstream.status).json({
        error: `WHEP upstream error: HTTP ${upstream.status}`,
        detail: errText,
      });
    }

    const sdpAnswer = await upstream.text();

    // Forward any Location header (WHEP spec uses it for session management)
    const location = upstream.headers.get('location');
    if (location) {
      res.setHeader('Location', location);
    }

    res.setHeader('Content-Type', 'application/sdp');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Location');
    res.status(upstream.status).send(sdpAnswer);
  } catch (err: any) {
    console.warn(`[WHEP Proxy] Failed for ${camId}:`, err.message);
    return res.status(502).json({ error: `WHEP proxy error: ${err.message}` });
  }
});

export default router;
