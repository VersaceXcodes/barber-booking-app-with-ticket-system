// tests/setup.ts
import { Pool } from 'pg';
import { app, pool } from '../server';

// Global setup - runs once before all tests
beforeAll(async () => {
  // Ensure test database is clean
  await pool.query('BEGIN');
});

// Global teardown - runs once after all tests
afterAll(async () => {
  await pool.query('ROLLBACK');
  await pool.end();
});

// Setup before each test
beforeEach(async () => {
  // Start transaction for test isolation
  await pool.query('BEGIN');
});

// Teardown after each test
afterEach(async () => {
  // Rollback transaction to clean state
  await pool.query('ROLLBACK');
});

// tests/helpers/test-utils.ts
import request from 'supertest';
import { app } from '../server';
import { v4 as uuidv4 } from 'uuid';

export const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: `test-${uuidv4()}@example.com`,
    password: 'password123',
    name: 'Test User',
    phone: '+15551234567',
    ...overrides
  };

  const response = await request(app)
    .post('/api/auth/register')
    .send(defaultUser);

  return {
    user: response.body.user,
    password: defaultUser.password
  };
};

export const loginUser = async (email: string, password: string) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return response.body.token;
};

export const createTestBooking = async (overrides = {}) => {
  const defaultBooking = {
    appointment_date: '2024-04-25',
    appointment_time: '10:00',
    customer_name: 'John Doe',
    customer_email: `test-${uuidv4()}@example.com`,
    customer_phone: '+15559876543',
    service_id: 'service_001',
    ...overrides
  };

  const response = await request(app)
    .post('/api/bookings')
    .send(defaultBooking);

  return response.body.booking;
};

export const createTestService = async (token: string, overrides = {}) => {
  const defaultService = {
    name: `Test Service ${uuidv4()}`,
    description: 'Test service description',
    duration: 40,
    price: 50.00,
    is_active: true,
    display_order: 1,
    ...overrides
  };

  const response = await request(app)
    .post('/api/admin/services')
    .set('Authorization', `Bearer ${token}`)
    .send(defaultService);

  return response.body.service;
};

// tests/integration/auth/register.test.ts
import request from 'supertest';
import { app, pool } from '../../server';

describe('POST /api/auth/register', () => {
  it('should register a new user with valid data', async () => {
    const userData = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
      phone: '+15551234567'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      is_verified: false
    });
    expect(response.body.user).toHaveProperty('user_id');
    expect(response.body.user).not.toHaveProperty('password_hash');
  });

  it('should store password as plain text (dev/test only)', async () => {
    const userData = {
      email: 'plaintext@example.com',
      password: 'mypassword123',
      name: 'Plain Text User',
      phone: '+15551234567'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData);

    // Verify password stored as plain text
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [userData.email]
    );

    expect(result.rows[0].password_hash).toBe('mypassword123');
  });

  it('should return 409 if email already exists', async () => {
    const userData = {
      email: 'duplicate@example.com',
      password: 'password123',
      name: 'First User',
      phone: '+15551234567'
    };

    // Create first user
    await request(app)
      .post('/api/auth/register')
      .send(userData);

    // Try to create duplicate
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should return 400 for invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
        phone: '+15551234567'
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for weak password', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
        phone: '+15551234567'
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid phone format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        phone: '123' // Invalid
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should generate verification token', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'verify@example.com',
        password: 'password123',
        name: 'Verify User',
        phone: '+15551234567'
      });

    const result = await pool.query(
      'SELECT verification_token, verification_token_expiry FROM users WHERE email = $1',
      ['verify@example.com']
    );

    expect(result.rows[0].verification_token).toBeTruthy();
    expect(result.rows[0].verification_token_expiry).toBeTruthy();
  });
});

// tests/integration/auth/login.test.ts
import request from 'supertest';
import { app, pool } from '../../server';
import { createTestUser } from '../../helpers/test-utils';

