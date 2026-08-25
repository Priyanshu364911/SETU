# Implementation Plan: SETU Registry

## Overview

Build the SETU Registry platform from scratch: a React/Vite SPA backed by a Node.js/Express REST API with PostgreSQL + PostGIS. Implementation proceeds in layers — infrastructure first, then backend services, then frontend pages — so every task produces integrated, runnable code. Testing (property-based with fast-check, unit, and integration) is wired in as optional sub-tasks alongside each implementation task.

Language: **TypeScript** (frontend + backend).

---

## Task Dependency Graph

```
1 (Scaffold)
└── 2 (Database)
    ├── 2.1 (DDL migrations)
    ├── 2.2 (Seed data)
    └── 2.3 (db.ts + migration runner)
        └── 3 (Auth service + JWT middleware)
            ├── 3.1 AuthService
            ├── 3.2* AuthService unit tests
            ├── 3.3 authMiddleware + rbacGuard
            ├── 3.4* Property: Auditor Write Rejection
            ├── 3.5* Property: RBAC Isolation
            └── 3.6 Auth routes
                └── 4 [Checkpoint: Auth layer]
                    └── 5 (Camera validation + ID generation)
                        ├── 5.1 validateCameraInput
                        ├── 5.2–5.4* Property tests (validation)
                        ├── 5.5 generateCameraId
                        └── 5.6–5.7* Property + unit tests (ID)
                            └── 6 (CameraService CRUD)
                                ├── 6.1 list()
                                ├── 6.2–6.3* Property tests (list)
                                ├── 6.4 getById / create / update / delete
                                ├── 6.5 getStats()
                                ├── 6.6* Property: Stats Consistency
                                ├── 6.7 getGeoJSON()
                                ├── 6.8–6.9* Property tests (GeoJSON)
                                └── 6.10 Camera routes
                                    ├── 7 (OnboardingService)
                                    │   ├── 7.1 submitManual
                                    │   ├── 7.2 submitBulkCSV
                                    │   ├── 7.3* Property: Bulk Partition
                                    │   ├── 7.4 getQueue / approve / reject
                                    │   ├── 7.5* Property: Status Monotonicity
                                    │   └── 7.6 Onboarding routes
                                    └── 8 [Checkpoint: Backend core]
                                        ├── 9 (AuditService)
                                        │   ├── 9.1 log()
                                        │   ├── 9.2* Property: Audit Completeness
                                        │   ├── 9.3 list() + getForCamera()
                                        │   └── 9.4 Audit routes
                                        ├── 10 (GapAnalysisService)
                                        │   ├── 10.1 getLowCoverageZones
                                        │   ├── 10.2* Property: Gap Zone Ordering
                                        │   ├── 10.3 getAgeingInfrastructure + getBelowAverageDistricts
                                        │   ├── 10.4 exportReport
                                        │   └── 10.5 Gap routes
                                        ├── 11 (HealthMonitorService)
                                        │   ├── 11.1 getFlaggedCameras
                                        │   ├── 11.2* Property: Health Flag Correctness
                                        │   ├── 11.3 getTrendData + getAlertSummary
                                        │   └── 11.4 Health routes
                                        └── 12 (Dept + User routes)
                                            ├── 12.1 Department routes
                                            └── 12.2 User management routes
                                                └── 13 [Checkpoint: All API routes]
                                                    └── 14 (Security hardening)
                                                        ├── 14.1 helmet + CORS + param queries
                                                        └── 14.2 Camera CSV export endpoint
                                                            └── 15 (React SPA scaffold)
                                                                ├── 15.1 React Router v6 routes
                                                                ├── 15.2 AuthContext + useAuth
                                                                └── 15.3 CSS tokens + layout components
                                                                    └── 16 (Login + shared UI)
                                                                        ├── 16.1 LoginPage
                                                                        └── 16.2 Shared components
                                                                            ├── 17 GIS Dashboard
                                                                            ├── 18 Camera Registry page
                                                                            ├── 19 Onboarding Queue page
                                                                            ├── 20 Gap Analysis page
                                                                            ├── 21 Health Monitor page
                                                                            ├── 22 Audit Trail page
                                                                            └── 23 Departments / Settings / API Docs
                                                                                └── 24 [Checkpoint: Frontend complete]
                                                                                    └── 25* (Integration tests)
                                                                                        └── 26 [Final checkpoint]
```

