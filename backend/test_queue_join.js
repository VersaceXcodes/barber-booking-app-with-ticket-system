#!/usr/bin/env node

/**
 * Test script to verify queue join functionality with barber_id
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { DATABASE_URL } = process.env;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testQueueJoin() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing queue join with barber_id...\n');
    
    // Test 1: Join queue WITHOUT barber_id (First Available)
    console.log('Test 1: Join queue without barber_id (First Available)');
    const queueId1 = `queue_test_${Date.now()}_1`;
    await client.query(
      `INSERT INTO walk_in_queue 
       (queue_id, customer_name, customer_phone, barber_id, status, position, estimated_wait_minutes, estimated_service_duration, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [queueId1, 'Test User 1', '+353831111111', null, 'waiting', 1, 15, 30, new Date().toISOString(), new Date().toISOString()]
    );
    console.log('✅ Successfully inserted queue entry with barber_id = NULL');
    
    // Verify the insert
    const result1 = await client.query('SELECT * FROM walk_in_queue WHERE queue_id = $1', [queueId1]);
    console.log('   Inserted data:', {
      queue_id: result1.rows[0].queue_id,
      customer_name: result1.rows[0].customer_name,
      barber_id: result1.rows[0].barber_id,
      status: result1.rows[0].status
    });
    console.log('');
    
    // Test 2: Join queue WITH barber_id (Specific Barber)
    console.log('Test 2: Join queue with barber_id (Specific Barber)');
    
    // First, get a barber ID from the database
    const barberResult = await client.query('SELECT barber_id, name FROM barbers LIMIT 1');
    
    if (barberResult.rows.length > 0) {
      const barberId = barberResult.rows[0].barber_id;
      const barberName = barberResult.rows[0].name;
      
      const queueId2 = `queue_test_${Date.now()}_2`;
      await client.query(
        `INSERT INTO walk_in_queue 
         (queue_id, customer_name, customer_phone, barber_id, status, position, estimated_wait_minutes, estimated_service_duration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [queueId2, 'Test User 2', '+353832222222', barberId, 'waiting', 2, 30, 30, new Date().toISOString(), new Date().toISOString()]
      );
      console.log(`✅ Successfully inserted queue entry with barber_id = ${barberId} (${barberName})`);
      
      // Verify the insert
      const result2 = await client.query(
        `SELECT q.*, b.name as barber_name 
         FROM walk_in_queue q 
         LEFT JOIN barbers b ON q.barber_id = b.barber_id 
         WHERE q.queue_id = $1`,
        [queueId2]
      );
      console.log('   Inserted data:', {
        queue_id: result2.rows[0].queue_id,
        customer_name: result2.rows[0].customer_name,
        barber_id: result2.rows[0].barber_id,
        barber_name: result2.rows[0].barber_name,
        status: result2.rows[0].status
      });
    } else {
      console.log('⚠️  No barbers found in database, skipping test with barber_id');
    }
    console.log('');
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await client.query(`DELETE FROM walk_in_queue WHERE queue_id LIKE 'queue_test_%'`);
    console.log('✅ Test data cleaned up');
    console.log('');
    
    console.log('🎉 All tests passed! The barber_id column is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testQueueJoin()
  .then(() => {
    console.log('\n✅ Queue join test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
