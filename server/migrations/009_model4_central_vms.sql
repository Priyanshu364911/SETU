-- ============================================================================
-- Migration 009: Model 4 — Central VMS & AI Analytics Platform
-- ============================================================================

-- 1. AI Analytics Events (face detection, crowd count, vehicle count, anomaly)
CREATE TABLE IF NOT EXISTS ai_analytics_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    event_type      VARCHAR(30) NOT NULL CHECK (event_type IN (
                      'face_detection', 'crowd_count', 'vehicle_count', 'anomaly', 'anpr'
                    )),
    confidence      NUMERIC(5, 4) DEFAULT 0.90,
    payload         JSONB NOT NULL DEFAULT '{}',
    processing_ms   INTEGER DEFAULT 0,
    source          VARCHAR(20) DEFAULT 'live' CHECK (source IN ('live', 'recorded', 'inference')),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_event_type ON ai_analytics_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_event_camera ON ai_analytics_events(camera_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_event_occurred ON ai_analytics_events(occurred_at DESC);

-- 2. External Integration Registry (VAHAN, SARTHI, eGujCop, AFIS, NAFIS)
CREATE TABLE IF NOT EXISTS external_integrations (
    id              VARCHAR(30) PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    system_type     VARCHAR(30) NOT NULL CHECK (system_type IN (
                      'vehicle_registry', 'licence_registry', 'police_db',
                      'fingerprint_db', 'face_db'
                    )),
    base_url        VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'connected' CHECK (status IN (
                      'connected', 'disconnected', 'degraded', 'maintenance'
                    )),
    last_sync_at    TIMESTAMPTZ,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Integration Query Log (audit trail for external lookups)
CREATE TABLE IF NOT EXISTS integration_queries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id  VARCHAR(30) NOT NULL REFERENCES external_integrations(id),
    query_type      VARCHAR(30) NOT NULL,
    query_input     JSONB NOT NULL,
    response_data   JSONB,
    status          VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout', 'not_found')),
    response_ms     INTEGER DEFAULT 0,
    queried_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integ_query_time ON integration_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integ_query_integration ON integration_queries(integration_id, created_at DESC);

-- 4. VAHAN Vehicle Registry (simulated local mirror for Gujarat vehicles)
CREATE TABLE IF NOT EXISTS vahan_vehicles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number    VARCHAR(20) NOT NULL UNIQUE,
    owner_name      VARCHAR(100) NOT NULL,
    vehicle_make    VARCHAR(50),
    vehicle_model   VARCHAR(50),
    vehicle_color   VARCHAR(30),
    vehicle_type    VARCHAR(30),
    registration_date DATE,
    insurance_valid_until DATE,
    insurance_status VARCHAR(20) DEFAULT 'active',
    fitness_valid_until DATE,
    rto_office      VARCHAR(50),
    fuel_type       VARCHAR(20),
    engine_number   VARCHAR(30),
    chassis_number  VARCHAR(30),
    is_stolen       BOOLEAN DEFAULT FALSE,
    stolen_fir_number VARCHAR(30),
    challan_count   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vahan_plate ON vahan_vehicles(plate_number);
