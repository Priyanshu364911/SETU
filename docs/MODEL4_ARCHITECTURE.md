# SETU Registry — Model 4 Architecture & Integration Guide
## Central VMS & AI Analytics Platform Layer
### Gujarat Police Innovation Challenge 2026

---

## 1. Executive Summary & Design Rationale

This document details the architecture, design decisions, and operational workflow of **Model 4: Central VMS & AI Analytics Platform** for the **SETU Registry** system.

### The Challenge
Statewide CCTV surveillance across Gujarat spans municipal corporations (AMC, SMC, VMC), traffic police checkpoints, highway authorities, and district monitoring centers. Consolidating thousands of feeds into a centralized monitoring system typically runs into three major bottlenecks:
1. **Bandwidth and GPU Resource Exhaustion**: Streaming uncompressed HD feeds to a central GPU cluster for computer vision creates prohibitive infrastructure costs and single points of failure.
2. **Data Silos between Surveillance and Law Enforcement**: Real-time camera detections (e.g. license plates, subject sightings) lack automated linkage to national registries like MoRTH VAHAN/SARTHI or police crime records (CCTNS/eGujCop).
3. **Rigid VMS Proprietary Architectures**: Existing commercial VMS systems do not interoperate seamlessly with multi-agency governance models.

### Architectural Decision: In-Browser Edge ML & Inter-Agency Federation
Model 4 addresses these challenges with a dual-pillar design:
1. **Client-Side Edge AI Inference Engine**: Utilizing TensorFlow.js (WebGL backend) with the COCO-SSD object detection pipeline and tiny face detection running directly on the operator's workstation. Video frames from federated Sentinel nodes are analyzed in real time without saturating central server GPUs. Significant metadata, crowd spikes, and anomalies are reported back to the central backend.
2. **Inter-Agency Government Integrations Hub**: Automated bidirectional adapter layer connecting detection events directly with national and state databases (MoRTH VAHAN for vehicle verification, SARTHI for driver credentials, eGujCop for FIRs/criminal history, and AFIS/NAFIS for biometric correlation).

---

## 2. End-to-End System Architecture

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │      Departmental Edge / Sentinel Camera Feeds          │
                                  │         (RTSP / ONVIF / WHEP WebRTC / HLS Proxy)        │
                                  └───────────────────────────┬─────────────────────────────┘
                                                              │
                                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       MODEL 3: VMS FEDERATION LAYER (MIDDLEWARE)                                       │
│   • Stream Mediation Gateway (/api/stream/sentinel/:camId) • Camera-to-VMS Bindings • Cross-System Correlation Bus     │
└─────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
┌────────────────────────────────────────────────────────┐      ┌────────────────────────────────────────────────────────┐
│    MODEL 4 CLIENT: AI COMMAND CENTRE (/command-centre)  │      │     MODEL 4 CLIENT: INTEGRATIONS HUB (/integrations)   │
│ • Live WebRTC/HLS Video Stream Viewport                │      │ • Inter-Agency Data Gateway Status Dashboard           │
│ • TensorFlow.js COCO-SSD Object Detector (WebGL)       │      │ • MoRTH VAHAN Instant Plate & Owner Lookup Engine      │
│ • Real-Time Bounding Box Canvas Overlay Engine         │      │ • Stolen Vehicle Criminal Hotlist Intercept Alerts     │
│ • Autonomous Anomaly Rules (Spike/Blackout/Traffic)    │      │ • Compliance Inspection (Insurance, Fitness, Challans) │
│ • Live Subject Telemetry & Recharts Event Distribution │      │ • Immutable Query Audit Trail                          │
└───────────────────────────┬────────────────────────────┘      └───────────────────────────┬────────────────────────────┘
                            │                                                               │
                            │ Ingest Significant Detections                                 │ Query / Sync Requests
                            ▼                                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             MODEL 4 BACKEND EXPRESS API                                                │
