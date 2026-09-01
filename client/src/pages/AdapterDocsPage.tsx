import './AdapterDocsPage.css';

const ARCH_DIAGRAM = `
┌─────────────────────────────────────────────────────────────────────┐
│                   MODEL 3 — VMS FEDERATION FABRIC                   │
└─────────────────────────────────────────────────────────────────────┘

 Departmental VMS (Source Systems — heterogeneous, untouched)
 ┌─────────────────────┐    ┌─────────────────────────────────────┐
 │  VMS-A (SimCloudVMS)│    │    VMS-B (EventEdge — Police/RTO)   │
 │  REST inventory API │    │    Event/webhook model, deviceId    │
 │  GET /api/cameras   │    │    GET /v1/devices                  │
 │  POST /streams/:id  │    │    POST /v1/devices/:id/live        │
 └──────────┬──────────┘    └──────────────┬──────────────────────┘
            │                              │
            ▼                              ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                  ADAPTER PLUGIN LAYER                            │
 │  VmsAAdapter (vms_a_rest)        VmsBAdapter (vms_b_events)     │
 │  • connect / disconnect          • connect / disconnect         │
 │  • healthCheck                   • healthCheck                  │
 │  • listCameras → Canonical       • listCameras → Canonical      │
 │  • requestStream (session)       • requestStream (session)      │
 │  • startEventIngest (poll 15s)   • startEventIngest (poll 8s)   │
 │                                                                  │
 │  + GovFeedAdapter (gov_feed)  — config-driven RTSP/HLS/HTTP     │
 └─────────────────────────────┬────────────────────────────────────┘
                               │  CanonicalEvent
                               ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │             FEDERATION MIDDLEWARE (FederationService)            │
 │  • Validates tenant / adapter auth                               │
 │  • Resolves external camera ID → registry camera ID (binding)    │
 │  • Persists to federated_events (Postgres)                       │
 │  • Publishes on Event Bus (in-process + optional Redis)          │
 └──────────────────┬───────────────────────────────────────────────┘
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
 ┌─────────────────┐  ┌─────────────────────────────────────────────┐
 │  Event/Metadata │  │         CORRELATION ENGINE                  │
 │  Bus            │  │  correlatePlateEvent()                      │
 │  (EventBus.ts)  │  │  • Joins PlateDetected events by plate      │
 │  In-memory +    │  │  • Updates correlation_tracks (Postgres)    │
 │  Redis optional │  │  • Tracks camera_ids[], timestamps, geo     │
 └─────────────────┘  └──────────────────────────┬──────────────────┘
                                                  │
                               ┌──────────────────┘
                               ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │             UNIFIED NORTHBOUND API (federation.ts)               │
 │  GET  /api/federation/systems        — VMS system registry       │
 │  GET  /api/federation/connectors     — Live health statuses      │
 │  POST /api/federation/systems/:id/sync — On-demand sync         │
 │  GET  /api/federation/cameras        — Federated camera list     │
 │  GET  /api/federation/events         — Canonical event log       │
 │  POST /api/federation/bindings       — Link registry ↔ VMS      │
 │  GET  /api/federation/tracks         — Correlation tracks        │
 │  GET  /api/federation/tracks/:id/history — GIS movement path    │
 │  GET  /api/federation/analytics/report   — 24h report JSON      │
 │  GET  /api/federation/analytics/report.csv — CSV export         │
 └─────────────────────┬────────────────────────────────────────────┘
                       │  JWT-authenticated consumers
          ┌────────────┼───────────────┐
          ▼            ▼               ▼
 Federation Hub  Correlation     Model 1 Registry
 (React page)    Dashboard       (existing GIS/
                 (React page)     camera pages)
`;

