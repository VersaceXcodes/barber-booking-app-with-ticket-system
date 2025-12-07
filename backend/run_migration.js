#!/usr/bin/env node

/**
 * Migration Script: Add barber_id to walk_in_queue table
 * 
 * This script adds the barber_id column to the walk_in_queue table
 * if it doesn't already exist.
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;

// Create database pool
const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { rejectUnauthorized: false } 
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false },
      }
);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration: Add barber_id to walk_in_queue table...');
    
    // Read the migration SQL file
    const migrationSQL = readFileSync(
      join(__dirname, 'migrate_add_barber_id_to_queue.sql'),
      'utf-8'
    );
    
    // Execute the migration
    await client.query(migrationSQL);
    
    // Verify the column exists
    const checkResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'walk_in_queue' 
      AND column_name = 'barber_id'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Migration successful!');
      console.log('   Column Details:', checkResult.rows[0]);
      
      // Check foreign key constraint
      const fkResult = await client.query(`
        SELECT
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name='walk_in_queue'
          AND kcu.column_name = 'barber_id'
      `);
      
      if (fkResult.rows.length > 0) {
        console.log('✅ Foreign key constraint verified:', fkResult.rows[0].constraint_name);
      }
      
      // Check index
      const indexResult = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'walk_in_queue'
        AND indexname = 'idx_walk_in_queue_barber_id'
      `);
      
      if (indexResult.rows.length > 0) {
        console.log('✅ Index verified:', indexResult.rows[0].indexname);
      }
    } else {
      console.log('❌ Migration failed: Column not found after migration');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