```json
{
  "waves": [
    {
      "wave": 1,
      "label": "Project scaffold",
      "tasks": ["1"]
    },
    {
      "wave": 2,
      "label": "Database layer",
      "tasks": ["2", "2.1", "2.2", "2.3"],
      "dependsOn": ["1"]
    },
    {
      "wave": 3,
      "label": "Auth service + JWT middleware",
      "tasks": ["3", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
      "dependsOn": ["2.3"]
    },
    {
      "wave": 4,
      "label": "Auth layer checkpoint",
      "tasks": ["4"],
      "dependsOn": ["3.6"]
    },
    {
      "wave": 5,
      "label": "Camera validation + ID generation",
      "tasks": ["5", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"],
      "dependsOn": ["4"]
    },
    {
      "wave": 6,
      "label": "CameraService CRUD + routes",
      "tasks": ["6", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10"],
      "dependsOn": ["5.5", "5.7"]
    },
    {
      "wave": 7,
      "label": "OnboardingService + routes",
      "tasks": ["7", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6"],
      "dependsOn": ["6.10"]
    },
    {
      "wave": 8,
      "label": "Backend core checkpoint",
      "tasks": ["8"],
      "dependsOn": ["6.10", "7.6"]
    },
    {
      "wave": 9,
      "label": "AuditService + GapAnalysisService + HealthMonitorService + Dept/User routes",
      "tasks": ["9", "9.1", "9.2", "9.3", "9.4", "10", "10.1", "10.2", "10.3", "10.4", "10.5", "11", "11.1", "11.2", "11.3", "11.4", "12", "12.1", "12.2"],
      "dependsOn": ["8"]
    },
    {
      "wave": 10,
      "label": "All API routes checkpoint",
      "tasks": ["13"],
      "dependsOn": ["9.4", "10.5", "11.4", "12.2"]
    },
    {
      "wave": 11,
      "label": "Security hardening + CSV export",
      "tasks": ["14", "14.1", "14.2"],
      "dependsOn": ["13"]
    },
    {
      "wave": 12,
      "label": "React SPA scaffold + AuthContext + layout",
      "tasks": ["15", "15.1", "15.2", "15.3"],
      "dependsOn": ["14"]
    },
    {
      "wave": 13,
      "label": "Login page + shared UI components",
      "tasks": ["16", "16.1", "16.2"],
      "dependsOn": ["15.3"]
    },
    {
      "wave": 14,
      "label": "Frontend pages",
      "tasks": ["17", "17.1", "17.2", "18", "18.1", "18.2", "19", "19.1", "19.2", "19.3", "20", "20.1", "21", "21.1", "22", "22.1", "23", "23.1", "23.2", "23.3"],
      "dependsOn": ["16.2"]
    },
    {
      "wave": 15,
      "label": "Frontend complete checkpoint",
      "tasks": ["24"],
      "dependsOn": ["17.2", "18.2", "19.3", "20.1", "21.1", "22.1", "23.3"]
    },
    {
      "wave": 16,
      "label": "Integration tests",
      "tasks": ["25", "25.1", "25.2", "25.3", "25.4", "25.5"],
      "dependsOn": ["24"]
    },
    {
      "wave": 17,
      "label": "Final checkpoint",
      "tasks": ["26"],
      "dependsOn": ["25.5"]
    }
  ]
}
```

- Tasks marked `*` are optional and can be skipped for a faster MVP build.
- Numbered checkpoints (4, 8, 13, 24, 26) gate the next layer and should not be skipped.

---

## Tasks

- [ ] 1. Project scaffold and shared types
  - Initialise the monorepo (or two separate packages: `client/` and `server/`)
  - Create `client/` with Vite + React 18 + TypeScript template
  - Create `server/` with Express 4 + TypeScript (`tsconfig`, `ts-node-dev`)
  - Add shared type definitions: `Camera`, `Department`, `District`, `User`, `AuditEntry`, `Role`, `CameraStatus`, `OnboardingStatus`, enum unions — to a `shared/` or `server/src/types.ts` file consumed by both sides
  - Add `zod` to both packages; define the `CameraInputSchema` and export inferred TypeScript types
  - Configure ESLint + Prettier; add `jest` (or `vitest`) with `fast-check` to both packages
  - _Requirements: 3.1_

- [ ] 2. Database setup, migrations, and seed data
  - [ ] 2.1 Write the PostgreSQL DDL migration files
    - `001_extensions.sql`: enable `postgis`, `uuid-ossp`
    - `002_lookup_tables.sql`: `districts` (26 Gujarat districts with centroids) and `departments` (26 govt departments)
    - `003_users.sql`: `users` table with constraints and check on `role`
    - `004_cameras.sql`: `cameras` table with geometry column, all check constraints, and all five indexes (`GIST` on `location`, composite on `(department_id, status)`, `district_id`, `onboarding_status`)
    - `005_audit_log.sql`: `audit_log` table (append-only); `REVOKE UPDATE, DELETE ON audit_log FROM app_user`
    - `006_onboarding_errors.sql`: `onboarding_errors` table
    - _Requirements: 3.1, 4.2, 13.5, 19.1, 19.5_
  - [ ] 2.2 Write synthetic seed data script
    - 50–200 camera records spread across real Gujarat districts (Ahmedabad, Surat, Vadodara, Rajkot, Bhavnagar, Jamnagar, Gandhinagar, Dang, etc.)
    - Distribute cameras across at least 8 departments (POL, RTO, FIRE, MUNI, PWD, EDU, HLTH, REV)
    - Assign a realistic mix of statuses: ~60% Online, ~20% Offline, ~20% Maintenance
    - Include 4 seed users (one per role), with bcrypt-hashed passwords
    - _Requirements: 14.1, 15.1_
  - [ ] 2.3 Create `db.ts` (connection pool) and a migration runner script
    - Use `pg.Pool`; expose `query()` helper
    - `npm run migrate` executes SQL files in order
    - `npm run seed` executes seed script
    - _Requirements: 18.3_

