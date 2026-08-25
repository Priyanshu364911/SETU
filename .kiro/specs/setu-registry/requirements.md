# Requirements Document

## Introduction

SETU (Surveillance Equipment Tracking Utility) Registry is a metadata and asset-visibility platform for the Gujarat Police Innovation Challenge 2026. It provides a single source of truth for approximately 80,000 CCTV cameras across 26 Gujarat government departments — enabling onboarding, search, geographic visualisation, gap analysis, and audit logging of camera metadata. The system handles **only metadata** (no live video, no AI/analytics) and is designed for internal government operations use. The platform is built as a React SPA (Vite) backed by a Node.js/Express REST API with a PostgreSQL + PostGIS database, and governed by role-based access control (RBAC) across four roles: State Nodal Officer, Department Officer, Field Officer, and Auditor.

---

## Glossary

- **System**: The SETU Registry platform (frontend + backend + database together).
- **Auth_Service**: The backend module responsible for issuing, validating, and refreshing JWT tokens and enforcing RBAC.
- **Camera_Service**: The backend module responsible for all CRUD and query operations on camera metadata.
- **Onboarding_Service**: The backend module managing the camera onboarding lifecycle (submission → review → approval/rejection).
- **Gap_Analysis_Service**: The backend module that computes coverage gaps, ageing alerts, and district rankings.
- **Audit_Service**: The backend module that maintains the append-only audit log of all state-changing actions.
- **Health_Monitor_Service**: The backend module that identifies cameras requiring attention based on status, verification age, and retention policy.
- **Camera**: A metadata record for a single physical CCTV camera unit.
- **Camera_ID**: The system-assigned unique identifier for a camera, formatted as `GJ-DEPTCODE-NNNNNN` (e.g. `GJ-POL-000042`).
- **SNO**: State Nodal Officer — the highest-privilege role with cross-department access.
- **Department_Officer (DO)**: A role with read/write/approve access scoped to their own department.
- **Field_Officer (FO)**: A role with read access and submission-only write access scoped to their own department.
- **Auditor**: A read-only role with cross-department access to all cameras and audit logs.
- **JWT**: JSON Web Token used for stateless authentication.
- **RBAC**: Role-Based Access Control — the permission system governing which roles may perform which actions.
- **Onboarding_Status**: The lifecycle state of a camera submission: `Pending`, `Validation`, `Approved`, or `Rejected`.
- **Camera_Status**: The operational state of a camera: `Online`, `Maintenance`, `Offline`, or `Pending`.
- **GeoJSON**: The geographic data format (RFC 7946) used for map rendering.
- **Gap_Zone**: A district whose approved camera count falls below a configurable threshold fraction of the district-level average.
- **Flagged_Camera**: A camera identified by the Health_Monitor_Service as requiring attention.
- **Gujarat_Bounds**: The bounding box for valid Gujarat coordinates: latitude [20.1°N, 24.7°N], longitude [68.2°E, 74.5°E].
- **Audit_Log**: The append-only database table recording every state-changing action.
- **CSV**: Comma-Separated Values — the file format used for bulk camera onboarding uploads.

---

## Requirements

### Requirement 1: User Authentication and Session Management

**User Story:** As a government officer, I want to log in securely and maintain an authenticated session, so that I can access the registry according to my role.

#### Acceptance Criteria

1. WHEN a user submits a valid username and password, THE Auth_Service SHALL return a signed JWT containing the user's ID, role, and departmentId with an 8-hour expiry.
2. WHEN a user submits an invalid username or password, THE Auth_Service SHALL return HTTP 401 with no token issued.
3. WHEN any API request includes a missing, malformed, or expired JWT, THE Auth_Service SHALL return HTTP 401 and the client SHALL redirect to the login page.
4. WHEN a valid JWT is presented, THE Auth_Service SHALL extract and validate the role and departmentId claims before any business logic executes.
5. THE Auth_Service SHALL hash all stored passwords using bcrypt with a cost factor of at least 12.
6. THE Auth_Service SHALL limit login attempts to 10 per minute per IP address and return HTTP 429 when the limit is exceeded.
7. WHEN a user requests a token refresh with a valid non-expired JWT, THE Auth_Service SHALL issue a new JWT and invalidate the old one.

