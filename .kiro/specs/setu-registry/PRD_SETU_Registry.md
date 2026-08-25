# Product Requirements Document (PRD)
## SETU Registry — Centralised CCTV Registry & GIS Foundation
### Gujarat Police Innovation Challenge 2026 — Model 1 Submission

**Version:** 1.0
**Status:** For development
**Owner:** [Team name]
**Date:** August 2026

---

## 1. Background & Problem

Twenty-six Gujarat government departments (Home/Police, Food & Civil Supplies, RTO/Transport, Municipal Corporations, and others) currently operate **independent, siloed CCTV systems**. These systems differ in:

- Vendor and VMS platform
- Storage architecture (cloud vs. local)
- Retention period (7–15+ days)
- Camera type (analog vs. IP-based)
- Deployment purpose (traffic monitoring, godown surveillance, RTO checkpoints, etc.)

There is currently **no centralised mechanism** to know what cameras exist, where they are, who owns them, or whether they are functioning. This makes state-level planning, gap identification, and future integration (video viewing, analytics, AI) impossible to coordinate.

The State's long-term vision is to integrate CCTV infrastructure statewide, scaling toward **~80,000 cameras**, and eventually connect this system with law-enforcement databases (VAHAN, SARTHI, eGujCop/CCTNS, AFIS, NAFIS) for real-time alerts.

## 2. What We Are Building (Scope)

This project implements **Model 1 only**, as defined in the official problem statement: the **Registry & GIS Foundation** — a mandatory base layer that other models (unified viewing, VMS federation, central VMS/AI) are expected to build on top of later.

**Model 1 is a metadata and asset-visibility layer. It is explicitly NOT:**
- A live video streaming or viewing platform
- A video recording/storage system
- An AI/analytics system (no ANPR, no facial recognition, no object detection)

Model 1's only job: **onboard, store, search, and visualise camera metadata** — and use that metadata to identify coverage gaps and ageing infrastructure.

## 3. Goals

| Goal | Success looks like |
|---|---|
| Give the state a single source of truth for camera assets | Any camera, from any department, is searchable in one place |
| Make coverage gaps visible | Districts/zones with low camera density or ageing infra are automatically flagged |
| Support fast onboarding at scale | New cameras can be added one at a time, in bulk (CSV), or via API |
| Enforce department-level access control | Officers see and edit only what their role permits |
| Prove scalability logic | The data model and UI patterns must not break conceptually between 50 cameras (demo) and 80,000 cameras (target) |

## 4. Non-Goals

- No live camera feed integration (RTSP/ONVIF/vendor SDK connections) — that belongs to Model 2/3.
- No AI-based detection or watchlist correlation — that belongs to Model 2/4 and the separate Live Challenge test case.
- No real integration with VAHAN/SARTHI/eGujCop/AFIS/NAFIS — for this submission, these are represented only as a status badge (e.g., "Integration ready: Pending / Connected") to demonstrate design intent, not a working connection.

## 5. Users & Roles

| Role | Description | Permissions |
|---|---|---|
| **State Nodal Officer** | Home Department, statewide oversight | Full access: view/edit all departments, approve onboarding, manage users, export everything |
| **Department Officer** | Manages their own department's cameras | View/edit cameras within their department only, submit onboarding requests |
| **Field Officer** | On-ground staff who physically registers new cameras | Submit onboarding requests (manual/bulk) only; cannot approve or edit others' entries |
| **Auditor** | Compliance/oversight role | Read-only access to registry and audit trail across all departments; cannot edit |

Role-based access control (RBAC) should be enforced at both the API level and reflected in the UI (hide/disable actions the current role cannot perform).

## 6. Core Data Entity: Camera

Every camera record in the registry must capture:

| Field | Type | Notes |
|---|---|---|
| Camera ID | String (unique) | Format suggestion: `GJ-<DEPTCODE>-<NUMBER>`, e.g. `GJ-HOM-1042` |
| Department | Enum/FK | One of the 26 departments |
| Location name | String | Human-readable location |
| District | String | Used for gap analysis and coverage grouping |
| Latitude / Longitude | Decimal | Required for GIS placement |
| Camera type | Enum | IP Camera, Analog (via encoder), PTZ, ANPR-enabled |
| Connectivity | Enum | Fiber, 4G, Microwave, Other |
| Storage type | Enum | Local NVR, Cloud, Hybrid |
| Retention period | Integer (days) | |
| Ownership | Enum | Government, Private — Public-facing |
| Status | Enum | Online, Maintenance, Offline |
| Onboarded date | Date | |
| Last verified | Date/time | Last health check timestamp |
| Onboarded by | String (officer/user reference) | For audit trail |
| Onboarding method | Enum | Manual, Bulk CSV, API |

## 7. Functional Requirements (mapped to features)

### 7.1 GIS Dashboard
- Interactive map (Leaflet) showing all cameras as markers, color-coded by status (online = teal, maintenance = amber, offline = red).
- Filter markers by department.
- Marker click shows a popup with camera ID, location, department, type, connectivity, storage, status, last verified.
- Top-level stat strip: total cameras onboarded (vs. 80,000 target), online/maintenance/offline counts, department count, district count.
- Summary panels: top gap-analysis alerts, department breakdown (bar chart or ranked list), recent onboarding activity feed.

