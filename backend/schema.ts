import { z } from 'zod';

// ============================================================================
// USERS SCHEMAS
// ============================================================================

// Main entity schema
export const userSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  password_hash: z.string(),
  name: z.string(),
  phone: z.string(),
  is_verified: z.boolean(),
  verification_token: z.string().nullable(),
  verification_token_expiry: z.string().nullable(),
  reset_token: z.string().nullable(),
  reset_token_expiry: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

// Input schema for user registration
export const createUserInputSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(255),
  phone: z.string().min(10).max(20).regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
});

// Input schema for user updates
export const updateUserInputSchema = z.object({
  user_id: z.string(),
  email: z.string().email().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(10).max(20).regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  is_verified: z.boolean().optional()
});

// Input schema for password change
export const changePasswordInputSchema = z.object({
  user_id: z.string(),
  current_password: z.string().min(8).max(100),
  new_password: z.string().min(8).max(100)
});

// Input schema for password reset request
export const requestPasswordResetInputSchema = z.object({
  email: z.string().email()
});

// Input schema for password reset
export const resetPasswordInputSchema = z.object({
  reset_token: z.string(),
  new_password: z.string().min(8).max(100)
});

// Input schema for email verification
export const verifyEmailInputSchema = z.object({
  verification_token: z.string()
});

// Query schema for searching users
export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  is_verified: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['email', 'name', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// Inferred types
export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;

// ============================================================================
// SERVICES SCHEMAS
// ============================================================================

// Main entity schema
export const serviceSchema = z.object({
  service_id: z.string(),
  name: z.string(),
  description: z.string(),
  image_url: z.string().nullable(),
  duration: z.number(),
  price: z.number().nullable(),
  is_active: z.boolean(),
  display_order: z.number(),
  created_at: z.string(),
  updated_at: z.string()
});

// Input schema for creating services
export const createServiceInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  image_url: z.string().url().nullable(),
  duration: z.number().int().positive().default(40),
  price: z.number().nonnegative().nullable(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().nonnegative().default(0)
});

// Input schema for updating services
export const updateServiceInputSchema = z.object({
  service_id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(2000).optional(),
  image_url: z.string().url().nullable().optional(),
  duration: z.number().int().positive().optional(),
  price: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().nonnegative().optional()
});

// Query schema for searching services
export const searchServiceInputSchema = z.object({
  query: z.string().optional(),
  is_active: z.boolean().optional(),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().nonnegative().optional(),
  min_duration: z.number().int().positive().optional(),
  max_duration: z.number().int().positive().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'price', 'duration', 'display_order', 'created_at']).default('display_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// Inferred types
export type Service = z.infer<typeof serviceSchema>;
export type CreateServiceInput = z.infer<typeof createServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>;
export type SearchServiceInput = z.infer<typeof searchServiceInputSchema>;

// ============================================================================
// BOOKINGS SCHEMAS
// ============================================================================

// Booking status enum
export const bookingStatusEnum = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);

