import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import authRoutes from './routes/auth';
import cameraRoutes from './routes/cameras';
import onboardingRoutes from './routes/onboarding';
import gapRoutes from './routes/gap';
import healthRoutes from './routes/health';
import auditRoutes from './routes/audit';
import departmentRoutes from './routes/departments';
import userRoutes from './routes/users';
import federationRoutes from './routes/federation';
import streamProxyRoutes from './routes/streamProxy';

// VMS Simulators (Model 3 — departmental VMS heterogeneity demo)
import vmsARouter from './federation/simulators/vmsA';
import vmsBRouter from './federation/simulators/vmsB';

import federationService from './federation/services/FederationService';
import correlationService from './federation/services/CorrelationService';
import mappingService from './federation/services/MappingService';
import watchlistService from './federation/services/WatchlistService';
import adapterRegistry from './federation/adapters/AdapterRegistry';
import { query } from './db';


const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "data:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
    },
  },
}));


// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting (general)
// Raised from 100→300 to accommodate federation polling intervals
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Stream Proxy (Mounted before rate limiter so HLS segments are not throttled) ───
app.use('/api/stream', streamProxyRoutes);

app.use(generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── VMS Simulators ───────────────────────────────────────────────────────────
// Mounted before auth — simulators are internal trusted services (no JWT needed)
app.use('/sim/vms-a', vmsARouter);
app.use('/sim/vms-b', vmsBRouter);

// ─── Model 1 API routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/gap-analysis', gapRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);

// ─── Model 3 Federation northbound API ───────────────────────────────────────
app.use('/api/federation', federationRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Federation Bootstrap ─────────────────────────────────────────────────────
/**
 * Federation Bootstrap (Real Government Feeds Only):
 * - Registers and connects GovFeedAdapter for the official Sentinel Camera Grid.
 * - Syncs live camera metadata and binds external Sentinel IDs to SETU Registry IDs.
 * - Wires live plate events to the real-time correlation and watchlist pipeline.
 */
async function bootstrapFederation() {
  // Phase 5: Bootstrap Sentinel Government Camera Grid
  await bootstrapGovFeed();

  // Shared plate pipeline — used by Sentinel camera AI inference
  const sharedPlatePipeline = async (plateEvent: any) => {
    const plate = String(plateEvent.payload?.plate || '');
    if (!plate) return;
    try {
      const track = await correlationService.correlatePlateEvent(plateEvent);
      await watchlistService.matchPlate({
        plate,
        cameraId: plateEvent.cameraId || null,
        eventId: plateEvent.id || null,
        trackId: track?.id || null,
        vmsSystemId: plateEvent.vmsSystemId,
        confidence: plateEvent.payload?.confidence,
      });
    } catch (err: any) {
      console.warn('[Federation] Plate pipeline error:', err.message);
    }
  };

  // Start Sentinel GovFeed adapter
  await federationService.startAllAdapters(sharedPlatePipeline);

  // Sync government cameras and auto-map to Registry IDs
  try {
    await federationService.syncSystem('gov-feeds');
    const mapped = await mappingService.autoMapDemo();
    console.log(`[Federation] Auto-mapped ${mapped.created} Sentinel camera binding(s)`);
  } catch (err: any) {
    console.warn('[Federation] Sentinel sync notice:', err.message);
  }
}


/**
 * Phase 5: Bootstrap government/Sentinel feed adapter.
 * Auth: POST /auth/login with SENTINEL_API_TOKEN → session cookie.
 * Catalogue: GET https://cctv.corp8.cloud/cameras.json → 30 cameras.
 * Streams:
 *   HLS   https://cctv.corp8.cloud/<id>/index.m3u8  (CDN, cookie)
 *   RTSP  rtsp://103.250.160.189:8554/stream/<id>   (direct)
 *   WHEP  http://103.250.160.189:8889/stream/<id>/whep (direct)
 */
async function bootstrapGovFeed() {
  const sentinelBaseUrl = process.env.SENTINEL_BASE_URL || 'https://cctv.corp8.cloud';
  const sentinelToken = process.env.SENTINEL_API_TOKEN || '';
  const rtspHost = process.env.SENTINEL_RTSP_HOST || '103.250.160.189';
  const govFeedsJson = process.env.GOV_FEEDS_JSON;
  const useExample = process.env.USE_EXAMPLE_FEEDS === 'true';

  let staticFeeds: any[] = [];

  // Always attempt to load fallback feeds from feeds.json
  const candidatePaths = [
    resolve(__dirname, '../config/feeds.json'),
    resolve(__dirname, '../../config/feeds.json'),
    resolve(process.cwd(), 'config/feeds.json'),
    resolve(process.cwd(), 'server/config/feeds.json'),
  ];
  const feedsFile = candidatePaths.find((p) => existsSync(p));

  const exampleCandidatePaths = [
    resolve(__dirname, '../config/feeds.example.json'),
    resolve(__dirname, '../../config/feeds.example.json'),
    resolve(process.cwd(), 'config/feeds.example.json'),
    resolve(process.cwd(), 'server/config/feeds.example.json'),
  ];
  const exampleFile = exampleCandidatePaths.find((p) => existsSync(p));

  if (feedsFile) {
    try {
      const raw = JSON.parse(readFileSync(feedsFile, 'utf-8'));
      staticFeeds = Array.isArray(raw) ? raw : raw.feeds || [];
      console.log(`[GovFeed] Loaded ${staticFeeds.length} static feed(s) from ${feedsFile}`);
    } catch (err: any) {
      console.warn('[GovFeed] feeds.json parse error:', err.message);
    }
  } else if (useExample && exampleFile) {
    try {
      const raw = JSON.parse(readFileSync(exampleFile, 'utf-8'));
      staticFeeds = Array.isArray(raw) ? raw : raw.feeds || [];
    } catch (_) {}
  } else if (govFeedsJson) {
    try {
      const parsed = JSON.parse(govFeedsJson);
      staticFeeds = Array.isArray(parsed) ? parsed : parsed.feeds || [];
      console.log(`[GovFeed] Loaded ${staticFeeds.length} feed(s) from GOV_FEEDS_JSON`);
    } catch (_) {}
  }

  console.log(`[GovFeed] Using Sentinel live catalogue at ${sentinelBaseUrl}/cameras.json`);

  // Upsert gov-feeds row into vms_systems
  try {
    await query(
      `INSERT INTO vms_systems (id, name, vendor, adapter_type, base_url, status, config)
       VALUES ('gov-feeds', 'Sentinel Camera Grid', 'SentinelGrid', 'gov_feed', $1, 'disconnected', $2)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         adapter_type = EXCLUDED.adapter_type,
         base_url = EXCLUDED.base_url,
         config = EXCLUDED.config,
         updated_at = NOW()`,
      [sentinelBaseUrl, JSON.stringify({ feeds: staticFeeds, token: sentinelToken })]
    );
    console.log('[GovFeed] Upserted gov-feeds vms_systems row');

    // Ensure the adapter is registered so startAllAdapters picks it up
    let govAdapter = adapterRegistry.get('gov-feeds');
    if (!govAdapter) {
      govAdapter = adapterRegistry.create('gov_feed', 'gov-feeds', sentinelBaseUrl, {
        feeds: staticFeeds,
        token: sentinelToken,
        rtspHost,
      });
      adapterRegistry.register(govAdapter);
    } else if (govAdapter instanceof (await import('./federation/adapters/GovFeedAdapter')).GovFeedAdapter) {
      govAdapter.setFeeds(staticFeeds);
    }

    // ── Auto-sync all live cameras into camera_registry ──────────────────
    // This populates the DB so the frontend /api/cameras and GIS map work
    // immediately without needing a manual seed step.
    // ── Warm up adapter: authenticate & discover cameras ──────────────────
    try {
      const { GovFeedAdapter } = await import('./federation/adapters/GovFeedAdapter');
      const warmAdapter = new GovFeedAdapter('gov-feeds', sentinelBaseUrl, staticFeeds, sentinelToken);
      const cameras = await warmAdapter.listCameras();
      console.log(`[GovFeed] ✅ Live catalogue: ${cameras.length} cameras discovered (${cameras.filter(c => c.status === 'online').length} online)`);
      cameras.slice(0, 5).forEach(c => console.log(`  · ${c.externalCameraId}: ${c.name}`));
      if (cameras.length > 5) console.log(`  … and ${cameras.length - 5} more`);
    } catch (warmErr: any) {
      console.warn('[GovFeed] Catalogue warm-up error (non-fatal):', warmErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────


  } catch (err: any) {
    console.warn('[GovFeed] Bootstrap error (non-fatal):', err.message);
  }
}


// Start server
app.listen(PORT, async () => {
  console.log(`SETU Registry API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Bootstrap federation after HTTP server is up
  try {
    await bootstrapFederation();
    console.log('[Federation] Bootstrap complete');
  } catch (err: any) {
    // Non-fatal — server stays up even if federation bootstrap fails
    console.error('[Federation] Bootstrap error (non-fatal):', err.message);
  }
});

export default app;