- [ ] 3. Authentication service and JWT middleware
  - [ ] 3.1 Implement `AuthService`
    - `login(username, password)`: query user by username, `bcrypt.compare`, sign JWT (`userId`, `role`, `departmentId`, 8-hour expiry), return `AuthResult`
    - `validateToken(token)`: verify with `JWT_SECRET` env var, return `TokenPayload | null`
    - `refreshToken(token)`: verify existing token, issue new JWT
    - Hash passwords with bcrypt cost factor ≥ 12
    - Reject login for `isActive = false` accounts with HTTP 401
    - _Requirements: 1.1, 1.2, 1.5, 1.7, 15.6_
  - [ ]* 3.2 Write unit tests for `AuthService`
    - Valid credentials → returns JWT with correct claims
    - Invalid password → returns null / 401
    - Inactive account → 401
    - Expired token → `validateToken` returns null
    - _Requirements: 1.1, 1.2, 1.7_
  - [ ] 3.3 Implement `authMiddleware` and `rbacGuard`
    - `authMiddleware`: extract Bearer token, call `validateToken`, attach `TokenPayload` to `req.user`; return 401 on failure
    - `rbacGuard(resource, action)`: implement the full RBAC matrix from the design; return 403 with no data when denied; handle `department_officer` dept scoping (`scopedTo`)
    - Wire rate limiter (`express-rate-limit`, 10 req/min per IP) onto `POST /api/auth/login`
    - _Requirements: 1.3, 1.4, 1.6, 2.1–2.7_
  - [ ]* 3.4 Write property test for RBAC guard — Property 2 (Auditor Write Rejection)
    - **Property 2: Auditor Write Rejection**
    - Use fast-check to generate arbitrary `{resource, action}` pairs where `action ∈ {POST, PUT, PATCH, DELETE}`; assert `rbacGuard` returns `allowed: false` for every Auditor JWT
    - **Validates: Requirements 2.4, 1.4**
  - [ ]* 3.5 Write property test for RBAC guard — Property 1 (RBAC Isolation for Department Officers)
    - **Property 1: RBAC Isolation for Department Officers**
    - Generate arbitrary `departmentId` values; assert that a DO with `deptA` cannot access cameras from `deptB`
    - **Validates: Requirements 2.2, 2.7, 8.5, 10.8**
  - [ ] 3.6 Implement `POST /api/auth/login` and `POST /api/auth/refresh` routes
    - _Requirements: 1.1, 1.6_

- [ ] 4. Checkpoint — Auth layer working
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `POST /api/auth/login` returns a JWT; verify rate limiter returns 429 after 10 requests/min.

- [ ] 5. Camera validation and ID generation
  - [ ] 5.1 Implement `validateCameraInput(input: CameraInput): ValidationResult`
    - Validate all 9 rules from Requirement 3: Camera_ID regex, Gujarat lat/lng bounds, `retentionDays` [1,365], name length, FK existence checks, enum values
    - Return `{valid: true, errors: []}` or `{valid: false, errors: FieldError[]}`
    - Must not mutate input
    - _Requirements: 3.2–3.9_
  - [ ]* 5.2 Write property test — Property 6: Validation Idempotence
    - **Property 6: Validation Idempotence**
    - Generate arbitrary `CameraInput` objects; call `validateCameraInput` twice; assert same result both times and input not mutated
    - **Validates: Requirements 3.8, 3.9**
  - [ ]* 5.3 Write property test — Property 15: Validation Rejects Out-of-Bounds Coordinates
    - **Property 15: Validation Rejects Out-of-Bounds Coordinates**
    - Generate latitudes outside [20.1, 24.7] and longitudes outside [68.2, 74.5]; assert `validateCameraInput` returns `valid: false` with a `latitude` or `longitude` field error
    - **Validates: Requirements 3.3, 3.8**
  - [ ]* 5.4 Write property test — Property 14: Retention Days Bounds
    - **Property 14: Retention Days Bounds**
    - Generate arbitrary integers outside [1, 365]; assert validation returns failure for `retentionDays`; generate in-range integers and assert they pass
    - **Validates: Requirements 3.4**
  - [ ] 5.5 Implement `generateCameraId(departmentId, conn): Promise<string>`
    - Atomically compute `MAX(sequence) + 1` per department, pad to 6 digits, prefix `GJ-{DEPTCODE}-`
    - Assert generated ID matches `/^GJ-[A-Z]{2,6}-\d{6}$/`
    - _Requirements: 4.1, 4.2_
  - [ ]* 5.6 Write property test — Property 3: Camera ID Format Invariant
    - **Property 3: Camera ID Format Invariant**
    - Generate arbitrary valid 2–6 letter department codes; assert `generateCameraId` always produces IDs matching `/^GJ-[A-Z]{2,6}-\d{6}$/`
    - **Validates: Requirements 3.2, 4.1**
  - [ ]* 5.7 Write unit tests for Camera ID generation
    - First camera per department → `000001`; second → `000002`; no gaps on sequential calls
    - Duplicate ID submitted manually → returns HTTP 409 with `DUPLICATE_ID`
    - _Requirements: 4.1, 4.3, 4.4_

