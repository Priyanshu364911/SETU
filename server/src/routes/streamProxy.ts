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

export default router;
