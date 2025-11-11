import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createUserInputSchema, createServiceInputSchema, createBookingInputSchema, createCapacityOverrideInputSchema } from './schema.js';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432, JWT_SECRET = 'dev-secret-key-change-in-production', PORT = 3000 } = process.env;
const pool = new Pool(DATABASE_URL
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
    });
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
function createErrorResponse(message, error = null, errorCode = null) {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString()
    };
    if (errorCode) {
        response.error = { code: errorCode };
    }
    if (error) {
        response.error = response.error || {};
        response.error.details = {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    return response;
}
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_REQUIRED'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query('SELECT user_id, email, name, is_verified FROM users WHERE user_id = $1', [decoded.user_id]);
        if (result.rows.length === 0) {
            return res.status(401).json(createErrorResponse('Invalid token', null, 'AUTH_TOKEN_INVALID'));
        }
        req.user = result.rows[0];
        next();
    }
    catch (error) {
        return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
    }
};
const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json(createErrorResponse('Admin access token required', null, 'ADMIN_AUTH_REQUIRED'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.is_admin) {
            return res.status(403).json(createErrorResponse('Admin access required', null, 'ADMIN_ACCESS_DENIED'));
        }
        req.admin = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json(createErrorResponse('Invalid admin token', error, 'ADMIN_TOKEN_INVALID'));
    }
};
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/services', async (req, res) => {
    try {
        const { is_active, sort_by = 'display_order', limit, offset = 0 } = req.query;
        let query = 'SELECT * FROM services';
        const params = [];
        if (is_active !== undefined) {
            query += ' WHERE is_active = $1';
            params.push(is_active === 'true');
        }
        else {
            query += ' WHERE is_active = TRUE';
        }
        const validSortFields = ['name', 'price', 'duration', 'display_order'];
        const sortByStr = String(sort_by);
        const sortField = validSortFields.includes(sortByStr) ? sortByStr : 'display_order';
        query += ` ORDER BY ${sortField} ASC`;
        if (limit) {
            query += ` LIMIT ${parseInt(String(limit))}`;
        }
        if (offset) {
            query += ` OFFSET ${parseInt(String(offset))}`;
        }
        const result = await pool.query(query, params);
        const services = result.rows.map(service => ({
            ...service,
            price: service.price ? parseFloat(service.price) : null
        }));
        res.json({ services });
    }
    catch (error) {
        console.error('Get services error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve services', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/availability', async (req, res) => {
    try {
        const { start_date, end_date, service_id } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json(createErrorResponse('start_date and end_date are required', null, 'MISSING_DATES'));
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start_date)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end_date))) {
            return res.status(400).json(createErrorResponse('Invalid date format. Use YYYY-MM-DD', null, 'INVALID_DATE_FORMAT'));
        }
        const settingsResult = await pool.query("SELECT * FROM (SELECT 'settings-main' as setting_id, 2 as capacity_mon_wed, 3 as capacity_thu_sun, 90 as booking_window_days, 2 as same_day_cutoff_hours) s LIMIT 1");
        const settings = settingsResult.rows[0] || { capacity_mon_wed: 2, capacity_thu_sun: 3, booking_window_days: 90 };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + settings.booking_window_days);
        maxDate.setHours(23, 59, 59, 999);
        const overridesResult = await pool.query('SELECT * FROM capacity_overrides WHERE override_date >= $1 AND override_date <= $2 AND is_active = TRUE', [start_date, end_date]);
        const overrides = {};
        overridesResult.rows.forEach(row => {
            overrides[row.override_date] = row.capacity;
        });
        const bookingsResult = await pool.query('SELECT appointment_date, appointment_time, COUNT(*) as booked_count FROM bookings WHERE appointment_date >= $1 AND appointment_date <= $2 AND status = $3 GROUP BY appointment_date, appointment_time', [start_date, end_date, 'confirmed']);
        const bookingsByDateAndTime = {};
        bookingsResult.rows.forEach(row => {
            const key = `${row.appointment_date}:${row.appointment_time}`;
            bookingsByDateAndTime[key] = parseInt(row.booked_count);
        });
        const start = new Date(String(start_date));
        const end = new Date(String(end_date));
        const dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const currentDate = new Date(dateStr + 'T00:00:00');
            const isPast = currentDate < today;
            const isBeyondBookingWindow = currentDate > maxDate;
            const dayOfWeek = d.getDay();
            const isMondayToWednesday = [1, 2, 3].includes(dayOfWeek);
            let baseCapacity = isMondayToWednesday ? settings.capacity_mon_wed : settings.capacity_thu_sun;
            let effectiveCapacity = overrides[dateStr] !== undefined ? overrides[dateStr] : baseCapacity;
            if (isPast || isBeyondBookingWindow) {
                effectiveCapacity = 0;
            }
            // Calculate availability across all time slots for this date
            const timeSlots = ['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:20'];
            let totalAvailableSlots = 0;
            let totalBookedSlots = 0;
            timeSlots.forEach(timeSlot => {
                const key = `${dateStr}:${timeSlot}`;
                const bookedCount = bookingsByDateAndTime[key] || 0;
                totalBookedSlots += bookedCount;
                const availableForSlot = Math.max(0, effectiveCapacity - bookedCount);
                totalAvailableSlots += availableForSlot;
            });
            dates.push({
                date: dateStr,
                day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
                is_blocked: effectiveCapacity === 0 || isPast || isBeyondBookingWindow,
                base_capacity: baseCapacity,
                override_capacity: overrides[dateStr] !== undefined ? overrides[dateStr] : null,
                effective_capacity: effectiveCapacity,
                booked_count: totalBookedSlots,
                available_spots: totalAvailableSlots,
                is_available: totalAvailableSlots > 0 && effectiveCapacity > 0 && !isPast && !isBeyondBookingWindow
            });
        }
        res.json({ dates });
    }
    catch (error) {
        console.error('Get availability range error:', error);
        res.status(500).json(createErrorResponse('Failed to check availability', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/availability/:date', async (req, res) => {
    try {
        const { date } = req.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json(createErrorResponse('Invalid date format. Use YYYY-MM-DD', null, 'INVALID_DATE_FORMAT'));
        }
        const settingsResult = await pool.query("SELECT * FROM (SELECT 'settings-main' as setting_id, 2 as capacity_mon_wed, 3 as capacity_thu_sun, 90 as booking_window_days, 2 as same_day_cutoff_hours) s LIMIT 1");
        const settings = settingsResult.rows[0] || { capacity_mon_wed: 2, capacity_thu_sun: 3, booking_window_days: 90 };
        const requestedDate = new Date(date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (requestedDate < today) {
            return res.status(400).json(createErrorResponse('Cannot check availability for past dates', null, 'PAST_DATE'));
        }
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + settings.booking_window_days);
        maxDate.setHours(23, 59, 59, 999);
        if (requestedDate > maxDate) {
            return res.status(400).json(createErrorResponse(`Cannot check availability more than ${settings.booking_window_days} days in advance`, null, 'BEYOND_BOOKING_WINDOW'));
        }
        const dayOfWeek = new Date(date).getDay();
        const isMondayToWednesday = [1, 2, 3].includes(dayOfWeek);
        let baseCapacity = isMondayToWednesday ? settings.capacity_mon_wed : settings.capacity_thu_sun;
        const overrideResult = await pool.query('SELECT * FROM capacity_overrides WHERE override_date = $1 AND is_active = TRUE LIMIT 1', [date]);
        let effectiveCapacity = baseCapacity;
        if (overrideResult.rows.length > 0) {
            effectiveCapacity = overrideResult.rows[0].capacity;
        }
        const blockedResult = await pool.query('SELECT * FROM capacity_overrides WHERE override_date = $1 AND capacity = 0 AND is_active = TRUE', [date]);
        const isEntireDayBlocked = blockedResult.rows.length > 0;
        const bookingsResult = await pool.query('SELECT appointment_time, COUNT(*) as booked_count FROM bookings WHERE appointment_date = $1 AND status = $2 GROUP BY appointment_time', [date, 'confirmed']);
        const bookingCounts = {};
        bookingsResult.rows.forEach(row => {
            bookingCounts[row.appointment_time] = parseInt(row.booked_count);
        });
        const timeSlots = ['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:20'];
        const slots = timeSlots.map(time => {
            let capacity = isEntireDayBlocked ? 0 : effectiveCapacity;
            const booked = bookingCounts[time] || 0;
            const available = Math.max(0, capacity - booked);
            return {
                time,
                total_capacity: capacity,
                booked_count: booked,
                available_spots: available,
                is_available: available > 0,
                status: available > 0 ? 'available' : (capacity === 0 ? 'blocked' : 'full')
            };
        });
        res.json({
            date,
            day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
            is_blocked: isEntireDayBlocked,
            base_capacity: baseCapacity,
            override_capacity: overrideResult.rows.length > 0 ? overrideResult.rows[0].capacity : null,
            effective_capacity: effectiveCapacity,
            slots
        });
    }
    catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json(createErrorResponse('Failed to check availability', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/bookings', async (req, res) => {
    try {
        const validationResult = createBookingInputSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json(createErrorResponse('Validation failed', validationResult.error, 'VALIDATION_ERROR'));
        }
        const { appointment_date, appointment_time, customer_name, customer_email, customer_phone, booking_for_name, service_id, special_request, inspiration_photos } = validationResult.data;
        const settingsResult = await pool.query("SELECT * FROM (SELECT 'settings-main' as setting_id, 2 as capacity_mon_wed, 3 as capacity_thu_sun, 90 as booking_window_days, 2 as same_day_cutoff_hours) s LIMIT 1");
        const settings = settingsResult.rows[0] || { booking_window_days: 90 };
        const appointmentDate = new Date(appointment_date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
            return res.status(400).json(createErrorResponse('Cannot book appointments in the past', null, 'PAST_DATE'));
        }
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + settings.booking_window_days);
        maxDate.setHours(23, 59, 59, 999);
        if (appointmentDate > maxDate) {
            return res.status(400).json(createErrorResponse(`Cannot book appointments more than ${settings.booking_window_days} days in advance`, null, 'BEYOND_BOOKING_WINDOW'));
        }
        const availabilityRes = await pool.query('SELECT COUNT(*) as count FROM bookings WHERE appointment_date = $1 AND appointment_time = $2 AND status = $3', [appointment_date, appointment_time, 'confirmed']);
        const currentBookings = parseInt(availabilityRes.rows[0].count);
        const dayOfWeek = new Date(appointment_date).getDay();
        const isMondayToWednesday = [1, 2, 3].includes(dayOfWeek);
        let capacity = isMondayToWednesday ? settings.capacity_mon_wed || 2 : settings.capacity_thu_sun || 3;
        const overrideResult = await pool.query('SELECT * FROM capacity_overrides WHERE override_date = $1 AND is_active = TRUE LIMIT 1', [appointment_date]);
        if (overrideResult.rows.length > 0) {
            capacity = overrideResult.rows[0].capacity;
        }
        if (currentBookings >= capacity) {
            return res.status(409).json(createErrorResponse('Time slot is fully booked', null, 'SLOT_FULL'));
        }
        const dateStr = appointment_date.replace(/-/g, '');
        const maxSeqResult = await pool.query("SELECT MAX(CAST(SUBSTRING(ticket_number FROM 14) AS INTEGER)) as max_seq FROM bookings WHERE ticket_number LIKE $1", [`TKT-${dateStr}-%`]);
        const maxSeq = maxSeqResult.rows[0].max_seq || 0;
        const nextSeq = maxSeq + 1;
        const ticketNumber = `TKT-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
        const booking_id = uuidv4();
        const user_id = req.user ? req.user.user_id : null;
        const now = new Date().toISOString();
        const insertResult = await pool.query(`INSERT INTO bookings (
        booking_id, ticket_number, user_id, status, appointment_date, appointment_time,
        slot_duration, customer_name, customer_email, customer_phone, booking_for_name,
        service_id, special_request, inspiration_photos, created_at, updated_at, confirmed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $15)
      RETURNING *`, [
            booking_id, ticketNumber, user_id, 'confirmed', appointment_date, appointment_time,
            40, customer_name, customer_email, customer_phone, booking_for_name,
            service_id, special_request, JSON.stringify(inspiration_photos || []), now
        ]);
        res.status(201).json({
            booking: insertResult.rows[0],
            message: `Booking confirmed! Confirmation sent to ${customer_email}`
        });
    }
    catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json(createErrorResponse('Failed to create booking', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/bookings/search', async (req, res) => {
    try {
        const { ticket_number, phone, date } = req.query;
        if (ticket_number) {
            if (typeof ticket_number !== 'string' || ticket_number.trim().length === 0) {
                return res.status(400).json(createErrorResponse('Invalid ticket number format', null, 'INVALID_TICKET_FORMAT'));
            }
            try {
                const result = await pool.query('SELECT * FROM bookings WHERE UPPER(ticket_number) = UPPER($1)', [String(ticket_number).trim()]);
                return res.json({ bookings: result.rows, total: result.rows.length });
            }
            catch (dbError) {
                console.error('Database error searching by ticket:', dbError);
                if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ETIMEDOUT') {
                    return res.status(503).json(createErrorResponse('Database connection failed. Please try again later.', dbError, 'DB_CONNECTION_ERROR'));
                }
                throw dbError;
            }
        }
        if (phone && date) {
            if (typeof phone !== 'string' || typeof date !== 'string') {
                return res.status(400).json(createErrorResponse('Invalid phone or date format', null, 'INVALID_PHONE_DATE_FORMAT'));
            }
            const dateStr = String(date).trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return res.status(400).json(createErrorResponse('Invalid date format. Use YYYY-MM-DD', null, 'INVALID_DATE_FORMAT'));
            }
            const parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json(createErrorResponse('Invalid date value. Please provide a valid date.', null, 'INVALID_DATE_VALUE'));
            }
            try {
                const result = await pool.query('SELECT * FROM bookings WHERE customer_phone = $1 AND appointment_date = $2 ORDER BY appointment_time ASC', [String(phone).trim(), dateStr]);
                return res.json({ bookings: result.rows, total: result.rows.length });
            }
            catch (dbError) {
                console.error('Database error searching by phone/date:', dbError);
                if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ETIMEDOUT') {
                    return res.status(503).json(createErrorResponse('Database connection failed. Please try again later.', dbError, 'DB_CONNECTION_ERROR'));
                }
                throw dbError;
            }
        }
        return res.status(400).json(createErrorResponse("Provide either 'ticket_number' OR both 'phone' and 'date'", null, 'INVALID_SEARCH_PARAMS'));
    }
    catch (error) {
        console.error('Search bookings error:', error);
        res.status(500).json(createErrorResponse('Failed to search bookings', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/bookings/:ticket_number', async (req, res) => {
    try {
        const { ticket_number } = req.params;
        const result = await pool.query(`SELECT b.*, s.name as service_name, s.duration as service_duration, s.price as service_price
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.service_id
       WHERE UPPER(b.ticket_number) = UPPER($1)`, [ticket_number]);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
        }
        const row = result.rows[0];
        const booking = { ...row };
        delete booking.service_name;
        delete booking.service_duration;
        delete booking.service_price;
        res.json({
            booking,
            service_name: row.service_name,
            service_duration: row.service_duration,
            service_price: row.service_price
        });
    }
    catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve booking', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/bookings/:ticket_number/cancel', async (req, res) => {
    try {
        const { ticket_number } = req.params;
        const { cancellation_reason } = req.body;
        if (!cancellation_reason) {
            return res.status(400).json(createErrorResponse('Cancellation reason is required', null, 'MISSING_REASON'));
        }
        const bookingResult = await pool.query('SELECT * FROM bookings WHERE UPPER(ticket_number) = UPPER($1)', [ticket_number]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
        }
        const booking = bookingResult.rows[0];
        if (booking.status === 'cancelled') {
            return res.status(409).json(createErrorResponse('Booking already cancelled', null, 'ALREADY_CANCELLED'));
        }
        if (booking.status === 'completed') {
            return res.status(409).json(createErrorResponse('Cannot cancel completed booking', null, 'CANNOT_CANCEL_COMPLETED'));
        }
        const now = new Date().toISOString();
        const cancelled_by = req.admin ? 'admin' : 'customer';
        const updateResult = await pool.query(`UPDATE bookings
       SET status = 'cancelled', cancelled_at = $1, cancelled_by = $2, cancellation_reason = $3, updated_at = $1
       WHERE booking_id = $4
       RETURNING *`, [now, cancelled_by, cancellation_reason, booking.booking_id]);
        res.json({
            booking: updateResult.rows[0],
            message: 'Booking cancelled successfully. Confirmation email sent.'
        });
    }
    catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json(createErrorResponse('Failed to cancel booking', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/bookings/:ticket_number/complete', async (req, res) => {
    try {
        const { ticket_number } = req.params;
        const bookingResult = await pool.query('SELECT * FROM bookings WHERE UPPER(ticket_number) = UPPER($1)', [ticket_number]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
        }
        const booking = bookingResult.rows[0];
        if (booking.status === 'completed') {
            return res.status(409).json(createErrorResponse('Booking already completed', null, 'ALREADY_COMPLETED'));
        }
        if (booking.status === 'cancelled') {
            return res.status(409).json(createErrorResponse('Cannot complete cancelled booking', null, 'CANNOT_COMPLETE_CANCELLED'));
        }
        const now = new Date().toISOString();
        const updateResult = await pool.query(`UPDATE bookings
       SET status = 'completed', completed_at = $1, updated_at = $1
       WHERE booking_id = $2
       RETURNING *`, [now, booking.booking_id]);
        res.json({
            booking: updateResult.rows[0],
            message: 'Booking marked as completed successfully'
        });
    }
    catch (error) {
        console.error('Complete booking error:', error);
        res.status(500).json(createErrorResponse('Failed to complete booking', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/bookings/:ticket_number', async (req, res) => {
    try {
        const { ticket_number } = req.params;
        const { admin_notes } = req.body;
        const bookingResult = await pool.query('SELECT * FROM bookings WHERE UPPER(ticket_number) = UPPER($1)', [ticket_number]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
        }
        const booking = bookingResult.rows[0];
        const now = new Date().toISOString();
        const updateResult = await pool.query(`UPDATE bookings
       SET admin_notes = $1, updated_at = $2
       WHERE booking_id = $3
       RETURNING *`, [admin_notes, now, booking.booking_id]);
        res.json({
            booking: updateResult.rows[0],
            message: 'Booking updated successfully'
        });
    }
    catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json(createErrorResponse('Failed to update booking', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/bookings/:ticket_number/reschedule', async (req, res) => {
    try {
        const { ticket_number } = req.params;
        const { new_appointment_date, new_appointment_time, service_id, special_request } = req.body;
        if (!new_appointment_date || !new_appointment_time) {
            return res.status(400).json(createErrorResponse('New date and time are required', null, 'MISSING_FIELDS'));
        }
        const originalResult = await pool.query('SELECT * FROM bookings WHERE UPPER(ticket_number) = UPPER($1)', [ticket_number]);
        if (originalResult.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
        }
        const original = originalResult.rows[0];
        if (original.status !== 'confirmed') {
            return res.status(409).json(createErrorResponse('Can only reschedule confirmed bookings', null, 'INVALID_STATUS'));
        }
        const availabilityRes = await pool.query('SELECT COUNT(*) as count FROM bookings WHERE appointment_date = $1 AND appointment_time = $2 AND status = $3', [new_appointment_date, new_appointment_time, 'confirmed']);
        const currentBookings = parseInt(availabilityRes.rows[0].count);
        const dayOfWeek = new Date(new_appointment_date).getDay();
        const isMondayToWednesday = [1, 2, 3].includes(dayOfWeek);
        let capacity = isMondayToWednesday ? 2 : 3;
        if (currentBookings >= capacity) {
            return res.status(409).json(createErrorResponse('New time slot is fully booked', null, 'SLOT_FULL'));
        }
        const newDateStr = new_appointment_date.replace(/-/g, '');
        const maxSeqResult = await pool.query("SELECT MAX(CAST(SUBSTRING(ticket_number FROM 14) AS INTEGER)) as max_seq FROM bookings WHERE ticket_number LIKE $1", [`TKT-${newDateStr}-%`]);
        const maxSeq = maxSeqResult.rows[0].max_seq || 0;
        const newTicketNumber = `TKT-${newDateStr}-${String(maxSeq + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const newBookingId = uuidv4();
        const newBookingResult = await pool.query(`INSERT INTO bookings (
        booking_id, ticket_number, user_id, status, appointment_date, appointment_time,
        slot_duration, customer_name, customer_email, customer_phone, booking_for_name,
        service_id, special_request, inspiration_photos, created_at, updated_at, confirmed_at, original_booking_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $15, $16)
      RETURNING *`, [
            newBookingId, newTicketNumber, original.user_id, 'confirmed', new_appointment_date, new_appointment_time,
            40, original.customer_name, original.customer_email, original.customer_phone, original.booking_for_name,
            service_id || original.service_id, special_request || original.special_request,
            original.inspiration_photos, now, original.booking_id
        ]);
        await pool.query(`UPDATE bookings
       SET status = 'cancelled', cancelled_at = $1, cancelled_by = 'customer',
           cancellation_reason = $2, updated_at = $1
       WHERE booking_id = $3`, [now, `Rescheduled to ${newTicketNumber}`, original.booking_id]);
        res.status(201).json({
            new_booking: newBookingResult.rows[0],
            original_booking: { ...original, status: 'cancelled', cancelled_at: now },
            message: `Booking rescheduled successfully. New ticket number: ${newTicketNumber}`
        });
    }
    catch (error) {
        console.error('Reschedule booking error:', error);
        res.status(500).json(createErrorResponse('Failed to reschedule booking', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/auth/check-email-exists', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email || typeof email !== 'string') {
            return res.status(400).json(createErrorResponse('Email parameter required', null, 'MISSING_EMAIL'));
        }
        const result = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        res.json({
            exists: result.rows.length > 0
        });
    }
    catch (error) {
        console.error('Check email exists error:', error);
        res.status(500).json(createErrorResponse('Failed to check email', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/auth/register', async (req, res) => {
    try {
        const validationResult = createUserInputSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json(createErrorResponse('Validation failed', validationResult.error, 'VALIDATION_ERROR'));
        }
        const { email, password, name, phone } = validationResult.data;
        const existingUser = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json(createErrorResponse('Email already registered', null, 'EMAIL_EXISTS'));
        }
        const user_id = uuidv4();
        const verification_token = crypto.randomBytes(32).toString('hex');
        const verification_token_expiry = new Date();
        verification_token_expiry.setHours(verification_token_expiry.getHours() + 24);
        const now = new Date().toISOString();
        const result = await pool.query(`INSERT INTO users (user_id, email, password_hash, name, phone, is_verified, verification_token, verification_token_expiry, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING user_id, email, name, phone, is_verified, created_at`, [user_id, email.toLowerCase(), password, name, phone, false, verification_token, verification_token_expiry.toISOString(), now]);
        const token = jwt.sign({ user_id: result.rows[0].user_id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            user: result.rows[0],
            token,
            message: 'Account created! Please check your email to verify your account.'
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json(createErrorResponse('Failed to create account', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json(createErrorResponse('Email and password are required', null, 'MISSING_FIELDS'));
        }
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
        }
        const user = result.rows[0];
        const is_valid_password = password === user.password_hash;
        if (!is_valid_password) {
            return res.status(400).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
        }
        const token = jwt.sign({ user_id: user.user_id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: {
                user_id: user.user_id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                is_verified: user.is_verified,
                created_at: user.created_at
            },
            token,
            message: 'Login successful'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json(createErrorResponse('Failed to login', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { verification_token } = req.body;
        if (!verification_token) {
            return res.status(400).json(createErrorResponse('Verification token is required', null, 'MISSING_TOKEN'));
        }
        const result = await pool.query('SELECT * FROM users WHERE verification_token = $1 AND is_verified = FALSE', [verification_token]);
        if (result.rows.length === 0) {
            return res.status(400).json(createErrorResponse('Invalid or already used verification token', null, 'INVALID_TOKEN'));
        }
        const user = result.rows[0];
        const expiryDate = new Date(user.verification_token_expiry);
        if (new Date() > expiryDate) {
            return res.status(400).json(createErrorResponse('Verification token expired', null, 'TOKEN_EXPIRED'));
        }
        const now = new Date().toISOString();
        const updateResult = await pool.query(`UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expiry = NULL, updated_at = $1
       WHERE user_id = $2
       RETURNING user_id, email, name, phone, is_verified, created_at, updated_at`, [now, user.user_id]);
        res.json({
            user: updateResult.rows[0],
            message: 'Email verified successfully! You can now log in.'
        });
    }
    catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json(createErrorResponse('Failed to verify email', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});
app.patch('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const updates = [];
        const params = [];
        let paramCount = 1;
        if (name) {
            updates.push(`name = $${paramCount++}`);
            params.push(name);
        }
        if (email) {
            updates.push(`email = $${paramCount++}`);
            params.push(email);
        }
        if (phone) {
            updates.push(`phone = $${paramCount++}`);
            params.push(phone);
        }
        if (updates.length === 0) {
            return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATES'));
        }
        const now = new Date().toISOString();
        updates.push(`updated_at = $${paramCount++}`);
        params.push(now);
        params.push(req.user.user_id);
        const result = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramCount} RETURNING user_id, email, name, phone, is_verified, created_at, updated_at`, params);
        res.json({
            user: result.rows[0],
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json(createErrorResponse('Failed to update profile', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/user/bookings', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT * FROM bookings WHERE user_id = $1';
        const params = [req.user.user_id];
        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }
        query += ' ORDER BY appointment_date DESC, appointment_time DESC';
        const result = await pool.query(query, params);
        res.json({ bookings: result.rows, total: result.rows.length });
    }
    catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve bookings', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === 'admin@barberslot.com' && password === 'admin123') {
            const token = jwt.sign({ admin_id: 'admin-1', email, is_admin: true }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({
                admin: { admin_id: 'admin-1', email, name: 'Admin' },
                token,
                message: 'Admin login successful'
            });
        }
        res.status(400).json(createErrorResponse('Invalid admin credentials', null, 'INVALID_CREDENTIALS'));
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json(createErrorResponse('Admin login failed', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/bookings', authenticateAdmin, async (req, res) => {
    try {
        const { status, service_id, customer_id, appointment_date_from, appointment_date_to, query: searchQuery, limit = 50, offset = 0, sort_by = 'appointment_date', sort_order = 'desc' } = req.query;
        let query = 'SELECT b.*, s.name as service_name FROM bookings b LEFT JOIN services s ON b.service_id = s.service_id LEFT JOIN users u ON b.user_id = u.user_id WHERE 1=1';
        const params = [];
        let paramCount = 1;
        if (customer_id) {
            query += ` AND (b.user_id = $${paramCount} OR 'guest-' || b.customer_email = $${paramCount})`;
            params.push(customer_id);
            paramCount++;
        }
        if (status) {
            query += ` AND b.status = $${paramCount++}`;
            params.push(status);
        }
        if (service_id) {
            query += ` AND b.service_id = $${paramCount++}`;
            params.push(service_id);
        }
        if (appointment_date_from) {
            query += ` AND b.appointment_date >= $${paramCount++}`;
            params.push(appointment_date_from);
        }
        if (appointment_date_to) {
            query += ` AND b.appointment_date <= $${paramCount++}`;
            params.push(appointment_date_to);
        }
        if (searchQuery) {
            query += ` AND (b.ticket_number ILIKE $${paramCount} OR b.customer_name ILIKE $${paramCount} OR b.customer_phone ILIKE $${paramCount} OR b.customer_email ILIKE $${paramCount})`;
            params.push(`%${searchQuery}%`);
            paramCount++;
        }
        const validSortFields = ['appointment_date', 'appointment_time', 'customer_name', 'ticket_number', 'created_at', 'status'];
        const sortField = validSortFields.includes(String(sort_by)) ? String(sort_by) : 'appointment_date';
        const sortOrderStr = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY b.${sortField} ${sortOrderStr}`;
        query += `, b.appointment_time ${sortOrderStr}`;
        query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parseInt(String(limit)), parseInt(String(offset)));
        const result = await pool.query(query, params);
        let countQuery = 'SELECT COUNT(*) as total FROM bookings b LEFT JOIN users u ON b.user_id = u.user_id WHERE 1=1';
        const countParams = [];
        let countParamNum = 1;
        if (customer_id) {
            countQuery += ` AND (b.user_id = $${countParamNum} OR 'guest-' || b.customer_email = $${countParamNum})`;
            countParams.push(customer_id);
            countParamNum++;
        }
        if (status) {
            countQuery += ` AND b.status = $${countParamNum++}`;
            countParams.push(status);
        }
        if (service_id) {
            countQuery += ` AND b.service_id = $${countParamNum++}`;
            countParams.push(service_id);
        }
        if (appointment_date_from) {
            countQuery += ` AND b.appointment_date >= $${countParamNum++}`;
            countParams.push(appointment_date_from);
        }
        if (appointment_date_to) {
            countQuery += ` AND b.appointment_date <= $${countParamNum++}`;
            countParams.push(appointment_date_to);
        }
        if (searchQuery) {
            countQuery += ` AND (b.ticket_number ILIKE $${countParamNum} OR b.customer_name ILIKE $${countParamNum} OR b.customer_phone ILIKE $${countParamNum} OR b.customer_email ILIKE $${countParamNum})`;
            countParams.push(`%${searchQuery}%`);
            countParamNum++;
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        res.json({ bookings: result.rows, total });
    }
    catch (error) {
        console.error('Admin get bookings error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve bookings', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/admin/bookings', authenticateAdmin, async (req, res) => {
    try {
        const { appointment_date, appointment_time, customer_name, customer_email, customer_phone, service_id, special_request, admin_notes } = req.body;
        const dateStr = appointment_date.replace(/-/g, '');
        const maxSeqResult = await pool.query("SELECT MAX(CAST(SUBSTRING(ticket_number FROM 14) AS INTEGER)) as max_seq FROM bookings WHERE ticket_number LIKE $1", [`TKT-${dateStr}-%`]);
        const maxSeq = maxSeqResult.rows[0].max_seq || 0;
        const ticketNumber = `TKT-${dateStr}-${String(maxSeq + 1).padStart(3, '0')}`;
        const booking_id = uuidv4();
        const now = new Date().toISOString();
        const result = await pool.query(`INSERT INTO bookings (
        booking_id, ticket_number, status, appointment_date, appointment_time,
        slot_duration, customer_name, customer_email, customer_phone,
        service_id, special_request, admin_notes, created_at, updated_at, confirmed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $13)
      RETURNING *`, [
            booking_id, ticketNumber, 'confirmed', appointment_date, appointment_time,
            40, customer_name, customer_email, customer_phone,
            service_id, special_request, admin_notes, now
        ]);
        res.status(201).json({ booking: result.rows[0], message: 'Manual booking created successfully' });
    }
    catch (error) {
        console.error('Create manual booking error:', error);
        res.status(500).json(createErrorResponse('Failed to create manual booking', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/services', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services ORDER BY display_order ASC');
        const services = result.rows.map(service => ({
            ...service,
            price: service.price ? parseFloat(service.price) : null
        }));
        res.json({ services });
    }
    catch (error) {
        console.error('Admin get services error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve services', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/admin/services', authenticateAdmin, async (req, res) => {
    try {
        const validationResult = createServiceInputSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json(createErrorResponse('Validation failed', validationResult.error, 'VALIDATION_ERROR'));
        }
        const { name, description, image_url, duration = 40, price, is_active = true, display_order = 0 } = validationResult.data;
        const service_id = uuidv4();
        const now = new Date().toISOString();
        const result = await pool.query(`INSERT INTO services (service_id, name, description, image_url, duration, price, is_active, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING *`, [service_id, name, description, image_url, duration, price, is_active, display_order, now]);
        res.status(201).json({ service: result.rows[0], message: 'Service created successfully' });
    }
    catch (error) {
        console.error('Create service error:', error);
        res.status(500).json(createErrorResponse('Failed to create service', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/admin/services/:service_id', authenticateAdmin, async (req, res) => {
    try {
        const { service_id } = req.params;
        const updates = [];
        const params = [];
        let paramCount = 1;
        const allowedFields = ['name', 'description', 'image_url', 'duration', 'price', 'is_active', 'display_order'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramCount++}`);
                params.push(req.body[field]);
            }
        });
        if (updates.length === 0) {
            return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATES'));
        }
        const now = new Date().toISOString();
        updates.push(`updated_at = $${paramCount++}`);
        params.push(now);
        params.push(service_id);
        const result = await pool.query(`UPDATE services SET ${updates.join(', ')} WHERE service_id = $${paramCount} RETURNING *`, params);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Service not found', null, 'NOT_FOUND'));
        }
        res.json({ service: result.rows[0], message: 'Service updated successfully' });
    }
    catch (error) {
        console.error('Update service error:', error);
        res.status(500).json(createErrorResponse('Failed to update service', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/capacity-overrides', authenticateAdmin, async (req, res) => {
    try {
        const { override_date_from, override_date_to } = req.query;
        let query = 'SELECT * FROM capacity_overrides WHERE is_active = TRUE';
        const params = [];
        let paramCount = 1;
        if (override_date_from) {
            query += ` AND override_date >= $${paramCount++}`;
            params.push(override_date_from);
        }
        if (override_date_to) {
            query += ` AND override_date <= $${paramCount++}`;
            params.push(override_date_to);
        }
        query += ' ORDER BY override_date ASC, time_slot ASC';
        const result = await pool.query(query, params);
        res.json({ overrides: result.rows });
    }
    catch (error) {
        console.error('Get capacity overrides error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve capacity overrides', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/admin/capacity-overrides', authenticateAdmin, async (req, res) => {
    try {
        const validationResult = createCapacityOverrideInputSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json(createErrorResponse('Validation failed', validationResult.error, 'VALIDATION_ERROR'));
        }
        const { override_date, time_slot, capacity, is_active = true } = validationResult.data;
        const override_id = uuidv4();
        const now = new Date().toISOString();
        const result = await pool.query(`INSERT INTO capacity_overrides (override_id, override_date, time_slot, capacity, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`, [override_id, override_date, time_slot, capacity, is_active, now]);
        res.status(201).json({ override: result.rows[0], message: 'Capacity override created successfully' });
    }
    catch (error) {
        console.error('Create capacity override error:', error);
        res.status(500).json(createErrorResponse('Failed to create capacity override', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/admin/capacity-overrides/:override_id', authenticateAdmin, async (req, res) => {
    try {
        const { override_id } = req.params;
        const { override_date, time_slot, capacity, is_active } = req.body;
        const updates = [];
        const params = [];
        let paramCount = 1;
        if (override_date !== undefined) {
            updates.push(`override_date = $${paramCount++}`);
            params.push(override_date);
        }
        if (time_slot !== undefined) {
            updates.push(`time_slot = $${paramCount++}`);
            params.push(time_slot);
        }
        if (capacity !== undefined) {
            updates.push(`capacity = $${paramCount++}`);
            params.push(capacity);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            params.push(is_active);
        }
        if (updates.length === 0) {
            return res.status(400).json(createErrorResponse('No fields to update', null, 'VALIDATION_ERROR'));
        }
        updates.push(`updated_at = $${paramCount++}`);
        params.push(new Date().toISOString());
        params.push(override_id);
        const result = await pool.query(`UPDATE capacity_overrides SET ${updates.join(', ')} WHERE override_id = $${paramCount} RETURNING *`, params);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Override not found', null, 'NOT_FOUND'));
        }
        res.json({ override: result.rows[0], message: 'Capacity override updated successfully' });
    }
    catch (error) {
        console.error('Update capacity override error:', error);
        res.status(500).json(createErrorResponse('Failed to update capacity override', error, 'INTERNAL_ERROR'));
    }
});
app.delete('/api/admin/capacity-overrides/:override_id', authenticateAdmin, async (req, res) => {
    try {
        const { override_id } = req.params;
        const result = await pool.query('DELETE FROM capacity_overrides WHERE override_id = $1 RETURNING *', [override_id]);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Override not found', null, 'NOT_FOUND'));
        }
        res.json({ message: 'Capacity override deleted successfully' });
    }
    catch (error) {
        console.error('Delete capacity override error:', error);
        res.status(500).json(createErrorResponse('Failed to delete capacity override', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/blocked-slots', authenticateAdmin, async (req, res) => {
    try {
        const { block_date_from, block_date_to } = req.query;
        res.json({
            blocked_slots: [],
            total: 0
        });
    }
    catch (error) {
        console.error('Get blocked slots error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve blocked slots', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/customers', authenticateAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, sort_by = 'total_bookings', sort_order = 'desc', type, search } = req.query;
        let query = `
      SELECT 
        COALESCE(u.user_id, 'guest-' || b.customer_email) as customer_id,
        COALESCE(u.email, b.customer_email) as email,
        COALESCE(u.name, b.customer_name) as name,
        COALESCE(u.phone, b.customer_phone) as phone,
        CASE WHEN u.user_id IS NOT NULL THEN 'registered' ELSE 'guest' END as customer_type,
        u.is_verified,
        COUNT(b.booking_id) as total_bookings,
        SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
        SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
        MAX(b.appointment_date) as last_booking_date,
        MIN(b.created_at) as first_booking_date
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;
        if (type === 'registered') {
            query += ` AND u.user_id IS NOT NULL`;
        }
        else if (type === 'guest') {
            query += ` AND u.user_id IS NULL`;
        }
        query += ` GROUP BY u.user_id, u.email, u.name, u.phone, u.is_verified, b.customer_email, b.customer_name, b.customer_phone`;
        if (search) {
            query += ` HAVING (COALESCE(u.name, b.customer_name) ILIKE $${paramCount} OR COALESCE(u.email, b.customer_email) ILIKE $${paramCount} OR COALESCE(u.phone, b.customer_phone) ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }
        const validSortFields = {
            'name': 'COALESCE(u.name, b.customer_name)',
            'email': 'COALESCE(u.email, b.customer_email)',
            'total_bookings': 'total_bookings',
            'last_booking_date': 'last_booking_date',
            'first_booking_date': 'first_booking_date'
        };
        const sortField = validSortFields[String(sort_by)] || validSortFields['total_bookings'];
        const sortOrderStr = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortField} ${sortOrderStr}`;
        query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parseInt(String(limit)), parseInt(String(offset)));
        const result = await pool.query(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT 
          COALESCE(u.user_id, 'guest-' || b.customer_email) as customer_id,
          COALESCE(u.name, b.customer_name) as name,
          COALESCE(u.email, b.customer_email) as email,
          COALESCE(u.phone, b.customer_phone) as phone
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.user_id
        WHERE 1=1
    `;
        if (type === 'registered') {
            countQuery += ` AND u.user_id IS NOT NULL`;
        }
        else if (type === 'guest') {
            countQuery += ` AND u.user_id IS NULL`;
        }
        countQuery += ` GROUP BY u.user_id, u.email, u.name, u.phone, b.customer_email, b.customer_name, b.customer_phone`;
        if (search) {
            countQuery += ` HAVING (COALESCE(u.name, b.customer_name) ILIKE '%${String(search)}%' OR COALESCE(u.email, b.customer_email) ILIKE '%${String(search)}%' OR COALESCE(u.phone, b.customer_phone) ILIKE '%${String(search)}%')`;
        }
        countQuery += `) as subquery`;
        const countResult = await pool.query(countQuery);
        const total = parseInt(countResult.rows[0].total);
        res.json({
            customers: result.rows.map(row => ({
                ...row,
                total_bookings: parseInt(row.total_bookings),
                completed_bookings: parseInt(row.completed_bookings),
                cancelled_bookings: parseInt(row.cancelled_bookings)
            })),
            total
        });
    }
    catch (error) {
        console.error('Admin get customers error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve customers', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/customers/:customer_id/notes', authenticateAdmin, async (req, res) => {
    try {
        const { customer_id } = req.params;
        await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_notes (
        note_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
        const result = await pool.query('SELECT * FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC', [customer_id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Get customer notes error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve notes', error, 'INTERNAL_ERROR'));
    }
});
app.post('/api/admin/customers/:customer_id/notes', authenticateAdmin, async (req, res) => {
    try {
        const { customer_id } = req.params;
        const { note_text } = req.body;
        const admin = req.admin;
        if (!note_text || note_text.trim().length === 0) {
            return res.status(400).json(createErrorResponse('Note text is required', null, 'MISSING_FIELD'));
        }
        await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_notes (
        note_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
        const note_id = uuidv4();
        const now = new Date().toISOString();
        const created_by = admin.email || 'Admin';
        const result = await pool.query(`INSERT INTO customer_notes (note_id, customer_id, note_text, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`, [note_id, customer_id, note_text.trim(), created_by, now]);
        res.status(201).json({
            note: result.rows[0],
            message: 'Note added successfully'
        });
    }
    catch (error) {
        console.error('Add customer note error:', error);
        res.status(500).json(createErrorResponse('Failed to add note', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/admin/customers/:customer_id/notes/:note_id', authenticateAdmin, async (req, res) => {
    try {
        const { customer_id, note_id } = req.params;
        const { note_text } = req.body;
        if (!note_text || note_text.trim().length === 0) {
            return res.status(400).json(createErrorResponse('Note text is required', null, 'MISSING_FIELD'));
        }
        const now = new Date().toISOString();
        const result = await pool.query(`UPDATE customer_notes
       SET note_text = $1, updated_at = $2
       WHERE note_id = $3 AND customer_id = $4
       RETURNING *`, [note_text.trim(), now, note_id, customer_id]);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Note not found', null, 'NOT_FOUND'));
        }
        res.json({
            note: result.rows[0],
            message: 'Note updated successfully'
        });
    }
    catch (error) {
        console.error('Update customer note error:', error);
        res.status(500).json(createErrorResponse('Failed to update note', error, 'INTERNAL_ERROR'));
    }
});
app.delete('/api/admin/customers/:customer_id/notes/:note_id', authenticateAdmin, async (req, res) => {
    try {
        const { customer_id, note_id } = req.params;
        const result = await pool.query('DELETE FROM customer_notes WHERE note_id = $1 AND customer_id = $2 RETURNING *', [note_id, customer_id]);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Note not found', null, 'NOT_FOUND'));
        }
        res.json({
            message: 'Note deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete customer note error:', error);
        res.status(500).json(createErrorResponse('Failed to delete note', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/customers/:customer_id', authenticateAdmin, async (req, res) => {
    try {
        const { customer_id } = req.params;
        let query = `
      SELECT 
        COALESCE(u.user_id, 'guest-' || b.customer_email) as customer_id,
        COALESCE(u.email, b.customer_email) as email,
        COALESCE(u.name, b.customer_name) as name,
        COALESCE(u.phone, b.customer_phone) as phone,
        CASE WHEN u.user_id IS NOT NULL THEN true ELSE false END as is_registered,
        COUNT(b.booking_id) as total_bookings,
        SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
        SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
        SUM(CASE WHEN b.status = 'no_show' THEN 1 ELSE 0 END) as no_shows,
        MAX(b.appointment_date) as last_booking_date,
        MIN(b.created_at) as created_at
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE COALESCE(u.user_id, 'guest-' || b.customer_email) = $1
      GROUP BY u.user_id, u.email, u.name, u.phone, b.customer_email, b.customer_name, b.customer_phone
    `;
        const result = await pool.query(query, [customer_id]);
        if (result.rows.length === 0) {
            return res.status(404).json(createErrorResponse('Customer not found', null, 'NOT_FOUND'));
        }
        const customer = {
            ...result.rows[0],
            total_bookings: parseInt(result.rows[0].total_bookings),
            completed_bookings: parseInt(result.rows[0].completed_bookings),
            cancelled_bookings: parseInt(result.rows[0].cancelled_bookings),
            no_shows: parseInt(result.rows[0].no_shows || 0)
        };
        res.json(customer);
    }
    catch (error) {
        console.error('Get customer detail error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve customer', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/dashboard/stats', authenticateAdmin, async (req, res) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayBookings = await pool.query("SELECT COUNT(*) as count, status FROM bookings WHERE appointment_date = $1 GROUP BY status", [todayStr]);
        const stats = {
            today_bookings: 0,
            today_completed: 0,
            today_upcoming: 0,
            week_bookings: 0,
            week_cancelled: 0,
            month_no_shows: 0
        };
        todayBookings.rows.forEach(row => {
            const count = parseInt(row.count);
            stats.today_bookings += count;
            if (row.status === 'completed')
                stats.today_completed = count;
            if (row.status === 'confirmed')
                stats.today_upcoming = count;
        });
        res.json(stats);
    }
    catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve dashboard stats', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/reports/bookings', authenticateAdmin, async (req, res) => {
    try {
        const { start_date, end_date, group_by = 'service', service_id, status } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json(createErrorResponse('start_date and end_date are required', null, 'MISSING_DATES'));
        }
        let query = `
      SELECT 
        b.*,
        s.name as service_name,
        s.price as service_price
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      WHERE b.appointment_date >= $1 AND b.appointment_date <= $2
    `;
        const params = [start_date, end_date];
        let paramCount = 3;
        if (service_id) {
            query += ` AND b.service_id = $${paramCount++}`;
            params.push(service_id);
        }
        if (status) {
            query += ` AND b.status = $${paramCount++}`;
            params.push(status);
        }
        const result = await pool.query(query, params);
        const bookings = result.rows;
        const totalBookings = bookings.length;
        const completed = bookings.filter(b => b.status === 'completed').length;
        const cancelled = bookings.filter(b => b.status === 'cancelled').length;
        const noShows = bookings.filter(b => b.status === 'no_show').length;
        const showUpRate = (completed + noShows) > 0 ? (completed / (completed + noShows)) * 100 : 0;
        let totalRevenue = null;
        const completedBookings = bookings.filter(b => b.status === 'completed');
        if (completedBookings.length > 0) {
            totalRevenue = completedBookings.reduce((sum, b) => {
                const price = b.service_price ? parseFloat(b.service_price) : 0;
                return sum + price;
            }, 0);
        }
        const byService = {};
        bookings.forEach(b => {
            const serviceName = b.service_name || 'No Service';
            if (!byService[serviceName]) {
                byService[serviceName] = { service_name: serviceName, count: 0 };
            }
            byService[serviceName].count++;
        });
        const byDayOfWeek = {
            'Sunday': { day: 'Sunday', count: 0 },
            'Monday': { day: 'Monday', count: 0 },
            'Tuesday': { day: 'Tuesday', count: 0 },
            'Wednesday': { day: 'Wednesday', count: 0 },
            'Thursday': { day: 'Thursday', count: 0 },
            'Friday': { day: 'Friday', count: 0 },
            'Saturday': { day: 'Saturday', count: 0 }
        };
        bookings.forEach(b => {
            const date = new Date(b.appointment_date);
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[date.getDay()];
            byDayOfWeek[dayName].count++;
        });
        const byTimeSlot = {};
        bookings.forEach(b => {
            const time = b.appointment_time;
            if (!byTimeSlot[time]) {
                const date = new Date(b.appointment_date);
                const dayOfWeek = date.getDay();
                const isMondayToWednesday = [1, 2, 3].includes(dayOfWeek);
                const capacity = isMondayToWednesday ? 2 : 3;
                byTimeSlot[time] = { time, count: 0, total_capacity: capacity };
            }
            byTimeSlot[time].count++;
        });
        res.json({
            total_bookings: totalBookings,
            completed,
            cancelled,
            no_shows: noShows,
            show_up_rate: showUpRate,
            total_revenue: totalRevenue,
            by_service: Object.values(byService),
            by_day_of_week: Object.values(byDayOfWeek).filter(d => d.count > 0),
            by_time_slot: Object.values(byTimeSlot)
        });
    }
    catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve reports', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/reports/export', authenticateAdmin, async (req, res) => {
    try {
        const { start_date, end_date, fields, format = 'csv' } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json(createErrorResponse('start_date and end_date are required', null, 'MISSING_DATES'));
        }
        if (format !== 'csv') {
            return res.status(400).json(createErrorResponse('Only CSV format is supported', null, 'UNSUPPORTED_FORMAT'));
        }
        const requestedFields = fields ? String(fields).split(',') : [
            'ticket_number', 'customer_name', 'customer_email', 'customer_phone',
            'appointment_date', 'appointment_time', 'service_name', 'status', 'special_request'
        ];
        const query = `
      SELECT 
        b.*,
        s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      WHERE b.appointment_date >= $1 AND b.appointment_date <= $2
      ORDER BY b.appointment_date ASC, b.appointment_time ASC
    `;
        const result = await pool.query(query, [start_date, end_date]);
        const bookings = result.rows;
        const fieldMapping = {
            'ticket_number': 'Ticket Number',
            'customer_name': 'Customer Name',
            'customer_email': 'Customer Email',
            'customer_phone': 'Customer Phone',
            'appointment_date': 'Date',
            'appointment_time': 'Time',
            'service_name': 'Service',
            'status': 'Status',
            'special_request': 'Special Request',
            'admin_notes': 'Admin Notes'
        };
        const csvHeaders = requestedFields.map(field => fieldMapping[field] || field).join(',');
        const csvRows = bookings.map(booking => {
            return requestedFields.map(field => {
                let value = booking[field] || '';
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        const csv = [csvHeaders, ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bookings_${start_date}_${end_date}.csv"`);
        res.send(csv);
    }
    catch (error) {
        console.error('Export reports error:', error);
        res.status(500).json(createErrorResponse('Failed to export reports', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = {
            shop_name: 'Master Fade',
            shop_address: '13 Synnott Pl, Phibsborough, Dublin 7, D07 E7N5',
            shop_phone: '+353833276229',
            shop_email: 'info@masterfade.ie',
            operating_hours: '10:00 AM - 3:00 PM',
            capacity_mon_wed: 2,
            capacity_thu_sun: 3,
            booking_window_days: 90,
            same_day_cutoff_hours: 2,
            reminder_hours_before: 2,
            services_enabled: true,
            gallery_enabled: true,
            social_facebook: '',
            social_instagram: '',
            social_twitter: ''
        };
        res.json(settings);
    }
    catch (error) {
        console.error('Get admin settings error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve settings', error, 'INTERNAL_ERROR'));
    }
});
app.patch('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        const updatedSettings = {
            ...req.body,
        };
        res.json({
            ...updatedSettings,
            message: 'Settings updated successfully'
        });
    }
    catch (error) {
        console.error('Update admin settings error:', error);
        res.status(500).json(createErrorResponse('Failed to update settings', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/settings', async (req, res) => {
    try {
        const settings = {
            shop_name: 'Master Fade',
            shop_address: '13 Synnott Pl, Phibsborough, Dublin 7, D07 E7N5',
            shop_phone: '+353833276229',
            shop_email: 'info@masterfade.ie',
            operating_hours: '10:00 AM - 3:00 PM',
            capacity_mon_wed: 2,
            capacity_thu_sun: 3,
            booking_window_days: 90,
            same_day_cutoff_hours: 2,
            reminder_hours_before: 2,
            services_enabled: true,
            gallery_enabled: true,
            social_facebook: '',
            social_instagram: '',
            social_twitter: ''
        };
        res.json(settings);
    }
    catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve settings', error, 'INTERNAL_ERROR'));
    }
});
app.get('/api/gallery', async (req, res) => {
    try {
        const { limit = 20, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const mockGalleryImages = [
            {
                image_id: 'img-1',
                image_url: 'https://picsum.photos/seed/haircut1/800/600',
                thumbnail_url: 'https://picsum.photos/seed/haircut1/400/300',
                caption: 'Classic Haircut',
                service_id: null,
                display_order: 1,
                uploaded_at: new Date().toISOString()
            },
            {
                image_id: 'img-2',
                image_url: 'https://picsum.photos/seed/balayage2/800/600',
                thumbnail_url: 'https://picsum.photos/seed/balayage2/400/300',
                caption: 'Balayage Style',
                service_id: null,
                display_order: 2,
                uploaded_at: new Date().toISOString()
            },
            {
                image_id: 'img-3',
                image_url: 'https://picsum.photos/seed/color3/800/600',
                thumbnail_url: 'https://picsum.photos/seed/color3/400/300',
                caption: 'Color Treatment',
                service_id: null,
                display_order: 3,
                uploaded_at: new Date().toISOString()
            },
            {
                image_id: 'img-4',
                image_url: 'https://picsum.photos/seed/keratin4/800/600',
                thumbnail_url: 'https://picsum.photos/seed/keratin4/400/300',
                caption: 'Keratin Treatment',
                service_id: null,
                display_order: 4,
                uploaded_at: new Date().toISOString()
            },
            {
                image_id: 'img-5',
                image_url: 'https://picsum.photos/seed/conditioning5/800/600',
                thumbnail_url: 'https://picsum.photos/seed/conditioning5/400/300',
                caption: 'Deep Conditioning',
                service_id: null,
                display_order: 5,
                uploaded_at: new Date().toISOString()
            },
            {
                image_id: 'img-6',
                image_url: 'https://picsum.photos/seed/bridal6/800/600',
                thumbnail_url: 'https://picsum.photos/seed/bridal6/400/300',
                caption: 'Bridal Hair',
                service_id: null,
                display_order: 6,
                uploaded_at: new Date().toISOString()
            }
        ];
        const limitNum = parseInt(String(limit));
        const offsetNum = parseInt(String(offset));
        const slicedImages = mockGalleryImages.slice(offsetNum, offsetNum + limitNum);
        res.json({
            images: slicedImages,
            total: mockGalleryImages.length,
            limit: limitNum,
            offset: offsetNum
        });
    }
    catch (error) {
        console.error('Get gallery error:', error);
        res.status(500).json(createErrorResponse('Failed to retrieve gallery images', error, 'INTERNAL_ERROR'));
    }
});
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json(createErrorResponse('API endpoint not found', null, 'NOT_FOUND'));
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
export { app, pool };
const portNumber = typeof PORT === 'string' ? parseInt(PORT) : PORT;
app.listen(portNumber, '0.0.0.0', () => {
    console.log(`Server running on port ${portNumber} and listening on 0.0.0.0`);
});
//# sourceMappingURL=server.js.map