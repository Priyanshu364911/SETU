# SETU Registry & Central VMS Platform
## Surveillance Equipment Tracking Utility & Smart Eye Traffic Unit

> **Gujarat State CCTV Metadata, VMS Federation & AI Analytics Platform**  
> **Gujarat Police Innovation Challenge 2026**  
> A high-contrast, data-dense administrative single-page application (SPA), northbound federation middleware, edge artificial intelligence (AI) engine, and central video management system engineered for Gujarat government departments to register, track, federate, and monitor over 80,000 surveillance cameras statewide.

📖 **Complete Project Technical Dossier**: For an exhaustive, publication-grade specification including all database schemas, API specs, mathematical scalability sizing, zero-trust security architecture, and evaluator runbooks, consult [SETU_COMPLETE_PROJECT_DOCUMENTATION.md](file:///c:/Users/Admin/Desktop/SETU/SETU_COMPLETE_PROJECT_DOCUMENTATION.md).

---

## 📋 System Overview

**SETU** is built specifically for internal Gujarat State Government and Gujarat Police operations. It replaces fragmented tracking systems with a centralized, role-based platform integrating public surveillance equipment across 26 Gujarat state government departments and 33 districts.

### Key Objectives & Unified Hybrid Model:
- **Model 1: Centralized CCTV Registry & GIS Foundation**: 18-attribute camera metadata tracking, Leaflet-powered GIS dashboard (`22.3° N, 71.8° E`), automated gap analysis with threshold sliders, 30-day health monitoring trends, controlled onboarding queue (manual single-entry + bulk CSV batch upload), and immutable audit logs.
- **Model 2: Unified Viewing & Metadata Analytics**: Multi-camera grid video walls (1x1, 2x2, 3x3 tiles), low-latency WebRTC WHEP / HLS proxy streaming, operator manual event tagging (`tagged_events`), ANPR plate detection, and vehicle search with interactive Leaflet movement trajectories.
- **Model 3: VMS Federation Spine & Northbound Middleware**: Extensible adapter framework (`GovFeedAdapter`, `VmsAAdapter`, `VmsBAdapter`), northbound REST API (`/api/federation/*`), 2-hour sliding window correlation engine, active watchlist monitoring with 5-minute alert deduplication, and mediated stream session tokens (300s TTL) protecting raw VMS credentials.
- **Model 4: Central VMS & AI Analytics Platform**: Client-side in-browser Edge AI inference (TensorFlow.js WebGL + MobileNet COCO-SSD + face-api), 4 autonomous deterministic anomaly rules (`crowd_spike`, `camera_blackout`, `traffic_congestion`, `after_hours_activity`), AI Command Centre HUD, and Inter-Agency Law Enforcement Integration Hub connecting **MoRTH VAHAN**, **SARTHI**, **eGujCop (CCTNS)**, **AFIS**, and **NAFIS** for real-time stolen vehicle criminal intercepts.
- **Official Sentinel Camera Grid Ingestion**: Direct native ingestion of the official Gujarat Police Sentinel sandbox streams over RTSP (TCP), WebRTC WHEP, and proxied HLS.

---

## 🛠️ Technology Stack

### **Frontend (`/client`)**
- **Core Framework**: React 18, TypeScript, Vite
- **Routing**: React Router v6 (with `ProtectedRoute` auth guards)
- **GIS & Mapping**: Leaflet, React-Leaflet (CartoDB Positron base maps)
- **Edge AI Computer Vision**: TensorFlow.js (`@tensorflow/tfjs` WebGL backend), `@tensorflow-models/coco-ssd`, `face-api.js`
- **Data Visualization**: Recharts (30-day health trends, hourly AI detection distributions)
- **State & Network**: React Context API (`AuthContext`, `ToastProvider`), Axios with JWT interceptors
- **Icons & Styling**: Lucide React, Vanilla CSS custom properties (utilitarian government design token system)

### **Backend (`/server`)**
- **Runtime & Language**: Node.js, Express, TypeScript
- **Validation**: Zod schema validation
- **Database & GIS**: PostgreSQL 14+ with PostGIS extension (`GEOGRAPHY(Point, 4326)` with GIST spatial indexing)
- **Streaming & Mediation**: MediaMTX WHEP WebRTC signaling proxy, HLS manifest rewriter & AES-128 decryption key server
- **Security**: JWT Authentication (8-hour token expiry), Helmet security headers, Rate limiting, CORS origin protection, SHA-256 chained audit logs

---

## 🔑 Role-Based Access Control (RBAC)

The system enforces strict permission boundaries across four distinct administrative roles:

| Feature / Action | State Nodal Officer (SNO) | Department Officer (DO) | Field Officer (FO) | Auditor (AUD) |
| :--- | :---: | :---: | :---: | :---: |
| **GIS Map & Camera Registry** | View All Statewide | View Dept Only | View Dept Only | View All (Read-Only) |
| **Manual Onboarding Submit** | ✅ | ✅ | ✅ | ❌ |
| **Bulk CSV Batch Upload** | ✅ | ✅ | ✅ | ❌ |
| **Approve / Reject Onboarding**| ✅ Full Approval | ✅ Dept Only | ❌ | ❌ |
| **Edit / Delete Camera** | Full Edit / Delete | Edit Dept Only | ❌ | ❌ |
| **CSV Data Export** | ✅ | ✅ | ❌ | ✅ |
| **Gap Analysis & Health Monitor**| Full Access | Full Access | Full Access | Full Access |
| **Live View Multi-Grid** | All Feeds | Dept Feeds | Dept Feeds | View Only |
| **AI Command Centre** | Full Access | Full Access | ❌ | ❌ |
| **MoRTH VAHAN Lookup** | Full Statewide | Full Statewide | Lookup Only | Read-Only Queries |
| **Watchlist Management** | Create / Edit / Delete | View / Alert Flag | ❌ | Read-Only |
| **Audit Log Access** | Full Statewide Logs | Dept Logs | Self Logs | Full Statewide Logs |
| **User Management Settings** | ✅ | ❌ | ❌ | ❌ |

---

## 🚀 System Architecture & Page Catalog

### 1. 🗺️ Central GIS Dashboard (`/`)
- Centered on Gujarat coordinates (`22.3° N, 71.8° E`).
- Status-coded markers: **Online** (`#2E7D5B`), **Maintenance** (`#B5792B`), **Offline** (`#A23B33`), and **Pending** (`#8A93A3`).
- Dynamic status filtering, department filtering, camera counter, and department camera breakdown sidebar.

### 2. 📹 Camera Registry (`/cameras`) — Model 1
- Data-dense, paginated grid displaying all camera entities with multi-parameter filtering.
- Modal drawer showing all 18 camera attributes (retention days, storage type, connectivity, coordinates, verification date).
- One-click CSV export capability.

### 3. 📥 Onboarding Queue (`/onboarding`) — Model 1
- Approval queue for pending camera registrations.
- **Manual Form**: Strict Zod validation for Gujarat geographic bounds (Latitude: `20.1 – 24.7`, Longitude: `68.2 – 74.5`).
- **Bulk CSV Upload**: Batch parsing with row-by-row error diagnostics and rejection tracking (`onboarding_errors`).

### 4. 📊 Gap Analysis (`/gap-analysis`) — Model 1
- Interactive threshold slider (`10% – 90%`) to identify under-monitored district gap zones below average camera density.
- Ranking table displaying camera counts, online percentages, and average coverage deficits with exportable reports.

### 5. 🩺 Infrastructure Health Monitor (`/health`) — Model 1
- Summary alert cards categorized by severity (High, Medium, Low).
- Recharts-powered 30-day status trend chart comparing Online, Offline, and Maintenance trajectories over time.
- Flagged cameras table with quick health resolution indicators.

### 6. 📜 Central Audit Trail (`/audit`) — Model 1
- Immutable append-only log recording all critical events (`ONBOARD_SUBMIT`, `ONBOARD_APPROVE`, `STATUS_CHANGE`, `BULK_UPLOAD`, `EXPORT`, `LOGIN`, `USER_CREATE`).
- Filterable by action type, actor, date range, and IP address.

### 7. 📺 Live View Multi-Grid Viewer (`/live-view`) — Model 2
- Multi-camera video wall configurable in 1x1, 2x2, and 3x3 layouts.
- Dual-stream WebRTC WHEP / HLS proxy streaming with canvas simulation fallback.
- In-stream operator manual moment tagging (`tagged_events`) with audit trail logging.

### 8. 🔍 Vehicle Search & Trajectory Visualizer (`/vehicle-search`) — Model 2
- Plate number search across historical and live ANPR detections (`detection_events`).
- Chronological sightings table and interactive Leaflet route visualizer with polyline movement indicators.

### 9. 🌐 Federation Hub (`/federation`) — Model 3
- Displays connected VMS vendor systems (`Sentinel Camera Grid`, `Municipal Cloud VMS`, `Police/RTO Checkpoint VMS`).
- Camera-to-VMS binding management and stream session modal with 300s token countdowns.

### 10. 🚨 Surveillance Alerts (`/alerts`) & Watchlist (`/watchlist`) — Model 3
- Live alert board showing critical, high, and medium severity watchlist matches with 5-minute deduplication.
- Watchlist management for stolen vehicles, blacklisted vehicles, and wanted persons.
- Manual ANPR plate injection widget for evaluator live challenge demonstration.

### 11. 📈 Event Correlation Dashboard (`/correlation`) — Model 3
- 24-hour telemetry metrics (total events, plate detections, unique plates, multi-camera tracks).
- Interactive Leaflet track history plotting with timestamped vehicle coordinates and CSV/JSON analytics export.

### 12. 🧠 AI Command Centre (`/command-centre`) — Model 4
- In-browser TensorFlow.js WebGL inference HUD with real-time bounding boxes (Person: Green, Vehicle: Blue, Face: Yellow, Anomaly: Red).
- Live evaluation of 4 deterministic anomaly rules (`crowd_spike`, `camera_blackout`, `traffic_congestion`, `after_hours_activity`).
- Live telemetry HUD displaying FPS, inference latency (ms), and active pipeline tallies.

### 13. 🏛️ Inter-Agency Government Integrations (`/integrations`) — Model 4
- Direct interface to **MoRTH VAHAN**, **SARTHI**, **eGujCop**, **AFIS**, and **NAFIS**.
- High-visibility crimson criminal intercept alerts for stolen vehicles, displaying FIR number, registered owner, chassis/engine serials, and pending challans.
- Tamper-evident query audit log (`integration_queries`).

### 14. 📖 Registry & Adapter Documentation (`/registry-api-docs`, `/adapter-docs`)
- Interactive documentation for 26+ Model 1 REST API endpoints and third-party VMS vendor integration guide.

---

## 📁 Repository Structure

```
SETU/
├── SETU_COMPLETE_PROJECT_DOCUMENTATION.md  # Master Technical Specification & Dossier
├── README.md                              # Project Overview & Quickstart Guide
├── client/                                # React 18 + Vite Frontend Application
│   ├── public/                            # Static assets
│   ├── src/
│   │   ├── api.ts                         # Axios client with JWT interceptors
│   │   ├── types.ts                       # Shared TypeScript domain types
│   │   ├── context/
│   │   │   └── AuthContext.tsx            # Authentication state management
│   │   ├── hooks/
│   │   │   └── useAIDetection.ts          # In-browser TF.js WebGL AI inference & anomaly rules
│   │   ├── components/                    # Reusable UI component library
│   │   │   ├── AppLayout.tsx              # Main layout shell with 220px LeftNav
│   │   │   ├── LeftNav.tsx                # Sidebar navigation with live alert counter badges
│   │   │   ├── TopBar.tsx                 # Header bar with real-time stat strip
│   │   │   ├── DataTable.tsx              # Sortable, paginated data grid
│   │   │   ├── StatusBadge.tsx            # Status dot badge component
│   │   │   ├── Button.tsx                 # Standard design token buttons
│   │   │   ├── Modal.tsx                  # Dialog overlay
│   │   │   └── Toast.tsx                  # Notification toast provider
│   │   ├── pages/                         # 19 SPA Page Routes
│   │   │   ├── LoginPage.tsx              # Authentication portal
│   │   │   ├── GISPage.tsx                # Model 1 Central GIS map
│   │   │   ├── RegistryPage.tsx           # Model 1 Camera inventory
│   │   │   ├── OnboardingPage.tsx         # Model 1 Onboarding queue
│   │   │   ├── GapAnalysisPage.tsx        # Model 1 Coverage gap engine
│   │   │   ├── HealthMonitorPage.tsx      # Model 1 Infrastructure health
│   │   │   ├── AuditTrailPage.tsx         # Model 1 Central audit log
│   │   │   ├── DepartmentsPage.tsx        # Model 1 Departments directory
│   │   │   ├── SettingsPage.tsx           # Model 1 User management
│   │   │   ├── APIDocsPage.tsx            # Model 1 API documentation
│   │   │   ├── LiveViewPage.tsx           # Model 2 Multi-grid video wall
│   │   │   ├── VehicleSearchPage.tsx      # Model 2 Plate search & GIS path
│   │   │   ├── FederationPage.tsx         # Model 3 Federation Hub
│   │   │   ├── CorrelationPage.tsx        # Model 3 Event correlation
│   │   │   ├── AdapterDocsPage.tsx        # Model 3 Adapter developer docs
│   │   │   ├── WatchlistPage.tsx          # Model 3 Watchlist & ANPR inject
│   │   │   ├── AlertsPage.tsx             # Model 3 Surveillance alert board
│   │   │   ├── CommandCentrePage.tsx      # Model 4 AI Command Centre HUD
│   │   │   └── IntegrationsPage.tsx       # Model 4 Inter-Agency Portal
│   │   ├── index.css                      # Design tokens & CSS custom properties
│   │   ├── App.tsx                        # Router setup & protected routes
│   │   └── main.tsx                       # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                                # Node.js + Express Backend Application
│   ├── src/
│   │   ├── index.ts                       # Express bootstrap & Sentinel feed connection
│   │   ├── db.ts                          # PostgreSQL connection pool
│   │   ├── schemas.ts                     # Zod input validation schemas
│   │   ├── types.ts                       # Server domain types
│   │   ├── middleware/                    # Auth & RBAC middleware
│   │   ├── routes/                        # 12 Modular Express Routers
│   │   │   ├── auth.ts                    # Authentication endpoints
│   │   │   ├── cameras.ts                 # Camera registry & PostGIS GeoJSON
│   │   │   ├── onboarding.ts              # Manual & bulk CSV onboarding
│   │   │   ├── gap.ts                     # Gap analysis calculation
│   │   │   ├── health.ts                  # Infrastructure health stats
│   │   │   ├── audit.ts                   # Audit trail queries
│   │   │   ├── departments.ts             # Department listings
│   │   │   ├── users.ts                   # User administration
│   │   │   ├── federation.ts              # Model 3 Northbound federation API
│   │   │   ├── streamProxy.ts             # Sentinel WHEP & HLS proxy gateway
│   │   │   ├── model2.ts                  # Model 2 Viewing & ANPR routes
│   │   │   └── model4.ts                  # Model 4 AI events & VAHAN lookup
│   │   ├── federation/                    # Model 3 Federation Spine
│   │   │   ├── adapters/                  # VmsAdapter implementations
│   │   │   ├── services/                  # Federation, Correlation, Watchlist services
│   │   │   └── simulators/                # VMS-A REST & VMS-B Webhook simulators
│   │   └── services/                      # Model 1 Camera & Audit services
│   ├── migrations/                        # 9 SQL Migration Scripts (001 to 009)
│   ├── .env.example                       # Environment configuration template
│   └── package.json
├── docs/                                  # Architectural deep-dive reports
│   ├── DEMO_RUNBOOK.md                    # Step-by-step evaluator runbook
│   ├── HLD_MODEL3.md                      # High-Level Design for Model 3
│   ├── MODEL2_ARCHITECTURE.md             # Model 2 Viewing & Analytics architecture
│   ├── MODEL4_ARCHITECTURE.md             # Model 4 Central VMS & AI architecture
│   ├── MODEL4_SCALABILITY_REPORT.md       # Sizing report for 80,000 cameras
│   └── MODEL4_SECURITY_ARCHITECTURE.md    # Zero-Trust security & DR architecture
└── .gitignore

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: `v14+` with **PostGIS** extension enabled

---

### Setup & Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/SETU.git
cd SETU
```

#### 2. Backend Setup (`/server`)
```bash
cd server

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Edit `.env` to configure your PostgreSQL database credentials:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/setu_registry
JWT_SECRET=your-secure-jwt-secret-key
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
```

Run database migrations and seed default data:
```bash
npm run migrate
npm run seed
```

Start the backend development server:
```bash
npm run dev
```
*(Server will start on `http://localhost:3000`)*

---

#### 3. Frontend Setup (`/client`)

Open a new terminal window:
```bash
cd client

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*(Frontend will launch on `http://localhost:5173`)*

---

## 🧪 Verification & Build

To check TypeScript types across the frontend:
```bash
cd client
npx tsc --noEmit -p tsconfig.app.json
```

To create a production build for the frontend:
```bash
cd client
npm run build
```

---

## 🛡️ License & Attributions

Developed for the **Gujarat Police Innovation Challenge 2026**. Designed adhering to administrative government operations standards.
