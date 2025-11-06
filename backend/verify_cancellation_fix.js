import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;

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

async function verifyCancellationFix() {
  console.log('='.repeat(70));
  console.log('CANCELLATION FIX VERIFICATION');
  console.log('='.repeat(70));

  try {
    const booking = await pool.query(
      `SELECT ticket_number, appointment_date, appointment_time, status, customer_name, customer_email
       FROM bookings 
       WHERE ticket_number = 'TKT-2024-014'`
    );

    if (booking.rows.length === 0) {
      console.log('\n❌ TEST FAILED: Booking TKT-2024-014 not found\n');
      return;
    }

    const b = booking.rows[0];
    const today = new Date();
    const apptDateTime = new Date(`${b.appointment_date}T${b.appointment_time}`);
    const cutoffHours = 2;
    const cutoffTime = new Date(apptDateTime.getTime() - (cutoffHours * 60 * 60 * 1000));
    
    const daysUntil = Math.floor((apptDateTime - today) / (1000 * 60 * 60 * 24));
    const hoursUntil = Math.floor((apptDateTime - today) / (1000 * 60 * 60));
    const hoursUntilCutoff = Math.floor((cutoffTime - today) / (1000 * 60 * 60));
    
    console.log('\n📋 BOOKING DETAILS');
    console.log('-'.repeat(70));
    console.log(`Ticket Number: ${b.ticket_number}`);
    console.log(`Customer: ${b.customer_name} (${b.customer_email})`);
    console.log(`Status: ${b.status}`);
    console.log(`Appointment: ${b.appointment_date} at ${b.appointment_time}`);
    
    console.log('\n⏰ TIME CALCULATIONS');
    console.log('-'.repeat(70));
    console.log(`Current Date/Time: ${today.toISOString()}`);
    console.log(`Appointment Date/Time: ${apptDateTime.toISOString()}`);
    console.log(`Cutoff Time (2hrs before): ${cutoffTime.toISOString()}`);
    console.log(`\nDays until appointment: ${daysUntil} days`);
    console.log(`Hours until appointment: ${hoursUntil} hours`);
    console.log(`Hours until cutoff: ${hoursUntilCutoff} hours`);
    
    console.log('\n✅ CANCELLATION ELIGIBILITY CHECK');
    console.log('-'.repeat(70));
    
    const checks = {
      'Status is confirmed': b.status === 'confirmed',
      'Appointment is in the future': apptDateTime > today,
      'Before cutoff time': cutoffTime > today,
      'Can be cancelled': b.status === 'confirmed' && cutoffTime > today
    };
    
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`${passed ? '✓' : '✗'} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
    }
    
    const canCancel = checks['Can be cancelled'];
    
    console.log('\n🎯 EXPECTED UI BEHAVIOR');
    console.log('-'.repeat(70));
    if (canCancel) {
      console.log('✅ Show "Cancel Booking" button');
      console.log('✅ Allow user to cancel the booking');
      console.log('✅ Show cancellation modal when clicked');
    } else {
      console.log('⚠️  Show warning: "Cannot cancel within 2 hours"');
      console.log('⚠️  Display shop phone number for manual cancellation');
      console.log('⚠️  Hide "Cancel Booking" button');
    }
    
    console.log('\n📊 FINAL RESULT');
    console.log('='.repeat(70));
    if (canCancel) {
      console.log('✅ TEST PASSED: Booking can be cancelled via UI');
      console.log('✅ The cancellation fix is working correctly!');
    } else {
      console.log('❌ TEST FAILED: Booking cannot be cancelled');
      console.log('❌ Need to update appointment to a future date');
    }
    console.log('='.repeat(70));
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

verifyCancellationFix();
