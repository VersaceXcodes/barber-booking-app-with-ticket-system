#!/usr/bin/env node

/**
 * Seed test bookings to test full capacity scenarios
 * This script creates bookings that fill up specific time slots
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { 
        connectionString: process.env.DATABASE_URL, 
        ssl: { rejectUnauthorized: false } 
      }
    : {
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        port: Number(process.env.PGPORT),
        ssl: { rejectUnauthorized: false },
      }
);

async function seedFullSlotBookings() {
  try {
    console.log('Seeding test bookings for full capacity testing...');
    
    // Get today's date and create bookings for future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create bookings for Nov 19, 2025 (Wednesday - capacity 2)
    const testDate1 = '2025-11-19';
    const testTime1 = '10:00';
    
    // Check capacity for Wednesday
    const dayOfWeek1 = new Date(testDate1).getDay(); // 3 = Wednesday
    const capacity1 = [1, 2, 3].includes(dayOfWeek1) ? 2 : 3;
    
    console.log(`\nCreating ${capacity1} bookings for ${testDate1} ${testTime1} (Wednesday, capacity ${capacity1})`);
    
    // Delete existing test bookings for this slot
    await pool.query(
      'DELETE FROM bookings WHERE appointment_date = $1 AND appointment_time = $2 AND customer_email LIKE $3',
      [testDate1, testTime1, 'test.full%@example.com']
    );
    
    // Create bookings to fill the slot
    for (let i = 0; i < capacity1; i++) {
      const booking_id = uuidv4();
      const dateStr = testDate1.replace(/-/g, '');
      
      // Get the next sequence number
      const maxSeqResult = await pool.query(
        "SELECT MAX(CAST(SUBSTRING(ticket_number FROM 14) AS INTEGER)) as max_seq FROM bookings WHERE ticket_number LIKE $1",
        [`TKT-${dateStr}-%`]
      );
      const maxSeq = maxSeqResult.rows[0].max_seq || 0;
      const ticketNumber = `TKT-${dateStr}-${String(maxSeq + 1).padStart(3, '0')}`;
      
      const now = new Date().toISOString();
      
      await pool.query(
        `INSERT INTO bookings (
          booking_id, ticket_number, user_id, status, appointment_date, appointment_time,
          slot_duration, customer_name, customer_email, customer_phone, booking_for_name,
          service_id, special_request, inspiration_photos, created_at, updated_at, confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $15)`,
        [
          booking_id,
          ticketNumber,
          null,
          'confirmed',
          testDate1,
          testTime1,
          40,
          `Test Full ${i + 1}`,
          `test.full${i + 1}@example.com`,
          `+35312345${String(i + 1).padStart(4, '0')}`,
          null,
          'service_001',
          'Test booking for full capacity',
          '[]',
          now
        ]
      );
      
      console.log(`  ✓ Created booking ${i + 1}/${capacity1}: ${ticketNumber}`);
    }
    
    // Create bookings for Nov 29, 2025 (Saturday - capacity 3)
    const testDate2 = '2025-11-29';
    const testTime2 = '10:40';
    
    const dayOfWeek2 = new Date(testDate2).getDay(); // 6 = Saturday
    const capacity2 = [1, 2, 3].includes(dayOfWeek2) ? 2 : 3;
    
    console.log(`\nCreating ${capacity2} bookings for ${testDate2} ${testTime2} (Saturday, capacity ${capacity2})`);
    
    // Delete existing test bookings for this slot
    await pool.query(
      'DELETE FROM bookings WHERE appointment_date = $1 AND appointment_time = $2 AND customer_email LIKE $3',
      [testDate2, testTime2, 'test.full%@example.com']
    );
    
    // Create bookings to fill the slot
    for (let i = 0; i < capacity2; i++) {
      const booking_id = uuidv4();
      const dateStr = testDate2.replace(/-/g, '');
      
      const maxSeqResult = await pool.query(
        "SELECT MAX(CAST(SUBSTRING(ticket_number FROM 14) AS INTEGER)) as max_seq FROM bookings WHERE ticket_number LIKE $1",
        [`TKT-${dateStr}-%`]
      );
      const maxSeq = maxSeqResult.rows[0].max_seq || 0;
      const ticketNumber = `TKT-${dateStr}-${String(maxSeq + 1).padStart(3, '0')}`;
      
      const now = new Date().toISOString();
      
      await pool.query(
        `INSERT INTO bookings (
          booking_id, ticket_number, user_id, status, appointment_date, appointment_time,
          slot_duration, customer_name, customer_email, customer_phone, booking_for_name,
          service_id, special_request, inspiration_photos, created_at, updated_at, confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $15)`,
        [
          booking_id,
          ticketNumber,
          null,
          'confirmed',
          testDate2,
          testTime2,
          40,
          `Test Full ${i + 1}`,
          `test.full${i + 1}@example.com`,
          `+35312345${String(i + 1).padStart(4, '0')}`,
          null,
          'service_001',
          'Test booking for full capacity',
          '[]',
          now
        ]
      );
      
      console.log(`  ✓ Created booking ${i + 1}/${capacity2}: ${ticketNumber}`);
    }
    
    // Verify the bookings
    console.log('\nVerifying created bookings...');
    
    const verification1 = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE appointment_date = $1 AND appointment_time = $2 AND status = $3',
      [testDate1, testTime1, 'confirmed']
    );
    console.log(`  ${testDate1} ${testTime1}: ${verification1.rows[0].count}/${capacity1} booked`);
    
    const verification2 = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE appointment_date = $1 AND appointment_time = $2 AND status = $3',
      [testDate2, testTime2, 'confirmed']
    );
    console.log(`  ${testDate2} ${testTime2}: ${verification2.rows[0].count}/${capacity2} booked`);
    
    console.log('\n✅ Test booking seeding completed successfully!');
    console.log('\nYou can now test the "booking full slot" scenario:');
    console.log(`  - ${testDate1} ${testTime1} should show as FULL (${capacity1}/${capacity1})`);
    console.log(`  - ${testDate2} ${testTime2} should show as FULL (${capacity2}/${capacity2})`);
    
  } catch (error) {
    console.error('❌ Error seeding test bookings:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

seedFullSlotBookings();
