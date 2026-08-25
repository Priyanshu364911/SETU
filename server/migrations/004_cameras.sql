-- Core cameras table with PostGIS support
CREATE TABLE IF NOT EXISTS cameras (
    id                  VARCHAR(30) PRIMARY KEY,   -- GJ-DEPTCODE-NNNNNN
    name                VARCHAR(200) NOT NULL,
    department_id       VARCHAR(10) NOT NULL REFERENCES departments(id),
    district_id         VARCHAR(10) NOT NULL REFERENCES districts(id),
    location            GEOMETRY(POINT, 4326) NOT NULL,
    camera_type         VARCHAR(20) NOT NULL CHECK (camera_type IN ('IP','Analog','PTZ','ANPR')),
    connectivity        VARCHAR(20) NOT NULL CHECK (connectivity IN ('Fiber','4G','Microwave','Other')),
    storage_type        VARCHAR(20) NOT NULL CHECK (storage_type IN ('Local NVR','Cloud','Hybrid')),
    retention_days      SMALLINT NOT NULL CHECK (retention_days BETWEEN 1 AND 365),
    ownership           VARCHAR(20) NOT NULL CHECK (ownership IN ('Govt','Private')),
    status              VARCHAR(20) NOT NULL DEFAULT 'Pending'
                            CHECK (status IN ('Online','Maintenance','Offline','Pending')),
    onboarding_status   VARCHAR(20) NOT NULL DEFAULT 'Pending'
                            CHECK (onboarding_status IN ('Pending','Validation','Approved','Rejected')),
    onboarding_method   VARCHAR(20) NOT NULL CHECK (onboarding_method IN ('Manual','Bulk CSV','API')),
    onboarded_by        UUID NOT NULL REFERENCES users(id),
    onboarded_at        TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at    TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for GIS queries
CREATE INDEX IF NOT EXISTS idx_cameras_location ON cameras USING GIST(location);

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_cameras_dept_status ON cameras(department_id, status);

-- Index on district_id for district-based queries
CREATE INDEX IF NOT EXISTS idx_cameras_district ON cameras(district_id);

-- Index on onboarding_status for queue queries
CREATE INDEX IF NOT EXISTS idx_cameras_onboarding ON cameras(onboarding_status);
