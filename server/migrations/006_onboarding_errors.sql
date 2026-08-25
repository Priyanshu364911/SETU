-- Onboarding validation errors table (transient)
CREATE TABLE IF NOT EXISTS onboarding_errors (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id   VARCHAR(30) REFERENCES cameras(id) ON DELETE CASCADE,
    field       VARCHAR(60),
    message     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