---

### Requirement 2: Role-Based Access Control (RBAC)

**User Story:** As a system administrator, I want every API action to be gated by the caller's role, so that no officer can access or modify data outside their authorisation.

#### Acceptance Criteria

1. WHILE a user has the role state_nodal_officer, THE System SHALL permit read and write access to all cameras across all departments and all audit logs.
2. WHILE a user has the role department_officer, THE System SHALL restrict camera read, write, and approve access to cameras belonging to their own department only.
3. WHILE a user has the role field_officer, THE System SHALL permit read access to cameras within their own department and restrict write access to submission of new onboarding entries only.
4. WHILE a user has the role auditor, THE System SHALL permit read access to all cameras and all audit log entries and reject all write, update, delete, and approve requests with HTTP 403.
5. THE Auth_Service SHALL evaluate the RBAC decision before executing any business logic for every API endpoint.
6. WHEN a user attempts an action not permitted by their role, THE Auth_Service SHALL return HTTP 403 and SHALL NOT return any data from the request.
7. THE System SHALL scope GeoJSON, camera list, and stats responses to the requesting user's department when the role is department_officer or field_officer.

---

### Requirement 3: Camera Metadata Model and Validation

**User Story:** As a system engineer, I want every camera record to conform to a strict schema and validation ruleset, so that the registry maintains data integrity across all 80,000 entries.

#### Acceptance Criteria

1. THE System SHALL store each camera with a unique Camera_ID, name, department, district, WGS84 coordinates, camera type, connectivity type, storage type, retention days, ownership, status, onboarding status, onboarding method, submitting user, and timestamps.
2. WHEN a camera record is created or updated, THE Camera_Service SHALL validate that the Camera_ID matches the pattern `/^GJ-[A-Z]{2,6}-\d{6}$/`.
3. WHEN a camera record is created or updated, THE Camera_Service SHALL validate that the latitude is within Gujarat_Bounds [20.1, 24.7] and longitude is within Gujarat_Bounds [68.2, 74.5].
4. WHEN a camera record is created or updated, THE Camera_Service SHALL validate that retentionDays is an integer in the range [1, 365].
5. WHEN a camera record is created or updated, THE Camera_Service SHALL validate that name is non-empty and does not exceed 200 characters.
6. WHEN a camera record is created or updated, THE Camera_Service SHALL validate that departmentId references an existing department and districtId references an existing district.
7. WHEN a camera record is created or updated, THE Camera_Service SHALL validate that cameraType is one of `IP`, `Analog`, `PTZ`, `ANPR`; connectivity is one of `Fiber`, `4G`, `Microwave`, `Other`; storageType is one of `Local NVR`, `Cloud`, `Hybrid`; and ownership is one of `Govt`, `Private`.
8. WHEN any validation rule fails, THE Camera_Service SHALL return HTTP 422 with field-level error messages identifying each failing constraint and its field name.
9. THE Camera_Service SHALL not mutate the input object during validation and SHALL return the same result for the same input on repeated calls (idempotent validation).

---

### Requirement 4: Camera ID Generation

**User Story:** As a system engineer, I want camera IDs to be generated automatically, uniquely, and atomically, so that no two cameras share the same identifier even under concurrent submissions.

#### Acceptance Criteria

1. WHEN a new camera is submitted for onboarding, THE Camera_Service SHALL generate a Camera_ID in the format `GJ-{DEPTCODE}-{NNNNNN}` where DEPTCODE is the 2–6 uppercase letter department code and NNNNNN is a zero-padded six-digit sequence number starting from 000001 per department.
2. THE Camera_Service SHALL generate Camera_IDs atomically so that concurrent submissions within the same department do not produce duplicate IDs.
3. FOR ALL cameras stored in the database, THE Camera_Service SHALL ensure every Camera_ID is unique.
4. IF a manually provided Camera_ID already exists in the database, THEN THE Camera_Service SHALL return HTTP 409 with error code `DUPLICATE_ID` and the conflicting ID.