const INTERFACE_CODE = `<span class="token-comment">/** Adapter plugin contract — every VMS vendor must implement this */</span>
<span class="token-keyword">interface</span> <span class="token-type">VmsAdapter</span> {
  <span class="token-keyword">readonly</span> id:          <span class="token-type">string</span>;       <span class="token-comment">// VMS system DB row ID</span>
  <span class="token-keyword">readonly</span> type:        <span class="token-type">AdapterType</span>; <span class="token-comment">// 'vms_a_rest' | 'vms_b_events' | 'gov_feed' | 'onvif_rtsp'</span>
  <span class="token-keyword">readonly</span> displayName: <span class="token-type">string</span>;

  <span class="token-method">connect</span>():        <span class="token-type">Promise&lt;void&gt;</span>;
  <span class="token-method">disconnect</span>():     <span class="token-type">Promise&lt;void&gt;</span>;
  <span class="token-method">healthCheck</span>():   <span class="token-type">Promise&lt;{ ok: boolean; detail?: string }&gt;</span>;
  <span class="token-method">listCameras</span>():   <span class="token-type">Promise&lt;CanonicalCameraMetadata[]&gt;</span>;
  <span class="token-method">getCamera</span>(externalId: <span class="token-type">string</span>): <span class="token-type">Promise&lt;CanonicalCameraMetadata | null&gt;</span>;

  <span class="token-comment">/** Request a mediated stream handle — UI/AI never gets raw VMS URLs */</span>
  <span class="token-method">requestStream</span>(externalId: <span class="token-type">string</span>): <span class="token-type">Promise&lt;{
    url: string;
    protocol: 'hls' | 'webrtc' | 'mjpeg' | 'snapshot';
    expiresInSec: number;
  } | null&gt;</span>;

  <span class="token-comment">/** Start polling or webhook listener — emit canonical events via callback */</span>
  <span class="token-method">startEventIngest</span>(onEvent: (event: <span class="token-type">CanonicalEvent</span>) => <span class="token-type">void</span>): <span class="token-type">Promise&lt;void&gt;</span>;
  <span class="token-method">stopEventIngest</span>(): <span class="token-type">Promise&lt;void&gt;</span>;
}`;

const SCHEMA_FIELDS = [
  { field: 'eventType', type: 'CanonicalEventType', required: 'Yes', description: 'CameraMetadataUpdated | CameraHealthChanged | StreamAvailable | AnalyticsEvent | PlateDetected | WatchlistMatch | SystemHeartbeat | AdapterError' },
  { field: 'vmsSystemId', type: 'string', required: 'Yes', description: 'ID of the source VMS system' },
  { field: 'cameraId', type: 'string?', required: 'No', description: 'SETU registry camera ID (GJ-XX-000000) — resolved from binding' },
  { field: 'externalCameraId', type: 'string?', required: 'No', description: 'Vendor-native camera identifier' },
  { field: 'severity', type: 'EventSeverity', required: 'No', description: 'info | low | medium | high | critical' },
  { field: 'payload', type: 'Record<string,unknown>', required: 'Yes', description: 'Event-type specific data (plate, confidence, status, etc.)' },
  { field: 'occurredAt', type: 'ISO string', required: 'Yes', description: 'Event timestamp from source VMS' },
  { field: 'correlationId', type: 'UUID?', required: 'No', description: 'Cross-system correlation group identifier' },
];

