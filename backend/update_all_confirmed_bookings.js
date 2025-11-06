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

async function updateAllConfirmedBookings() {
  console.log('Updating all confirmed bookings with future dates...\n');

  try {
    const bookings = await pool.query(
      `SELECT ticket_number, appointment_date, appointment_time
       FROM bookings 
       WHERE status = 'confirmed' AND appointment_date < $1
       ORDER BY appointment_date DESC`,
      [new Date().toISOString().split('T')[0]]
    );

    if (bookings.rows.length === 0) {
      console.log('✓ All confirmed bookings already have future dates!');
      return;
    }

    console.log(`Found ${bookings.rows.length} past confirmed bookings to update:\n`);

    const today = new Date();
    const now = new Date().toISOString();
    let dayOffset = 7;

    for (const booking of bookings.rows) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + dayOffset);
      const dateStr = futureDate.toISOString().split('T')[0];

      console.log(`Updating ${booking.ticket_number}: ${booking.appointment_date} → ${dateStr}`);

      await pool.query(
        `UPDATE bookings 
         SET appointment_date = $1, 
             updated_at = $2 
         WHERE ticket_number = $3`,
        [dateStr, now, booking.ticket_number]
      );

      dayOffset += 1;
    }

    console.log('\n✓ Successfully updated all confirmed bookings!');

    const verifyResult = await pool.query(
      `SELECT ticket_number, appointment_date, appointment_time, status, customer_name
       FROM bookings 
       WHERE status = 'confirmed'
       ORDER BY appointment_date ASC
       LIMIT 10`
    );

    console.log('\n📋 Updated confirmed bookings (next 10):');
    verifyResult.rows.forEach((row, index) => {
      const apptDate = new Date(row.appointment_date);
      const daysUntil = Math.floor((apptDate - today) / (1000 * 60 * 60 * 24));
      console.log(`${index + 1}. ${row.ticket_number} - ${row.appointment_date} at ${row.appointment_time} (in ${daysUntil} days)`);
    });

  } catch (error) {
    console.error('❌ Error updating bookings:', error);
  } finally {
    await pool.end();
  }
}

updateAllConfirmedBookings();
