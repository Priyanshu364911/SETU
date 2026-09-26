# SETU Registry — Scalability Architecture Report
## Scaling to 80,000 Cameras Statewide Across Gujarat
### Gujarat Police Innovation Challenge 2026 — PRD Deliverable #3

---

## 1. Executive Summary

The State of Gujarat comprises 33 districts, 8 municipal corporations (including AMC, SMC, VMC, RMC), state and national highways, industrial corridors (GIDC), ports, and critical government infrastructure. Scaling the **SETU Central VMS and AI Analytics Platform** to accommodate **80,000 concurrent cameras** requires an enterprise architecture that avoids centralized bandwidth choke-points, guarantees millisecond-level telemetry retrieval, and maintains uninterrupted 24/7 reliability.

This report establishes the technical blueprint, resource sizing, horizontal scaling topology, and migration roadmap required to operate SETU at statewide production scale.

---

## 2. Ingestion & Bandwidth Sizing Calculations

### 2.1 Video Stream Bandwidth Model
Assuming standardized enterprise camera profiles:
- **Encoding**: H.265 (HEVC) Main Profile / H.264 High Profile
- **Resolution**: 1080p Full HD ($1920 \times 1080$) @ 25 FPS
- **Bitrate per camera**: 4 Mbps (average continuous) / 6 Mbps (peak scene complexity)

$$\text{Total Continuous Video Bandwidth} = 80,000 \times 4\text{ Mbps} = 320,000\text{ Mbps} = 320\text{ Gbps}$$

### 2.2 Why Centralized Ingestion Fails
Attempting to backhaul 320 Gbps of raw video to a single central data center incurs:
- Prohibitive state-wide network lease costs ($>₹100\text{ Cr/year}$).
- Catastrophic single point of network failure (DDoS or fiber cut).
- Massive compute overhead in centralized media transcoding clusters.

### 2.3 The SETU Edge-Mediation Sizing Advantage
SETU adopts a **Distributed Edge-Mediation Paradigm** (Models 3 & 4):
1. **Video Data Stays at Edge VMS**: Continuous 30-day recordings reside on local NVR/SAN clusters inside municipal corporations, smart cities, and district police headquarters.
2. **On-Demand Central Streaming**: Central command centres stream video only when an operator actively views a feed, or an automated incident alert triggers a live clip. At any given moment, no more than **2% of total cameras** (1,600 simultaneous feeds) are active on the central network.

$$\text{Central Ingestion Bandwidth (Peak Live Operations)} = 1,600 \times 4\text{ Mbps} = 6.4\text{ Gbps}$$

A 6.4 Gbps ingress requirement is easily satisfied over standard Gujarat State Wide Area Network (GSWAN) optical rings.

---

## 3. Metadata Storage & Compute Projections

While video remains decentralized, **telemetry and AI metadata are centralized** to enable statewide correlation, vehicle tracking, and criminal hotlist matching.

### 3.1 Metadata Volume Forecast

| Event Category | Daily Rate / Camera | Daily Total (80,000 Cameras) | Monthly Volume | Storage Estimate / Month |
|----------------|---------------------|------------------------------|----------------|--------------------------|
| **ANPR Detections** | 2,500 plates | 200,000,000 records | 6,000,000,000 | ~1.8 TB |
| **Crowd & Vehicle Counts** | 120 hourly snapshots | 9,600,000 records | 288,000,000 | ~86 GB |
| **Anomalies & Incidents** | 5 triggers | 400,000 events | 12,000,000 | ~15 GB |
| **System Heartbeats** | 1,440 pings (1/min) | 115,200,000 records | 3,456,000,000 | ~340 GB |
| **Total Monthly Ingest** | — | **~325M events/day** | **~9.75 Billion records** | **~2.24 TB / month** |

### 3.2 Storage Tiering Strategy
To prevent uncontrolled database expansion, SETU enforces a three-tier retention lifecycle:
- **Hot Tier (0 – 30 Days)**: PostgreSQL + TimescaleDB partitioned hypertables on NVMe SSD arrays. Sub-millisecond indexed queries for active investigations.
- **Warm Tier (31 – 180 Days)**: Compressed columnar hypertable chunks with 90% compression ratio (~220 GB/month), stored on standard SAS SSDs.
- **Cold Tier (180+ Days)**: Parquet files archived to S3-compatible Object Storage (e.g. MinIO / Ceph on GSWAN Cloud), queryable via Presto/Trino for historical audit trails.

---

## 4. Horizontal Scaling Architecture Topology

