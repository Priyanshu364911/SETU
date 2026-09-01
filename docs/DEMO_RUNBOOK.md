# DEMO RUNBOOK — SETU Model 3 Federation
> Hackathon Evaluator Guide · SETU Smart Eye Traffic Unit

---

## Prerequisites

| Component | Status |
|-----------|--------|
| PostgreSQL 14+ | Running, migrations applied |
| Node 18+ | Server + client npm install done |
| Credentials | `sno_user` / `password123` |

---

## 1. Start the Stack

```bash
# Terminal 1 — Server
cd server
npm run migrate        # apply all migrations (001-007)
npm run seed           # seed demo cameras + users
npm run dev            # starts on :3000, bootstraps federation

# Terminal 2 — Client
cd client
npm run dev            # starts on :5173
```

**Expected server startup logs (after bootstrap):**
```
[Federation] Seeding vms_systems...
[WatchlistService] Seeded default watchlist entries
[Federation] Adapter started: vms-a-municipal (vms_a_rest)
[Federation] Adapter started: vms-b-police (vms_b_events)
[Federation] Auto-mapped N camera binding(s)
[Federation] Bootstrap complete
```

---

## 2. Login

Navigate to `http://localhost:5173` → login with:
- **Username:** `sno_user`
- **Password:** `password123`

---

## 3. Federation Hub — Systems & Cameras

1. Click **Federation Hub** in the left nav
2. **Systems tab:** You should see two VMS systems (`Municipal Cloud VMS`, `Police/RTO Checkpoint VMS`) with status `connected`
3. **Cameras tab:** Auto-mapped cameras are listed. Each row has a **View Stream** button
4. Click **View Stream** on any bound camera:
   - A modal opens with protocol, expiry countdown, and the mediated stream URL
   - The session token (64 hex chars) is valid for 300 seconds
   - For simulator cameras, the URL resolves to the simulator snapshot endpoint

---

## 4. Watchlist — Pre-seeded Plates

Navigate to **Watchlist** in the left nav:

| Plate | Type | Priority |
|-------|------|----------|
| `GJ01WL0001` | stolen_vehicle | **CRITICAL** |
| `GJ05WL0002` | blacklisted_vehicle | **HIGH** |

These two plates are auto-seeded on first boot and match VMS-B's `DEMO_PLATES` list.

**Add a custom entry:**
1. Click **Add Entry**
2. Fill in plate, type, priority
3. Click **Add to Watchlist**

**Remove an entry:** Click 🗑 next to any active entry (soft-deactivates via `is_active=false`)

---

## 5. Alerts — Watching VMS-B Fire

1. Navigate to **Alerts** in the left nav (badge shows open count)
2. Keep the tab on **Open**
3. VMS-B simulator fires plate events every ~10s — when `GJ01WL0001` or `GJ05WL0002` is detected, an alert appears within 5 seconds (5s poll)
4. Click any alert card to expand:
   - View plate, camera, severity, timestamp
   - **Acknowledge** with an optional note
   - **Close** to resolve
   - **View Track** → navigates to correlation

**Dedupe window:** At most ONE new open/acknowledged alert per plate per 5 minutes. The pipeline still correlates sightings but suppresses duplicate alert spam.

---

## 6. ANPR Inject — Manual Plate Demo

On the **Watchlist** page, the **ANPR Plate Inject** widget lets you manually push a plate through the federation pipeline:

1. Select a federated camera from the dropdown
2. Enter plate (e.g. `GJ01WL0001` for a watchlist hit, or any other plate)
3. Set confidence (0-1)
4. Click **Inject Plate**

**Result panel shows:**
- Event ID from `federated_events`
- Track sighting count from `correlation_tracks`
- 🚨 **WATCHLIST HIT** banner if the plate matched and a new alert was created

---

## 7. Event Correlation — Track + GIS Path

Navigate to **Event Correlation**:

1. The dashboard shows 24h stats (detections, unique plates, multi-camera tracks)
2. In the **Correlation Tracks** table, click any row to expand
3. If history has GIS coordinates (cameras have lat/lng), a **Leaflet map** appears showing:
   - Numbered markers for each sighting location (green = first, blue = subsequent)
   - A polyline connecting sightings in `occurredAt` order
4. The timeline list below the map shows camera name, coordinates, timestamp

---

## 8. Analytics Export

From **Event Correlation**, scroll to **Sample Federated Analytics Report**:

- **Export JSON** → downloads `federation-analytics-YYYY-MM-DD.json`
- **Export CSV** → downloads `federation-analytics-YYYY-MM-DD.csv` (direct API download, no CORS issues)

Report includes: total events, plate detections, unique plates, per-VMS counts, top plates by sightings.

---

## 9. Government Feed (Optional — Phase 5)

To connect a real Sentinel camera grid:

**Option A — Live Sentinel Catalogue:**
```bash
SENTINEL_BASE_URL=http://your-sentinel-host npm run dev
```

**Option B — Static feed file:**
```bash
# Edit server/config/feeds.example.json with real URLs
# Then either:
cp server/config/feeds.example.json server/config/feeds.json  # auto-picked up
# OR:
USE_EXAMPLE_FEEDS=true npm run dev  # uses example placeholders
```

**Option C — Env JSON:**
```bash
GOV_FEEDS_JSON='[{"externalId":"cam-001","name":"NH-48","lat":23.02,"lng":72.57,"url":"...","protocol":"hls","urls":{...}}]' npm run dev
```

After restart, `gov-feeds` appears as a third system in Federation Hub.

---

## 10. Regression Check — Model 1 Unchanged

All original Model 1 routes must still work:
- `/cameras` → Camera Registry
- `/` → GIS Dashboard
- `/onboarding` → Onboarding Queue
- `/gap-analysis` → Gap Analysis
- `/health` → Health Monitor
- `/audit` → Audit Trail

---

## Acceptance Checklist

- [ ] Server builds: `npm --prefix server run build`
- [ ] Client builds: `npm --prefix client run build`
- [ ] Two watchlist plates seeded on first boot
- [ ] VMS-B alert fires for GJ01WL0001 / GJ05WL0002, deduped within 5 min
- [ ] Stream session modal works for bound cameras
- [ ] ANPR inject creates event + correlation + alert (when watchlisted)
- [ ] `/watchlist` and `/alerts` work; nav badge shows open count
- [ ] Correlation map renders when track history has coordinates
- [ ] Model 1 routes unchanged