---

### Requirement 5: Manual Camera Onboarding

**User Story:** As a Field Officer, I want to submit a single camera's metadata through a form, so that I can register new surveillance equipment from the field.

#### Acceptance Criteria

1. WHEN a Field Officer submits a valid manual onboarding form, THE Onboarding_Service SHALL create a camera record with Onboarding_Status `Pending` and return HTTP 201 with the generated Camera_ID.
2. THE System SHALL perform client-side validation of all required fields and coordinate bounds before the form is submitted to the API.
3. WHEN the manual form is submitted successfully, THE System SHALL display a success toast notification containing the new Camera_ID.
4. WHEN the manual form submission fails validation, THE System SHALL display inline field-level error messages without clearing form data.
5. WHEN a camera is submitted for onboarding, THE Onboarding_Service SHALL record the submitting user's ID and the submission timestamp.

---

### Requirement 6: Bulk CSV Camera Onboarding

**User Story:** As a Department Officer, I want to upload a CSV file containing multiple camera records, so that I can onboard large batches of cameras efficiently.

#### Acceptance Criteria

1. WHEN a CSV file is uploaded to the bulk onboarding endpoint, THE Onboarding_Service SHALL parse and validate each row independently against the full camera schema.
2. WHEN bulk validation completes, THE Onboarding_Service SHALL return HTTP 207 with a result containing the count of accepted rows, count of rejected rows, and per-row error details for all rejected rows.
3. THE Onboarding_Service SHALL insert all valid rows into the onboarding queue with status `Pending` even when some rows in the same batch are invalid.
4. WHEN bulk CSV validation identifies row errors, THE System SHALL produce a downloadable error report CSV containing the row number, field name, and error message for each failing row.
5. IF a Camera_ID in the CSV already exists in the database or appears more than once within the same batch, THEN THE Onboarding_Service SHALL reject that row with a `DUPLICATE_ID` error.
6. THE Onboarding_Service SHALL reject CSV uploads with an incorrect MIME type or a file size exceeding 5 MB with HTTP 400.
7. FOR ALL bulk validation results, the count of accepted rows plus the count of rows with errors SHALL equal the total number of input rows.

---

### Requirement 7: Onboarding Queue and Approval Workflow

**User Story:** As a State Nodal Officer or Department Officer, I want to review, approve, or reject pending camera submissions, so that only validated equipment enters the active registry.

#### Acceptance Criteria

1. THE Onboarding_Service SHALL expose a paginated onboarding queue listing all cameras with Onboarding_Status `Pending` or `Validation`, filtered by the requesting user's department scope.
2. WHEN an SNO or Department_Officer approves a camera, THE Onboarding_Service SHALL transition the Onboarding_Status to `Approved` and update the Camera_Status to `Online`.
3. WHEN an SNO or Department_Officer rejects a camera, THE Onboarding_Service SHALL transition the Onboarding_Status to `Rejected` and store the rejection reason.
4. WHEN an onboarding status changes, THE Audit_Service SHALL record the action, actor ID, actor role, previous status, new status, and timestamp.
5. THE Onboarding_Service SHALL enforce the following valid status transitions only: `Pending` → `Validation`, `Pending` → `Rejected`, `Validation` → `Approved`, `Validation` → `Rejected`; no reverse transitions are permitted.
6. IF a Field_Officer attempts to approve or reject an onboarding entry, THEN THE System SHALL return HTTP 403.

---

### Requirement 8: Camera Registry — Search, Filter, and Pagination

**User Story:** As any authorised officer, I want to search and filter the camera registry by multiple criteria, so that I can quickly locate specific cameras or subsets of the inventory.

#### Acceptance Criteria