describe('POST /api/auth/login', () => {
  it('should login with valid credentials (plain text password)', async () => {
    const { user, password } = await createTestUser({
      email: 'login@example.com',
      password: 'password123'
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe('login@example.com');
  });

  it('should compare passwords as plain text (no bcrypt)', async () => {
    // Create user with known plain text password
    await pool.query(
      `INSERT INTO users (user_id, email, password_hash, name, phone, is_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      ['test-user-1', 'plaintext@test.com', 'mypassword', 'Test', '+15551234567', true, new Date().toISOString()]
    );

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'plaintext@test.com',
        password: 'mypassword'
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
  });

  it('should return 401 for incorrect password', async () => {
    await createTestUser({
      email: 'wrong@example.com',
      password: 'correctpassword'
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 for non-existent user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'notexist@example.com',
        password: 'password123'
      })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should allow login for unverified users', async () => {
    await createTestUser({
      email: 'unverified@example.com',
      password: 'password123'
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'unverified@example.com',
        password: 'password123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
  });

  it('should return JWT token with correct payload', async () => {
    const { user } = await createTestUser({
      email: 'jwt@example.com',
      password: 'password123'
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jwt@example.com',
        password: 'password123'
      });

    const token = response.body.token;
    expect(token).toBeTruthy();
    
    // Decode JWT (without verification for testing)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload).toHaveProperty('user_id');
    expect(payload).toHaveProperty('email');
  });
});

// tests/integration/bookings/create.test.ts
import request from 'supertest';
import { app, pool } from '../../server';
import { createTestUser, loginUser } from '../../helpers/test-utils';

describe('POST /api/bookings', () => {
  it('should create guest booking without authentication', async () => {
    const bookingData = {
      appointment_date: '2024-05-01',
      appointment_time: '10:00',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+15551234567',
      service_id: 'service_001'
    };

    const response = await request(app)
      .post('/api/bookings')
      .send(bookingData)
      .expect(201);

    expect(response.body.booking).toMatchObject({
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      user_id: null, // Guest booking
      status: 'pending'
    });
    expect(response.body.booking.ticket_number).toMatch(/^TKT-\d{8}-\d{3}$/);
  });

  it('should create user booking with authentication', async () => {
    const { user } = await createTestUser();
    const token = await loginUser(user.email, 'password123');

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointment_date: '2024-05-01',
        appointment_time: '11:00',
        customer_name: user.name,
        customer_email: user.email,
        customer_phone: user.phone,
        service_id: 'service_001'
      })
      .expect(201);

    expect(response.body.booking.user_id).toBe(user.user_id);
  });

  it('should validate slot availability before creating', async () => {
    // Create 3 bookings for same slot (assuming capacity is 3)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/bookings')
        .send({
          appointment_date: '2024-05-02',
          appointment_time: '14:00',
          customer_name: `Customer ${i}`,
          customer_email: `customer${i}@example.com`,
          customer_phone: `+1555123456${i}`,
          service_id: 'service_001'
        });
    }

    // Try to book 4th slot (should fail)
    const response = await request(app)
      .post('/api/bookings')
      .send({
        appointment_date: '2024-05-02',
        appointment_time: '14:00',
        customer_name: 'Customer 4',
        customer_email: 'customer4@example.com',
        customer_phone: '+15551234564',
        service_id: 'service_001'
      })
      .expect(409);

    expect(response.body.error.code).toBe('SLOT_FULL');
  });

  it('should prevent booking within cutoff time', async () => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const dateStr = oneHourFromNow.toISOString().split('T')[0];
    const timeStr = oneHourFromNow.toTimeString().substring(0, 5);

    const response = await request(app)
      .post('/api/bookings')
      .send({
        appointment_date: dateStr,
        appointment_time: timeStr,
        customer_name: 'Late Booker',
        customer_email: 'late@example.com',
        customer_phone: '+15551234567',
        service_id: 'service_001'
      })
      .expect(400);

    expect(response.body.error.code).toBe('CUTOFF_VIOLATION');
  });

  it('should generate unique ticket numbers', async () => {
    const bookings = [];
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          appointment_date: '2024-05-03',
          appointment_time: '10:00',
          customer_name: `Customer ${i}`,
          customer_email: `unique${i}@example.com`,
          customer_phone: `+1555123456${i}`,
          service_id: 'service_001'
        });
      bookings.push(response.body.booking.ticket_number);
    }

    const uniqueTickets = new Set(bookings);
    expect(uniqueTickets.size).toBe(5);
  });

  it('should handle special requests and inspiration photos', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        appointment_date: '2024-05-04',
        appointment_time: '10:00',
        customer_name: 'Special Customer',
        customer_email: 'special@example.com',
        customer_phone: '+15551234567',
        service_id: 'service_001',
        special_request: 'Low fade, sensitive skin',
        inspiration_photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']
      })
      .expect(201);

    expect(response.body.booking.special_request).toBe('Low fade, sensitive skin');
    expect(response.body.booking.inspiration_photos).toHaveLength(2);
  });

  it('should handle booking for someone else', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        appointment_date: '2024-05-05',
        appointment_time: '10:00',
        customer_name: 'Parent Name',
        customer_email: 'parent@example.com',
        customer_phone: '+15551234567',
        booking_for_name: 'Child Name',
        service_id: 'service_012'
      })
      .expect(201);

    expect(response.body.booking.booking_for_name).toBe('Child Name');
  });

  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        appointment_date: '2024-05-06',
        // Missing time, name, email, phone
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid date format', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        appointment_date: '05/01/2024', // Wrong format
        appointment_time: '10:00',
        customer_name: 'Test',
        customer_email: 'test@example.com',
        customer_phone: '+15551234567'
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// tests/integration/bookings/search.test.ts
import request from 'supertest';
import { app } from '../../server';
import { createTestBooking } from '../../helpers/test-utils';

describe('GET /api/bookings/search', () => {
  it('should find booking by ticket number', async () => {
    const booking = await createTestBooking();

    const response = await request(app)
      .get('/api/bookings/search')
      .query({ ticket_number: booking.ticket_number })
      .expect(200);

    expect(response.body.bookings).toHaveLength(1);
    expect(response.body.bookings[0].ticket_number).toBe(booking.ticket_number);
  });

  it('should find bookings by phone and date', async () => {
    const phone = '+15551112233';
    const date = '2024-05-10';

    await createTestBooking({ customer_phone: phone, appointment_date: date });
    await createTestBooking({ customer_phone: phone, appointment_date: date });

    const response = await request(app)
      .get('/api/bookings/search')
      .query({ phone, date })
      .expect(200);

    expect(response.body.bookings.length).toBeGreaterThanOrEqual(2);
    response.body.bookings.forEach(booking => {
      expect(booking.customer_phone).toBe(phone);
      expect(booking.appointment_date).toBe(date);
    });
  });

  it('should return empty array if no bookings found', async () => {
    const response = await request(app)
      .get('/api/bookings/search')
      .query({ ticket_number: 'TKT-99999999-999' })
      .expect(200);

    expect(response.body.bookings).toHaveLength(0);
    expect(response.body.total).toBe(0);
  });

  it('should return 400 if neither search method provided', async () => {
    const response = await request(app)
      .get('/api/bookings/search')
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_SEARCH_PARAMS');
  });

  it('should return 400 if phone provided without date', async () => {
    const response = await request(app)
      .get('/api/bookings/search')
      .query({ phone: '+15551234567' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_SEARCH_PARAMS');
  });

  it('should be case-insensitive for ticket number', async () => {
    const booking = await createTestBooking();
    const lowerTicket = booking.ticket_number.toLowerCase();

    const response = await request(app)
      .get('/api/bookings/search')
      .query({ ticket_number: lowerTicket })
      .expect(200);

    expect(response.body.bookings).toHaveLength(1);
  });
});

// tests/integration/bookings/cancel.test.ts
import request from 'supertest';
import { app, pool } from '../../server';
import { createTestBooking } from '../../helpers/test-utils';

describe('PATCH /api/bookings/:ticket_number/cancel', () => {
  it('should cancel booking with valid reason', async () => {
    const booking = await createTestBooking({
      appointment_date: '2024-06-01',
      appointment_time: '10:00'
    });

    const response = await request(app)
      .patch(`/api/bookings/${booking.ticket_number}/cancel`)
      .send({
        cancellation_reason: 'Schedule changed'
      })
      .expect(200);

    expect(response.body.booking.status).toBe('cancelled');
    expect(response.body.booking.cancellation_reason).toBe('Schedule changed');
    expect(response.body.booking.cancelled_by).toBe('customer');
    expect(response.body.booking.cancelled_at).toBeTruthy();
  });

  it('should release slot capacity when cancelled', async () => {
    const booking = await createTestBooking({
      appointment_date: '2024-06-02',
      appointment_time: '11:00'
    });

    await request(app)
      .patch(`/api/bookings/${booking.ticket_number}/cancel`)
      .send({ cancellation_reason: 'Test' });

    // Check availability increased
    const availResponse = await request(app)
      .get('/api/availability/2024-06-02');

    const slot = availResponse.body.slots.find(s => s.time === '11:00');
    expect(slot.available_slots).toBeGreaterThan(0);
  });

  it('should return 409 if already cancelled', async () => {
    const booking = await createTestBooking();

    await request(app)
      .patch(`/api/bookings/${booking.ticket_number}/cancel`)
      .send({ cancellation_reason: 'First cancel' });

    const response = await request(app)
      .patch(`/api/bookings/${booking.ticket_number}/cancel`)
      .send({ cancellation_reason: 'Second cancel' })
      .expect(409);

    expect(response.body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('should return 404 for non-existent ticket', async () => {
    const response = await request(app)
      .patch('/api/bookings/TKT-99999999-999/cancel')
      .send({ cancellation_reason: 'Test' })
      .expect(404);

    expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('should return 400 if cancellation reason missing', async () => {
    const booking = await createTestBooking();

    const response = await request(app)
      .patch(`/api/bookings/${booking.ticket_number}/cancel`)
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// tests/integration/services/crud.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('Service Management', () => {
  describe('GET /api/services', () => {
    it('should return all active services', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);

      expect(Array.isArray(response.body.services)).toBe(true);
      response.body.services.forEach(service => {
        expect(service.is_active).toBe(true);
      });
    });

    it('should sort services by display_order', async () => {
      const response = await request(app)
        .get('/api/services')
        .query({ sort_by: 'display_order' });

      const orders = response.body.services.map(s => s.display_order);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/services')
        .query({ min_price: 50, max_price: 100 });

      response.body.services.forEach(service => {
        if (service.price !== null) {
          expect(service.price).toBeGreaterThanOrEqual(50);
          expect(service.price).toBeLessThanOrEqual(100);
        }
      });
    });
  });
});

// tests/integration/availability/calculate.test.ts
import request from 'supertest';
import { app, pool } from '../../server';
import { createTestBooking } from '../../helpers/test-utils';

describe('GET /api/availability/:date', () => {
  it('should return all time slots for date', async () => {
    const response = await request(app)
      .get('/api/availability/2024-06-15')
      .expect(200);

    expect(response.body.date).toBe('2024-06-15');
    expect(response.body.slots).toHaveLength(8);
    
    const times = response.body.slots.map(s => s.time);
    expect(times).toEqual(['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:20']);
  });

  it('should reflect day-of-week capacity rules', async () => {
    // Monday (capacity 2)
    const monday = await request(app).get('/api/availability/2024-06-17');
    expect(monday.body.slots[0].total_capacity).toBe(2);

    // Saturday (capacity 3)
    const saturday = await request(app).get('/api/availability/2024-06-22');
    expect(saturday.body.slots[0].total_capacity).toBe(3);
  });

  it('should reflect capacity overrides', async () => {
    // Create override
    await pool.query(
      `INSERT INTO capacity_overrides (override_id, override_date, time_slot, capacity, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      ['test-override', '2024-06-20', '10:00', 1, true, new Date().toISOString()]
    );

    const response = await request(app).get('/api/availability/2024-06-20');
    const slot = response.body.slots.find(s => s.time === '10:00');
    expect(slot.total_capacity).toBe(1);
  });

  it('should calculate available spots correctly', async () => {
    const date = '2024-06-25';
    const time = '10:00';

    // Create 2 bookings
    await createTestBooking({ appointment_date: date, appointment_time: time });
    await createTestBooking({ appointment_date: date, appointment_time: time });

    const response = await request(app).get(`/api/availability/${date}`);
    const slot = response.body.slots.find(s => s.time === time);
    
    expect(slot.booked_count).toBe(2);
    expect(slot.available_spots).toBe(slot.total_capacity - 2);
  });

  it('should mark fully booked slots', async () => {
    const date = '2024-06-26';
    const time = '14:00';

    // Fill slot to capacity (3)
    for (let i = 0; i < 3; i++) {
      await createTestBooking({
        appointment_date: date,
        appointment_time: time,
        customer_email: `test${i}@example.com`
      });
    }

    const response = await request(app).get(`/api/availability/${date}`);
    const slot = response.body.slots.find(s => s.time === time);
    
    expect(slot.is_available).toBe(false);
    expect(slot.status).toBe('full');
  });

  it('should return 400 for invalid date format', async () => {
    const response = await request(app)
      .get('/api/availability/invalid-date')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// tests/unit/ticket-generator.test.ts
import { generateTicketNumber } from '../utils/ticket-generator';
import { pool } from '../server';

describe('Ticket Number Generator', () => {
  it('should generate correct format', async () => {
    const ticket = await generateTicketNumber('2024-05-15', pool);
    expect(ticket).toMatch(/^TKT-20240515-\d{3}$/);
  });

  it('should increment sequence for same date', async () => {
    const date = '2024-05-20';
    const ticket1 = await generateTicketNumber(date, pool);
    const ticket2 = await generateTicketNumber(date, pool);

    const seq1 = parseInt(ticket1.split('-')[2]);
    const seq2 = parseInt(ticket2.split('-')[2]);
    expect(seq2).toBe(seq1 + 1);
  });

  it('should pad sequence  with zeros', async () => {
    const ticket = await generateTicketNumber('2024-05-25', pool);
    const sequence = ticket.split('-')[2];
    expect(sequence).toHaveLength(3);
    expect(sequence).toMatch(/^\d{3}$/);
  });
});

// tests/database/transactions.test.ts
import { pool } from '../server';

describe('Database Transactions', () => {
  it('should rollback on error', async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      await client.query(
        'INSERT INTO users (user_id, email, password_hash, name, phone, is_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)',
        ['test-tx-1', 'tx@test.com', 'pass', 'Test', '+15551234567', false, new Date().toISOString()]
      );
      
      // Force error with duplicate email
      await client.query(
        'INSERT INTO users (user_id, email, password_hash, name, phone, is_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)',
        ['test-tx-2', 'tx@test.com', 'pass', 'Test', '+15551234567', false, new Date().toISOString()]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Verify no data was inserted
    const result = await pool.query('SELECT * FROM users WHERE email = $1', ['tx@test.com']);
    expect(result.rows).toHaveLength(0);
  });

  it('should handle concurrent booking attempts', async () => {
    const date = '2024-06-30';
    const time = '10:00';

    // Simulate concurrent requests
    const bookings = await Promise.allSettled([
      createTestBooking({ appointment_date: date, appointment_time: time }),
      createTestBooking({ appointment_date: date, appointment_time: time }),
      createTestBooking({ appointment_date: date, appointment_time: time }),
      createTestBooking({ appointment_date: date, appointment_time: time })
    ]);

    const successful = bookings.filter(b => b.status === 'fulfilled');
    const failed = bookings.filter(b => b.status === 'rejected');

    expect(successful.length).toBeLessThanOrEqual(3); // Max capacity
    expect(failed.length).toBeGreaterThan(0);
  });
});

// tests/integration/admin/dashboard.test.ts
import request from 'supertest';
import { app, pool } from '../../server';
import { loginUser } from '../../helpers/test-utils';

describe('Admin Dashboard', () => {
  let adminToken: string;

  beforeAll(async () => {
    // Create admin user
    await pool.query(
      `INSERT INTO users (user_id, email, password_hash, name, phone, is_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      ['admin-1', 'admin@barberslot.com', 'admin123', 'Admin', '+15551234567', true, new Date().toISOString()]
    );
    
    adminToken = await loginUser('admin@barberslot.com', 'admin123');
  });

  describe('GET /api/admin/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('today_bookings');
      expect(response.body).toHaveProperty('week_bookings');
      expect(response.body).toHaveProperty('cancellation_rate');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/stats')
        .expect(401);
    });
  });

  describe('GET /api/admin/bookings', () => {
    it('should list all bookings with filters', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'pending' })
        .expect(200);

      expect(Array.isArray(response.body.bookings)).toBe(true);
      response.body.bookings.forEach(booking => {
        expect(booking.status).toBe('pending');
      });
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          appointment_date_from: '2024-04-01',
          appointment_date_to: '2024-04-30'
        });

      response.body.bookings.forEach(booking => {
        expect(booking.appointment_date >= '2024-04-01').toBe(true);
        expect(booking.appointment_date <= '2024-04-30').toBe(true);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 5, offset: 0 });

      expect(response.body.bookings.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination).toBeDefined();
    });
  });
});

// tests/integration/error-handling.test.ts
import request from 'supertest';
import { app } from '../server';

describe('Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/api/unknown')
      .expect(404);

    expect(response.body.error).toBeDefined();
  });

  it('should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send('{"invalid json}')
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('should sanitize error messages', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' })
      .expect(401);

    // Should not reveal if user exists
    expect(response.body.error.message).not.toContain('user not found');
  });

  it('should handle database errors gracefully', async () => {
    // Force database error by invalid query
    const response = await request(app)
      .get('/api/bookings/search')
      .query({ ticket_number: 'a'.repeat(1000) }) // Overly long
      .expect(500);

    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// tests/performance/response-time.test.ts
import request from 'supertest';
import { app } from '../server';

describe('Performance Tests', () => {
  it('should respond to availability check within 200ms', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/availability/2024-07-01')
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it('should handle 10 concurrent booking requests', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      request(app)
        .post('/api/bookings')
        .send({
          appointment_date: '2024-07-15',
          appointment_time: '10:00',
          customer_name: `User ${i}`,
          customer_email: `user${i}@test.com`,
          customer_phone: `+155512345${i.toString().padStart(2, '0')}`,
          service_id: 'service_001'
        })
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    expect(successful).toBeGreaterThan(0);
    expect(successful).toBeLessThanOrEqual(3); // Capacity limit
  });
});