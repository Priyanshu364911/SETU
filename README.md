# SETU Registry — Surveillance Equipment Tracking Utility

> **Gujarat State CCTV Metadata Platform**  
> A high-contrast, data-dense administrative single-page application (SPA) and backend system designed for Gujarat government departments to register, track, and monitor over 80,000 surveillance cameras statewide.

---

## 📋 System Overview

**SETU Registry** is built specifically for internal government operations. It replaces fragmented tracking systems with a centralized, role-based platform for monitoring public surveillance equipment across 26 Gujarat state government departments.

### Key Objectives:
- **Centralized Registry**: Uniform tracking of camera hardware specs, connectivity, ownership, retention policies, and geographic coordinates.
- **Geospatial Intelligence**: Leaflet-powered GIS dashboard visualizing camera coverage across all districts in Gujarat.
- **Controlled Onboarding**: Managed onboarding workflow supporting single camera entry validation and bulk CSV batch imports.
- **Health Monitoring & Gap Analysis**: Algorithmic detection of under-monitored zones, high/medium/low severity camera alerts, and 30-day operational status trends.
- **Strict Governance**: Immutable audit trail logging all system operations and strict HTTP/UI-level Role-Based Access Control (RBAC).

---

## 🛠️ Technology Stack

### **Frontend (`/client`)**
- **Core Framework**: React 18, TypeScript, Vite
- **Routing**: React Router v6 (with `ProtectedRoute` auth guards)
- **GIS & Mapping**: Leaflet, React-Leaflet (CartoDB Positron base maps)
- **Data Visualization**: Recharts (30-day health trends line chart)
- **State & Network**: React Context API (`AuthContext`, `ToastProvider`), Axios with JWT interceptors
- **Icons & Styling**: Lucide React, Vanilla CSS custom properties (utliitarian government design token system)

### **Backend (`/server`)**
- **Runtime & Language**: Node.js, Express, TypeScript
- **Validation**: Zod schema validation
- **Database & GIS**: PostgreSQL + PostGIS extension
- **Security**: JWT Authentication (8-hour token expiry), Helmet security headers, Rate limiting, CORS protection

---

## 🔑 Role-Based Access Control (RBAC)

The system enforces strict permission boundaries across four distinct administrative roles:

| Feature / Action | State Nodal Officer (SNO) | Department Officer (DO) | Field Officer (FO) | Auditor (AUD) |
| :--- | :---: | :---: | :---: | :---: |
| **GIS Map & Camera Registry** | View All | View Dept | View Dept | View All |
| **Manual Onboarding Submit** | ✅ | ✅ | ✅ | ❌ |
| **Bulk CSV Batch Upload** | ✅ | ✅ | ✅ | ❌ |
| **Approve / Reject Onboarding**| ✅ | ✅ | ❌ | ❌ |
| **Edit / Delete Camera** | Full Edit / Delete | Edit Dept Only | ❌ | ❌ |
| **CSV Data Export** | ✅ | ✅ | ❌ | ✅ |
| **Gap Analysis & Health Monitor**| Full Access | Full Access | Full Access | Full Access |
| **Audit Log Access** | Full Logs | Dept Logs | Self Logs | Full Logs |
| **User Management Settings** | ✅ | ❌ | ❌ | ❌ |

---

## 🚀 System Architecture & Features

### 1. 🗺️ GIS Dashboard (`/`)
- Centered on Gujarat coordinates (`22.3° N, 71.8° E`).
- Status-coded markers: **Online** (`#2E7D5B`), **Maintenance** (`#B5792B`), **Offline** (`#A23B33`), and **Pending** (`#8A93A3`).
- Dynamic status filtering, department filtering, camera counter, and department camera breakdown sidebar.

### 2. 📹 Camera Registry (`/cameras`)
- Data-dense, paginated grid displaying all camera entities.
- Multi-parameter filtering: Free-text search, camera status, department code, and camera type (IP, Analog, PTZ, ANPR).
- Modal drawer showing all 18 camera attributes (retention days, storage type, connectivity, coordinates, verification date).
- One-click CSV export capability.

### 3. 📥 Onboarding Queue (`/onboarding`)
- Approval queue for pending camera registrations.
- **Manual Form**: Strict client-side and server-side Zod validation for geographic bounds (Latitude: `20.1 – 24.7`, Longitude: `68.2 – 74.5`).
- **Bulk CSV Upload**: Batch parsing with row-by-row error reporting and rejected entry breakdowns.

### 4. 📊 Gap Analysis (`/gap-analysis`)
- Interactive threshold slider (`10% – 90%`) to identify under-monitored district gap zones below average camera density.
- Ranking table displaying camera counts, online percentages, and average coverage deficits.

### 5. 🩺 Infrastructure Health Monitor (`/health`)
- Summary alert cards categorized by severity (High, Medium, Low).
- Recharts-powered 30-day status trend chart comparing Online, Offline, and Maintenance trajectories over time.
- Flagged cameras table with quick health resolution indicators.

### 6. 📜 Audit Trail (`/audit`)
- Immutable log recording all critical events (`ONBOARD_SUBMIT`, `ONBOARD_APPROVE`, `STATUS_CHANGE`, `BULK_UPLOAD`, `EXPORT`, `LOGIN`, `USER_CREATE`).
- Filterable by action type and actor user ID.

### 7. 📖 Registry API Documentation (`/registry-api-docs`)
- Interactive reference guide detailing all 26 REST API endpoints, authorized roles, request schemas, and sample JSON payloads.

---

## 📁 Repository Structure

```
SETU/
├── client/                      # React + Vite Frontend Application
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── api.ts               # Axios instance with JWT interceptors
│   │   ├── types.ts             # Shared TypeScript entity types
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Auth state management
│   │   ├── components/          # Reusable UI components
│   │   │   ├── AppLayout.tsx    # Main layout shell
│   │   │   ├── LeftNav.tsx      # 220px fixed navigation sidebar
│   │   │   ├── TopBar.tsx       # Header bar with live stat strip
│   │   │   ├── DataTable.tsx    # Generic sortable & paginated table
│   │   │   ├── StatusBadge.tsx  # Status dot badge component
│   │   │   ├── Button.tsx       # Standard design token buttons
│   │   │   ├── Modal.tsx        # Dialog overlay
│   │   │   └── Toast.tsx        # Notification toast provider
│   │   ├── pages/               # SPA Page routes
│   │   │   ├── LoginPage.tsx
│   │   │   ├── GISPage.tsx
│   │   │   ├── RegistryPage.tsx
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── GapAnalysisPage.tsx
│   │   │   ├── HealthMonitorPage.tsx
│   │   │   ├── AuditTrailPage.tsx
│   │   │   ├── DepartmentsPage.tsx
│   │   │   ├── APIDocsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── index.css            # Global CSS variables & design tokens
│   │   ├── App.tsx              # Router setup
│   │   └── main.tsx             # Application entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                      # Node.js + Express Backend Application
│   ├── src/
│   │   ├── index.ts             # Express app & route mounting
│   │   ├── schemas.ts           # Zod input validation schemas
│   │   └── types.ts             # Server domain types
│   ├── migrations/              # SQL database migration scripts
│   ├── .env.example             # Environment configuration template
│   └── package.json
├── .gitignore                   # Repository git ignore rules
└── README.md                    # Project documentation
```

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