1. THE Camera_Service SHALL support filtering the camera list by any combination of departmentId, districtId, status, cameraType, connectivity, and free-text search across camera name, location description, and Camera_ID.
2. THE Camera_Service SHALL support pagination with a default page size of 50 and a maximum page size of 500, returning total record count alongside each page.
3. THE Camera_Service SHALL support sorting the camera list by any camera field in ascending or descending order.
4. WHEN pagination parameters are provided, THE Camera_Service SHALL return at most pageSize records and a total count reflecting the full filtered result set.
5. WHEN a Department_Officer or Field_Officer lists cameras, THE Camera_Service SHALL exclude cameras from all departments other than the actor's department.
6. WHEN a Field_Officer lists cameras, THE Camera_Service SHALL exclude all cameras with Onboarding_Status `Rejected`.

---

### Requirement 9: Camera Detail and Update

**User Story:** As an authorised officer, I want to view the full metadata for any camera and update fields I am permitted to change, so that I can keep the registry accurate.

#### Acceptance Criteria

1. THE Camera_Service SHALL return the full camera metadata record including all fields when a specific Camera_ID is requested by an authorised user.
2. WHEN an SNO or Department_Officer updates a camera record, THE Camera_Service SHALL validate the updated fields, persist the changes, and return the updated record.
3. WHEN a camera field is updated, THE Audit_Service SHALL record the before and after state of the changed fields.
4. WHEN an SNO deletes a camera record, THE Camera_Service SHALL remove the record and insert an audit log entry with the full before state.
5. IF a Field_Officer attempts to update or delete an existing camera record, THEN THE System SHALL return HTTP 403.

---

### Requirement 10: GIS Dashboard and Map Visualisation

**User Story:** As any authorised officer, I want to see all cameras plotted on an interactive map with status-coloured markers, so that I can understand geographic camera coverage at a glance.

#### Acceptance Criteria

1. THE Camera_Service SHALL expose a GeoJSON endpoint returning a valid RFC 7946 FeatureCollection where each feature represents one approved camera.
2. THE Camera_Service SHALL return GeoJSON coordinates in [longitude, latitude] order as required by RFC 7946.
3. EACH GeoJSON feature SHALL include at minimum the properties: Camera_ID, status, departmentId, and cameraType.
4. THE System SHALL render camera markers on a Leaflet map using status-based colour coding: Online as green (`#2E7D5B`), Maintenance as amber (`#B5792B`), Offline as red (`#A23B33`).
5. THE System SHALL cluster markers using Leaflet.markercluster with a maximum cluster radius of 40 pixels when the map contains densely co-located cameras.
6. WHEN a user clicks a map marker or cluster, THE System SHALL display a detail panel or expand the cluster without navigating away from the map view.
7. THE Camera_Service SHALL return a camera statistics object containing total, online, offline, maintenance, and pending counts for display in the top stat strip.
8. WHEN a Department_Officer or Field_Officer views the map, THE Camera_Service SHALL return only GeoJSON features belonging to their department.

---

### Requirement 11: Gap Analysis

**User Story:** As a State Nodal Officer, I want to identify districts and zones with below-average camera coverage, so that I can prioritise infrastructure investment.

#### Acceptance Criteria

1. THE Gap_Analysis_Service SHALL compute the average approved camera count per district and identify all districts where the camera count falls below a caller-supplied threshold fraction of that average.
2. WHEN returning gap zones, THE Gap_Analysis_Service SHALL include district ID, district name, actual camera count, average camera count, deficit (average minus actual), and the district centroid coordinates.
3. WHEN returning gap zones, THE Gap_Analysis_Service SHALL sort them by deficit in descending order.
4. THE Gap_Analysis_Service SHALL identify cameras that have not been verified within the past 90 days as ageing infrastructure.
5. THE Gap_Analysis_Service SHALL provide district rankings showing each district's camera count, online rate, and whether it is below the average.
6. WHEN a gap analysis export is requested, THE Gap_Analysis_Service SHALL produce a downloadable report in CSV or PDF format containing the complete gap zone and district ranking data.
7. IF the threshold parameter is outside the range (0, 1), THEN THE Gap_Analysis_Service SHALL return HTTP 400 with a descriptive error.

---

### Requirement 12: Health Monitor

**User Story:** As a State Nodal Officer or Department Officer, I want to see a prioritised list of cameras requiring attention, so that I can act on operational issues promptly.