│                                                   (/api/model4)                                                        │
│ • POST /ai/events (Ingest)     • GET /ai/events (Log)          • GET /dashboard (Stats)                                │
│ • GET /integrations (Registry) • POST /integrations/:id/sync   • GET /integrations/vahan/lookup                        │
│ • GET /system/metrics          • GET /system/capacity          • GET /integrations/queries                             │
└───────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            POSTGRESQL & POSTGIS DATABASE                                               │
│ • ai_analytics_events: Inference telemetry, person/vehicle counts, bounding boxes, anomalies, confidence scores        │
│ • external_integrations: Registry of MoRTH VAHAN, SARTHI, eGujCop, AFIS, NAFIS connection endpoints and uptime        │
│ • integration_queries: Complete audit logging of all law enforcement queries, query inputs, responses, latency        │
│ • vahan_vehicles: Gujarat vehicle master table (50+ seeded records, registration, stolen flags, FIR records)           │
│ • audit_log: Unified immutable audit trail with MODEL4_* action types                                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Capabilities & Workflows

### 3.1 Autonomous In-Browser AI Detection (`useAIDetection` hook)
- **Computer Vision Runtime**: Runs TensorFlow.js with WebGL hardware acceleration in the operator's browser.
- **Model Architecture**:
  - `coco-ssd` (MobileNet v2 lite base): Identifies persons, cars, trucks, buses, motorcycles, bicycles at ~20-30 FPS.
  - `face-api.js` TinyFaceDetector: Identifies human faces and head regions.
- **Dynamic Bounding Boxes**:
  - Persons: Emerald Green (`#10b981`)
  - Vehicles: Signal Blue (`#3b82f6`)
  - Faces: Amber Yellow (`#eab308`)
  - Anomalies: Crimson Red Alert Perimeter (`#ef4444`)
- **Telemetry Display**: Video HUD presents real-time FPS, inference duration (ms), active pipeline count, and backend resolution.

### 3.2 Deterministic Anomaly Evaluation Rules
The client AI engine evaluates four autonomous rules without needing server ML dependencies:
1. **`crowd_spike`**: Triggered when person count in a single frame exceeds 25 individuals (escalates to critical if >40).
2. **`camera_blackout`**: Triggered when person tracking count abruptly collapses from $\ge 5$ to 0, indicating lens obstruction, power cut, or tampering.
3. **`traffic_congestion`**: Triggered when vehicle density exceeds 15 queued vehicles in a monitored corridor.
4. **`after_hours_activity`**: Triggered when faces or pedestrians are identified between 23:00 and 05:00 in restricted-hours zones.

When triggered, an incident banner flashes across the viewer, an alert perimeter pulses, and an event is persisted to `/api/model4/ai/events`.

### 3.3 VAHAN Law Enforcement Intercept Workflow
1. Camera detects a vehicle plate or operator inputs an observed registration number into `/integrations`.
2. System queries the `vahan_vehicles` database table via `/api/model4/integrations/vahan/lookup`.
3. If the vehicle is listed on the stolen registry (`is_stolen = TRUE`), the interface immediately presents:
   - High-visibility red criminal intercept banner
   - Police FIR Number (e.g. `FIR/AHM/2026/04821`)
   - Registered owner and address
   - Insurance validity, RTO jurisdiction, chassis number, and pending traffic challans
4. All lookup transactions are recorded in `integration_queries` and the system-wide `audit_log`.

---

## 4. Database Schema Reference (Migration 009)