- [ ] 6. CameraService — CRUD, filters, pagination
  - [ ] 6.1 Implement `CameraService.list()` with filters and pagination
    - Build parameterized SQL with dynamic WHERE clauses for all `CameraFilters` fields
    - Apply RBAC scoping: DO/FO → `WHERE department_id = $n`; FO → exclude `onboarding_status = 'Rejected'`
    - Return `{ data: Camera[], total: number, page, pageSize }`
    - Enforce `pageSize` max 500
    - _Requirements: 8.1–8.6, 2.2, 2.3_
  - [ ]* 6.2 Write property test — Property 13: Pagination Bound
    - **Property 13: Pagination Bound**
    - Generate arbitrary `pageSize` values in [1, 500]; assert `result.data.length <= pageSize` and `result.total >= result.data.length`
    - **Validates: Requirements 8.2, 8.4**
  - [ ]* 6.3 Write property test — Property 12: Field Officer Scope Invariant
    - **Property 12: Field Officer Scope Invariant**
    - Generate Field Officer tokens with various `departmentId` values; assert all returned cameras have matching `departmentId` and none have `onboarding_status = 'Rejected'`
    - **Validates: Requirements 2.3, 8.5, 8.6**
  - [ ] 6.4 Implement `CameraService.getById()`, `.create()`, `.update()`, and `.delete()`
    - `create`: call `validateCameraInput`, call `generateCameraId`, INSERT with PostGIS `ST_GeomFromText('POINT(lng lat)', 4326)`, call `appendAuditLog`
    - `update`: validate patched fields, UPDATE, call `appendAuditLog` with before/after snapshots; return 403 for Field Officer
    - `delete`: SNO only, DELETE + audit log with full before state; return 403 for others
    - Return HTTP 422 on validation failure, 409 on duplicate ID, 403 on permission failure
    - _Requirements: 9.1–9.5, 3.8_
  - [ ] 6.5 Implement `CameraService.getStats()` with 60-second in-memory cache
    - Query `COUNT(*) GROUP BY status` (scoped by actor)
    - Wrap with `node-cache` TTL 60s
    - Return `{ total, online, offline, maintenance, pending }`
    - _Requirements: 10.7, 19.3_
  - [ ]* 6.6 Write property test — Property 16: Camera Stats Consistency
    - **Property 16: Camera Stats Consistency**
    - Generate arbitrary stats objects; assert `online + offline + maintenance <= total` and all fields `>= 0`
    - **Validates: Requirements 10.7**
  - [ ] 6.7 Implement `CameraService.getGeoJSON()`
    - SELECT approved cameras with `ST_X(location)` as `lng`, `ST_Y(location)` as `lat`
    - Build RFC 7946 FeatureCollection: `coordinates: [lng, lat]`, properties `{ id, status, departmentId, cameraType }`
    - Apply dept scoping for DO/FO
    - Support `?fields=` query param for field projection
    - _Requirements: 10.1–10.3, 10.8, 19.2_
  - [ ]* 6.8 Write property test — Property 9: GeoJSON Coordinate Order
    - **Property 9: GeoJSON Coordinate Order**
    - Generate camera records with known lat/lng; assert every returned Feature has `coordinates[0] === lng` and `coordinates[1] === lat`
    - **Validates: Requirements 10.2**
  - [ ]* 6.9 Write property test — Property 4: Geographic Coordinate Constraint
    - **Property 4: Geographic Coordinate Constraint**
    - Generate cameras accepted by the system; assert every stored camera has `lat ∈ [20.1, 24.7]` and `lng ∈ [68.2, 74.5]`
    - **Validates: Requirements 3.3, 2.7**
  - [ ] 6.10 Register camera routes: `GET /api/cameras`, `GET /api/cameras/geojson`, `GET /api/cameras/stats`, `GET /api/cameras/:id`, `POST /api/cameras`, `PATCH /api/cameras/:id`, `DELETE /api/cameras/:id`
    - Wire `authMiddleware` + `rbacGuard` on each route
    - Add `Content-Disposition` + MIME headers for CSV export responses
    - _Requirements: 8.1–8.6, 9.1–9.5, 16.1, 16.5_

