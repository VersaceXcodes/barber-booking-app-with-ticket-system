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

async function updateTestBookings() {
  console.log('Updating test bookings with future dates...\n');

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 7);
  const dateStr = futureDate.toISOString().split('T')[0];
  const now = new Date().toISOString();

  console.log(`Setting booking TKT-2024-014 to: ${dateStr} at 14:00 (2:00 PM)`);

  try {
    const result = await pool.query(
      `UPDATE bookings 
       SET appointment_date = $1, 
           appointment_time = '14:00', 
           updated_at = $2 
       WHERE ticket_number = 'TKT-2024-014'
       RETURNING ticket_number, appointment_date, appointment_time, status`,
      [dateStr, now]
    );

    if (result.rows.length > 0) {
      console.log('\n✓ Successfully updated booking:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('\n✗ Booking not found: TKT-2024-014');
    }

    const verifyResult = await pool.query(
      `SELECT ticket_number, appointment_date, appointment_time, status, customer_name, customer_email
       FROM bookings 
       WHERE ticket_number = 'TKT-2024-014'`
    );

    console.log('\n📋 Current booking details:');
    console.log(JSON.stringify(verifyResult.rows[0], null, 2));

  } catch (error) {
    console.error('❌ Error updating bookings:', error);
  } finally {
    await pool.end();
  }
}

updateTestBookings();
