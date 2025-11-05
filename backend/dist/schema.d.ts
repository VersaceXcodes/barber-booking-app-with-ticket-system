import { z } from 'zod';
export declare const userSchema: z.ZodObject<{
    user_id: z.ZodString;
    email: z.ZodString;
    password_hash: z.ZodString;
    name: z.ZodString;
    phone: z.ZodString;
    is_verified: z.ZodBoolean;
    verification_token: z.ZodNullable<z.ZodString>;
    verification_token_expiry: z.ZodNullable<z.ZodString>;
    reset_token: z.ZodNullable<z.ZodString>;
    reset_token_expiry: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    email?: string;
    password_hash?: string;
    name?: string;
    phone?: string;
    is_verified?: boolean;
    verification_token?: string;
    verification_token_expiry?: string;
    reset_token?: string;
    reset_token_expiry?: string;
    created_at?: string;
    updated_at?: string;
}, {
    user_id?: string;
    email?: string;
    password_hash?: string;
    name?: string;
    phone?: string;
    is_verified?: boolean;
    verification_token?: string;
    verification_token_expiry?: string;
    reset_token?: string;
    reset_token_expiry?: string;
    created_at?: string;
    updated_at?: string;
}>;
export declare const createUserInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    name?: string;
    phone?: string;
    password?: string;
}, {
    email?: string;
    name?: string;
    phone?: string;
    password?: string;
}>;
export declare const updateUserInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    is_verified: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    email?: string;
    name?: string;
    phone?: string;
    is_verified?: boolean;
}, {
    user_id?: string;
    email?: string;
    name?: string;
    phone?: string;
    is_verified?: boolean;
}>;
export declare const changePasswordInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    current_password: z.ZodString;
    new_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    current_password?: string;
    new_password?: string;
}, {
    user_id?: string;
    current_password?: string;
    new_password?: string;
}>;
export declare const requestPasswordResetInputSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
}, {
    email?: string;
}>;
export declare const resetPasswordInputSchema: z.ZodObject<{
    reset_token: z.ZodString;
    new_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reset_token?: string;
    new_password?: string;
}, {
    reset_token?: string;
    new_password?: string;
}>;
export declare const verifyEmailInputSchema: z.ZodObject<{
    verification_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    verification_token?: string;
}, {
    verification_token?: string;
}>;
export declare const searchUserInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    is_verified: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["email", "name", "created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    is_verified?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "email" | "name" | "created_at";
    sort_order?: "asc" | "desc";
}, {
    is_verified?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "email" | "name" | "created_at";
    sort_order?: "asc" | "desc";
}>;
export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;
export declare const serviceSchema: z.ZodObject<{
    service_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    image_url: z.ZodNullable<z.ZodString>;
    duration: z.ZodNumber;
    price: z.ZodNullable<z.ZodNumber>;
    is_active: z.ZodBoolean;
    display_order: z.ZodNumber;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name?: string;
    created_at?: string;
    updated_at?: string;
    service_id?: string;
    description?: string;
    image_url?: string;
    duration?: number;
    price?: number;
    is_active?: boolean;
    display_order?: number;
}, {
    name?: string;
    created_at?: string;
    updated_at?: string;
    service_id?: string;
    description?: string;
    image_url?: string;
    duration?: number;
    price?: number;
    is_active?: boolean;
    display_order?: number;
}>;
export declare const createServiceInputSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    image_url: z.ZodNullable<z.ZodString>;
    duration: z.ZodDefault<z.ZodNumber>;
    price: z.ZodNullable<z.ZodNumber>;
    is_active: z.ZodDefault<z.ZodBoolean>;
    display_order: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    description?: string;
    image_url?: string;
    duration?: number;
    price?: number;
    is_active?: boolean;
    display_order?: number;
}, {
    name?: string;
    description?: string;
    image_url?: string;
    duration?: number;
    price?: number;
    is_active?: boolean;
    display_order?: number;
}>;
export declare const updateServiceInputSchema: z.ZodObject<{
    service_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    duration: z.ZodOptional<z.ZodNumber>;
    price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    display_order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    service_id?: string;
    description?: string;
    image_url?: string;
    duration?: number;
    price?: number;
    is_active?: boolean;
    display_order?: number;
}, {
    name?: string;
    service_id?: string;
    description?: string;
    image_url?: string;
    duration?: number;
    price?: number;
    is_active?: boolean;
    display_order?: number;
}>;
export declare const searchServiceInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    min_price: z.ZodOptional<z.ZodNumber>;
    max_price: z.ZodOptional<z.ZodNumber>;
    min_duration: z.ZodOptional<z.ZodNumber>;
    max_duration: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["name", "price", "duration", "display_order", "created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "created_at" | "duration" | "price" | "display_order";
    sort_order?: "asc" | "desc";
    is_active?: boolean;
    min_price?: number;
    max_price?: number;
    min_duration?: number;
    max_duration?: number;
}, {
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "created_at" | "duration" | "price" | "display_order";
    sort_order?: "asc" | "desc";
    is_active?: boolean;
    min_price?: number;
    max_price?: number;
    min_duration?: number;
    max_duration?: number;
}>;
export type Service = z.infer<typeof serviceSchema>;
export type CreateServiceInput = z.infer<typeof createServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>;
export type SearchServiceInput = z.infer<typeof searchServiceInputSchema>;
export declare const bookingStatusEnum: z.ZodEnum<["pending", "confirmed", "completed", "cancelled"]>;
export declare const bookingSchema: z.ZodObject<{
    booking_id: z.ZodString;
    ticket_number: z.ZodString;
    user_id: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["pending", "confirmed", "completed", "cancelled"]>;
    appointment_date: z.ZodString;
    appointment_time: z.ZodString;
    slot_duration: z.ZodNumber;
    customer_name: z.ZodString;
    customer_email: z.ZodString;
    customer_phone: z.ZodString;
    booking_for_name: z.ZodNullable<z.ZodString>;
    service_id: z.ZodNullable<z.ZodString>;
    special_request: z.ZodNullable<z.ZodString>;
    inspiration_photos: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    confirmed_at: z.ZodNullable<z.ZodString>;
    reminder_sent_at: z.ZodNullable<z.ZodString>;
    completed_at: z.ZodNullable<z.ZodString>;
    cancelled_at: z.ZodNullable<z.ZodString>;
    cancellation_reason: z.ZodNullable<z.ZodString>;
    cancelled_by: z.ZodNullable<z.ZodString>;
    admin_notes: z.ZodNullable<z.ZodString>;
    original_booking_id: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    status?: "pending" | "confirmed" | "completed" | "cancelled";
    service_id?: string;
    booking_id?: string;
    ticket_number?: string;
    appointment_date?: string;
    appointment_time?: string;
    slot_duration?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    booking_for_name?: string;
    special_request?: string;
    inspiration_photos?: string[];
    confirmed_at?: string;
    reminder_sent_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    cancelled_by?: string;
    admin_notes?: string;
    original_booking_id?: string;
}, {
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    status?: "pending" | "confirmed" | "completed" | "cancelled";
    service_id?: string;
    booking_id?: string;
    ticket_number?: string;
    appointment_date?: string;
    appointment_time?: string;
    slot_duration?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    booking_for_name?: string;
    special_request?: string;
    inspiration_photos?: string[];
    confirmed_at?: string;
    reminder_sent_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    cancelled_by?: string;
    admin_notes?: string;
    original_booking_id?: string;
}>;
export declare const createBookingInputSchema: z.ZodObject<{
    user_id: z.ZodNullable<z.ZodString>;
    appointment_date: z.ZodString;
    appointment_time: z.ZodString;
    slot_duration: z.ZodDefault<z.ZodNumber>;
    customer_name: z.ZodString;
    customer_email: z.ZodString;
    customer_phone: z.ZodString;
    booking_for_name: z.ZodNullable<z.ZodString>;
    service_id: z.ZodNullable<z.ZodString>;
    special_request: z.ZodNullable<z.ZodString>;
    inspiration_photos: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    service_id?: string;
    appointment_date?: string;
    appointment_time?: string;
    slot_duration?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    booking_for_name?: string;
    special_request?: string;
    inspiration_photos?: string[];
}, {
    user_id?: string;
    service_id?: string;
    appointment_date?: string;
    appointment_time?: string;
    slot_duration?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    booking_for_name?: string;
    special_request?: string;
    inspiration_photos?: string[];
}>;
export declare const updateBookingInputSchema: z.ZodObject<{
    booking_id: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["pending", "confirmed", "completed", "cancelled"]>>;
    appointment_date: z.ZodOptional<z.ZodString>;
    appointment_time: z.ZodOptional<z.ZodString>;
    slot_duration: z.ZodOptional<z.ZodNumber>;
    customer_name: z.ZodOptional<z.ZodString>;
    customer_email: z.ZodOptional<z.ZodString>;
    customer_phone: z.ZodOptional<z.ZodString>;
    booking_for_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    service_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    special_request: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    inspiration_photos: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    admin_notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "confirmed" | "completed" | "cancelled";
    service_id?: string;
    booking_id?: string;
    appointment_date?: string;
    appointment_time?: string;
    slot_duration?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    booking_for_name?: string;
    special_request?: string;
    inspiration_photos?: string[];
    admin_notes?: string;
}, {
    status?: "pending" | "confirmed" | "completed" | "cancelled";
    service_id?: string;
    booking_id?: string;
    appointment_date?: string;
    appointment_time?: string;
    slot_duration?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    booking_for_name?: string;
    special_request?: string;
    inspiration_photos?: string[];
    admin_notes?: string;
}>;
export declare const confirmBookingInputSchema: z.ZodObject<{
    booking_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    booking_id?: string;
}, {
    booking_id?: string;
}>;
export declare const completeBookingInputSchema: z.ZodObject<{
    booking_id: z.ZodString;
    admin_notes: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    booking_id?: string;
    admin_notes?: string;
}, {
    booking_id?: string;
    admin_notes?: string;
}>;
export declare const cancelBookingInputSchema: z.ZodObject<{
    booking_id: z.ZodString;
    cancellation_reason: z.ZodString;
    cancelled_by: z.ZodEnum<["customer", "admin"]>;
}, "strip", z.ZodTypeAny, {
    booking_id?: string;
    cancellation_reason?: string;
    cancelled_by?: "customer" | "admin";
}, {
    booking_id?: string;
    cancellation_reason?: string;
    cancelled_by?: "customer" | "admin";
}>;
export declare const searchBookingInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    user_id: z.ZodOptional<z.ZodString>;
    service_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending", "confirmed", "completed", "cancelled"]>>;
    appointment_date_from: z.ZodOptional<z.ZodString>;
    appointment_date_to: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["appointment_date", "appointment_time", "created_at", "status"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    status?: "pending" | "confirmed" | "completed" | "cancelled";
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "status" | "appointment_date" | "appointment_time";
    sort_order?: "asc" | "desc";
    service_id?: string;
    appointment_date_from?: string;
    appointment_date_to?: string;
}, {
    user_id?: string;
    status?: "pending" | "confirmed" | "completed" | "cancelled";
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "status" | "appointment_date" | "appointment_time";
    sort_order?: "asc" | "desc";
    service_id?: string;
    appointment_date_from?: string;
    appointment_date_to?: string;
}>;
export declare const checkAvailabilityInputSchema: z.ZodObject<{
    appointment_date: z.ZodString;
    service_id: z.ZodOptional<z.ZodString>;
    exclude_booking_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    service_id?: string;
    appointment_date?: string;
    exclude_booking_id?: string;
}, {
    service_id?: string;
    appointment_date?: string;
    exclude_booking_id?: string;
}>;
export type Booking = z.infer<typeof bookingSchema>;
export type BookingStatus = z.infer<typeof bookingStatusEnum>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingInputSchema>;
export type CompleteBookingInput = z.infer<typeof completeBookingInputSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;
export type SearchBookingInput = z.infer<typeof searchBookingInputSchema>;
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInputSchema>;
export declare const capacityOverrideSchema: z.ZodObject<{
    override_id: z.ZodString;
    override_date: z.ZodString;
    time_slot: z.ZodString;
    capacity: z.ZodNumber;
    is_active: z.ZodBoolean;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at?: string;
    updated_at?: string;
    is_active?: boolean;
    override_id?: string;
    override_date?: string;
    time_slot?: string;
    capacity?: number;
}, {
    created_at?: string;
    updated_at?: string;
    is_active?: boolean;
    override_id?: string;
    override_date?: string;
    time_slot?: string;
    capacity?: number;
}>;
export declare const createCapacityOverrideInputSchema: z.ZodObject<{
    override_date: z.ZodString;
    time_slot: z.ZodString;
    capacity: z.ZodNumber;
    is_active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    is_active?: boolean;
    override_date?: string;
    time_slot?: string;
    capacity?: number;
}, {
    is_active?: boolean;
    override_date?: string;
    time_slot?: string;
    capacity?: number;
}>;
export declare const updateCapacityOverrideInputSchema: z.ZodObject<{
    override_id: z.ZodString;
    override_date: z.ZodOptional<z.ZodString>;
    time_slot: z.ZodOptional<z.ZodString>;
    capacity: z.ZodOptional<z.ZodNumber>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    is_active?: boolean;
    override_id?: string;
    override_date?: string;
    time_slot?: string;
    capacity?: number;
}, {
    is_active?: boolean;
    override_id?: string;
    override_date?: string;
    time_slot?: string;
    capacity?: number;
}>;
export declare const searchCapacityOverrideInputSchema: z.ZodObject<{
    override_date: z.ZodOptional<z.ZodString>;
    override_date_from: z.ZodOptional<z.ZodString>;
    override_date_to: z.ZodOptional<z.ZodString>;
    time_slot: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["override_date", "time_slot", "created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "override_date" | "time_slot";
    sort_order?: "asc" | "desc";
    is_active?: boolean;
    override_date?: string;
    time_slot?: string;
    override_date_from?: string;
    override_date_to?: string;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "override_date" | "time_slot";
    sort_order?: "asc" | "desc";
    is_active?: boolean;
    override_date?: string;
    time_slot?: string;
    override_date_from?: string;
    override_date_to?: string;
}>;
export declare const getCapacityInputSchema: z.ZodObject<{
    override_date: z.ZodString;
    time_slot: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    override_date?: string;
    time_slot?: string;
}, {
    override_date?: string;
    time_slot?: string;
}>;
export type CapacityOverride = z.infer<typeof capacityOverrideSchema>;
export type CreateCapacityOverrideInput = z.infer<typeof createCapacityOverrideInputSchema>;
export type UpdateCapacityOverrideInput = z.infer<typeof updateCapacityOverrideInputSchema>;
export type SearchCapacityOverrideInput = z.infer<typeof searchCapacityOverrideInputSchema>;
export type GetCapacityInput = z.infer<typeof getCapacityInputSchema>;
export declare const paginatedResponseSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    data: z.ZodArray<T, "many">;
    pagination: z.ZodObject<{
        total: z.ZodNumber;
        limit: z.ZodNumber;
        offset: z.ZodNumber;
        has_more: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        limit?: number;
        offset?: number;
        total?: number;
        has_more?: boolean;
    }, {
        limit?: number;
        offset?: number;
        total?: number;
        has_more?: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    data?: T["_output"][];
    pagination?: {
        limit?: number;
        offset?: number;
        total?: number;
        has_more?: boolean;
    };
}, {
    data?: T["_input"][];
    pagination?: {
        limit?: number;
        offset?: number;
        total?: number;
        has_more?: boolean;
    };
}>;
export declare const successResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: T;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodLiteral<true>;
    data: T;
}>, any> extends infer T_1 ? { [k in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodLiteral<true>;
    data: T;
}>, any>[k]; } : never, z.baseObjectInputType<{
    success: z.ZodLiteral<true>;
    data: T;
}> extends infer T_2 ? { [k_1 in keyof T_2]: z.baseObjectInputType<{
    success: z.ZodLiteral<true>;
    data: T;
}>[k_1]; } : never>;
export declare const errorResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        code?: string;
        message?: string;
        details?: Record<string, any>;
    }, {
        code?: string;
        message?: string;
        details?: Record<string, any>;
    }>;
}, "strip", z.ZodTypeAny, {
    success?: false;
    error?: {
        code?: string;
        message?: string;
        details?: Record<string, any>;
    };
}, {
    success?: false;
    error?: {
        code?: string;
        message?: string;
        details?: Record<string, any>;
    };
}>;
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
export declare const timeSlotSchema: z.ZodObject<{
    time: z.ZodString;
    available_slots: z.ZodNumber;
    total_capacity: z.ZodNumber;
    is_available: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    time?: string;
    available_slots?: number;
    total_capacity?: number;
    is_available?: boolean;
}, {
    time?: string;
    available_slots?: number;
    total_capacity?: number;
    is_available?: boolean;
}>;
export declare const availabilityResponseSchema: z.ZodObject<{
    date: z.ZodString;
    slots: z.ZodArray<z.ZodObject<{
        time: z.ZodString;
        available_slots: z.ZodNumber;
        total_capacity: z.ZodNumber;
        is_available: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        time?: string;
        available_slots?: number;
        total_capacity?: number;
        is_available?: boolean;
    }, {
        time?: string;
        available_slots?: number;
        total_capacity?: number;
        is_available?: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    date?: string;
    slots?: {
        time?: string;
        available_slots?: number;
        total_capacity?: number;
        is_available?: boolean;
    }[];
}, {
    date?: string;
    slots?: {
        time?: string;
        available_slots?: number;
        total_capacity?: number;
        is_available?: boolean;
    }[];
}>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;
//# sourceMappingURL=schema.d.ts.map