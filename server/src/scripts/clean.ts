import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/setu_registry',
});

async function cleanDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Cleaning all dummy and mock data from database...');

    // 1. Delete all federated runtime and mock data
    await client.query('DELETE FROM stream_sessions');
    await client.query('DELETE FROM alerts');
    await client.query('DELETE FROM correlation_tracks');
    await client.query('DELETE FROM federated_events');
    await client.query('DELETE FROM camera_vms_bindings');
    await client.query('DELETE FROM watchlist_entries');
    await client.query('DELETE FROM onboarding_errors');
    await client.query('DELETE FROM audit_log');

    // 2. Delete all mock/dummy cameras
    const res = await client.query('DELETE FROM cameras');
    console.log(`- Removed ${res.rowCount} dummy camera records.`);

    await client.query('COMMIT');
    console.log('✅ Database cleaned successfully! All dummy cameras, events, and mock tracks removed.');
    console.log('ℹ️ Core system lookup tables (departments, districts, login users) preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cleaning database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDatabase().catch(console.error);
