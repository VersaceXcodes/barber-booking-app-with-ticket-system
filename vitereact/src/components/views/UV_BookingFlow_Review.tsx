import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

// ============================================================================
// INTERFACES
// ============================================================================

interface CreateBookingPayload {
  user_id: string | null;
  appointment_date: string;
  appointment_time: string;
  slot_duration: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_for_name: string | null;
  service_id: string | null;
  special_request: string | null;
  inspiration_photos: string[] | null;
}

interface BookingResponse {
  booking_id: string;
  ticket_number: string;
  status: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  created_at: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const formatLongDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  } catch {
    return dateString;
  }
};

const formatTime12Hour = (time24: string): string => {
  try {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time24;
  }
};

const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  try {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  } catch {
    return startTime;
  }
};

const formatTimeRange = (startTime: string, durationMinutes: number): string => {
  const endTime = calculateEndTime(startTime, durationMinutes);
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_BookingFlow_Review: React.FC = () => {
  const navigate = useNavigate();

  // ============================================================================
  // STATE - CRITICAL: Individual selectors to avoid infinite loops
  // ============================================================================

  const bookingContext = useAppStore(state => state.booking_context);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const shopSettings = useAppStore(state => state.app_settings);

  // Local state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);

  // ============================================================================
  // API MUTATION
  // ============================================================================

  const createBookingMutation = useMutation({
    mutationFn: async (payload: CreateBookingPayload) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await axios.post<BookingResponse>(
        `${getApiBaseUrl()}/api/bookings`,
        payload,
        { headers }
      );

      return response.data;
    },
    onSuccess: (data) => {
      // Navigate to confirmation page with ticket number
      navigate('/booking/confirmation', {
        state: { ticketNumber: data.ticket_number, booking: data }
      });
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleTermsToggle = () => {
    setTermsAccepted(!termsAccepted);
  };

  const handleConfirmBooking = async () => {
    if (!termsAccepted) {
      return;
    }

    // Validate required fields
    if (!bookingContext.selected_date || !bookingContext.selected_time || 
        !bookingContext.customer_name || !bookingContext.customer_email || 
        !bookingContext.customer_phone) {
      return;
    }

    const payload: CreateBookingPayload = {
      user_id: currentUser?.id || null,
      appointment_date: bookingContext.selected_date,
      appointment_time: bookingContext.selected_time,
      slot_duration: 40, // Default duration
      customer_name: bookingContext.customer_name,
      customer_email: bookingContext.customer_email,
      customer_phone: bookingContext.customer_phone,
      booking_for_name: bookingContext.booking_for_name,
      service_id: bookingContext.service_id,
      special_request: bookingContext.special_request,
      inspiration_photos: bookingContext.inspiration_photos,
    };

    createBookingMutation.mutate(payload);
  };

  const openLightbox = (index: number) => {
    setLightboxImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    if (bookingContext.inspiration_photos && lightboxImageIndex < bookingContext.inspiration_photos.length - 1) {
      setLightboxImageIndex(lightboxImageIndex + 1);
    }
  };

  const previousImage = () => {
    if (lightboxImageIndex > 0) {
      setLightboxImageIndex(lightboxImageIndex - 1);
    }
  };

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const getErrorMessage = (): string => {
    if (!createBookingMutation.error) return '';

    const err = createBookingMutation.error as {
      response?: { data?: { error?: { message?: string } } };
      message?: string;
    };
    const errorMessage = err.response?.data?.error?.message || err.message || '';

    if (errorMessage.toLowerCase().includes('slot') && errorMessage.toLowerCase().includes('available')) {
      return 'Sorry, this time slot was just booked. Please choose another time.';
    }
    if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('validation')) {
      return 'Invalid customer information. Please review and try again.';
    }
    if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
      return "Connection issue. Your booking hasn't been confirmed yet.";
    }
    
    return `Booking failed. Please try again or contact us at ${shopSettings.shop_phone}.`;
  };

  const isSlotError = (): boolean => {
    const errorMsg = getErrorMessage();
    return errorMsg.includes('time slot');
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const hasSpecialRequests = 
    bookingContext.special_request || 
    bookingContext.booking_for_name || 
    (bookingContext.inspiration_photos && bookingContext.inspiration_photos.length > 0);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 md:py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Progress Indicator */}
          <div className="mb-6 lg:mb-8">
            <p className="text-center text-sm font-medium text-gray-600">
              Final Step
            </p>
          </div>

          {/* Page Header */}
          <div className="text-center mb-8 lg:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Review Your Booking
            </h1>
            <p className="mt-2 text-base md:text-lg text-gray-600">
              Please verify all details before confirming
            </p>
          </div>

          {/* Error Banner */}
          {createBookingMutation.isError && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-red-800">
                    {getErrorMessage()}
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => createBookingMutation.reset()}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
                    >
                      Try Again
                    </button>
                    {isSlotError() && (
                      <Link
                        to="/book/time"
                        className="inline-flex items-center px-4 py-2 bg-white text-red-700 border-2 border-red-200 rounded-lg font-medium hover:bg-red-50 transition-colors text-sm"
                      >
                        Choose New Time
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking Summary Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
            {/* Appointment Details Section */}
            <div className="p-6 lg:p-8 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900">Appointment Details</h2>
                </div>
                <Link
                  to="/book/date"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                  aria-label="Edit appointment details"
                >
                  Edit
                </Link>
              </div>
              <div className="space-y-3">
                {bookingContext.service_name && (
                  <div>
                    <p className="text-sm text-gray-600">Service</p>
                    <p className="text-base font-medium text-gray-900">{bookingContext.service_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="text-base font-medium text-gray-900">
                    {bookingContext.selected_date ? formatLongDate(bookingContext.selected_date) : 'Not selected'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="text-base font-medium text-gray-900">
                    {bookingContext.selected_time ? formatTimeRange(bookingContext.selected_time, 40) : 'Not selected'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="text-base font-medium text-gray-900">40 minutes</p>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="p-6 lg:p-8 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
                </div>
                <Link
                  to="/book/details"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                  aria-label="Edit contact information"
                >
                  Edit
                </Link>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="text-base font-medium text-gray-900">{bookingContext.customer_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email Address</p>
                  <p className="text-base font-medium text-gray-900">{bookingContext.customer_email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone Number (WhatsApp preferred)</p>
                  <p className="text-base font-medium text-gray-900">{bookingContext.customer_phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Special Requests Section */}
            {hasSpecialRequests && (
              <div className="p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <h2 className="text-xl font-semibold text-gray-900">Special Requests</h2>
                  </div>
                  <Link
                    to="/book/details"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                    aria-label="Edit special requests"
                  >
                    Edit
                  </Link>
                </div>
                <div className="space-y-3">
                  {bookingContext.special_request && (
                    <div>
                      <p className="text-sm text-gray-600">Your Request</p>
                      <p className="text-base text-gray-900">{bookingContext.special_request}</p>
                    </div>
                  )}
                  {bookingContext.booking_for_name && (
                    <div>
                      <p className="text-sm text-gray-600">Booking For</p>
                      <p className="text-base font-medium text-gray-900">{bookingContext.booking_for_name}</p>
                    </div>
                  )}
                  {bookingContext.inspiration_photos && bookingContext.inspiration_photos.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Inspiration Photos</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {bookingContext.inspiration_photos.map((photo, index) => (
                          <button
                            key={index}
                            onClick={() => openLightbox(index)}
                            className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <img
                              src={photo}
                              alt={`Inspiration ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Important Information Card */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 lg:p-8 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Important Information</h2>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">{shopSettings.shop_address || 'Address not available'}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopSettings.shop_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block"
                  >
                    Get Directions →
                  </a>
                </div>
              </div>
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${shopSettings.shop_phone}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                  {shopSettings.shop_phone || 'Phone not available'}
                </a>
              </div>
              <div className="pt-3 border-t border-blue-300">
                <p className="text-sm text-gray-700">
                  <strong>Cancellation Policy:</strong> You can cancel up to 2 hours before your appointment.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Reminders:</strong> You'll receive a confirmation email and SMS, plus a reminder before your appointment.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Acceptance */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-6">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={handleTermsToggle}
                className="mt-1 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-4 focus:ring-blue-100 cursor-pointer"
              />
              <span className="ml-3 text-sm text-gray-700">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => window.open('/terms', '_blank')}
                  className="text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  cancellation policy and terms of service
                </button>
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/book/details"
              className="flex-1 sm:flex-none sm:w-auto px-6 py-3 bg-gray-100 text-gray-900 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 text-center"
            >
              Back to Edit
            </Link>
            <button
              onClick={handleConfirmBooking}
              disabled={!termsAccepted || createBookingMutation.isPending}
              className="flex-1 px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
            >
              {createBookingMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Confirming...
                </>
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && bookingContext.inspiration_photos && bookingContext.inspiration_photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
              aria-label="Close lightbox"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            <div className="flex items-center justify-center">
              <img
                src={bookingContext.inspiration_photos[lightboxImageIndex]}
                alt={`Inspiration ${lightboxImageIndex + 1}`}
                className="max-h-[80vh] max-w-full rounded-lg"
              />
            </div>

            {/* Navigation */}
            {bookingContext.inspiration_photos.length > 1 && (
              <>
                <button
                  onClick={previousImage}
                  disabled={lightboxImageIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous image"
                >
                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  disabled={lightboxImageIndex === bookingContext.inspiration_photos.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next image"
                >
                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Image Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full">
                  {lightboxImageIndex + 1} / {bookingContext.inspiration_photos.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default UV_BookingFlow_Review;