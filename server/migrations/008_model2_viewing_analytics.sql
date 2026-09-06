-- Model 2: Unified Viewing & Metadata Analytics Schema

-- Recorded & live ANPR detection events
CREATE TABLE IF NOT EXISTS detection_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    plate_raw       VARCHAR(50) NOT NULL,
    plate_normalised VARCHAR(50) NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence      NUMERIC(5, 4) DEFAULT 0.95,
    snapshot_url    TEXT,
    source          VARCHAR(20) DEFAULT 'live' CHECK (source IN ('live', 'recorded', 'simulation')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detection_plate ON detection_events(plate_normalised, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_detection_camera ON detection_events(camera_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_detection_timestamp ON detection_events(timestamp DESC);

-- Operator manual event tags
CREATE TABLE IF NOT EXISTS tagged_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id       VARCHAR(30) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note            TEXT NOT NULL,
    tagged_by       UUID REFERENCES users(id),
    snapshot_url    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tagged_camera ON tagged_events(camera_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tagged_created ON tagged_events(created_at DESC);
