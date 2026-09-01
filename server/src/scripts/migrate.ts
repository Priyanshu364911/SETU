import 'dotenv/config';
import { Pool, Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/setu_registry';

async function ensureDatabaseExists() {
  try {
    const parsed = new URL(dbUrl);
    const targetDb = parsed.pathname.replace(/^\//, '') || 'setu_registry';
    parsed.pathname = '/postgres';

    const rootClient = new Client({ connectionString: parsed.toString() });
    await rootClient.connect();

    const res = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDb]);
    if (res.rows.length === 0) {
      console.log(`[Migrate] Creating database "${targetDb}"...`);
      await rootClient.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[Migrate] Database "${targetDb}" created.`);
    }
    await rootClient.end();
  } catch (err: any) {
    console.warn(`[Migrate] Database existence check note: ${err.message}`);
  }
}

const migrationsDir = path.join(__dirname, '../../migrations');

async function runMigrations() {
  await ensureDatabaseExists();

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    console.log('Starting migrations...');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // Get already executed migrations
    const executedResult = await client.query('SELECT filename FROM schema_migrations ORDER BY id');
    const executedFiles = new Set(executedResult.rows.map((r) => r.filename));

    // Run pending migrations
    for (const file of migrationFiles) {
      if (executedFiles.has(file)) {
        console.log(`Skipping already executed migration: ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Completed migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to run migration ${file}:`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(() => process.exit(1));