### 7.2 Camera Registry (full table view)
- Full-height, sortable, filterable data table of all cameras.
- Filters: department, district, status, camera type, connectivity, ownership.
- Free-text search (camera ID, location).
- Row click → detail panel/modal with full metadata, edit option (role-permitting), and that camera's own audit history.
- Bulk select → bulk export (CSV/PDF), bulk reassign department, bulk flag for review.
- Export button for full or filtered dataset.

### 7.3 Onboarding
- **Manual entry**: form covering all fields in Section 6.
- **Bulk upload**: CSV upload with a fixed template (camera_id, dept, lat, lng, type, storage, connectivity, retention, ownership). Validation must reject malformed rows and show which rows failed and why.
- **API onboarding**: a documented endpoint other systems could POST camera records to (for this submission, this can be represented in the Registry API doc page — a working endpoint is a bonus, not mandatory for MVP).
- **Onboarding Queue**: submissions go through states — Pending Review → Validation → Approved → Rejected. State Nodal Officer / Department Officer can approve or reject (with a required reason on rejection). Approved entries move into the live Camera Registry.

### 7.4 Gap Analysis
- Automatically computed list of:
  - Geographic zones with no/low camera coverage (based on district area vs. camera density)
  - Cameras past their expected AMC/maintenance-review window
  - Districts below state-average camera density
- Each gap item: location/district, severity, description, recommended action.
- Exportable as a report (PDF/CSV) — this maps directly to the "sample gap-analysis report" deliverable required by the official problem statement.

### 7.5 Departments
- List/grid of all 26 departments with camera count and status breakdown per department.
- Drill into a department to see its filtered camera list.

### 7.6 Health Monitor
- Status board of currently flagged cameras (offline, maintenance overdue), sorted by how long they've been in that state.
- Simple trend chart of online/maintenance/offline counts over time.
- For the demo: camera status can be simulated/randomised periodically rather than requiring real camera heartbeats (see Section 10).

### 7.7 Audit Trail
- Read-only chronological log: who did what, when, to which camera/department.
- Every onboarding, edit, approval, rejection, and export action must write an audit entry.
- Filterable by date range, actor, action type, department.

### 7.8 Registry API (documentation page)
- A documentation-style page listing the API surface (endpoints, sample request/response JSON) so the design intent for future integration (Models 2–4 consuming this registry) is clear, even if not every endpoint is wired to a live backend for the hackathon demo.

### 7.9 Settings
- Role and user management (list users, their department, role, last active).
- System preferences: default retention period, offline-alert threshold, default map view.

## 8. Data for the Demo

Per the official problem statement, Model 1's own expected deliverable includes a **"sample onboarded camera-metadata dataset"** — real government camera data is not required or expected for this model. The project should ship with a realistic **synthetic dataset** (recommend 50–200 records) covering multiple departments and real Gujarat districts (Ahmedabad, Surat, Vadodara, Rajkot, Kutch, Dwarka, Dahod, Valsad, Banaskantha, etc.) so the map and gap-analysis logic have something meaningful to show.

No external camera API, vendor SDK, or live video feed is required for Model 1. (If the team later layers in Model 2/3 viewing capability, the hackathon separately provides ~50 real camera feeds via the event's Resources page post-registration — out of scope for this PRD.)

## 9. Success Criteria for the Hackathon Submission

- [ ] Working registry portal with GIS map view (explicit deliverable in the problem statement)
- [ ] Bulk and manual camera-onboarding demonstrated live
- [ ] Sample onboarded camera-metadata dataset shipped with the project
- [ ] Registry API documented (endpoints + sample payloads)
- [ ] Sample gap-analysis report generated and exportable
- [ ] Role-based access control functioning for at least 2 distinct roles
- [ ] Audit trail populated by real actions taken during a demo walkthrough

## 10. Assumptions & Open Questions

- Camera "status" (online/maintenance/offline) will be simulated for the demo (e.g., a scheduled job that randomly flips a small percentage of records) rather than sourced from real device heartbeats, since no physical cameras are connected in Model 1.
- Government database integrations (VAHAN, SARTHI, eGujCop, AFIS, NAFIS) are represented as a UI status indicator only ("Integration ready") — not a functioning connection.
- Geocoding (address → lat/lng) for manual entry can use a free provider (e.g., OpenStreetMap Nominatim) if time permits; otherwise lat/lng can be entered directly.
- Final department list (all 26) should be confirmed against the official problem statement resources/annexures if the full list is published separately; a representative subset (4–6 departments) is acceptable for the MVP if the full list isn't available in time.

## 11. Suggested Technology Stack

(As recommended in the official problem statement for Model 1)

| Layer | Choice |
|---|---|
| Frontend | React.js (Vite) |
| GIS | Leaflet.js |
| Backend | Node.js/Express or Python (FastAPI/Django) |
| Database | PostgreSQL + PostGIS |
| Auth | JWT-based, role field on user table |
| Hosting (demo) | Vercel/Netlify (frontend) + Railway/Render (backend + DB) |

## 12. Out of Scope for This Submission

- Live video streaming/viewing (Model 2/3/4 territory)
- AI-powered video analytics (ANPR, facial recognition, object detection)
- Vehicle tracking / watchlist correlation (separate Live Challenge test case, only relevant if the team later builds beyond Model 1)
- Real integration with any external government database or camera vendor system