- [ ] 7. Onboarding service and queue
  - [ ] 7.1 Implement `OnboardingService.submitManual()`
    - Validate input with `validateCameraInput`; generate Camera_ID; INSERT camera with `onboarding_status = 'Pending'`; audit log `ONBOARD_SUBMIT`
    - Return HTTP 201 `{ id, onboardingStatus: "Pending" }`
    - _Requirements: 5.1, 5.5_
  - [ ] 7.2 Implement `OnboardingService.submitBulkCSV()`
    - Use `csv-parse` to parse the buffer row-by-row in memory (no disk write)
    - Call `validateBulkCSV(rows, existingIds, departments, districts)` implementing the algorithm from the design
    - Bulk INSERT valid rows; return HTTP 207 `{ accepted, rejected, errors }`
    - Validate MIME type (`text/csv`) and max size 5MB before parsing; return 400 on failure
    - Audit log `BULK_UPLOAD` with `{ count, filename }`
    - _Requirements: 6.1–6.7, 18.5, 18.7_
  - [ ]* 7.3 Write property test — Property 5: Bulk Import Partition Completeness
    - **Property 5: Bulk Import Partition Completeness**
    - Generate arbitrary arrays of `CameraInput` rows (mix of valid and invalid); assert `result.accepted + result.rejected === rows.length` for every input
    - **Validates: Requirements 6.1, 6.2, 6.7**
  - [ ] 7.4 Implement `OnboardingService.getQueue()`, `.approve()`, and `.reject()`
    - `getQueue`: paginated list of cameras with `onboarding_status IN ('Pending', 'Validation')`, scoped by actor dept
    - `approve`: transition to `Approved`, set `status = 'Online'`; enforce permitted transitions only; audit log `ONBOARD_APPROVE`
    - `reject`: transition to `Rejected`, store reason; audit log `ONBOARD_REJECT`
    - Return 403 for Field Officer approve/reject attempts
    - _Requirements: 7.1–7.6_
  - [ ]* 7.5 Write property test — Property 7: Onboarding Status Monotonicity
    - **Property 7: Onboarding Status Monotonicity**
    - Generate sequences of status transitions; assert only `Pending→Validation`, `Pending→Rejected`, `Validation→Approved`, `Validation→Rejected` are accepted; all others return an error
    - **Validates: Requirements 7.5**
  - [ ] 7.6 Register onboarding routes: `GET /api/onboarding`, `POST /api/onboarding`, `POST /api/onboarding/bulk`, `PATCH /api/onboarding/:id/approve`, `PATCH /api/onboarding/:id/reject`
    - Wire `multer` (memory storage) for the bulk route
    - _Requirements: 5.1–5.5, 6.1–6.7, 7.1–7.6_

- [ ] 8. Checkpoint — Backend core complete
  - Ensure all tests pass, ask the user if questions arise.
  - Smoke-test the onboarding flow end-to-end against the seeded database: submit → queue → approve → camera appears in list.

- [ ] 9. AuditService
  - [ ] 9.1 Implement `AuditService.log()` (`appendAuditLog`)
    - INSERT into `audit_log`; must run within the caller's transaction to satisfy atomicity (pass `conn` or `client` through)
    - _Requirements: 13.1, 13.2, 13.6_
  - [ ]* 9.2 Write property test — Property 8: Audit Completeness
    - **Property 8: Audit Completeness**
    - Generate arbitrary state-changing operations (create, update, approve, reject, delete); assert exactly one `audit_log` row exists per operation with matching `targetId` and timestamp within the same transaction
    - **Validates: Requirements 13.1, 7.4, 9.3, 9.4, 15.3, 15.4**
  - [ ] 9.3 Implement `AuditService.list()` and `AuditService.getForCamera()`
    - `list`: paginated, filterable by `action`, `actorId`, `targetId`, date range; SNO/Auditor → all; Field Officer → own entries only
    - `getForCamera`: full history for a Camera_ID, no pagination
    - _Requirements: 13.3, 13.4, 13.7, 13.8_
  - [ ] 9.4 Register audit routes: `GET /api/audit`, `GET /api/audit/camera/:id`
    - Apply `rbacGuard` (SNO, Auditor, and scoped FO access)
    - _Requirements: 13.3, 13.4, 13.7, 13.8_

