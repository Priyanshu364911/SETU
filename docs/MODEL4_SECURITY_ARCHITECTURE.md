# SETU Registry — Security Architecture & Disaster Recovery Design
## Enterprise Defense, Cryptographic Integrity, and Business Continuity
### Gujarat Police Innovation Challenge 2026 — PRD Deliverables #4 & #5

---

## 1. Executive Summary

As a statewide surveillance backbone operating across 33 districts, the **SETU Registry** and **Central VMS Platform** handles mission-critical law enforcement data, real-time video intelligence, and sensitive vehicle owner records. Securing this surface demands a **Zero-Trust Architecture** coupled with **High Availability Disaster Recovery (HA/DR)** to guarantee continuous operational readiness even in the face of infrastructure outages, network partition, or adversarial cyber attacks.

This document establishes the security safeguards, cryptographic controls, multi-tenancy enforcement, and disaster recovery procedures governing Model 4.

---

## 2. Zero-Trust Security Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               OPERATOR WORKSTATION / COMMAND CENTRE                              │
│  • Mutual TLS (mTLS) Authentication    • Strict Content Security Policy (CSP)                    │
│  • No Local Video File Storage         • In-Memory Client Inference (TensorFlow.js WebGL)        │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼  [TLS 1.3 / HTTPS / DTLS-SRTP]
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SECURITY PERIMETER GATEWAY                                    │
│  • WAF (Web Application Firewall)      • DDoS Mitigation (Rate Limiting via Redis)               │
│  • Reverse Proxy (NGINX / HAProxy)     • Strict JWT Token Inspection (8-Hour Expiry)             │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MEDIATED STREAM SECURITY GATEWAY                                 │
│  • Virtual Stream Tokens (5-Min TTL)   • Departmental RTSP Credentials NEVER Exposed to Client   │
│  • Internal Token Validation           • Automated Session Revocation                            │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DATA PERSISTENCE & AUDIT ENCLAVE                                  │
│  • PostgreSQL Row-Level Security (RLS) • Volume Encryption at Rest (AES-256 LUKS)                │
│  • Cryptographically Chained Audit Log • Tamper-Evident Inter-Agency Query History               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cryptographic Controls & Data Protection

### 3.1 Encryption in Transit (Data in Flight)
1. **Application APIs**: All REST endpoints (`/api/model4/*`, `/api/model2/*`, `/api/federation/*`) strictly enforce **TLS 1.3** using hardened cipher suites (`TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`). Plaintext HTTP is permanently disabled via HSTS headers.
2. **Video Streaming Channels**:
   - **WebRTC WHEP Streams**: Encrypted end-to-end using **DTLS 1.2 / SRTP** (Secure Real-time Transport Protocol). Video frames are encrypted before leaving the media relay and decrypted only in GPU buffers.
   - **HLS Segments**: Proxied over TLS 1.3 with AES-128 segment-level payload encryption.
3. **Inter-Agency Integrations**: Communication with MoRTH VAHAN/SARTHI and State Police CCTNS utilizes encrypted VPN tunnels over GSWAN with mutual certificate authentication (mTLS).

### 3.2 Encryption at Rest (Data at Rest)
1. **Database Volume Encryption**: PostgreSQL storage volumes are encrypted at block-level using Linux Unified Key Setup (**LUKS AES-XTS-256**) with keys stored in Hardware Security Modules (HSM) managed by Gujarat State Data Center.
2. **Column-Level Confidentiality**: Sensitive personally identifiable information (PII) including vehicle chassis numbers, engine serials, and registered owner contact records are masked in standard query logs.
3. **Video Archive Storage**: Edge NVR SAN volumes enforce AES-256 encryption on all stored MP4/MKV video blocks.

### 3.3 Stream Mediation & Credential Shielding
A core vulnerability of legacy VMS platforms is exposing direct RTSP camera IP addresses and credentials (`rtsp://admin:pass@192.168.1.100:554`) to client applications.
**SETU eliminates this risk entirely**:
- Operators **never** communicate directly with physical camera endpoints.
- The client requests a mediated stream session from `/api/federation/streams`.
- The server generates an ephemeral cryptographically signed token:
  ```json
  {
    "token": "strm_9f8a3c1e2b4d5e",
    "expires_at": "2026-09-07T12:45:00Z",
    "authorized_camera": "cam01"
  }
  ```
- The client connects to an internal proxy (`/api/stream/sentinel/cam01/index.m3u8?token=...`).
- The internal gateway verifies the token with Redis and relays the stream. If an operator logs out or is deauthorized, the token is instantly blacklisted.

---

## 4. Identity, RBAC & Multi-Tenancy Segregation

### 4.1 Role-Based Access Matrix

| Role | Live AI Inference | VAHAN Plate Lookup | Watchlist Management | System Config & Sync | Audit Log Access |
|------|:-----------------:|:------------------:|:--------------------:|:-------------------:|:----------------:|
| **State Nodal Officer** | Full Statewide | Full Access | Create / Edit / Delete | Full Access | Full Statewide |
| **District Police Officer**| District Scope | Full Access | View / Acknowledge | District Sync | District Scope |
| **Control Room Operator** | Monitored Feeds | Lookup Only | View / Alert Flag | None | Own Actions Only |
| **System Auditor** | None | Read-Only Queries | None | None | Full Immutable Log |