```sql
-- 1. AI Analytics Inference Results
CREATE TABLE IF NOT EXISTS ai_analytics_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    event_type      VARCHAR(30) NOT NULL CHECK (event_type IN (
                      'face_detection', 'crowd_count', 'vehicle_count', 'anomaly', 'anpr'
                    )),
    confidence      NUMERIC(5, 4) DEFAULT 0.90,
    payload         JSONB NOT NULL DEFAULT '{}',
    processing_ms   INTEGER DEFAULT 0,
    source          VARCHAR(20) DEFAULT 'live' CHECK (source IN ('live', 'recorded', 'inference')),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. External Government Integration Registry
CREATE TABLE IF NOT EXISTS external_integrations (
    id              VARCHAR(30) PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    system_type     VARCHAR(30) NOT NULL CHECK (system_type IN (
                      'vehicle_registry', 'licence_registry', 'police_db',
                      'fingerprint_db', 'face_db'
                    )),
    base_url        VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'connected' CHECK (status IN (
                      'connected', 'disconnected', 'degraded', 'maintenance'
                    )),
    last_sync_at    TIMESTAMPTZ,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Inter-Agency Query Audit Log
CREATE TABLE IF NOT EXISTS integration_queries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id  VARCHAR(30) NOT NULL REFERENCES external_integrations(id),
    query_type      VARCHAR(30) NOT NULL,
    query_input     JSONB NOT NULL,
    response_data   JSONB,
    status          VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout', 'not_found')),
    response_ms     INTEGER DEFAULT 0,
    queried_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VAHAN Vehicle Registry (Local Mirror)
CREATE TABLE IF NOT EXISTS vahan_vehicles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number    VARCHAR(20) NOT NULL UNIQUE,
    owner_name      VARCHAR(100) NOT NULL,
    vehicle_make    VARCHAR(50),
    vehicle_model   VARCHAR(50),
    vehicle_color   VARCHAR(30),
    vehicle_type    VARCHAR(30),
    registration_date DATE,
    insurance_valid_until DATE,
    insurance_status VARCHAR(20) DEFAULT 'active',
    fitness_valid_until DATE,
    rto_office      VARCHAR(50),
    fuel_type       VARCHAR(20),
    engine_number   VARCHAR(30),
    chassis_number  VARCHAR(30),
    is_stolen       BOOLEAN DEFAULT FALSE,
    stolen_fir_number VARCHAR(30),
    challan_count   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Endpoint Specifications

All endpoints are mounted at `/api/model4` and protected with JWT `authMiddleware`:

| Method | Endpoint | Description | Query / Body Params | Response |
|--------|----------|-------------|---------------------|----------|
| `GET` | `/dashboard` | System overview stats, AI totals today, anomaly list | None | JSON `{ ai, recentAnomalies, integrations, system }` |
| `GET` | `/ai/events` | Paginated AI analytics event log | `page`, `pageSize`, `event_type`, `camera_id`, `minConfidence` | JSON `{ data: [], total, page, pageSize }` |
| `POST` | `/ai/events` | Ingest an AI detection event from client inference | `{ camera_id, event_type, confidence, payload, processing_ms }` | HTTP 201 `{ id, ... }` |
| `GET` | `/ai/analytics` | Hourly aggregated time-series and top cameras | None | JSON `{ hourly: [], topCameras: [] }` |
| `GET` | `/integrations` | List all 5 government integrations with status | None | JSON `{ data: [] }` |
| `POST` | `/integrations/:id/sync` | Trigger sync / heartbeat check | `id` in path | JSON `{ message, data }` |
| `GET` | `/integrations/vahan/lookup` | Query vehicle registry by registration plate | `plate` | JSON `{ found: boolean, vehicle: { ... }, responseMs }` |
| `GET` | `/integrations/queries` | Audit trail of inter-agency lookups | `limit` (default 50) | JSON `{ data: [] }` |
| `GET` | `/system/metrics` | Real-time system load, GPU load, ingest rate | None | JSON `{ cameraCount, aiEventsToday, gpuUtilisation, ... }` |
| `GET` | `/system/capacity` | Scalability status (current vs 80,000 cameras) | None | JSON `{ current_cameras, target_capacity, projected_bandwidth_gbps, ... }` |

---

## 6. Summary of Architectural Achievements

1. **Zero Server GPU Bottleneck**: Full person, vehicle, and face detection occurs in-browser via TensorFlow.js WebGL, allowing thousands of operator stations to inspect streams simultaneously.
2. **Actionable Law Enforcement Integration**: Real-time VAHAN vehicle lookup returns verified owner and legal compliance details, instantly alerting operators to stolen vehicles and outstanding FIRs.
3. **Audit Compliance**: All AI ingestion events and inter-agency queries produce tamper-evident audit records under `MODEL4_AI_EVENT`, `MODEL4_INTEGRATION_SYNC`, and `MODEL4_VAHAN_LOOKUP`.
