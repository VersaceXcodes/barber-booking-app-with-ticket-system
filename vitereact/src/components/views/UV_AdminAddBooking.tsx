import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ============================================================================
// TYPES
// ============================================================================

interface Service {
  service_id: string;
  name: string;
  description: string;
  image_url: string | null;
  duration: number;
  price: number | null;
  is_active: boolean;
  display_order: number;
}

interface TimeSlot {
  time: string;
  available_slots: number;
  total_capacity: number;
  is_available: boolean;
}

interface AvailabilityResponse {
  date: string;
  slots: TimeSlot[];
}

interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
}

interface CreateBookingPayload {
  user_id: null;
  appointment_date: string;
  appointment_time: string;
  slot_duration: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_for_name: string | null;
  service_id: string | null;
  special_request: string | null;
  inspiration_photos: null;
}

interface Booking {
  booking_id: string;
  ticket_number: string;
  status: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string | null;
  special_request: string | null;
  booking_for_name: string | null;
}

interface FormData {
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_for_name: string;
  special_request: string;
  admin_notes: string;
  is_booking_for_other: boolean;
  skip_confirmation: boolean;
  mark_as_prepaid: boolean;
  override_capacity: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================



const SESSION_STORAGE_KEY = 'admin_booking_form_draft';
const DRAFT_EXPIRY_HOURS = 1;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminAddBooking: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ====================================================================
  // GLOBAL STATE (ZUSTAND) - Individual selectors
  // ====================================================================
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // ====================================================================
  // LOCAL STATE
  // ====================================================================
  const [formData, setFormData] = useState<FormData>({
    service_id: '',
    appointment_date: '',
    appointment_time: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    booking_for_name: '',
    special_request: '',
    admin_notes: '',
    is_booking_for_other: false,
    skip_confirmation: false,
    mark_as_prepaid: false,
    override_capacity: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [showCapacityWarning, setShowCapacityWarning] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ====================================================================
  // URL PARAMS EXTRACTION
  // ====================================================================
  const customerIdParam = searchParams.get('customer_id');
  const dateParam = searchParams.get('date');
  const timeParam = searchParams.get('time');

  // ====================================================================
  // API CALLS - FETCH SERVICES
  // ====================================================================
  const {
    data: servicesData,
    isLoading: isLoadingServices,
  } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: async () => {
      const response = await axios.get(
        `${apiBaseUrl}/api/services?is_active=true&sort_by=display_order&sort_order=asc`
      );
      return response.data as Service[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const services = servicesData || [];

  // ====================================================================
  // API CALLS - FETCH CUSTOMER (if customer_id param)
  // ====================================================================
  const {
    data: customerData,
    isLoading: isLoadingCustomer,
  } = useQuery({
    queryKey: ['customer', customerIdParam],
    queryFn: async () => {
      if (!customerIdParam || !authToken) return null;
      const response = await axios.get(
        `${apiBaseUrl}/api/admin/customers/${customerIdParam}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      return response.data as Customer;
    },
    enabled: !!customerIdParam && !!authToken,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ====================================================================
  // API CALLS - FETCH AVAILABILITY (when date selected)
  // ====================================================================
  const {
    data: availabilityData,
    isLoading: isLoadingAvailability,
  } = useQuery({
    queryKey: ['availability', formData.appointment_date, formData.service_id],
    queryFn: async () => {
      if (!formData.appointment_date) return null;
      const serviceParam = formData.service_id ? `?service_id=${formData.service_id}` : '';
      const response = await axios.get(
        `${apiBaseUrl}/api/availability/${formData.appointment_date}${serviceParam}`
      );
      return response.data as AvailabilityResponse;
    },
    enabled: !!formData.appointment_date,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });

  const availableSlots = availabilityData?.slots || [];

  // ====================================================================
  // API CALLS - CREATE BOOKING MUTATION
  // ====================================================================
  const createBookingMutation = useMutation({
    mutationFn: async (payload: CreateBookingPayload) => {
      const response = await axios.post(
        `${apiBaseUrl}/api/bookings`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data as Booking;
    },
    onSuccess: (data) => {
      setCreatedBooking(data);
      setShowSuccessModal(true);
      clearFormDraft();
      // Reset form
      setFormData({
        service_id: '',
        appointment_date: '',
        appointment_time: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        booking_for_name: '',
        special_request: '',
        admin_notes: '',
        is_booking_for_other: false,
        skip_confirmation: false,
        mark_as_prepaid: false,
        override_capacity: false,
      });
      setValidationErrors({});
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create booking';
      alert(`Error: ${errorMessage}`);
    },
  });

  // ====================================================================
  // FORM PERSISTENCE - sessionStorage
  // ====================================================================
  const saveFormDraft = useCallback(() => {
    const draft = {
      formData,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(draft));
  }, [formData]);

  const loadFormDraft = useCallback(() => {
    const draftStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!draftStr) return;

    try {
      const draft = JSON.parse(draftStr);
      const age = Date.now() - draft.timestamp;
      const maxAge = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000;

      if (age < maxAge) {
        setFormData(draft.formData);
      } else {
        clearFormDraft();
      }
    } catch {
      clearFormDraft();
    }
  }, []);

  const clearFormDraft = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  };

  // ====================================================================
  // EFFECTS
  // ====================================================================

  // Load draft on mount
  useEffect(() => {
    loadFormDraft();
  }, [loadFormDraft]);

  // Pre-fill from customer data
  useEffect(() => {
    if (customerData) {
      setFormData(prev => ({
        ...prev,
        customer_name: customerData.name,
        customer_email: customerData.email,
        customer_phone: customerData.phone,
      }));
    }
  }, [customerData]);

  // Pre-select date from URL param
  useEffect(() => {
    if (dateParam && !formData.appointment_date) {
      setFormData(prev => ({ ...prev, appointment_date: dateParam }));
    }
  }, [dateParam]);

  // Pre-select time from URL param (only if slot is available)
  useEffect(() => {
    if (timeParam && formData.appointment_date && availableSlots.length > 0) {
      const slot = availableSlots.find(s => s.time === timeParam);
      if (slot && slot.is_available) {
        setFormData(prev => ({ ...prev, appointment_time: timeParam }));
      }
    }
  }, [timeParam, formData.appointment_date, availableSlots]);

  // Save draft on form data change (debounced)
  useEffect(() => {
    const hasData = Object.values(formData).some(val => val !== '' && val !== false);
    if (hasData) {
      const timer = setTimeout(saveFormDraft, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData, saveFormDraft]);

  // Check capacity warning when time slot selected
  useEffect(() => {
    if (formData.appointment_time && availableSlots.length > 0) {
      const slot = availableSlots.find(s => s.time === formData.appointment_time);
      if (slot && slot.available_slots === 0) {
        setShowCapacityWarning(true);
      } else {
        setShowCapacityWarning(false);
      }
    } else {
      setShowCapacityWarning(false);
    }
  }, [formData.appointment_time, availableSlots]);

  // ====================================================================
  // HANDLERS
  // ====================================================================

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setFormData(prev => ({
      ...prev,
      appointment_date: date,
      appointment_time: '', // Reset time when date changes
    }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const time = e.target.value;
    setFormData(prev => ({ ...prev, appointment_time: time }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Customer Name
    if (!formData.customer_name.trim()) {
      errors.customer_name = 'Customer name is required';
    } else if (formData.customer_name.length < 2 || formData.customer_name.length > 255) {
      errors.customer_name = 'Customer name must be between 2 and 255 characters';
    }

    // Customer Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.customer_email.trim()) {
      errors.customer_email = 'Email is required';
    } else if (!emailRegex.test(formData.customer_email)) {
      errors.customer_email = 'Please enter a valid email address';
    }

    // Customer Phone
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!formData.customer_phone.trim()) {
      errors.customer_phone = 'Phone number is required';
    } else if (!phoneRegex.test(formData.customer_phone.replace(/[\s()-]/g, ''))) {
      errors.customer_phone = 'Please enter a valid phone number';
    }

    // Appointment Date
    if (!formData.appointment_date) {
      errors.appointment_date = 'Please select an appointment date';
    }

    // Appointment Time
    if (!formData.appointment_time) {
      errors.appointment_time = 'Please select a time slot';
    }

    // Special Request length
    if (formData.special_request.length > 1000) {
      errors.special_request = 'Special request must be 1000 characters or less';
    }

    // Admin Notes length
    if (formData.admin_notes.length > 2000) {
      errors.admin_notes = 'Admin notes must be 2000 characters or less';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      alert('Please fix the validation errors before submitting');
      return;
    }

    // If slot is full and override not checked, require confirmation
    if (showCapacityWarning && !formData.override_capacity) {
      alert('This slot is at full capacity. Please check "Override capacity" to proceed.');
      return;
    }

    // If override is checked and slot is full, show confirmation modal
    if (formData.override_capacity && showCapacityWarning) {
      setShowOverrideConfirm(true);
      return;
    }

    // Proceed with booking creation
    await submitBooking();
  };

  const submitBooking = async () => {
    const payload: CreateBookingPayload = {
      user_id: null, // Admin-created bookings are guest bookings
      appointment_date: formData.appointment_date,
      appointment_time: formData.appointment_time,
      slot_duration: 40, // Default duration
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone,
      booking_for_name: formData.is_booking_for_other && formData.booking_for_name
        ? formData.booking_for_name
        : null,
      service_id: formData.service_id || null,
      special_request: formData.special_request || null,
      inspiration_photos: null,
    };

    await createBookingMutation.mutateAsync(payload);
  };

  const handleConfirmOverride = async () => {
    setShowOverrideConfirm(false);
    await submitBooking();
  };

  const handleCancel = () => {
    const hasData = Object.values(formData).some(val => val !== '' && val !== false);
    if (hasData) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirm) return;
    }
    clearFormDraft();
    navigate('/admin/bookings/calendar');
  };

  const handleCreateAnother = () => {
    setShowSuccessModal(false);
    setCreatedBooking(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewBooking = () => {
    if (createdBooking) {
      navigate(`/admin/bookings/${createdBooking.ticket_number}`);
    }
  };

  const handleGoToCalendar = () => {
    if (createdBooking) {
      navigate(`/admin/bookings/calendar?highlight=${createdBooking.ticket_number}`);
    }
  };

  // ====================================================================
  // HELPER FUNCTIONS
  // ====================================================================

  const isPastBooking = (): boolean => {
    if (!formData.appointment_date || !formData.appointment_time) return false;
    const bookingDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`);
    return bookingDateTime < new Date();
  };

  const getSlotCapacityInfo = (time: string): { count: number; capacity: number; available: number } | null => {
    const slot = availableSlots.find(s => s.time === time);
    if (!slot) return null;
    return {
      count: slot.total_capacity - slot.available_slots,
      capacity: slot.total_capacity,
      available: slot.available_slots,
    };
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <nav className="flex items-center text-sm text-gray-600 mb-4">
              <Link to="/admin" className="hover:text-blue-600 transition-colors">
                Admin
              </Link>
              <span className="mx-2">/</span>
              <Link to="/admin/bookings" className="hover:text-blue-600 transition-colors">
                Bookings
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">Add Booking</span>
            </nav>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Add Manual Booking
            </h1>
            <p className="mt-2 text-gray-600 text-base leading-relaxed">
              Create a booking for walk-ins, phone bookings, or record-keeping
            </p>
          </div>

          {/* Main Form Card */}
          <div className="bg-white rounded-xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-8">
              {/* Service Selection */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    1
                  </span>
                  Service Selection
                </h2>
                
                {isLoadingServices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading services...</span>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="service_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Service Type
                    </label>
                    <select
                      id="service_id"
                      value={formData.service_id}
                      onChange={(e) => handleFieldChange('service_id', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
                    >
                      <option value="">None / General Haircut</option>
                      {services.map(service => (
                        <option key={service.service_id} value={service.service_id}>
                          {service.name} {service.price ? `- $${service.price.toFixed(2)}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-gray-500">
                      Optional: Select a specific service or leave as "General Haircut"
                    </p>
                  </div>
                )}
              </div>

              {/* Date & Time Selection */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    2
                  </span>
                  Date & Time
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Picker */}
                  <div>
                    <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Appointment Date *
                    </label>
                    <input
                      type="date"
                      id="appointment_date"
                      value={formData.appointment_date}
                      onChange={handleDateChange}
                      className={`w-full px-4 py-3 rounded-lg border-2 ${
                        validationErrors.appointment_date
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                      } focus:ring-4 transition-all duration-200 outline-none`}
                    />
                    {validationErrors.appointment_date && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.appointment_date}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-500">
                      Past dates allowed for record-keeping
                    </p>
                  </div>

                  {/* Time Slot Selection */}
                  <div>
                    <label htmlFor="appointment_time" className="block text-sm font-medium text-gray-700 mb-2">
                      Time Slot *
                    </label>
                    <select
                      id="appointment_time"
                      value={formData.appointment_time}
                      onChange={handleTimeChange}
                      disabled={!formData.appointment_date || isLoadingAvailability}
                      className={`w-full px-4 py-3 rounded-lg border-2 ${
                        validationErrors.appointment_time
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                      } focus:ring-4 transition-all duration-200 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed`}
                    >
                      <option value="">Select time slot</option>
                      {availableSlots.map(slot => {
                        const capacityInfo = getSlotCapacityInfo(slot.time);
                        return (
                          <option key={slot.time} value={slot.time} disabled={!slot.is_available && !formData.override_capacity}>
                            {slot.time} - {capacityInfo ? `${capacityInfo.count}/${capacityInfo.capacity} booked` : 'Loading...'}
                            {slot.available_slots === 0 ? ' (FULL)' : slot.available_slots === 1 ? ' (1 left)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {validationErrors.appointment_time && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.appointment_time}</p>
                    )}
                    {isLoadingAvailability && (
                      <p className="mt-2 text-sm text-gray-500 flex items-center">
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading availability...
                      </p>
                    )}
                  </div>
                </div>

                {/* Capacity Warning */}
                {showCapacityWarning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex">
                      <svg className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-amber-800">Slot at Capacity</h3>
                        <p className="mt-1 text-sm text-amber-700">
                          This time slot is at full capacity. Check "Override capacity" below to proceed.
                        </p>
                        <div className="mt-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.override_capacity}
                              onChange={(e) => handleFieldChange('override_capacity', e.target.checked)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm font-medium text-amber-900">
                              Override capacity limit
                            </span>
                          </label>
                          {formData.override_capacity && (
                            <p className="mt-2 text-sm text-amber-600 bg-amber-100 px-3 py-2 rounded-md">
                              ⚠️ This will exceed the slot capacity. Confirm before submitting.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Past Date Warning */}
                {isPastBooking() && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                    <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-blue-800">Past Booking</h3>
                      <p className="mt-1 text-sm text-blue-700">
                        This booking is in the past. Status will be set to "Completed" upon creation.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Information */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    3
                  </span>
                  Customer Information
                </h2>

                {isLoadingCustomer && (
                  <div className="flex items-center text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading customer information...
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Name */}
                  <div className="md:col-span-2">
                    <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                      placeholder="John Smith"
                      className={`w-full px-4 py-3 rounded-lg border-2 ${
                        validationErrors.customer_name
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                      } focus:ring-4 transition-all duration-200 outline-none`}
                    />
                    {validationErrors.customer_name && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.customer_name}</p>
                    )}
                  </div>

                  {/* Customer Email */}
                  <div>
                    <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="customer_email"
                      value={formData.customer_email}
                      onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                      placeholder="john@example.com"
                      className={`w-full px-4 py-3 rounded-lg border-2 ${
                        validationErrors.customer_email
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                      } focus:ring-4 transition-all duration-200 outline-none`}
                    />
                    {validationErrors.customer_email && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.customer_email}</p>
                    )}
                  </div>

                  {/* Customer Phone */}
                  <div>
                    <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="customer_phone"
                      value={formData.customer_phone}
                      onChange={(e) => handleFieldChange('customer_phone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className={`w-full px-4 py-3 rounded-lg border-2 ${
                        validationErrors.customer_phone
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                      } focus:ring-4 transition-all duration-200 outline-none`}
                    />
                    {validationErrors.customer_phone && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.customer_phone}</p>
                    )}
                  </div>
                </div>

                {/* Booking for Someone Else */}
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_booking_for_other}
                      onChange={(e) => handleFieldChange('is_booking_for_other', e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Booking for someone else
                    </span>
                  </label>

                  {formData.is_booking_for_other && (
                    <div className="ml-6 animate-fadeIn">
                      <label htmlFor="booking_for_name" className="block text-sm font-medium text-gray-700 mb-2">
                        Person's Name
                      </label>
                      <input
                        type="text"
                        id="booking_for_name"
                        value={formData.booking_for_name}
                        onChange={(e) => handleFieldChange('booking_for_name', e.target.value)}
                        placeholder="e.g., Child's name, family member"
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        We'll still use the contact info above for confirmations
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Options */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    4
                  </span>
                  Special Options
                </h2>

                {/* Special Request */}
                <div>
                  <label htmlFor="special_request" className="block text-sm font-medium text-gray-700 mb-2">
                    Special Request
                  </label>
                  <textarea
                    id="special_request"
                    value={formData.special_request}
                    onChange={(e) => handleFieldChange('special_request', e.target.value)}
                    placeholder="Any special requests or preferences..."
                    rows={3}
                    maxLength={1000}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      validationErrors.special_request
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                    } focus:ring-4 transition-all duration-200 outline-none resize-none`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-gray-500">Optional customer preferences</p>
                    <p className="text-sm text-gray-500">{formData.special_request.length}/1000</p>
                  </div>
                  {validationErrors.special_request && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.special_request}</p>
                  )}
                </div>

                {/* Admin Notes */}
                <div>
                  <label htmlFor="admin_notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes (Private)
                  </label>
                  <textarea
                    id="admin_notes"
                    value={formData.admin_notes}
                    onChange={(e) => handleFieldChange('admin_notes', e.target.value)}
                    placeholder="Internal notes (not visible to customer)..."
                    rows={3}
                    maxLength={2000}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      validationErrors.admin_notes
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                    } focus:ring-4 transition-all duration-200 outline-none resize-none`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-gray-500">Private admin notes</p>
                    <p className="text-sm text-gray-500">{formData.admin_notes.length}/2000</p>
                  </div>
                  {validationErrors.admin_notes && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.admin_notes}</p>
                  )}
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.skip_confirmation}
                      onChange={(e) => handleFieldChange('skip_confirmation', e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Skip confirmation email
                    </span>
                  </label>
                  <p className="ml-6 text-sm text-gray-500">
                    Don't send confirmation email (useful for walk-ins already present)
                  </p>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.mark_as_prepaid}
                      onChange={(e) => handleFieldChange('mark_as_prepaid', e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Mark as pre-paid
                    </span>
                  </label>
                  <p className="ml-6 text-sm text-gray-500">
                    Customer has already paid for this booking
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {createBookingMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Booking...
                    </>
                  ) : (
                    'Create Booking'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={createBookingMutation.isPending}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium border border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Override Capacity Confirmation Modal */}
      {showOverrideConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Override Capacity?</h3>
            </div>

            <p className="text-gray-700 mb-6">
              This slot currently has {getSlotCapacityInfo(formData.appointment_time)?.count || 0} bookings out of{' '}
              {getSlotCapacityInfo(formData.appointment_time)?.capacity || 0} capacity.
              Creating this booking will exceed the capacity limit.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowOverrideConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverride}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
              >
                Proceed with Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && createdBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 animate-fadeIn">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Booking Created Successfully!
            </h2>

            <p className="text-gray-600 text-center mb-6">
              The booking has been created and the customer will receive a confirmation.
            </p>

            {/* Booking Details Card */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Ticket Number:</span>
                <span className="text-lg font-bold text-blue-600">{createdBooking.ticket_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Customer:</span>
                <span className="text-sm text-gray-900">{createdBooking.customer_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Date & Time:</span>
                <span className="text-sm text-gray-900">
                  {new Date(createdBooking.appointment_date).toLocaleDateString()} at{' '}
                  {createdBooking.appointment_time}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleViewBooking}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                View Booking Detail
              </button>

              <button
                onClick={handleCreateAnother}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium border border-gray-300 transition-all duration-200"
              >
                Create Another Booking
              </button>

              <button
                onClick={handleGoToCalendar}
                className="w-full text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Go to Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminAddBooking;