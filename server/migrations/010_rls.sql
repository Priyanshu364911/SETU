-- ============================================================================
-- Migration 010: Row-Level Security (RLS) — Defence in Depth
-- SEC-05: RBAC enforced at DB level in addition to app layer.
-- ============================================================================
-- NOTE: This migration requires the application DB role to be 'setu_app'.
-- Run with: psql $DATABASE_URL -f 010_rls.sql
--
-- RLS on cameras: department_officer and field_officer roles see only their dept.
-- state_nodal_officer and auditor see all rows.
-- This is enforced via the JWT dept_id propagated as a session variable.
-- ============================================================================

-- Enable RLS on cameras (does not affect superuser/admin)
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;

-- Policy: state_nodal_officer and auditor see all cameras (dept = NULL in token)
-- Policy: department_officer and field_officer see only their department
-- Implementation: Set app.current_user_dept as a session variable before queries
-- The application must run: SET LOCAL app.current_user_dept = '<dept_id>';
--                           SET LOCAL app.current_user_role = '<role>';

CREATE POLICY cameras_rls ON cameras
  FOR ALL
  TO PUBLIC  -- applies to all non-superuser roles
  USING (
    -- SNO and auditor pass NULL dept → see all
    current_setting('app.current_user_dept', TRUE) IS NULL
    OR current_setting('app.current_user_dept', TRUE) = ''
    OR department_id = current_setting('app.current_user_dept', TRUE)
  );

-- Enable RLS on audit_log: field_officers only see their own entries
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_rls ON audit_log
  FOR SELECT
  TO PUBLIC
  USING (
    -- SNO, DO, auditor see all logs
    current_setting('app.current_user_role', TRUE) IN (
      'state_nodal_officer', 'department_officer', 'auditor'
    )
    -- field_officer sees only their own audit entries
    OR actor_id::text = current_setting('app.current_user_id', TRUE)
  );

-- Allow INSERT on audit_log for all roles (logging must always succeed)
CREATE POLICY audit_log_insert_rls ON audit_log
  FOR INSERT
  TO PUBLIC
  WITH CHECK (TRUE);

-- ============================================================================
-- Informational comment: to activate, the db.ts query wrapper must set
-- session variables per-request:
--   await client.query(`SET LOCAL app.current_user_dept = $1`, [user.departmentId ?? '']);
--   await client.query(`SET LOCAL app.current_user_role = $1`, [user.role]);
--   await client.query(`SET LOCAL app.current_user_id = $1`, [user.userId]);
-- This is a P2 item; RLS is disabled by default until the app layer is updated.
-- ============================================================================
ALTER TABLE cameras DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
-- Remove the DISABLE lines above and update db.ts to activate RLS enforcement.