- [ ] 10. GapAnalysisService
  - [ ] 10.1 Implement `GapAnalysisService.getLowCoverageZones(threshold)`
    - Execute the SQL from the design pseudocode: LEFT JOIN districts + cameras, GROUP BY district, compute average, filter below `threshold × avg`, sort by deficit DESC
    - Return HTTP 400 if `threshold` outside (0, 1)
    - _Requirements: 11.1–11.3, 11.7_
  - [ ]* 10.2 Write property test — Property 11: Gap Zone Ordering and Correctness
    - **Property 11: Gap Zone Ordering and Correctness**
    - Generate arbitrary district count maps and threshold values t ∈ (0, 1); assert every returned zone has `cameraCount < t × avg` and zones are sorted by `deficit` DESC
    - **Validates: Requirements 11.1, 11.3**
  - [ ] 10.3 Implement `GapAnalysisService.getAgeingInfrastructure()` and `getBelowAverageDistricts()`
    - `getAgeingInfrastructure`: query cameras where `last_verified_at IS NULL OR last_verified_at < NOW() - INTERVAL '90 days'`
    - `getBelowAverageDistricts`: rank all districts by camera count; flag below-average; include `onlineRate`
    - _Requirements: 11.4, 11.5_
  - [ ] 10.4 Implement `GapAnalysisService.exportReport()` — CSV format
    - Produce `Content-Disposition: attachment; filename="gap-report.csv"` with gap zones + district rankings
    - Audit log `EXPORT` with filters, count, format
    - Return 403 for Field Officer
    - _Requirements: 11.6, 16.2, 16.3, 16.4, 16.5_
  - [ ] 10.5 Register gap analysis routes: `GET /api/gap-analysis`, `GET /api/gap-analysis/ageing`, `GET /api/gap-analysis/export`
    - _Requirements: 11.1–11.7_

- [ ] 11. HealthMonitorService
  - [ ] 11.1 Implement `HealthMonitorService.getFlaggedCameras()`
    - Apply the flagging algorithm from the design: Offline → high, Maintenance → medium, Not_Verified_90d → medium, Retention_Expiring (< 7 days) → low
    - Assign single highest-severity when multiple conditions met
    - Sort: high → medium → low, then flaggedAt ASC within each tier
    - Apply dept scoping for DO
    - _Requirements: 12.1–12.3, 12.6_
  - [ ]* 11.2 Write property test — Property 10: Health Flag Correctness and Ordering
    - **Property 10: Health Flag Correctness and Ordering**
    - Generate arbitrary camera lists; assert every item in the flagged result satisfies at least one flag condition, and the sort order is strictly `high → medium → low` then `flaggedAt ASC`
    - **Validates: Requirements 12.1, 12.2, 12.3**
  - [ ] 11.3 Implement `HealthMonitorService.getTrendData()` and `getAlertSummary()`
    - `getTrendData(days)`: generate daily counts of Online/Offline/Maintenance for the past N days using a date-series query
    - `getAlertSummary`: return `{ high: N, medium: N, low: N }` totals
    - _Requirements: 12.4, 12.5_
  - [ ] 11.4 Register health routes: `GET /api/health/flagged`, `GET /api/health/trend`
    - _Requirements: 12.1–12.6_

- [ ] 12. Department and User management routes
  - [ ] 12.1 Implement department routes
    - `GET /api/departments`: return all 26 departments with computed `cameraCount` (subquery or denorm); accessible to all roles
    - `GET /api/departments/:id`: full detail + camera count for one department
    - _Requirements: 14.1–14.4_
  - [ ] 12.2 Implement user management routes (SNO only)
    - `GET /api/users`: list all users with role + department assignment
    - `POST /api/users`: validate unique username/email, hash password (bcrypt ≥ 12), INSERT, audit log `USER_CREATE`
    - `PATCH /api/users/:id`: update role/department/isActive, audit log `USER_UPDATE` with before/after; reject non-SNO with 403
    - _Requirements: 15.1–15.6_

- [ ] 13. Checkpoint — All API routes complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run the integration test suite against the seeded database: verify RBAC at HTTP layer for all four roles; verify audit log entries for each action type.

- [ ] 14. Security and infrastructure hardening
  - [ ] 14.1 Add `helmet` middleware (CSP, X-Frame-Options, X-Content-Type-Options) to the Express app
    - Configure CORS to allow only the deployed frontend origin (from env var `FRONTEND_ORIGIN`)
    - All SQL must use parameterized queries — audit all `query()` calls
    - _Requirements: 18.1–18.4, 18.6_
  - [ ] 14.2 Add camera CSV export endpoint `GET /api/cameras/export`
    - Apply same filters as list endpoint; return all matching rows (no pagination) as CSV
    - Set `Content-Disposition: attachment; filename="cameras-export.csv"` and `Content-Type: text/csv`
    - Audit log `EXPORT`; reject Field Officers with 403
    - _Requirements: 16.1, 16.3, 16.4, 16.5_