// Main entity schema
export const bookingSchema = z.object({
  booking_id: z.string(),
  ticket_number: z.string(),
  user_id: z.string().nullable(),
  status: bookingStatusEnum,
  appointment_date: z.string(),
  appointment_time: z.string(),
  slot_duration: z.number(),
  customer_name: z.string(),
  customer_email: z.string(),
  customer_phone: z.string(),
  booking_for_name: z.string().nullable(),
  service_id: z.string().nullable(),
  special_request: z.string().nullable(),
  inspiration_photos: z.array(z.string().url()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  confirmed_at: z.string().nullable(),
  reminder_sent_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  cancelled_by: z.string().nullable(),
  admin_notes: z.string().nullable(),
  original_booking_id: z.string().nullable()
});

// Input schema for creating bookings
export const createBookingInputSchema = z.object({
  user_id: z.string().nullable(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  appointment_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  slot_duration: z.number().int().positive().default(40),
  customer_name: z.string().min(1).max(255),
  customer_email: z.string().email().max(255),
  customer_phone: z.string().min(10).max(20).regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  booking_for_name: z.string().max(255).nullable(),
  service_id: z.string().nullable(),
  special_request: z.string().max(1000).nullable(),
  inspiration_photos: z.array(z.string().url()).max(10).nullable()
});

// Input schema for updating bookings
export const updateBookingInputSchema = z.object({
  booking_id: z.string(),
  status: bookingStatusEnum.optional(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  appointment_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  slot_duration: z.number().int().positive().optional(),
  customer_name: z.string().min(1).max(255).optional(),
  customer_email: z.string().email().max(255).optional(),
  customer_phone: z.string().min(10).max(20).regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  booking_for_name: z.string().max(255).nullable().optional(),
  service_id: z.string().nullable().optional(),
  special_request: z.string().max(1000).nullable().optional(),
  inspiration_photos: z.array(z.string().url()).max(10).nullable().optional(),
  admin_notes: z.string().max(2000).nullable().optional()
});

// Input schema for confirming bookings
export const confirmBookingInputSchema = z.object({
  booking_id: z.string()
});

// Input schema for completing bookings
export const completeBookingInputSchema = z.object({
  booking_id: z.string(),
  admin_notes: z.string().max(2000).nullable()
});

// Input schema for cancelling bookings
export const cancelBookingInputSchema = z.object({
  booking_id: z.string(),
  cancellation_reason: z.string().min(1).max(500),
  cancelled_by: z.enum(['customer', 'admin'])
});

// Query schema for searching bookings
export const searchBookingInputSchema = z.object({
  query: z.string().optional(),
  user_id: z.string().optional(),
  service_id: z.string().optional(),
  status: bookingStatusEnum.optional(),
  appointment_date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  appointment_date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['appointment_date', 'appointment_time', 'created_at', 'status']).default('appointment_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// Query schema for checking availability
export const checkAvailabilityInputSchema = z.object({
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  service_id: z.string().optional(),
  exclude_booking_id: z.string().optional()
});

// Inferred types
export type Booking = z.infer<typeof bookingSchema>;
export type BookingStatus = z.infer<typeof bookingStatusEnum>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingInputSchema>;
export type CompleteBookingInput = z.infer<typeof completeBookingInputSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;
export type SearchBookingInput = z.infer<typeof searchBookingInputSchema>;
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInputSchema>;

// ============================================================================
// CAPACITY OVERRIDES SCHEMAS
// ============================================================================

// Main entity schema
export const capacityOverrideSchema = z.object({
  override_id: z.string(),
  override_date: z.string(),
  time_slot: z.string(),
  capacity: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

// Input schema for creating capacity overrides
export const createCapacityOverrideInputSchema = z.object({
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  capacity: z.number().int().nonnegative(),
  is_active: z.boolean().default(true)
});

// Input schema for updating capacity overrides
export const updateCapacityOverrideInputSchema = z.object({
  override_id: z.string(),
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  capacity: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional()
});

// Query schema for searching capacity overrides
export const searchCapacityOverrideInputSchema = z.object({
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  override_date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  override_date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['override_date', 'time_slot', 'created_at']).default('override_date'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// Query schema for getting capacity for specific date
export const getCapacityInputSchema = z.object({
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional()
});

// Inferred types
export type CapacityOverride = z.infer<typeof capacityOverrideSchema>;
export type CreateCapacityOverrideInput = z.infer<typeof createCapacityOverrideInputSchema>;
export type UpdateCapacityOverrideInput = z.infer<typeof updateCapacityOverrideInputSchema>;
export type SearchCapacityOverrideInput = z.infer<typeof searchCapacityOverrideInputSchema>;
export type GetCapacityInput = z.infer<typeof getCapacityInputSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Paginated response schema
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      total: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
      offset: z.number().int().nonnegative(),
      has_more: z.boolean()
    })
  });

// Success response schema
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  });

// Error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  })
});

// Inferred types
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
};

export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

// Time slot schema
export const timeSlotSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  available_slots: z.number().int().nonnegative(),
  total_capacity: z.number().int().nonnegative(),
  is_available: z.boolean()
});

// Availability response schema
export const availabilityResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  slots: z.array(timeSlotSchema)
});

// Inferred types
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;