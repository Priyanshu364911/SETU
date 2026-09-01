import 'dotenv/config';
import { Client } from 'pg';

async function createDatabase() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/setu_registry';
  
  // Parse connection string and connect to the default 'postgres' database first
  const parsed = new URL(dbUrl);
  const targetDbName = parsed.pathname.replace(/^\//, '') || 'setu_registry';
  
  // Point to default 'postgres' maintenance database to check/create target database
  parsed.pathname = '/postgres';
  
  const client = new Client({
    connectionString: parsed.toString(),
  });

  try {
    await client.connect();
    console.log(`[DB Setup] Connected to PostgreSQL server.`);

    const check = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );

    if (check.rows.length === 0) {
      console.log(`[DB Setup] Database "${targetDbName}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`[DB Setup] Database "${targetDbName}" created successfully!`);
    } else {
      console.log(`[DB Setup] Database "${targetDbName}" already exists.`);
    }
  } catch (err: any) {
    console.error('[DB Setup] Failed to create database:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

createDatabase().catch(() => process.exit(1));