#### Acceptance Criteria

1. THE Health_Monitor_Service SHALL flag cameras as requiring attention when any of the following conditions is met: Camera_Status is `Offline` (severity: high), Camera_Status is `Maintenance` (severity: medium), last verified timestamp is absent or more than 90 days in the past (severity: medium), or retentionDays is less than 7 (severity: low).
2. WHEN a camera meets multiple flag conditions, THE Health_Monitor_Service SHALL assign the single highest-severity condition as the primary flag reason.
3. THE Health_Monitor_Service SHALL return flagged cameras sorted first by severity (high before medium before low) and then by flaggedAt timestamp ascending within each severity tier.
4. THE Health_Monitor_Service SHALL return a status trend dataset showing daily counts of Online, Offline, and Maintenance cameras for a caller-specified number of past days.
5. THE Health_Monitor_Service SHALL return an alert summary object containing the total count of high, medium, and low severity flagged cameras.
6. WHEN a Department_Officer views the health monitor, THE Health_Monitor_Service SHALL return only cameras belonging to their department.

---

### Requirement 13: Audit Trail

**User Story:** As a State Nodal Officer or Auditor, I want to review a complete, immutable log of every action taken in the system, so that I can ensure accountability and support compliance investigations.

#### Acceptance Criteria

1. THE Audit_Service SHALL record an audit entry for every state-changing operation including: camera onboarding submission, approval, rejection, update, deletion, bulk CSV upload, status change, user creation, user update, login, and data export.
2. EACH audit entry SHALL include: unique entry ID, action type, actor ID, actor role, target ID, target type, before state snapshot, after state snapshot, metadata, IP address, and creation timestamp.
3. THE Audit_Service SHALL expose a paginated audit log endpoint supporting filtering by action type, actor ID, target ID, and date range.
4. THE Audit_Service SHALL expose an endpoint returning the complete audit history for a specific Camera_ID.
5. THE audit_log database table SHALL be protected so that no UPDATE or DELETE operations are permitted at the database permission level.
6. WHEN the enclosing database transaction rolls back, THE Audit_Service SHALL also roll back the audit entry to maintain atomicity.
7. WHEN a Field_Officer requests the audit log endpoint, THE System SHALL return only audit entries for actions taken by that Field_Officer.
8. IF an Auditor or SNO queries the audit trail, THE Audit_Service SHALL return entries across all departments.

---

### Requirement 14: Department Management

**User Story:** As any authorised officer, I want to browse the list of registered departments and view per-department camera counts, so that I can understand the distribution of the registry across Gujarat government bodies.

#### Acceptance Criteria

1. THE System SHALL maintain a departments table containing department ID, full name, nodal officer name, and nodal officer email.
2. THE System SHALL expose an endpoint returning the list of all departments including the computed camera count for each.
3. THE System SHALL expose an endpoint returning the full department detail and camera count for a specified department ID.
4. WHEN any officer with read permissions requests the department list, THE System SHALL return all 26 departments regardless of the requesting user's role.

---

### Requirement 15: User Management

**User Story:** As a State Nodal Officer, I want to create, view, and update user accounts and their roles, so that I can onboard new officers and manage access rights.

#### Acceptance Criteria

1. THE System SHALL expose a user management endpoint allowing the SNO to list all registered users with their roles and department assignments.
2. WHEN the SNO creates a new user, THE System SHALL validate that username and email are unique, assign the specified role and departmentId, and store a bcrypt-hashed password.
3. WHEN a new user is created, THE Audit_Service SHALL record a `USER_CREATE` audit entry with the new user's ID, role, and department.
4. WHEN the SNO updates a user record (role, department, or active status), THE Audit_Service SHALL record a `USER_UPDATE` audit entry with the before and after state.
5. IF a Department_Officer, Field_Officer, or Auditor attempts to access the user management endpoints, THEN THE System SHALL return HTTP 403.
6. WHEN a user account is deactivated (isActive set to false), THE Auth_Service SHALL reject all subsequent login attempts for that account with HTTP 401.