- [ ] 15. React SPA scaffold, routing, and AuthContext
  - [ ] 15.1 Set up React Router v6 with all 9 routes
    - `/login` — public
    - `/` → GIS Dashboard, `/cameras` → Camera Registry, `/onboarding` → Onboarding Queue, `/gap-analysis` → Gap Analysis, `/departments` → Departments, `/health` → Health Monitor, `/audit` → Audit Trail, `/registry-api-docs` → API Docs, `/settings` → Settings
    - Create `ProtectedRoute` component that redirects unauthenticated users to `/login`
    - Redirect `/registry-api-docs` to login if unauthenticated (Requirement 17.3)
    - _Requirements: 17.1, 17.3_
  - [ ] 15.2 Implement `AuthContext` + `useAuth` hook
    - Store JWT + decoded `TokenPayload` in context
    - `login()`: call `POST /api/auth/login`, store token in localStorage, set context
    - `logout()`: clear localStorage, redirect to login
    - Axios interceptor: attach `Authorization: Bearer {token}` header; on 401 response → call `logout()`
    - _Requirements: 1.3_
  - [ ] 15.3 Implement the CSS design token file and shared layout components
    - `LeftNav` (220px fixed): navigation links with active state, role-based link visibility
    - `TopBar` (48px): page title + user role chip
    - `StatStrip`: 4 stat cards (Total / Online / Offline / Maintenance) using data from `/api/cameras/stats`
    - `StatusBadge`: colored dot + label (no pill), WCAG AA compliant, all six status values
    - _Requirements: 10.4, 10.7_

- [ ] 16. Login page and shared UI components
  - [ ] 16.1 Build `LoginPage`
    - Form: username + password fields with `react-hook-form` + `zod` validation
    - On success: store token, redirect to `/`
    - On failure: display inline error message
    - _Requirements: 1.1, 1.2_
  - [ ] 16.2 Build shared `DataTable` component
    - Sortable column headers, pagination controls, loading skeleton, empty state
    - `FilterBar` component: dropdowns + free-text search
    - `Modal` / `Drawer` component: used for camera detail and form overlays
    - `ExportButton`: triggers CSV download via anchor with `Content-Disposition` response
    - `Toast` / `Alert` component: success (Camera ID confirmation) and error (field validation) variants
    - _Requirements: 5.3, 5.4, 8.1–8.3_

- [ ] 17. GIS Dashboard page
  - [ ] 17.1 Build `MapView` component (Leaflet)
    - CartoDB Positron tile layer: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
    - Fetch GeoJSON from `GET /api/cameras/geojson`; render `CircleMarker` (radius 6) with status color coding: Online `#2E7D5B`, Maintenance `#B5792B`, Offline `#A23B33`
    - Wire `Leaflet.markercluster` with `maxClusterRadius: 40`
    - On marker click: open `CameraDetailDrawer` (no page navigation)
    - On cluster click: expand cluster in place
    - _Requirements: 10.1, 10.4, 10.5, 10.6_
  - [ ] 17.2 Build `GISPage`
    - Compose `MapView` + `StatStrip` + `FilterBar` (filter by status/department/district) + `DepartmentBreakdown` list + `RecentActivity` list
    - `FilterBar` selection updates the GeoJSON query params and re-fetches
    - _Requirements: 10.1–10.8_

- [ ] 18. Camera Registry page
  - [ ] 18.1 Build `RegistryPage`
    - `FilterBar` (status, department, district, camera type, connectivity, free text)
    - `DataTable` bound to `GET /api/cameras` with pagination and column sort
    - Row click → `CameraDetailDrawer` showing all fields
    - `ExportButton` → `GET /api/cameras/export` (hidden for Field Officers)
    - _Requirements: 8.1–8.6, 9.1, 16.1_
  - [ ] 18.2 Build `CameraDetailDrawer` with inline edit for SNO/DO
    - Show all 18 camera fields
    - SNO/DO: editable fields with `react-hook-form`; submit → `PATCH /api/cameras/:id`; success toast; error display
    - SNO only: "Delete" button → confirm modal → `DELETE /api/cameras/:id`
    - _Requirements: 9.1–9.5_

- [ ] 19. Onboarding Queue page
  - [ ] 19.1 Build `ManualOnboardingForm`
    - All required fields with `react-hook-form` + `zod` client-side validation (bounds check before submit)
    - On submit: `POST /api/onboarding`; show success toast with Camera_ID; show inline errors on validation failure without clearing form data
    - _Requirements: 5.1–5.5_
  - [ ] 19.2 Build `CSVUploader` component
    - File input (accept `.csv`, max 5 MB client-side check)
    - `papaparse` preview of first 5 rows
    - On upload: `POST /api/onboarding/bulk`; show result summary (accepted / rejected counts)
    - Downloadable error report CSV when there are rejected rows
    - _Requirements: 6.1–6.7_
  - [ ] 19.3 Build `QueueTable` and `OnboardingQueuePage`
    - Paginated table of Pending/Validation entries from `GET /api/onboarding`
    - SNO/DO: Approve and Reject action buttons per row with reject-reason modal
    - Field Officer view: read-only queue (no action buttons)
    - _Requirements: 7.1–7.6_

