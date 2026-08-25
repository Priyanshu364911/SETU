-- Districts table (26 Gujarat districts)
CREATE TABLE IF NOT EXISTS districts (
    id          VARCHAR(10) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    centroid    GEOMETRY(POINT, 4326),
    region      VARCHAR(60)
);

-- Departments table (26 government departments)
CREATE TABLE IF NOT EXISTS departments (
    id                   VARCHAR(10) PRIMARY KEY,
    name                 VARCHAR(150) NOT NULL,
    nodal_officer_name   VARCHAR(100),
    nodal_officer_email  VARCHAR(150),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