---

### Requirement 16: Data Export

**User Story:** As an SNO, Department Officer, or Auditor, I want to export filtered camera lists and reports as CSV or PDF files, so that I can use the data in external reporting tools.

#### Acceptance Criteria

1. THE Camera_Service SHALL expose a CSV export endpoint that applies the same filters as the camera list endpoint and returns all matching records (not subject to pagination) as a downloadable CSV file.
2. THE Gap_Analysis_Service SHALL expose an export endpoint producing a comprehensive gap report in either CSV or PDF format.
3. WHEN any export is performed, THE Audit_Service SHALL record an `EXPORT` audit entry containing the actor, filters applied, record count, and export format.
4. IF a Field_Officer attempts to access any export endpoint, THEN THE System SHALL return HTTP 403.
5. THE System SHALL set the appropriate `Content-Disposition` and MIME type headers on all export responses to trigger browser download behaviour.

---

### Requirement 17: API Documentation Page

**User Story:** As a developer or integrator, I want a built-in API reference page, so that I can understand how to use the SETU Registry REST API programmatically.

#### Acceptance Criteria

1. THE System SHALL serve a Registry API documentation page accessible to authenticated users at the `/registry-api-docs` route.
2. THE API documentation page SHALL list all available endpoints with their HTTP method, path, required roles, request parameters, and example request/response bodies.
3. WHEN an unauthenticated user attempts to access the API documentation page, THE System SHALL redirect them to the login page.

---

### Requirement 18: Security and Infrastructure

**User Story:** As a security officer, I want the platform to follow secure coding and deployment practices, so that sensitive government data is protected from unauthorised access.

#### Acceptance Criteria

1. THE System SHALL serve all traffic exclusively over HTTPS and redirect all HTTP requests to HTTPS.
2. THE System SHALL configure CORS to allow requests only from the deployed frontend origin and SHALL NOT use a wildcard origin in production.
3. THE System SHALL use parameterized database queries for all SQL operations to prevent SQL injection.
4. THE System SHALL apply security response headers (including `Content-Security-Policy`, `X-Frame-Options`, and `X-Content-Type-Options`) using the `helmet` middleware on all API responses.
5. THE System SHALL validate the MIME type and enforce a maximum file size of 5 MB on all CSV uploads, rejecting non-compliant uploads with HTTP 400.
6. THE System SHALL store the JWT signing secret exclusively as an environment variable and SHALL NOT commit it to source control.
7. THE System SHALL process CSV uploads in memory without persisting the file to disk.

---

### Requirement 19: GIS Performance

**User Story:** As a user of the GIS dashboard, I want the map to load and respond promptly even with 80,000 camera records, so that the platform remains usable at full scale.

#### Acceptance Criteria

1. THE System SHALL create a PostGIS GIST spatial index on the camera location column to support efficient geographic queries.
2. WHEN the GeoJSON endpoint is called with no spatial filter, THE System SHALL support field projection (e.g. `?fields=id,lat,lng,status,department`) to reduce payload size.
3. THE Camera_Service SHALL cache the camera statistics response with a time-to-live of 60 seconds using an in-memory store.
4. THE Camera_Service SHALL enforce a maximum pageSize of 500 records per paginated list response.
5. THE System SHALL create a composite index on `(department_id, status)`, an index on `district_id`, and an index on `onboarding_status` in the cameras table to support the most common filter patterns.

---

## Correctness Properties

*A property is a characteristic or behaviour that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: RBAC Isolation for Department Officers

*For any* authenticated Department_Officer actor and any camera returned by a list or GeoJSON query, the camera's departmentId SHALL equal the actor's departmentId.

**Validates: Requirements 2.2, 2.7, 8.5, 10.8**

---

### Property 2: Auditor Write Rejection

*For any* API request using an Auditor JWT where the HTTP method is POST, PUT, PATCH, or DELETE, the system SHALL return HTTP 403 and no data shall be modified.

**Validates: Requirements 2.4, 1.4**

---

### Property 3: Camera ID Format Invariant