- [ ] 20. Gap Analysis page
  - [ ] 20.1 Build `GapAnalysisPage`
    - Map with gap-zone district markers (sized by deficit) from `GET /api/gap-analysis`
    - Threshold slider (0.1–0.9, default 0.5) that refetches on change
    - `GapTable`: sortable table of gap zones with district name, camera count, average, deficit
    - Ageing infrastructure sub-section from `GET /api/gap-analysis/ageing`
    - `ExportButton` → `GET /api/gap-analysis/export` (SNO, DO, Auditor only)
    - _Requirements: 11.1–11.7_

- [ ] 21. Health Monitor page
  - [ ] 21.1 Build `HealthMonitorPage`
    - Alert summary chips (high / medium / low counts) from `GET /api/health/flagged`
    - `FlaggedBoard`: table of flagged cameras with severity badge, flag reason, camera ID, district, last verified
    - `TrendChart`: recharts `LineChart` with three lines (Online / Offline / Maintenance) bound to `GET /api/health/trend?days=30`
    - _Requirements: 12.1–12.6_

- [ ] 22. Audit Trail page
  - [ ] 22.1 Build `AuditTrailPage`
    - `FilterBar`: filter by action type, actor, target ID, date range
    - `AuditTable`: paginated table bound to `GET /api/audit` with columns: timestamp, action, actor, role, target ID, IP
    - Field Officer view: shows only their own entries (server-enforced; client hides filter controls)
    - _Requirements: 13.1–13.8_

- [ ] 23. Departments, Settings, and API Docs pages
  - [ ] 23.1 Build `DepartmentsPage`
    - Table of all 26 departments from `GET /api/departments` with camera count column
    - Row click → department detail panel
    - _Requirements: 14.1–14.4_
  - [ ] 23.2 Build `SettingsPage` (SNO only)
    - `UserTable`: list all users from `GET /api/users` (role, department, active status)
    - `RoleEditor`: form to create new user (`POST /api/users`) and edit existing user role/dept/active (`PATCH /api/users/:id`)
    - Non-SNO users see 403 page
    - _Requirements: 15.1–15.6_
  - [ ] 23.3 Build `RegistryAPIDocsPage`
    - Static page rendering the full endpoint table from the design (method, path, required roles, params, example request/response)
    - Route accessible only to authenticated users; redirect to login if not authenticated
    - _Requirements: 17.1–17.3_

- [ ] 24. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 9 pages render with seeded data; verify RBAC-based UI differences (e.g., Field Officer cannot see Approve buttons, export buttons are hidden, Settings is inaccessible).

- [ ] 25. Integration tests
  - [ ]* 25.1 Write integration test: full onboarding flow
    - Seed DB; submit manual onboarding as Field Officer → verify camera appears in queue as Pending → approve as SNO → verify `onboarding_status = 'Approved'` and `status = 'Online'` in cameras table → verify audit entries exist for both operations
    - _Requirements: 5.1, 7.2, 7.4_
  - [ ]* 25.2 Write integration test: RBAC at HTTP layer
    - For each of the 4 roles, call each endpoint group and assert correct 200/403/401 responses per the RBAC matrix
    - _Requirements: 2.1–2.7_
  - [ ]* 25.3 Write integration test: bulk CSV upload with partial errors
    - Upload CSV with 10 valid rows and 3 invalid rows (2 bad lat/lng, 1 duplicate ID); assert HTTP 207, `accepted: 10`, `rejected: 3`, error report downloadable
    - _Requirements: 6.1–6.7_
  - [ ]* 25.4 Write integration test: GeoJSON bounds
    - Fetch `GET /api/cameras/geojson`; assert all features have `coordinates[1] ∈ [20.1, 24.7]` and `coordinates[0] ∈ [68.2, 74.5]`
    - _Requirements: 10.1, 10.2, 3.3_
  - [ ]* 25.5 Write integration test: audit log completeness
    - Trigger onboarding submit, approve, update, delete, bulk upload, login; assert 6 distinct audit entries with correct `action` values and `targetId` references
    - _Requirements: 13.1, 13.2_

- [ ] 26. Final checkpoint — Ensure all tests pass
  - Run the full test suite (unit + property + integration); confirm zero failures.
  - Ask the user if questions arise before considering implementation complete.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- Property tests use **fast-check** and are co-located with their implementation tasks to catch regressions early.
- Each task references specific requirements for traceability; all 19 requirements and 16 correctness properties are covered.
- The synthetic seed dataset (Task 2.2) is required for a meaningful demo and for integration tests.
- Database migrations must be idempotent and run in numbered order via `npm run migrate`.
- The `audit_log` table immutability is enforced at the PostgreSQL permission layer (`REVOKE UPDATE, DELETE`) — not just application code.
- JWT secret and frontend origin must be configured as environment variables (`JWT_SECRET`, `FRONTEND_ORIGIN`); never committed to source control.
