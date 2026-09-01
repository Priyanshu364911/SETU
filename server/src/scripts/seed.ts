import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/setu_registry',
});

const departments = [
  { id: 'POL', name: 'Home/Police', nodal_officer_name: 'Rajesh Patel', nodal_officer_email: 'rajesh.police@gujarat.gov.in' },
  { id: 'RTO', name: 'RTO/Transport', nodal_officer_name: 'Amit Shah', nodal_officer_email: 'amit.rto@gujarat.gov.in' },
  { id: 'FIRE', name: 'Fire & Emergency', nodal_officer_name: 'Vikram Singh', nodal_officer_email: 'vikram.fire@gujarat.gov.in' },
  { id: 'MUNI', name: 'Municipal Corporation', nodal_officer_name: 'Priya Desai', nodal_officer_email: 'priya.muni@gujarat.gov.in' },
  { id: 'PWD', name: 'Public Works Department', nodal_officer_name: 'Suresh Kumar', nodal_officer_email: 'suresh.pwd@gujarat.gov.in' },
  { id: 'EDU', name: 'Education', nodal_officer_name: 'Meena Joshi', nodal_officer_email: 'meena.edu@gujarat.gov.in' },
  { id: 'HLTH', name: 'Health & Medical', nodal_officer_name: 'Dr. Anil Mehta', nodal_officer_email: 'anil.health@gujarat.gov.in' },
  { id: 'REV', name: 'Revenue', nodal_officer_name: 'Kiran Bhatt', nodal_officer_email: 'kiran.revenue@gujarat.gov.in' },
];

const districts = [
  { id: 'AHM', name: 'Ahmedabad', centroid_lat: 23.0225, centroid_lng: 72.5714, region: 'Central Gujarat' },
  { id: 'SUR', name: 'Surat', centroid_lat: 21.1702, centroid_lng: 72.8311, region: 'South Gujarat' },
  { id: 'VAD', name: 'Vadodara', centroid_lat: 22.3107, centroid_lng: 73.1926, region: 'Central Gujarat' },
  { id: 'RAJ', name: 'Rajkot', centroid_lat: 22.3039, centroid_lng: 70.8022, region: 'Saurashtra' },
  { id: 'BHA', name: 'Bhavnagar', centroid_lat: 21.7645, centroid_lng: 72.1519, region: 'Saurashtra' },
  { id: 'JAM', name: 'Jamnagar', centroid_lat: 22.4707, centroid_lng: 70.0577, region: 'Saurashtra' },
  { id: 'GAND', name: 'Gandhinagar', centroid_lat: 23.2156, centroid_lng: 72.6369, region: 'Central Gujarat' },
  { id: 'DANG', name: 'Dang', centroid_lat: 20.9382, centroid_lng: 73.8653, region: 'South Gujarat' },
  { id: 'VAL', name: 'Valsad', centroid_lat: 20.6043, centroid_lng: 72.9290, region: 'South Gujarat' },
  { id: 'BAN', name: 'Banaskantha', centroid_lat: 24.4329, centroid_lng: 72.4331, region: 'North Gujarat' },
];