```
                                      GSWAN 10 Gbps Redundant Fiber Rings
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼                                                       ▼
            ┌─────────────────────────────┐                         ┌─────────────────────────────┐
            │   Ahmedabad DC (Primary)    │ ◄── Active-Active ──►  │ Gandhinagar DR (Secondary)  │
            └──────────────┬──────────────┘       Mirroring         └──────────────┬──────────────┘
                           │                                                       │
                           ▼                                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       GLOBAL INGRESS LOAD BALANCER                                     │
│                              HAProxy / F5 BIG-IP with Anycast BGP Routing                              │
└──────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CONTAINER ORCHESTRATION CLUSTER (KUBERNETES)                              │
│                                                                                                        │
│   ┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐        │
│   │ API Gateways (12 Pods)   │    │ Stream Relays (24 Pods)  │    │ AI Ingestion (16 Pods)   │        │
│   │ Express.js + Node Cluster│    │ MediaMTX / WHEP Proxies  │    │ Kafka Consumer Pool      │        │
│   └──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘        │
└──────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DISTRIBUTED MESSAGE BUS (APACHE KAFKA)                                 │
│   • Topic: setu.anpr.detections (32 Partitions)          • Topic: setu.ai.anomalies (16 Partitions)    │
│   • Topic: setu.integrations.vahan (8 Partitions)        • Throughput: 150,000 msgs/sec sustained      │
└──────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     STATE STORE & DATA SERVICES                                        │
│                                                                                                        │
│   ┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐        │
│   │ PostgreSQL 16 Primary    │    │ Read Replicas (3 Nodes)  │    │ Redis Cluster (6 Nodes)  │        │
│   │ Declarative Partitioning │    │ Query Offload & GIS Path │    │ Session Cache & Hotlists │        │
│   └──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Key Architecture Components
1. **Stateless API Services**: Scaled horizontally across Kubernetes worker nodes using Horizontal Pod Autoscalers (HPA) governed by CPU utilisation and request queue depth.
2. **Distributed Message Queue (Apache Kafka)**: Ingests telemetry bursts from ANPR cameras during rush hours without database lock contention.
3. **Database Partitioning**:
   - `ai_analytics_events` and `detection_events` partitioned monthly using PostgreSQL declarative range partitioning.
   - Spatial indexing via PostGIS `GIST` indices on camera geometry coordinates.
4. **Redis Cache Layer**:
   - Stores active VAHAN watchlist plates in Redis Bloom Filters and Sorted Sets for sub-microsecond matching.
   - Manages active WebRTC stream leases and token invalidation.

---

## 5. Technology Upgrade Roadmap (Scale Milestones)

| Component | Current Prototype Architecture | Production Milestone (10,000 Cams) | Statewide Target (80,000 Cams) |
|-----------|--------------------------------|-------------------------------------|--------------------------------|
| **Database Engine** | Standalone PostgreSQL 16 + PostGIS | PostgreSQL Primary + 2 Read Replicas | PostgreSQL + TimescaleDB Citus Distributed Sharding |
| **Event Pipeline** | In-Process Event Emitter | Redis Pub/Sub Event Exchange | Apache Kafka Multi-Broker Cluster (32 Partitions) |
| **Media Distribution** | Local MediaMTX + WHEP Relay | Regional MediaMTX Edge Nodes | Anycast Distributed WHEP Edge Relays across 33 Districts |
| **AI Inference** | Client-Side In-Browser (TF.js) | Client-Side + Edge Server Hybrid | Multi-Tier (Edge Gateways + In-Browser Operator CV) |
| **External VAHAN API** | Seeded Mirror + REST Gateway | Microservice with Redis Query Cache | GovCloud National NIC Direct gRPC Leased Line |

---

## 6. Bottlenecks & Mitigation Matrix

| Potential Bottleneck | Failure Mode | Mitigation Strategy |
|----------------------|--------------|---------------------|
| **Database Write Contention** | High concurrent ANPR inserts stall API threads | Kafka message buffering + PostgreSQL `COPY` batch ingest workers (5,000 records/batch). |
| **Network Link Saturation** | Multiple operators opening feeds overloads district pipe | Dynamic bitrate transcoding (1080p $\rightarrow$ 720p/480p on cellular/constrained links) and WebRTC congestion control. |
| **Operator Browser Memory Exhaustion** | Long-running TensorFlow.js sessions leak WebGL textures | Automatic tensor memory disposal (`tf.tidy()`) and canvas recycling in `useAIDetection`. |
| **External Registry Timeout** | MoRTH VAHAN API latency spikes during national peak hours | Circuit breaker pattern: fall back to local cached mirror when external latency exceeds 800ms. |

---

## 7. Phased Implementation Timeline

1. **Phase 1 (Months 1–3): Pilot Deployment (2,000 Cameras)**
   - Ahmedabad Smart City (AMC) & Gandhinagar Command Center.
   - Validation of edge-mediated WebRTC streaming and VAHAN lookup workflows.
2. **Phase 2 (Months 4–8): Regional Rollout (20,000 Cameras)**
   - Expansion to Surat (SMC), Vadodara (VMC), Rajkot (RMC), and National Highway corridors (NH-48).
   - Deployment of regional Kafka clusters and TimescaleDB hypertable compression.
3. **Phase 3 (Months 9–14): Full Statewide Integration (80,000 Cameras)**
   - Onboarding of all 33 District Police Headquarters, GIDC industrial belts, and port perimeters.
   - Dual-datacenter active-active disaster recovery verification.