export default function AdapterDocsPage() {
  return (
    <div className="adapter-docs">
      <div className="adapter-docs__header">
        <div className="adapter-docs__title">Adapter Architecture Documentation</div>
        <div className="adapter-docs__subtitle">
          Model 3 Phase 3 deliverable — VMS Federation Plugin Framework
        </div>
      </div>

      <div className="adapter-docs__body">

        {/* ─── Overview ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Overview</div>
          <div className="doc-section__body">
            <p>
              SETU Model 3 adopts a <strong>VMS Federation &amp; Middleware</strong> architecture.
              Instead of connecting directly to each departmental CCTV camera (Model 2) or
              replacing all systems with one central VMS (Model 4), Model 3 federates
              heterogeneous departmental VMS platforms via a common <strong>adapter/plugin layer</strong>.
            </p>
            <p>
              Each departmental VMS retains its own infrastructure and operational control.
              The federation middleware integrates them through adapters, normalises their
              divergent APIs into a <strong>canonical event schema</strong>, and exposes a single
              unified northbound API for downstream dashboards and AI services.
            </p>
            <ul>
              <li><strong>Vendor-neutral:</strong> new VMS vendors add one adapter class, no middleware changes.</li>
              <li><strong>Interoperable:</strong> single canonical schema; heterogeneous sources speak one language.</li>
              <li><strong>Model 1 integrated:</strong> federation references SETU registry camera IDs (GJ-XX-000000) as the statewide identity — no parallel inventory.</li>
              <li><strong>Mediated access:</strong> stream URLs are never exposed directly to the UI; all access is through the federation API (Model 3 architectural principle).</li>
            </ul>
          </div>
        </div>

        {/* ─── Architecture Diagram ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Architecture Diagram</div>
          <pre className="arch-diagram">{ARCH_DIAGRAM}</pre>
        </div>

        {/* ─── Adapter Plugin Interface ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Adapter Plugin Interface (TypeScript)</div>
          <div className="doc-section__body">
            <p>
              Every VMS vendor adapter implements the <code>VmsAdapter</code> interface.
              Concrete adapters extend <code>BaseAdapter</code> and override vendor-specific methods.
            </p>
          </div>
          <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
            <div
              className="interface-block"
              dangerouslySetInnerHTML={{ __html: INTERFACE_CODE }}
            />
          </div>
        </div>

        {/* ─── VMS-A vs VMS-B Comparison ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Heterogeneity Demo — VMS-A vs VMS-B</div>
          <div className="adapter-compare">
            <div className="adapter-card">
              <div className="adapter-card__head">VMS-A — SimCloudVMS (Municipal)</div>
              <div className="adapter-card__rows">
                {[
                  ['Type', 'vms_a_rest'],
                  ['Style', 'REST inventory + health poll'],
                  ['Camera ID', 'MUNI-CAM-001 … 005'],
                  ['Endpoint', 'GET /api/cameras'],
                  ['Stream', 'POST /api/cameras/:id/stream'],
                  ['Events', 'Polled every 15s (health)'],
                  ['Auth', 'No auth (internal)'],
                  ['Protocol', 'HTTP JSON'],
                ].map(([k, v]) => (
                  <div key={k} className="adapter-row">
                    <span className="adapter-row__key">{k}</span>
                    <span className="adapter-row__val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="adapter-card">
              <div className="adapter-card__head">VMS-B — EventEdge (Police/RTO)</div>
              <div className="adapter-card__rows">
                {[
                  ['Type', 'vms_b_events'],
                  ['Style', 'Event-oriented / webhook'],
                  ['Camera ID', 'RTO-DEV-10, POL-DEV-20 …'],
                  ['Endpoint', 'GET /v1/devices'],
                  ['Stream', 'POST /v1/devices/:id/live'],
                  ['Events', 'Poll /v1/events/poll every 8s'],
                  ['Auth', 'No auth (internal)'],
                  ['Protocol', 'HTTP JSON + event queue'],
                ].map(([k, v]) => (
                  <div key={k} className="adapter-row">
                    <span className="adapter-row__key">{k}</span>
                    <span className="adapter-row__val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="doc-section__body">
            <p>
              The key difference: VMS-A uses a canonical REST inventory model while VMS-B uses an
              event-push / polling model with a different ID scheme. The adapter layer normalises both
              into identical <code>CanonicalCameraMetadata</code> and <code>CanonicalEvent</code> objects
              before the federation middleware sees them — demonstrating vendor-neutral interoperability.
            </p>
          </div>
        </div>

        {/* ─── Canonical Event Schema ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Canonical Event Schema</div>
          <div className="doc-section__body">
            <p>All events from any VMS are normalised to this envelope before being persisted and published:</p>
          </div>
          <table className="schema-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMA_FIELDS.map((f) => (
                <tr key={f.field}>
                  <td>{f.field}</td>
                  <td>{f.type}</td>
                  <td style={{ color: f.required === 'Yes' ? 'var(--status-online)' : 'var(--text-tertiary)', fontFamily: 'monospace' }}>{f.required}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── Adding a New Adapter ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Adding a New Vendor Adapter</div>
          <div className="doc-section__body">
            <ol style={{ paddingLeft: 'var(--space-4)', lineHeight: 2 }}>
              <li>Create <code>server/src/federation/adapters/MyVmsAdapter.ts</code> extending <code>BaseAdapter</code>.</li>
              <li>Implement all methods of the <code>VmsAdapter</code> interface.</li>
              <li>Add the adapter type string to the <code>AdapterType</code> union in <code>federation/types.ts</code>.</li>
              <li>Register the new type in <code>AdapterRegistry.create()</code> switch statement.</li>
              <li>Update the <code>adapter_type</code> CHECK constraint in the <code>vms_systems</code> table (migration).</li>
              <li>Insert a row into <code>vms_systems</code> with the new adapter type and base URL.</li>
              <li>The federation middleware picks it up automatically on next server start.</li>
            </ol>
          </div>
        </div>

        {/* ─── Sentinel Camera Grid / Government Feed Adapter ─── */}
        <div className="doc-section">
          <div className="doc-section__heading">Sentinel Camera Grid Adapter (Official Integrator's Guide)</div>
          <div className="doc-section__body">
            <p>
              The <code>GovFeedAdapter</code> integrates directly with the <strong>Gujarat Police Sentinel Camera Grid Sandbox</strong> adhering strictly to the official Integrator's Guide specifications:
            </p>

            <table className="schema-table mb-3">
              <thead>
                <tr>
                  <th>Protocol</th>
                  <th>Endpoint Pattern</th>
                  <th>Intended Consumer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>RTSP (TCP)</td>
                  <td>rtsp://&lt;host&gt;:8554/stream/&lt;id&gt;</td>
                  <td>AI inference engines (OpenCV, GStreamer, FFmpeg, DeepStream)</td>
                </tr>
                <tr>
                  <td>WebRTC (WHEP)</td>
                  <td>http://&lt;host&gt;:8889/stream/&lt;id&gt;/whep</td>
                  <td>Ultra-low latency browser playback</td>
                </tr>
                <tr>
                  <td>HLS</td>
                  <td>http://&lt;host&gt;/live/stream/&lt;id&gt;/index.m3u8</td>
                  <td>Web dashboards, mobile, firewall-restricted networks</td>
                </tr>
                <tr>
                  <td>Catalogue</td>
                  <td>http://&lt;host&gt;/api/ingest</td>
                  <td>Single source of truth for all live camera IDs, codecs, and GPS coordinates</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Core Technical Rules (Do's and Don'ts):
            </div>
            <ul style={{ marginTop: '6px' }}>
              <li><strong>RTSP over TCP mandatory:</strong> Set <code>rtsp_transport=tcp</code> in all clients to prevent UDP packet loss across NATs.</li>
              <li><strong>PTS Timestamps only:</strong> Trackers and Kalman filters must use Presentation Timestamps (PTS / <code>CAP_PROP_POS_MSEC</code>), never wall-clock arrival time.</li>
              <li><strong>Heterogeneous Codecs:</strong> Grid contains mixed H.264 and H.265 at differing frame rates and resolutions.</li>
              <li><strong>Scene Discontinuity tolerance:</strong> Feeds loop continuous footage; re-identification and track IDs must handle hard cuts gracefully.</li>
            </ul>
          </div>
        </div>

        {/* ─── Documentation Links (Phase 5) ─── */}
        <div className="adapter-section">
          <div className="adapter-section__title">📄 Documentation & Runbooks</div>
          <div className="adapter-section__body">
            <p style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              The following documents are available in the <code>docs/</code> directory of this repository.
              Open them in any Markdown viewer or GitHub.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="adapter-doc-link-card">
                <div className="adapter-doc-link-card__title">🏃 DEMO_RUNBOOK.md</div>
                <div className="adapter-doc-link-card__desc">
                  Step-by-step evaluator guide: starting the stack, login, watchlist seeding, alert flow,
                  ANPR inject, correlation map, analytics export, and gov feed setup.
                </div>
                <div className="adapter-doc-link-card__path">
                  <code>docs/DEMO_RUNBOOK.md</code>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                    — Open in your editor or at{' '}
                    <a
                      href="https://github.com/your-org/setu/blob/main/docs/DEMO_RUNBOOK.md"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      GitHub
                    </a>
                  </span>
                </div>
              </div>

              <div className="adapter-doc-link-card">
                <div className="adapter-doc-link-card__title">🏗️ HLD_MODEL3.md</div>
                <div className="adapter-doc-link-card__desc">
                  High-Level Design for Model 3: federation architecture, component interactions,
                  shared plate pipeline sequence, database schema, scale narrative (80k cameras),
                  security model, and production path.
                </div>
                <div className="adapter-doc-link-card__path">
                  <code>docs/HLD_MODEL3.md</code>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                    — Open in your editor or at{' '}
                    <a
                      href="https://github.com/your-org/setu/blob/main/docs/HLD_MODEL3.md"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      GitHub
                    </a>
                  </span>
                </div>
              </div>

              <div className="adapter-doc-link-card">
                <div className="adapter-doc-link-card__title">📋 feeds.example.json</div>
                <div className="adapter-doc-link-card__desc">
                  Sentinel government feed configuration template. Replace placeholder URLs with
                  Resource URLs from the hackathon challenge portal, then set USE_EXAMPLE_FEEDS=true
                  or copy to <code>server/config/feeds.json</code>.
                </div>
                <div className="adapter-doc-link-card__path">
                  <code>server/config/feeds.example.json</code>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