*For any* camera stored in the database, the Camera_ID SHALL match the regular expression `/^GJ-[A-Z]{2,6}-\d{6}$/`.

**Validates: Requirements 3.2, 4.1**

---

### Property 4: Geographic Coordinate Constraint

*For any* camera record accepted by the system, the latitude SHALL be in the range [20.1, 24.7] and the longitude SHALL be in the range [68.2, 74.5].

**Validates: Requirements 3.3, 2.7**

---

### Property 5: Bulk Import Partition Completeness

*For any* bulk CSV input of N rows, the count of accepted rows plus the count of rows with errors in the BulkValidationResult SHALL equal N.

**Validates: Requirements 6.1, 6.2, 6.7**

---

### Property 6: Validation Idempotence

*For any* CameraInput object, calling validateCameraInput twice with the same input SHALL return the same result, and the input object SHALL not be mutated.

**Validates: Requirements 3.8, 3.9**

---

### Property 7: Onboarding Status Monotonicity

*For any* camera in the system, the sequence of Onboarding_Status values recorded in the audit log SHALL follow only the permitted transitions: `Pending → Validation`, `Pending → Rejected`, `Validation → Approved`, `Validation → Rejected`. No reverse or undefined transitions SHALL appear.

**Validates: Requirements 7.5**

---

### Property 8: Audit Completeness

*For any* state-changing operation (create, update, delete, approve, reject, bulk upload, export, login) executed successfully on a Camera or User resource, there SHALL exist exactly one audit log entry whose targetId matches the resource ID and whose createdAt timestamp is within the same transaction.

**Validates: Requirements 13.1, 7.4, 9.3, 9.4, 15.3, 15.4**

---

### Property 9: GeoJSON Coordinate Order

*For any* GeoJSON feature returned by the GeoJSON endpoint, the coordinates array SHALL contain longitude at index 0 and latitude at index 1, consistent with RFC 7946.

**Validates: Requirements 10.2**

---

### Property 10: Health Flag Correctness and Ordering

*For any* list of cameras passed to the Health_Monitor_Service, every camera in the returned flagged list SHALL satisfy at least one flag condition (Offline, Maintenance, Not_Verified_90d, Retention_Expiring), and the list SHALL be sorted with high severity before medium and medium before low, with ascending flaggedAt within each tier.

**Validates: Requirements 12.1, 12.2, 12.3**

---

### Property 11: Gap Zone Ordering and Correctness

*For any* set of district camera counts and any threshold value t ∈ (0, 1), every Gap_Zone returned by getLowCoverageZones SHALL have a camera count less than t × average, and the zones SHALL be sorted by deficit in descending order.

**Validates: Requirements 11.1, 11.3**

---

### Property 12: Field Officer Scope Invariant

*For any* authenticated Field_Officer actor and any camera returned by a list or detail query, the camera's departmentId SHALL equal the actor's departmentId, and no camera with Onboarding_Status `Rejected` SHALL be included in the results.

**Validates: Requirements 2.3, 8.5, 8.6**

---

### Property 13: Pagination Bound

*For any* paginated list request with pageSize P where 1 ≤ P ≤ 500, the number of records returned SHALL be at most P, and the total field SHALL reflect the count of all records matching the applied filters (not the page count).

**Validates: Requirements 8.2, 8.4**

---

### Property 14: Retention Days Bounds

*For any* camera record accepted by the system, retentionDays SHALL be an integer in the range [1, 365].

**Validates: Requirements 3.4**

---

### Property 15: Validation Rejects Out-of-Bounds Coordinates

*For any* CameraInput where latitude is outside [20.1, 24.7] or longitude is outside [68.2, 74.5], THE Camera_Service SHALL return a validation failure with a field-level error identifying the out-of-bounds coordinate field.

**Validates: Requirements 3.3, 3.8**

---

### Property 16: Camera Stats Consistency

*For any* response from the stats endpoint scoped to a given actor, the sum of online + offline + maintenance counts SHALL be less than or equal to the total count, and all counts SHALL be non-negative.

**Validates: Requirements 10.7**
