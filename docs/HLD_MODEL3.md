# High-Level Design — SETU Model 3: Federation Spine

## 1. Overview

SETU (Smart Eye Traffic Unit) solves India's fragmented surveillance infrastructure problem: hundreds of cameras across municipal, police, and government VMS platforms that cannot talk to each other. Model 3 introduces a **Federation Spine** — a northbound middleware layer that sits atop Model 1's canonical registry.

**Scale target:** 80,000+ registered cameras across Gujarat, unified through a single federation API.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SETU Registry (Model 1)                    │
│  Cameras · Districts · Departments · GIS · Health · Audit        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Registry IDs (GJ-XX-000000)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Federation Spine (Model 3)                          │
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ FederationSvc │  │ CorrelationSvc│  │   WatchlistService   │ │
│  │  ingestEvent  │  │ correlate     │  │  matchPlate + dedupe  │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────┬───────────┘ │
│         │                  │                       │             │
│  ┌──────▼───────────────────────────────────────▼─────────────┐ │
│  │              federated_events DB table                       │ │
│  │    correlation_tracks · watchlist_entries · alerts           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │  Adapter: VMS-A │  │ Adapter:VMS-B│  │ Adapter: GovFeed  │   │
│  │  REST polling   │  │ Event stream │  │  Sentinel/HLS     │   │
│  └─────────────────┘  └─────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                    Northbound API
                  /api/federation/*
                            │
┌─────────────────────────────────────────────────────────────────┐
│                    React Client (Model 3 UI)                     │
│  Federation Hub · Watchlist · Alerts · Correlation · Adapter Docs│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Model 1 — Registry (unchanged)
- **PostgreSQL** canonical store: cameras, districts, departments, users
- Camera IDs follow `GJ-{DISTRICT}-{6-digit}` format
- APIs: onboarding, gap analysis, GIS, health, audit

### 3.2 Federation Spine (Model 3)

| Component | Purpose |
|-----------|---------|
| `FederationService` | Ingests canonical events, resolves camera bindings, publishes on EventBus |
| `CorrelationService` | Cross-system plate/entity track within a 2h sliding window |
| `WatchlistService` | Active entity list; plate matching with 5-min alert dedupe |
| `AlertService` | CRUD for open/acknowledged/closed alerts |
| `StreamSessionService` | Short-lived mediated stream tokens (no direct VMS URL in UI) |
| `AnprService` | Shared plate pipeline for both adapter callbacks and manual inject |
| `MappingService` | Auto-maps registry cameras to VMS external IDs |
| `EventBus` | In-process pub/sub; optionally bridges to Redis when configured |

### 3.3 Adapter Layer

All adapters implement the `VmsAdapter` interface:
- `connect()` / `disconnect()` / `healthCheck()`
- `listCameras()` → `CanonicalCameraMetadata[]`
- `requestStream(externalId)` → `{ url, protocol, expiresInSec }`
- `startEventIngest(onEvent)` → continuous push of `CanonicalEvent`

| Adapter | Type | Protocol |
|---------|------|----------|
| `VmsAAdapter` | `vms_a_rest` | REST polling simulator |
| `VmsBAdapter` | `vms_b_events` | Webhook event stream simulator |
| `GovFeedAdapter` | `gov_feed` | Sentinel HLS feed catalogue |

### 3.4 Plate Pipeline (Shared)

All plate detections — whether from adapters or manual ANPR inject — flow through the same pipeline:

```
PlateDetected event
       │
       ▼
federationService.ingestEvent()    ← persists to federated_events
       │
       ▼
correlationService.correlatePlateEvent()  ← upserts correlation_track
       │
       ▼
watchlistService.matchPlate()    ← normalize, match active entries
       │
  [if match & not deduped]
       │
       ▼
INSERT INTO alerts (severity=critical|high|medium)
federationService.ingestEvent(WatchlistMatch)
```

**Deduplication:** No new `open`/`acknowledged` alert for the same plate within 5 minutes. Correlation still updates.

### 3.5 Stream Mediation

UI never accesses VMS URLs directly. All stream access flows through:
```
POST /api/federation/streams → creates session_token (64 hex, 300s TTL)
GET /api/federation/streams/:token → returns mediated URL
```

---

## 4. Database Schema (007_federation.sql)

| Table | Purpose |
|-------|---------|
| `vms_systems` | VMS vendor registrations |
| `camera_vms_bindings` | Registry camera ↔ VMS external ID mapping |
| `federated_events` | All canonical events (PlateDetected, WatchlistMatch, etc.) |
| `correlation_tracks` | Cross-camera entity tracks |
| `watchlist_entries` | Active surveillance entities (soft-delete via `is_active`) |
| `alerts` | Watchlist hit alerts (severity: low/medium/high/critical) |
| `stream_sessions` | Short-lived mediated stream tokens |

---

## 5. Scale Narrative

| Metric | Current (Demo) | Production Target |
|--------|---------------|-------------------|
| Cameras | ~20 demo | 80,000 Gujarat |
| VMS systems | 3 (A, B, Gov) | 50+ heterogeneous |
| Events/hour | ~360 (simulators) | ~2.8M (avg 35 events/cam/hr) |
| Plate detections | ~120/hr | ~480K/hr |
| Active watchlist | 2 (demo seed) | 50,000+ |

**Horizontal scaling path:**
1. EventBus → Redis Pub/Sub (env: `REDIS_URL`)
2. Ingest workers → separate Node processes consuming bus
3. Correlation → Redis-backed sliding window
4. Alert deduplication → Redis SET with TTL
5. Stream sessions → shared Redis store

---

## 6. Security

- All `/api/federation/*` endpoints require JWT (same auth middleware as Model 1)
- `/sim/*` (simulator endpoints) remain open for local demo
- Stream mediation prevents direct VMS credential exposure
- Watchlist deactivation is soft (audit trail preserved via `is_active=false`)

---

## 7. Future Extensions (Production Path)

- Real ANPR sidecar → calls `POST /api/federation/anpr/detect` (same pipeline)
- Sentinel live catalogue → `SENTINEL_BASE_URL` env (gov feed adapter)
- Cross-state federation → repeat adapter pattern for additional state SETU registries
- Face recognition → `entity_type: wanted_person` in watchlist
- Kafka/Kinesis → replace EventBus for multi-datacenter event streaming

---

## 8. Docs Links

- [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) — evaluator step-by-step guide
- [Adapter Docs page](/adapter-docs) in the UI — integration guide for VMS vendors
- [feeds.example.json](../server/config/feeds.example.json) — Sentinel feed format reference
