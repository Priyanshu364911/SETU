-- Audit log table (append-only - no UPDATE/DELETE permitted)
CREATE TABLE IF NOT EXISTS audit_log (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action        VARCHAR(30) NOT NULL,
    actor_id      UUID NOT NULL REFERENCES users(id),
    actor_role    VARCHAR(30) NOT NULL,
    target_id     VARCHAR(50),
    target_type   VARCHAR(20),
    before_state  JSONB,
    after_state   JSONB,
    metadata      JSONB,
    ip_address    INET,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Revoke UPDATE and DELETE permissions on audit_log to enforce append-only
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    REVOKE UPDATE, DELETE ON audit_log FROM app_user;
  END IF;
END
$$;