const cameraTypes: Array<'IP' | 'Analog' | 'PTZ' | 'ANPR'> = ['IP', 'Analog', 'PTZ', 'ANPR'];
const connectivityTypes: Array<'Fiber' | '4G' | 'Microwave' | 'Other'> = ['Fiber', '4G', 'Microwave', 'Other'];
const storageTypes: Array<'Local NVR' | 'Cloud' | 'Hybrid'> = ['Local NVR', 'Cloud', 'Hybrid'];
const ownershipTypes: Array<'Govt' | 'Private'> = ['Govt', 'Private'];
const statuses: Array<'Online' | 'Maintenance' | 'Offline'> = ['Online', 'Online', 'Online', 'Online', 'Online', 'Online', 'Offline', 'Maintenance'];

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Seeding departments...');
    for (const dept of departments) {
      await client.query(
        'INSERT INTO departments (id, name, nodal_officer_name, nodal_officer_email) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [dept.id, dept.name, dept.nodal_officer_name, dept.nodal_officer_email]
      );
    }
    
    console.log('Seeding districts...');
    for (const dist of districts) {
      await client.query(
        `INSERT INTO districts (id, name, centroid, region) 
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5) 
         ON CONFLICT (id) DO NOTHING`,
        [dist.id, dist.name, dist.centroid_lng, dist.centroid_lat, dist.region]
      );
    }
    
    console.log('Seeding users...');
    const passwordHash = await bcrypt.hash('password123', 12);
    
    const users = [
      { username: 'sno_user', email: 'sno@gujarat.gov.in', role: 'state_nodal_officer', department_id: null },
      { username: 'dept_officer', email: 'dept.pol@gujarat.gov.in', role: 'department_officer', department_id: 'POL' },
      { username: 'field_officer', email: 'field.pol@gujarat.gov.in', role: 'field_officer', department_id: 'POL' },
      { username: 'auditor', email: 'auditor@gujarat.gov.in', role: 'auditor', department_id: null },
    ];
    
    const userIds: { [key: string]: string } = {};
    for (const user of users) {
      const result = await client.query(
        'INSERT INTO users (username, email, password_hash, role, department_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING RETURNING id',
        [user.username, user.email, passwordHash, user.role, user.department_id]
      );
      if (result.rows.length > 0) {
        userIds[user.username] = result.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM users WHERE username = $1', [user.username]);
        userIds[user.username] = existing.rows[0].id;
      }
    }
    
    console.log('Seeding official Sentinel Gujarat Camera Grid entries...');
    const sentinelCameras = [
      { id: 'GJ-POL-000001', name: 'Sentinel Camera 01 — Ahmedabad Highway Junction', dept: 'POL', dist: 'AHM', lat: 23.0338, lng: 72.5074, type: 'ANPR' },
      { id: 'GJ-RTO-000002', name: 'Sentinel Camera 02 — Surat Ring Road Toll Plaza', dept: 'RTO', dist: 'SUR', lat: 21.1702, lng: 72.8311, type: 'ANPR' },
      { id: 'GJ-POL-000003', name: 'Sentinel Camera 03 — Vadodara Express Highway', dept: 'POL', dist: 'VAD', lat: 22.3107, lng: 73.1926, type: 'PTZ' },
      { id: 'GJ-MUNI-000004', name: 'Sentinel Camera 04 — Gandhinagar CH Road Interchange', dept: 'MUNI', dist: 'GAND', lat: 23.2156, lng: 72.6369, type: 'IP' },
      { id: 'GJ-POL-000005', name: 'Sentinel Camera 05 — Rajkot Bypass Checkpoint', dept: 'POL', dist: 'RAJ', lat: 22.3039, lng: 70.8022, type: 'ANPR' },
    ];

    for (const cam of sentinelCameras) {
      await client.query(
        `INSERT INTO cameras 
         (id, name, department_id, district_id, location, camera_type, connectivity, storage_type, 
          retention_days, ownership, status, onboarding_status, onboarding_method, onboarded_by, 
          last_verified_at, notes)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, 'Fiber', 'Cloud', 30, 'Govt', 'Online', 'Approved', 'API', $8, NOW(), 'Official Sentinel Camera Grid Feed')
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           location = EXCLUDED.location,
           status = 'Online',
           onboarding_status = 'Approved'`,
        [
          cam.id,
          cam.name,
          cam.dept,
          cam.dist,
          cam.lng,
          cam.lat,
          cam.type,
          userIds['field_officer'] || null,
        ]
      );
    }

    // 5. Ensure gov-feeds exists in vms_systems and bind all 5 Sentinel cameras
    await client.query(
      `INSERT INTO vms_systems (id, name, vendor, adapter_type, base_url, status, config)
       VALUES ('gov-feeds', 'Sentinel Government Feed', 'SentinelGrid', 'gov_feed', 'https://live.corp8.cloud', 'connected', '{}')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'connected'`
    );

    // Remove legacy mock systems cleanly
    await client.query(`DELETE FROM alerts`);
    await client.query(`DELETE FROM federated_events`);
    await client.query(`DELETE FROM camera_vms_bindings`);
    await client.query(`DELETE FROM vms_systems WHERE id IN ('vms-a-municipal', 'vms-b-police')`);



    for (let i = 0; i < sentinelCameras.length; i++) {
      const cam = sentinelCameras[i];
      const externalId = String(i + 1);
      await client.query(
        `INSERT INTO camera_vms_bindings
           (camera_id, vms_system_id, external_camera_id, stream_path, capabilities, is_active)
         VALUES ($1, 'gov-feeds', $2, $3, $4, TRUE)
         ON CONFLICT (camera_id, vms_system_id) DO UPDATE SET
           external_camera_id = EXCLUDED.external_camera_id,
           stream_path = EXCLUDED.stream_path,
           capabilities = EXCLUDED.capabilities,
           is_active = TRUE`,
        [
          cam.id,
          externalId,
          `https://live.corp8.cloud/live/stream/${externalId}/index.m3u8`,
          JSON.stringify({
            live: true,
            events: true,
            hlsUrl: `https://live.corp8.cloud/live/stream/${externalId}/index.m3u8`,
            whepUrl: `https://live.corp8.cloud:8889/stream/${externalId}/whep`,
            rtspUrl: `rtsp://live.corp8.cloud:8554/stream/${externalId}`,
          }),
        ]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Core foundation & Sentinel cameras seeded successfully!');
    console.log(`- ${departments.length} official departments`);
    console.log(`- ${districts.length} districts`);
    console.log(`- ${Object.keys(userIds).length} authentication users`);
    console.log(`- ${sentinelCameras.length} real Sentinel Grid cameras registered & bound to gov-feeds`);


    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding data:', error);
    throw error;
  } finally {
    client.release();
  }

  
  await pool.end();
}

seed().catch(console.error);
