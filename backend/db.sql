-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS capacity_overrides CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verification_token TEXT UNIQUE,
    verification_token_expiry TEXT,
    reset_token TEXT UNIQUE,
    reset_token_expiry TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Create services table
CREATE TABLE services (
    service_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    duration INTEGER NOT NULL DEFAULT 40,
    price NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Create bookings table
CREATE TABLE bookings (
    booking_id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    user_id TEXT,
    status TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    slot_duration INTEGER NOT NULL DEFAULT 40,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    booking_for_name TEXT,
    service_id TEXT,
    special_request TEXT,
    inspiration_photos JSONB,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    confirmed_at TEXT,
    reminder_sent_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    cancelled_by TEXT,
    admin_notes TEXT,
    original_booking_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL,
    FOREIGN KEY (original_booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
);

-- Create capacity_overrides table
CREATE TABLE capacity_overrides (
    override_id TEXT PRIMARY KEY,
    override_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_appointment_date ON bookings(appointment_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_ticket_number ON bookings(ticket_number);
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_capacity_overrides_date ON capacity_overrides(override_date);

-- Seed users table
INSERT INTO users (user_id, email, password_hash, name, phone, is_verified, verification_token, verification_token_expiry, reset_token, reset_token_expiry, created_at, updated_at) VALUES
('user_001', 'admin@beautysalon.com', 'admin123', 'Sarah Johnson', '+1-555-0101', true, NULL, NULL, NULL, NULL, '2024-01-15T08:00:00Z', '2024-01-15T08:00:00Z'),
('user_002', 'emily.chen@email.com', 'password123', 'Emily Chen', '+1-555-0102', true, NULL, NULL, NULL, NULL, '2024-01-20T10:30:00Z', '2024-01-20T10:30:00Z'),
('user_003', 'jessica.martinez@email.com', 'password123', 'Jessica Martinez', '+1-555-0103', true, NULL, NULL, NULL, NULL, '2024-02-01T14:15:00Z', '2024-02-01T14:15:00Z'),
('user_004', 'amanda.taylor@email.com', 'password123', 'Amanda Taylor', '+1-555-0104', false, 'verify_token_amanda_xyz789', '2024-12-31T23:59:59Z', NULL, NULL, '2024-02-10T09:45:00Z', '2024-02-10T09:45:00Z'),
('user_005', 'rachel.brown@email.com', 'password123', 'Rachel Brown', '+1-555-0105', true, NULL, NULL, NULL, NULL, '2024-02-15T11:20:00Z', '2024-02-15T11:20:00Z'),
('user_006', 'olivia.davis@email.com', 'password123', 'Olivia Davis', '+1-555-0106', true, NULL, NULL, NULL, NULL, '2024-03-01T16:00:00Z', '2024-03-01T16:00:00Z'),
('user_007', 'sophia.wilson@email.com', 'password123', 'Sophia Wilson', '+1-555-0107', false, 'verify_token_sophia_abc123', '2024-12-31T23:59:59Z', NULL, NULL, '2024-03-05T13:30:00Z', '2024-03-05T13:30:00Z'),
('user_008', 'isabella.moore@email.com', 'password123', 'Isabella Moore', '+1-555-0108', true, NULL, NULL, 'reset_token_isabella_def456', '2024-12-25T18:00:00Z', '2024-03-10T10:00:00Z', '2024-03-10T10:00:00Z');

-- Seed services table
INSERT INTO services (service_id, name, description, image_url, duration, price, is_active, display_order, created_at, updated_at) VALUES
('service_001', 'Classic Haircut', 'Professional haircut with wash and blow-dry. Perfect for maintaining your style or trying something new with expert consultation.', 'https://picsum.photos/seed/haircut1/800/600', 45, 65.00, true, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_002', 'Balayage Highlights', 'Hand-painted highlights for a natural, sun-kissed look. Includes toning and deep conditioning treatment.', 'https://picsum.photos/seed/balayage2/800/600', 180, 225.00, true, 2, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_003', 'Full Color Treatment', 'Complete color transformation with premium products. Includes consultation, color application, and styling.', 'https://picsum.photos/seed/color3/800/600', 150, 185.00, true, 3, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_004', 'Keratin Treatment', 'Smoothing treatment that eliminates frizz and adds shine for up to 3 months. Includes wash, treatment, and blow-dry.', 'https://picsum.photos/seed/keratin4/800/600', 120, 295.00, true, 4, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_005', 'Deep Conditioning', 'Intensive hydrating treatment for damaged or dry hair. Restores moisture and improves hair health.', 'https://picsum.photos/seed/conditioning5/800/600', 40, 55.00, true, 5, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_006', 'Bridal Updo', 'Elegant updo styling for your special day. Includes consultation, trial run option, and day-of styling.', 'https://picsum.photos/seed/bridal6/800/600', 90, 175.00, true, 6, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_007', 'Hair Extensions', 'Premium tape-in or clip-in extensions for length and volume. Includes application and styling.', 'https://picsum.photos/seed/extensions7/800/600', 120, 350.00, true, 7, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_008', 'Blow-Dry & Style', 'Professional wash, blow-dry, and styling. Perfect for special occasions or everyday glam.', 'https://picsum.photos/seed/blowdry8/800/600', 40, 45.00, true, 8, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_009', 'Root Touch-Up', 'Quick root color refresh to maintain your look between full color treatments.', 'https://picsum.photos/seed/roots9/800/600', 60, 85.00, true, 9, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_010', 'Perm Treatment', 'Create beautiful waves or curls with our modern perm techniques. Includes styling and aftercare kit.', 'https://picsum.photos/seed/perm10/800/600', 150, 195.00, true, 10, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_011', 'Scalp Treatment', 'Therapeutic scalp massage and treatment to promote healthy hair growth and relaxation.', 'https://picsum.photos/seed/scalp11/800/600', 30, 40.00, true, 11, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('service_012', 'Children''s Haircut', 'Gentle and fun haircut experience for kids under 12. Includes wash and simple styling.', 'https://picsum.photos/seed/kids12/800/600', 30, 35.00, true, 12, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');

-- Seed bookings table
INSERT INTO bookings (booking_id, ticket_number, user_id, status, appointment_date, appointment_time, slot_duration, customer_name, customer_email, customer_phone, booking_for_name, service_id, special_request, inspiration_photos, created_at, updated_at, confirmed_at, reminder_sent_at, completed_at, cancelled_at, cancellation_reason, cancelled_by, admin_notes, original_booking_id) VALUES
('booking_001', 'TKT-2024-001', 'user_002', 'completed', '2024-03-15', '10:00', 45, 'Emily Chen', 'emily.chen@email.com', '+1-555-0102', NULL, 'service_001', 'Please use organic products if possible', NULL, '2024-03-10T09:00:00Z', '2024-03-15T11:00:00Z', '2024-03-10T09:05:00Z', '2024-03-14T08:00:00Z', '2024-03-15T10:45:00Z', NULL, NULL, NULL, 'Client was very satisfied with the result', NULL),
('booking_002', 'TKT-2024-002', 'user_003', 'completed', '2024-03-16', '14:00', 180, 'Jessica Martinez', 'jessica.martinez@email.com', '+1-555-0103', NULL, 'service_002', 'I want a warm honey blonde tone', '["https://picsum.photos/seed/inspo1/400/400","https://picsum.photos/seed/inspo2/400/400"]', '2024-03-12T11:30:00Z', '2024-03-16T17:30:00Z', '2024-03-12T11:35:00Z', '2024-03-15T08:00:00Z', '2024-03-16T17:00:00Z', NULL, NULL, NULL, 'Beautiful result, client loved it', NULL),
('booking_003', 'TKT-20251107-003', 'user_005', 'confirmed', '2025-11-07', '11:00', 150, 'Rachel Brown', 'rachel.brown@email.com', '+1-555-0105', NULL, 'service_003', 'Full color treatment', NULL, '2025-11-05T10:00:00Z', '2025-11-05T10:00:00Z', '2025-11-05T10:02:00Z', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('booking_004', 'TKT-20251106-004', 'user_006', 'completed', '2025-11-06', '09:30', 120, 'Olivia Davis', 'olivia.davis@email.com', '+1-555-0106', NULL, 'service_004', 'First time getting keratin treatment, a bit nervous!', NULL, '2025-11-04T14:20:00Z', '2025-11-06T11:30:00Z', '2025-11-04T14:25:00Z', NULL, '2025-11-06T11:30:00Z', NULL, NULL, NULL, 'Sent care instructions via email, client was happy', NULL),
('booking_005', 'TKT-20251105-005', NULL, 'confirmed', '2025-11-05', '15:00', 40, 'Samantha Lee', 'samantha.lee@email.com', '+1-555-0201', NULL, 'service_008', NULL, NULL, '2025-11-03T16:45:00Z', '2025-11-03T16:45:00Z', '2025-11-03T16:50:00Z', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('booking_006', 'TKT-2024-006', 'user_002', 'cancelled', '2024-03-20', '13:00', 40, 'Emily Chen', 'emily.chen@email.com', '+1-555-0102', NULL, 'service_005', NULL, NULL, '2024-03-18T10:00:00Z', '2024-03-19T14:30:00Z', '2024-03-18T10:05:00Z', NULL, NULL, '2024-03-19T14:30:00Z', 'Had to reschedule due to work emergency', 'customer', NULL, NULL),
('booking_007', 'TKT-20251103-007', 'user_008', 'completed', '2025-11-03', '10:00', 90, 'Isabella Moore', 'isabella.moore@email.com', '+1-555-0108', NULL, 'service_006', 'Special event updo', '["https://picsum.photos/seed/bride1/400/400","https://picsum.photos/seed/bride2/400/400","https://picsum.photos/seed/bride3/400/400"]', '2025-11-01T09:00:00Z', '2025-11-03T11:30:00Z', '2025-11-01T09:10:00Z', NULL, '2025-11-03T11:30:00Z', NULL, NULL, NULL, 'Beautiful updo, client very satisfied', NULL),
('booking_008', 'TKT-20251102-008', NULL, 'completed', '2025-11-02', '16:00', 30, 'Michael Thompson', 'michael.t@email.com', '+1-555-0202', 'My son Tommy', 'service_012', 'He''s 7 years old and a bit shy', NULL, '2025-11-01T12:00:00Z', '2025-11-02T16:35:00Z', '2025-11-01T12:05:00Z', '2025-11-02T08:00:00Z', '2025-11-02T16:30:00Z', NULL, NULL, NULL, 'Great kid, gave him a sticker', NULL),
('booking_009', 'TKT-20251104-009', 'user_003', 'completed', '2025-11-04', '11:00', 60, 'Jessica Martinez', 'jessica.martinez@email.com', '+1-555-0103', NULL, 'service_009', NULL, NULL, '2025-11-02T09:30:00Z', '2025-11-04T12:05:00Z', '2025-11-02T09:35:00Z', '2025-11-03T08:00:00Z', '2025-11-04T12:00:00Z', NULL, NULL, NULL, 'Roots matched perfectly', NULL),
('booking_010', 'TKT-2024-010', NULL, 'confirmed', '2024-04-24', '13:30', 120, 'Victoria Santos', 'v.santos@email.com', '+1-555-0203', NULL, 'service_007', 'I''d like to add about 4 inches of length', NULL, '2024-04-19T15:00:00Z', '2024-04-19T15:00:00Z', '2024-04-19T15:10:00Z', NULL, NULL, NULL, NULL, NULL, 'Ordered extensions in ash brown', NULL),
('booking_011', 'TKT-2024-011', 'user_005', 'cancelled', '2024-03-25', '10:00', 40, 'Rachel Brown', 'rachel.brown@email.com', '+1-555-0105', NULL, 'service_008', NULL, NULL, '2024-03-23T11:00:00Z', '2024-03-24T08:00:00Z', '2024-03-23T11:05:00Z', NULL, NULL, '2024-03-24T08:00:00Z', 'Sick with flu', 'customer', NULL, NULL),
('booking_012', 'TKT-2024-012', 'user_006', 'completed', '2024-03-28', '14:00', 30, 'Olivia Davis', 'olivia.davis@email.com', '+1-555-0106', NULL, 'service_011', 'I''ve been having some scalp dryness', NULL, '2024-03-26T10:30:00Z', '2024-03-28T14:35:00Z', '2024-03-26T10:35:00Z', '2024-03-27T08:00:00Z', '2024-03-28T14:30:00Z', NULL, NULL, NULL, 'Recommended moisturizing shampoo', NULL),
('booking_013', 'TKT-2024-013', NULL, 'pending', '2024-04-26', '09:00', 150, 'Diana Prince', 'd.prince@email.com', '+1-555-0204', NULL, 'service_010', 'I want loose beachy waves', '["https://picsum.photos/seed/waves1/400/400"]', '2024-04-21T13:20:00Z', '2024-04-21T13:20:00Z', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('booking_014', 'TKT-20251113-014', 'user_002', 'confirmed', '2025-11-13', '11:30', 45, 'Emily Chen', 'emily.chen@email.com', '+1-555-0102', NULL, 'service_001', 'Same style as last time please!', NULL, '2025-11-01T09:15:00Z', '2025-11-01T09:15:00Z', '2025-11-01T09:20:00Z', NULL, NULL, NULL, NULL, NULL, 'Regular client, knows what she wants', NULL),
('booking_015', 'TKT-20251105-015', NULL, 'completed', '2025-11-05', '15:30', 40, 'Karen White', 'k.white@email.com', '+1-555-0205', NULL, 'service_008', 'Special event tonight', NULL, '2025-11-05T10:00:00Z', '2025-11-05T16:15:00Z', '2025-11-05T10:02:00Z', NULL, '2025-11-05T16:10:00Z', NULL, NULL, NULL, 'Created elegant waves', NULL),
('booking_016', 'TKT-20251106-016', 'user_007', 'confirmed', '2025-11-06', '10:30', 180, 'Sophia Wilson', 'sophia.wilson@email.com', '+1-555-0107', NULL, 'service_002', 'I want to go lighter but keep it natural', '["https://picsum.photos/seed/blonde1/400/400","https://picsum.photos/seed/blonde2/400/400"]', '2025-11-01T11:45:00Z', '2025-11-01T11:45:00Z', '2025-11-01T11:50:00Z', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('booking_017', 'TKT-20251104-017', NULL, 'cancelled', '2025-11-04', '12:00', 45, 'Linda Martinez', 'linda.m@email.com', '+1-555-0206', NULL, 'service_001', NULL, NULL, '2025-11-01T14:00:00Z', '2025-11-03T16:00:00Z', '2025-11-01T14:05:00Z', NULL, NULL, '2025-11-03T16:00:00Z', 'Schedule conflict', 'customer', 'Client called to cancel due to schedule conflict', NULL),
('booking_018', 'TKT-20251107-018', 'user_008', 'confirmed', '2025-11-07', '14:30', 90, 'Isabella Moore', 'isabella.moore@email.com', '+1-555-0108', NULL, 'service_006', 'Special occasion updo', '["https://picsum.photos/seed/trial1/400/400"]', '2025-11-02T10:00:00Z', '2025-11-02T10:00:00Z', '2025-11-02T10:05:00Z', NULL, NULL, NULL, NULL, NULL, 'Looking forward to this appointment', NULL),
('booking_019', 'TKT-20251107-019', NULL, 'completed', '2025-11-07', '10:00', 40, 'Patricia Johnson', 'p.johnson@email.com', '+1-555-0207', NULL, 'service_001', 'Regular trim and style', NULL, '2025-11-06T15:30:00Z', '2025-11-07T10:45:00Z', '2025-11-06T15:35:00Z', '2025-11-07T08:00:00Z', '2025-11-07T10:40:00Z', NULL, NULL, NULL, 'Great service as always', NULL),
('booking_020', 'TKT-20251108-020', 'user_005', 'confirmed', '2025-11-08', '16:00', 150, 'Rachel Brown', 'rachel.brown@email.com', '+1-555-0105', NULL, 'service_003', 'Ready for a change! Going darker', '["https://picsum.photos/seed/dark1/400/400"]', '2025-11-03T12:00:00Z', '2025-11-03T12:00:00Z', '2025-11-03T12:05:00Z', NULL, NULL, NULL, NULL, NULL, 'Client excited about going from blonde to brunette', NULL);

-- Seed capacity_overrides table
INSERT INTO capacity_overrides (override_id, override_date, time_slot, capacity, is_active, created_at, updated_at) VALUES
('override_001', '2024-04-20', '09:00', 2, true, '2024-04-10T10:00:00Z', '2024-04-10T10:00:00Z'),
('override_002', '2024-04-20', '10:00', 2, true, '2024-04-10T10:00:00Z', '2024-04-10T10:00:00Z'),
('override_003', '2024-04-20', '11:00', 2, true, '2024-04-10T10:00:00Z', '2024-04-10T10:00:00Z'),
('override_004', '2024-04-27', '09:00', 3, true, '2024-04-15T09:00:00Z', '2024-04-15T09:00:00Z'),
('override_005', '2024-04-27', '14:00', 3, true, '2024-04-15T09:00:00Z', '2024-04-15T09:00:00Z'),
('override_006', '2024-05-01', '10:00', 1, true, '2024-04-20T11:00:00Z', '2024-04-20T11:00:00Z'),
('override_007', '2024-05-01', '11:00', 1, true, '2024-04-20T11:00:00Z', '2024-04-20T11:00:00Z'),
('override_008', '2024-05-01', '15:00', 1, true, '2024-04-20T11:00:00Z', '2024-04-20T11:00:00Z'),
('override_009', '2024-04-25', '13:00', 0, true, '2024-04-18T14:00:00Z', '2024-04-18T14:00:00Z'),
('override_010', '2024-04-25', '14:00', 0, true, '2024-04-18T14:00:00Z', '2024-04-18T14:00:00Z'),
('override_011', '2024-05-05', '09:00', 4, true, '2024-04-22T10:30:00Z', '2024-04-22T10:30:00Z'),
('override_012', '2024-05-05', '10:00', 4, true, '2024-04-22T10:30:00Z', '2024-04-22T10:30:00Z'),
('override_013', '2024-05-05', '11:00', 4, true, '2024-04-22T10:30:00Z', '2024-04-22T10:30:00Z'),
('override_014', '2024-05-10', '16:00', 2, true, '2024-04-25T08:00:00Z', '2024-04-25T08:00:00Z'),
('override_015', '2024-05-10', '17:00', 2, true, '2024-04-25T08:00:00Z', '2024-04-25T08:00:00Z');