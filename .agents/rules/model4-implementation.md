# Model 4 Implementation Rules

## STRICT CONSTRAINTS — DO NOT VIOLATE

### Files to Create (ONLY these, nothing else)
- `server/migrations/009_model4_central_vms.sql`
- `server/src/routes/model4.ts`
- `server/src/scripts/seed_model4.ts`
- `client/src/hooks/useAIDetection.ts`
- `client/src/pages/CommandCentrePage.tsx`
- `client/src/pages/CommandCentrePage.css`
- `client/src/pages/IntegrationsPage.tsx`
- `client/src/pages/IntegrationsPage.css`
- `docs/MODEL4_ARCHITECTURE.md`
- `docs/MODEL4_SCALABILITY_REPORT.md`
- `docs/MODEL4_SECURITY_ARCHITECTURE.md`

### Files to Modify (ONLY these, minimal changes)
- `server/src/index.ts` — ONLY add import + mount for model4Routes
- `server/src/types.ts` — ONLY add MODEL4_* audit action types
- `server/package.json` — ONLY add seed:model4 script
- `client/src/api.ts` — ONLY add model4Api object
- `client/src/App.tsx` — ONLY add 2 route entries + imports
- `client/src/components/LeftNav.tsx` — ONLY add Central VMS nav section

### DO NOT
- Create any files not listed above
- Modify any existing page files (LiveViewPage, VehicleSearchPage, FederationPage, etc.)
- Modify existing CSS files
- Change existing API endpoints or database tables
- Add middleware or services not in the plan
- Install npm packages not listed (only: @tensorflow/tfjs, @tensorflow-models/coco-ssd, face-api.js)
- Create new React context providers
- Modify AuthContext, ToastProvider, or AppLayout
- Add new database migrations beyond 009
- Change the server port, CORS config, or security middleware
- Rename existing routes or components

### Database Schema — EXACT tables
1. `ai_analytics_events` — AI inference results
2. `external_integrations` — VAHAN, SARTHI, eGujCop, AFIS, NAFIS registry
3. `integration_queries` — query audit log
4. `vahan_vehicles` — simulated vehicle registry

No other tables. No modifications to tables from migrations 001-008.

### API Endpoints — EXACT list
All under `/api/model4/`:
1. `GET /dashboard`
2. `GET /ai/events`
3. `POST /ai/events`
4. `GET /ai/analytics`
5. `GET /integrations`
6. `POST /integrations/:id/sync`
7. `GET /integrations/vahan/lookup`
8. `GET /integrations/queries`
9. `GET /system/metrics`
10. `GET /system/capacity`

No other endpoints. No WebSocket endpoints. No SSE endpoints.

### Client Pages — EXACT count
1. `CommandCentrePage` at route `/command-centre`
2. `IntegrationsPage` at route `/integrations`

No other new pages. No modals in other pages. No new components beyond useAIDetection hook.

### Styling Rules
- Use existing CSS custom properties from index.css (--bg, --surface, --accent, etc.)
- Use Inter font (already loaded)
- Use JetBrains Mono for monospace (already loaded)
- Keep the government/administrative design language — data-dense, no flashy animations
- Dark panels for camera/AI areas, light panels for data tables
- Use Recharts for charts (already a dependency)
- Use Lucide React for icons (already a dependency)
- Use Leaflet for any map needs (already a dependency)

### AI Detection Rules
- TensorFlow.js COCO-SSD for person/vehicle detection
- face-api.js for face detection
- All inference runs in-browser, NEVER on the server
- Detection interval: ~500ms per frame (configurable)
- Post events to backend only for significant detections (anomalies, high counts)
- Anomaly rules are rule-based, NOT ML-based:
  - person_count > 25 → crowd_spike
  - person_count drops to 0 after >5 → camera_blackout
  - vehicle_count > 15 → traffic_congestion
  - face detected between 23:00-05:00 → after_hours_activity

### VAHAN Lookup Rules
- Query the `vahan_vehicles` PostgreSQL table
- Return structured JSON with vehicle + owner details
- Log every query to `integration_queries`
- Seed ~50 realistic Gujarat vehicle records
- Include watchlist plates (GJ01WL0001, GJ05WL0002) as stolen vehicles
