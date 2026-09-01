-- Model 3: VMS Federation & Middleware schema
-- Extends Model 1 camera registry with VMS binding, events, watchlists, alerts

-- Registered departmental VMS systems (source platforms)
CREATE TABLE IF NOT EXISTS vms_systems (
    id              VARCHAR(40) PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    vendor          VARCHAR(100) NOT NULL,
    adapter_type    VARCHAR(40) NOT NULL CHECK (adapter_type IN ('vms_a_rest', 'vms_b_events', 'gov_feed', 'onvif_rtsp')),
    base_url        VARCHAR(500) NOT NULL,
    department_id   VARCHAR(10) REFERENCES departments(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'disconnected'
                        CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    last_sync_at    TIMESTAMPTZ,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Link Model 1 registry cameras to external VMS camera IDs
CREATE TABLE IF NOT EXISTS camera_vms_bindings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id           VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    vms_system_id       VARCHAR(40) NOT NULL REFERENCES vms_systems(id) ON DELETE CASCADE,
    external_camera_id  VARCHAR(100) NOT NULL,
    stream_path         VARCHAR(500),
    capabilities        JSONB DEFAULT '{"live": true, "events": true, "ptz": false}',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (vms_system_id, external_camera_id),
    UNIQUE (camera_id, vms_system_id)
);

CREATE INDEX IF NOT EXISTS idx_bindings_camera ON camera_vms_bindings(camera_id);
CREATE INDEX IF NOT EXISTS idx_bindings_vms ON camera_vms_bindings(vms_system_id);

-- Canonical federated events (metadata + analytics events from adapters)
CREATE TABLE IF NOT EXISTS federated_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type      VARCHAR(60) NOT NULL,
    vms_system_id   VARCHAR(40) REFERENCES vms_systems(id),
    camera_id       VARCHAR(30) REFERENCES cameras(id),
    external_camera_id VARCHAR(100),
    severity        VARCHAR(20) DEFAULT 'info'
                        CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    payload         JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at     TIMESTAMPTZ DEFAULT NOW(),
    correlation_id  UUID
);

CREATE INDEX IF NOT EXISTS idx_fed_events_type ON federated_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fed_events_camera ON federated_events(camera_id);
CREATE INDEX IF NOT EXISTS idx_fed_events_occurred ON federated_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fed_events_corr ON federated_events(correlation_id);

-- Cross-system correlation tracks (e.g. same plate across cameras)
CREATE TABLE IF NOT EXISTS correlation_tracks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     VARCHAR(40) NOT NULL DEFAULT 'vehicle_plate',
    entity_value    VARCHAR(100) NOT NULL,
    camera_ids      TEXT[] NOT NULL DEFAULT '{}',
    event_ids       UUID[] NOT NULL DEFAULT '{}',
    first_seen_at   TIMESTAMPTZ NOT NULL,
    last_seen_at    TIMESTAMPTZ NOT NULL,
    point_count     INTEGER NOT NULL DEFAULT 1,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corr_entity ON correlation_tracks(entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_corr_last_seen ON correlation_tracks(last_seen_at DESC);

-- Watchlist of entities of interest (representative dataset for demo)
CREATE TABLE IF NOT EXISTS watchlist_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     VARCHAR(40) NOT NULL CHECK (entity_type IN (
                        'stolen_vehicle', 'blacklisted_vehicle', 'wanted_person',
                        'missing_person', 'suspect', 'other'
                    )),
    entity_value    VARCHAR(100) NOT NULL,
    display_name    VARCHAR(200),
    description     TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    source          VARCHAR(100) DEFAULT 'demo',
    is_active       BOOLEAN DEFAULT TRUE,
    metadata        JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique
    ON watchlist_entries(entity_type, lower(entity_value)) WHERE is_active = TRUE;

-- Real-time alerts from watchlist matches / correlated events
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type      VARCHAR(60) NOT NULL,
    title           VARCHAR(300) NOT NULL,
    message         TEXT,
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'acknowledged', 'closed')),
    camera_id       VARCHAR(30) REFERENCES cameras(id),
    watchlist_id    UUID REFERENCES watchlist_entries(id),
    event_id        UUID REFERENCES federated_events(id),
    track_id        UUID REFERENCES correlation_tracks(id),
    entity_value    VARCHAR(100),
    payload         JSONB DEFAULT '{}',
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_camera ON alerts(camera_id);

-- Mediated stream sessions (northbound access via federation, not direct VMS URLs)
CREATE TABLE IF NOT EXISTS stream_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id),
    vms_system_id   VARCHAR(40) NOT NULL REFERENCES vms_systems(id),
    session_token   VARCHAR(64) NOT NULL UNIQUE,
    stream_url      VARCHAR(500) NOT NULL,
    protocol        VARCHAR(20) NOT NULL DEFAULT 'hls'
                        CHECK (protocol IN ('hls', 'webrtc', 'mjpeg', 'snapshot')),
    expires_at      TIMESTAMPTZ NOT NULL,
    requested_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_token ON stream_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_expires ON stream_sessions(expires_at);
