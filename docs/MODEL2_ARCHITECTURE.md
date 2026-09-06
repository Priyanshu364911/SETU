# SETU Registry — Model 2 Architecture & Integration Guide
## Unified Viewing & Metadata Analytics Layer
### Gujarat Police Innovation Challenge 2026

---

## 1. Executive Summary & Design Rationale

This document details the architecture and implementation of **Model 2: Unified Viewing & Metadata Analytics** for the **SETU Registry** system.

### Architectural Decision: Consuming Model 3 Federation Layer
Per Section 3 of the Product Requirements Document (PRD), **Model 2 does not duplicate a parallel, direct connection path to departmental VMS systems.** Instead, Model 2's viewing and analytics engine consumes camera video streams and metadata directly through the existing **Model 3 VMS Federation Layer**.

#### Justification:
1. **Single Point of Protocol Adaptation**: Model 3's adapter/plugin framework (`GovFeedAdapter`, `VmsAAdapter`, `VmsBAdapter`) already manages authentication, token rotation, protocol translation (RTSP, ONVIF, WHEP, HLS), and connection pooling for departmental VMS platforms.
2. **Unified Registry Context**: Model 1's Camera Registry remains the single source of truth for camera metadata, geographic locations, and ownership permissions.
3. **Clean Layering**: Model 2 operates as the **viewing and analytics experience layer**. It requests stream handles from Model 3, renders them in the unified viewer, performs ANPR plate detection and manual event tagging, and publishes events back onto Model 3's metadata bus.

---

## 2. End-to-End Data Flow

```
Departmental VMS / Camera Systems (Sentinel Grid, SMC, AMC, Police)
        │
        ▼  [RTSP / ONVIF / WHEP / HLS — Managed by Model 3 Adapters]
Model 3: VMS Federation Layer (Middleware)
   - Adapter Registry & Protocol Translators
   - Stream Session Manager (`/api/stream/sentinel/:camId/index.m3u8`)
   - Event Exchange Bus & Cross-System Correlation Engine
        │
        ▼  [Model 2 requests stream handles & ingests frames]
Model 2: Unified Viewing & Metadata Analytics Layer
   - Live View Multi-Grid Viewer (1x1, 2x2, 3x3)
   - ANPR Engine (Plate Detection & Normalization)
   - Operator Manual Event Tagging (`tagged_events`)
   - Vehicle Search & GIS Movement Trajectory Engine (`detection_events`)
        │
        ▼  [Writes Detections, Tags & Watchlist Hits]
Unified Audit Trail & Real-Time Alerts
   - Model 1 Central Audit Log (`audit_log`)
   - Model 3 Hotlist & Watchlist Alerts (`alerts`)
```

---

## 3. Scope & Key Features

### 3.1 Unified Multi-Camera Viewer (`/live-view`)
- **Grid Layouts**: Configurable 1x1, 2x2, 3x3 camera tiles.
- **Camera Selection**: Pulls active federated cameras from Model 1 & Model 3 registry.
- **Dual Stream rendering**: Real-time WebRTC WHEP (<200ms latency) with automatic HLS proxy fallback (~2s latency) and AI canvas simulation mode.
- **Operator Event Tagging**: Allows operators to tag moments of interest on live streams with notes, logging directly to `tagged_events` and the central `audit_log`.

### 3.2 Vehicle Search & Path Analytics (`/vehicle-search`)
- **Plate Number Search**: Exact and partial match search across live and historical ANPR detection events.
- **Chronological Detections List**: Camera ID, location, timestamp, confidence match score, and source.
- **GIS Trajectory Visualizer**: Plots the vehicle's movement sequence on an interactive Leaflet map, connecting passage points chronologically with polyline direction indicators.

### 3.3 Watchlist & Alert Integration (`/watchlist`, `/alerts`)
- Plate matches automatically trigger hotlist alerts in Model 3's alert system.
- Unacknowledged alerts update the left navigation badge in real time.

---

## 4. Database Schema Additions (Model 2)

```sql
-- ANPR Detection Events
CREATE TABLE IF NOT EXISTS detection_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    plate_raw       VARCHAR(50) NOT NULL,
    plate_normalised VARCHAR(50) NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence      NUMERIC(5, 4) DEFAULT 0.95,
    snapshot_url    TEXT,
    source          VARCHAR(20) DEFAULT 'live' CHECK (source IN ('live', 'recorded', 'simulation')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Operator Manual Event Tags
CREATE TABLE IF NOT EXISTS tagged_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note            TEXT NOT NULL,
    tagged_by       UUID REFERENCES users(id),
    snapshot_url    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Reference (Model 2)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/model2/live-feeds` | Returns active federated camera feeds with stream handles |
| `POST` | `/api/model2/events/tag` | Manual operator tag for a camera moment of interest |
| `GET` | `/api/model2/events/tagged` | List recent operator tagged events |
| `POST` | `/api/model2/anpr/detect` | Post ANPR detection event & run watchlist matching |
| `GET` | `/api/model2/vehicle-search` | Search plate detections & generate GIS trajectory path |
| `GET` | `/api/model2/stats` | High-level metrics for Model 2 widgets |

---

## 6. Audit Trail Integration

All Model 2 operations log structured entries into Model 1's append-only `audit_log` table with the following action types:
- `MODEL2_EVENT_TAGGED`: Manual event tag created by operator.
- `MODEL2_ANPR_DETECT`: Plate detection ingested.
- `MODEL2_VEHICLE_SEARCH`: Vehicle search query executed.
- `MODEL2_WATCHLIST_UPDATE`: Watchlist entry added/removed.
- `MODEL2_ALERT_ACTION`: Alert acknowledged/closed.
