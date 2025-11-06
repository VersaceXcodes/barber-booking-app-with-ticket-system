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

async function checkBookings() {
  try {
    const result = await pool.query(
      `SELECT ticket_number, appointment_date, appointment_time, status, customer_name
       FROM bookings 
       WHERE status = 'confirmed'
       ORDER BY appointment_date DESC`
    );
    
    const today = new Date();
    console.log(`\nToday's date: ${today.toISOString().split('T')[0]}\n`);
    console.log(`Found ${result.rows.length} confirmed bookings:\n`);
    
    result.rows.forEach((booking, index) => {
      const apptDate = new Date(booking.appointment_date);
      const daysUntil = Math.floor((apptDate - today) / (1000 * 60 * 60 * 24));
      const status = daysUntil >= 0 ? `✓ Future (in ${daysUntil} days)` : `✗ Past (${Math.abs(daysUntil)} days ago)`;
      
      console.log(`${index + 1}. ${booking.ticket_number}`);
      console.log(`   Customer: ${booking.customer_name}`);
      console.log(`   Date: ${booking.appointment_date} at ${booking.appointment_time}`);
      console.log(`   ${status}\n`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkBookings();