### 4.2 Multi-District Data Isolation
To prevent unauthorized cross-jurisdiction data access:
1. **Row-Level Security (RLS)**: PostgreSQL tables (`cameras`, `ai_analytics_events`, `detection_events`) enforce tenant isolation:
   ```sql
   ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
   CREATE POLICY district_isolation_policy ON cameras
     FOR ALL TO authenticated_users
     USING (
       district_id = current_setting('request.jwt.district_id', true)
       OR current_setting('request.jwt.role', true) = 'state_nodal_officer'
     );
   ```
2. **Audit Attribution**: Every query against the VAHAN registry records the specific officer's `user_id`, IP address, and official justification in `integration_queries`.

---

## 5. Disaster Recovery & Business Continuity (PRD Deliverable #4)

### 5.1 Service Level Objectives (SLOs)

| Metric | Target Objective | Strategy |
|--------|------------------|----------|
| **Recovery Point Objective (RPO)** | **$\le 0$ seconds** for Audit Trails<br>**$\le 10$ seconds** for Metadata | Synchronous multi-site database commit for audit events; streaming asynchronous replication for telemetry. |
| **Recovery Time Objective (RTO)** | **$\le 15$ minutes** for Central Platform<br>**$0$ seconds** for Edge Video | Automated DNS Anycast failover to Gandhinagar DR site; local edge NVRs continue recording autonomously during central outages. |

### 5.2 Dual-Datacenter Active-Active Topology

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 GSWAN Global Anycast DNS                │
                  └────────────┬───────────────────────────────┬────────────┘
                               │                               │
                Primary Path (10 Gbps)           Standby Path (10 Gbps)
                               │                               │
                               ▼                               ▼
       ┌───────────────────────────────┐               ┌───────────────────────────────┐
       │   PRIMARY SITE: Ahmedabad SDC │               │  SECONDARY DR: Gandhinagar SDC│
       │                               │               │                               │
       │ • Kubernetes Cluster (12 Nodes│               │ • Kubernetes Cluster (8 Nodes)│
       │ • PostgreSQL 16 (Primary)     │ ──Sync Rep──► │ • PostgreSQL 16 (Hot Standby) │
       │ • Redis Cluster Primary       │ ◄──Replication│ • Redis Cluster Replica       │
       │ • MediaMTX Stream Relays      │               │ • MediaMTX Stream Relays      │
       └───────────────────────────────┘               └───────────────────────────────┘
```

### 5.3 Automated Failover Protocol
1. **Health Probing**: Global load balancers monitor central API health endpoints (`/api/model4/system/metrics`) every 5 seconds.
2. **Split-Brain Prevention**: Quorum is maintained using an independent tie-breaker witness node hosted at Vadodara Smart City Data Center.
3. **Trigger**: If the primary Ahmedabad cluster becomes unresponsive for 30 consecutive seconds:
   - Anycast BGP routes are automatically updated to point to Gandhinagar.
   - Gandhinagar hot-standby PostgreSQL cluster is promoted to primary (`pg_ctl promote`).
   - Active client sessions seamlessly reconnect via JWT re-validation.

---

## 6. Immutable Audit Trail & Legal Admissibility

Under the **Indian Evidence Act (Section 65B)** and **IT Act 2000**, digital surveillance metadata presented in court requires tamper-evident chain of custody:
1. **Append-Only Enforcement**: Tables `audit_log`, `ai_analytics_events`, and `integration_queries` strictly revoke `UPDATE` and `DELETE` permissions from all application database users.
2. **Cryptographic Chaining**: Each audit entry incorporates a SHA-256 hash calculated from the preceding log entry's hash concatenated with the current payload:
   $$\text{Hash}_n = \text{SHA-256}(\text{Hash}_{n-1} \,\|\, \text{Timestamp} \,\|\, \text{Action} \,\|\, \text{UserID} \,\|\, \text{Payload})$$
3. **Court-Ready Export**: Audit trails can be exported with verification signatures confirming that log integrity has not been altered since insertion.

---

## 7. Regulatory Compliance Matrix

| Regulation / Standard | Requirement | SETU Implementation |
|-----------------------|-------------|---------------------|
| **Digital Personal Data Protection Act (DPDPA 2023)** | Data minimization and lawful purpose limitation | Automated face blur options for civilian bystander feeds; 30-day default telemetry purge. |
| **MHA National CCTV Guidelines** | Standardized 30-day forensic video retention | Decentralized edge storage retention policies enforced at municipal VMS nodes. |
| **CERT-In Cyber Security Directions** | 180-day mandatory system log retention | Audit and query log streams replicated to GSWAN central SIEM / cold archive. |
| **ISO/IEC 27001:2022** | Information security management & access control | Zero-trust authentication, TLS 1.3 everywhere, and least-privilege RBAC. |
