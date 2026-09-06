import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/setu_registry',
});

async function seedModel2() {
  const client = await pool.connect();
  try {
    console.log('[Model2 Seed] Populating sample ANPR detections & watchlist entries...');
    await client.query('BEGIN');

    // 1. Clear old detections for clean demo state
    await client.query('DELETE FROM detection_events');
    await client.query('DELETE FROM tagged_events');

    // 2. Insert ANPR detections for GJ01WL0001 across Gujarat highway checkpoints
    const baseTime = new Date();
    const detections = [
      {
        camId: 'GJ-POL-000001',
        plateRaw: 'GJ01WL0001',
        plateNorm: 'GJ01WL0001',
        offsetMin: -60,
        conf: 0.98,
        src: 'live',
      },
      {
        camId: 'GJ-RTO-000002',
        plateRaw: 'GJ 01 WL 0001',
        plateNorm: 'GJ01WL0001',
        offsetMin: -40,
        conf: 0.96,
        src: 'live',
      },
      {
        camId: 'GJ-POL-000003',
        plateRaw: 'GJ01WL0001',
        plateNorm: 'GJ01WL0001',
        offsetMin: -25,
        conf: 0.95,
        src: 'live',
      },
      {
        camId: 'GJ-POL-000005',
        plateRaw: 'GJ-01-WL-0001',
        plateNorm: 'GJ01WL0001',
        offsetMin: -10,
        conf: 0.99,
        src: 'live',
      },
      // Additional vehicle detections
      {
        camId: 'GJ-MUNI-000004',
        plateRaw: 'GJ05WL0002',
        plateNorm: 'GJ05WL0002',
        offsetMin: -30,
        conf: 0.94,
        src: 'recorded',
      },
      {
        camId: 'GJ-POL-000001',
        plateRaw: 'GJ01AB1234',
        plateNorm: 'GJ01AB1234',
        offsetMin: -15,
        conf: 0.97,
        src: 'live',
      },
    ];

    for (const d of detections) {
      const timestamp = new Date(baseTime.getTime() + d.offsetMin * 60 * 1000);
      await client.query(
        `INSERT INTO detection_events (camera_id, plate_raw, plate_normalised, timestamp, confidence, source)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [d.camId, d.plateRaw, d.plateNorm, timestamp, d.conf, d.src]
      );
    }

    // 3. Ensure Watchlist Entry for GJ01WL0001
    await client.query('DELETE FROM watchlist_entries WHERE entity_value = \'GJ01WL0001\'');
    await client.query(
      `INSERT INTO watchlist_entries (entity_type, entity_value, display_name, description, priority, source, is_active)
       VALUES ('stolen_vehicle', 'GJ01WL0001', 'Stolen SUV — Hotlist', 'Black Fortuner stolen from Ahmedabad SG Highway', 'critical', 'Police Hotlist', TRUE)`
    );

    // 4. Insert sample operator tagged event
    await client.query(
      `INSERT INTO tagged_events (camera_id, note, timestamp)
       VALUES ('GJ-POL-000001', 'Suspect vehicle flagged at Ahmedabad toll booth; patrol notified', NOW())`
    );

    await client.query('COMMIT');
    console.log('✅ Model 2 sample data seeded successfully!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Model 2 seed error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedModel2();
