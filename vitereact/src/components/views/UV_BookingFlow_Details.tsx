import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronDown, ChevronUp, X, Check, AlertCircle, User, Mail, Phone, FileText, Image, Calendar, Clock, MapPin } from 'lucide-react';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string | null;
  booking_for_name: string | null;
  special_request: string | null;
  inspiration_photos: string[] | null;
}

interface ValidationErrors {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  booking_for_name?: string;
  special_request?: string;
}

// Validation schema subset for customer details
const customerDetailsSchema = z.object({
  customer_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').regex(/^[a-zA-Z\s]+$/, 'Name must contain only letters and spaces'),
  customer_email: z.string().email('Please enter a valid email address').max(255, 'Email too long'),
  customer_phone: z.string()
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long')
    .refine((val) => {
      // Strip formatting characters before validation
      const cleaned = val.replace(/[\s()-]/g, '');
      return /^\+?[1-9]\d{1,14}$/.test(cleaned);
    }, 'Please enter a valid phone number'),
  customer_address: z.string().min(5, 'Address must be at least 5 characters').max(500, 'Address too long').nullable(),
  booking_for_name: z.string().max(255, 'Name too long').nullable(),
  special_request: z.string().max(500, 'Special request must be 500 characters or less').nullable(),
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_BookingFlow_Details: React.FC = () => {
  const navigate = useNavigate();

  // ============================================================================
  // ZUSTAND STORE ACCESS - CRITICAL: Individual selectors only!
  // ============================================================================
  
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const bookingContext = useAppStore(state => state.booking_context);
  const updateBookingContext = useAppStore(state => state.update_booking_context);
  const updateCurrentUser = useAppStore(state => state.update_current_user);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: null,
    booking_for_name: null,
    special_request: null,
    inspiration_photos: null,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [useProfileDetails, setUseProfileDetails] = useState(true);
  const [updateProfileWithChanges, setUpdateProfileWithChanges] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const [showBookingForField, setShowBookingForField] = useState(false);
  const [showSpecialRequest, setShowSpecialRequest] = useState(false);
  const [showInspirationPhotos, setShowInspirationPhotos] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoUrlError, setPhotoUrlError] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  // ============================================================================
  // API BASE URL
  // ============================================================================

  const getApiBaseUrl = (): string => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  // ============================================================================
  // FETCH USER PROFILE (if authenticated)
  // ============================================================================

  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      if (!isAuthenticated || !authToken) {
        return null;
      }

      const response = await axios.get(
        `${getApiBaseUrl()}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return response.data.user;
    },
    enabled: isAuthenticated && !!authToken && useProfileDetails,
    staleTime: 60000,
  });

  useEffect(() => {
    if (profileData && useProfileDetails) {
      setFormData(prev => ({
        ...prev,
        customer_name: profileData.name || '',
        customer_email: profileData.email || '',
        customer_phone: profileData.phone || '',
      }));
    }
  }, [profileData, useProfileDetails]);

  // ============================================================================
  // UPDATE USER PROFILE MUTATION
  // ============================================================================

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { name: string; email: string; phone: string }) => {
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      const response = await axios.patch(
        `${getApiBaseUrl()}/api/auth/me`,
        updates,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return response.data;
    },
    onSuccess: (data) => {
      // Update global state with new user data
      if (data.user) {
        updateCurrentUser({
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
        });
      }
    },
  });

  // ============================================================================
  // INITIALIZE FORM FROM BOOKING CONTEXT (on mount)
  // ============================================================================

  useEffect(() => {
    // Restore form data from booking context if user navigated back
    if (bookingContext.customer_name || bookingContext.customer_email || bookingContext.customer_phone) {
      setFormData({
        customer_name: bookingContext.customer_name || '',
        customer_email: bookingContext.customer_email || '',
        customer_phone: bookingContext.customer_phone || '',
        customer_address: bookingContext.customer_address || null,
        booking_for_name: bookingContext.booking_for_name || null,
        special_request: bookingContext.special_request || null,
        inspiration_photos: bookingContext.inspiration_photos || null,
      });

      // Set character count if special request exists
      if (bookingContext.special_request) {
        setCharacterCount(bookingContext.special_request.length);
        setShowSpecialRequest(true);
      }

      // Show booking for field if data exists
      if (bookingContext.booking_for_name) {
        setShowBookingForField(true);
      }

      // Show photos section if data exists
      if (bookingContext.inspiration_photos && bookingContext.inspiration_photos.length > 0) {
        setShowInspirationPhotos(true);
      }
    }
    // If authenticated and no booking context data, pre-fill from user will happen via useQuery
  }, [bookingContext]);

  // ============================================================================
  // VALIDATION FUNCTIONS
  // ============================================================================

  const validateField = useCallback((fieldName: keyof FormData, value: any) => {
    try {
      const fieldSchema = customerDetailsSchema.shape[fieldName as keyof typeof customerDetailsSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldName as keyof ValidationErrors];
          return newErrors;
        });
        return true;
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationErrors(prev => ({
          ...prev,
          [fieldName]: error.errors[0].message,
        }));
        return false;
      }
      return true;
    }
  }, []);

  const validateAllFields = useCallback((): boolean => {
    try {
      // For call-out services, address is required
      const validationData: any = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        customer_address: bookingContext.is_callout ? formData.customer_address : null,
        booking_for_name: formData.booking_for_name,
        special_request: formData.special_request,
      };

      customerDetailsSchema.parse(validationData);

      // Additional check for call-out address requirement
      if (bookingContext.is_callout && !formData.customer_address?.trim()) {
        setValidationErrors({ customer_address: 'Address is required for call-out service' });
        return false;
      }

      setValidationErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationErrors = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof ValidationErrors] = err.message;
          }
        });
        setValidationErrors(errors);
        return false;
      }
      return false;
    }
  }, [formData, bookingContext.is_callout]);

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field as keyof ValidationErrors];
      return newErrors;
    });

    // Update character count for special request
    if (field === 'special_request') {
      setCharacterCount(value.length);
    }
  };

  const handleFieldBlur = (field: keyof FormData) => {
    const value = formData[field];
    validateField(field, value);
  };

  const handlePhotoUrlAdd = () => {
    setPhotoUrlError('');
    
    if (!photoUrlInput.trim()) {
      setPhotoUrlError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(photoUrlInput);
    } catch {
      setPhotoUrlError('Please enter a valid URL');
      return;
    }

    // Check if already added
    if (formData.inspiration_photos && formData.inspiration_photos.includes(photoUrlInput)) {
      setPhotoUrlError('This URL has already been added');
      return;
    }

    // Check max 3 photos
    if (formData.inspiration_photos && formData.inspiration_photos.length >= 3) {
      setPhotoUrlError('Maximum 3 photos allowed');
      return;
    }

    // Add URL to photos array
    setFormData(prev => ({
      ...prev,
      inspiration_photos: prev.inspiration_photos 
        ? [...prev.inspiration_photos, photoUrlInput]
        : [photoUrlInput],
    }));

    setPhotoUrlInput('');
  };

  const handleRemovePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      inspiration_photos: prev.inspiration_photos
        ? prev.inspiration_photos.filter((_, i) => i !== index)
        : null,
    }));
  };

  const handleContinue = async () => {
    // Validate all fields
    const isValid = validateAllFields();
    if (!isValid) {
      // Scroll to first error
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // Show loading indicator
    setIsNavigating(true);

    // Update booking context with form data
    updateBookingContext({
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone,
      customer_address: formData.customer_address,
      booking_for_name: formData.booking_for_name,
      special_request: formData.special_request,
      inspiration_photos: formData.inspiration_photos,
      step_completed: 4,
    });

    // If authenticated and update profile checkbox is checked, update profile
    if (isAuthenticated && updateProfileWithChanges) {
      try {
        await updateProfileMutation.mutateAsync({
          name: formData.customer_name,
          email: formData.customer_email,
          phone: formData.customer_phone,
        });
      } catch (error) {
        console.error('Failed to update profile:', error);
        // Don't block navigation on profile update failure
      }
    }

    // Navigate to review
    navigate('/book/review');
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isFormValid = 
    formData.customer_name.trim().length > 0 &&
    formData.customer_email.trim().length > 0 &&
    formData.customer_phone.trim().length > 0 &&
    (!bookingContext.is_callout || (formData.customer_address?.trim().length || 0) > 0) &&
    Object.keys(validationErrors).length === 0;

  const progressStep = bookingContext.service_id ? 4 : 3;
  const totalSteps = bookingContext.service_id ? 4 : 3;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Your Details
            </h1>
            <p className="text-gray-600 text-lg">
              {isAuthenticated
                ? "We've pre-filled your information. Update if needed."
                : "We need your contact details to confirm your booking"}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <span>Step {progressStep} of {totalSteps}</span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progressStep / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              Booking Summary
            </h2>
            <div className="space-y-3">
              {bookingContext.service_name && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-700">
                    <User className="w-5 h-5 mr-2 text-gray-400" />
                    <span>Service:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{bookingContext.service_name}</span>
                    <Link
                      to="/book/service"
                      className="text-blue-600 hover:text-blue-700 text-sm underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              )}
              {bookingContext.selected_date && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-700">
                    <Calendar className="w-5 h-5 mr-2 text-gray-400" />
                    <span>Date:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">
                      {new Date(bookingContext.selected_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <Link
                      to="/book/date"
                      className="text-blue-600 hover:text-blue-700 text-sm underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              )}
              {bookingContext.selected_time && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-700">
                    <Clock className="w-5 h-5 mr-2 text-gray-400" />
                    <span>Time:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{bookingContext.selected_time}</span>
                    <Link
                      to="/book/time"
                      className="text-blue-600 hover:text-blue-700 text-sm underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Call-Out Service Banner */}
          {bookingContext.is_callout && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-6 mb-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-orange-900 mb-2 flex items-center">
                    <span className="mr-2">Premium Call-Out Service</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      €150
                    </span>
                  </h3>
                  <p className="text-orange-800 text-sm leading-relaxed">
                    A Master Fade barber will come to your location. Please provide your full address including any special instructions (parking, buzzer, floor number, etc.) in the address or notes field below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Guest User Banner */}
          {!isAuthenticated && !bookingContext.is_callout && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-sm">
                <strong>Tip:</strong> Create a free account to save your details for faster booking next time.{' '}
                <Link to="/register" className="underline font-medium hover:text-blue-900">
                  Sign up here
                </Link>
              </p>
            </div>
          )}

          {/* Main Form Card */}
          <form 
            className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              handleContinue();
            }}
            aria-label="Booking Details Form"
            role="form"
          >
            {/* Profile Pre-fill Toggle (Registered Users Only) */}
            {isAuthenticated && (
              <div className="mb-6 pb-6 border-b border-gray-200">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProfileDetails}
                    onChange={(e) => setUseProfileDetails(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 font-medium">Use my profile details</span>
                </label>
              </div>
            )}

            {/* Loading State */}
            {isLoadingProfile && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading your profile...</p>
              </div>
            )}

            {/* Form Fields */}
            {!isLoadingProfile && (
              <div className="space-y-6">
                {/* Required Fields Header */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Fields marked with <span className="text-red-600">*</span> are required
                  </p>
                </div>

                {/* Full Name */}
                <div>
                  <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                     <input
                      id="customer_name"
                      name="customer_name"
                      data-testid="customer-name-input"
                      aria-label="Full Name"
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                      onBlur={() => handleFieldBlur('customer_name')}
                      placeholder="John Smith"
                      aria-required="true"
                      aria-invalid={!!validationErrors.customer_name}
                      aria-describedby={validationErrors.customer_name ? "customer-name-error" : undefined}
                      className={`block w-full pl-10 pr-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all ${
                        validationErrors.customer_name
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                   {validationErrors.customer_name && (
                    <p id="customer-name-error" className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.customer_name}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">First and last name</p>
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                     <input
                      id="customer_email"
                      name="customer_email"
                      data-testid="customer-email-input"
                      aria-label="Email Address"
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                      onBlur={() => handleFieldBlur('customer_email')}
                      placeholder="john@example.com"
                      aria-required="true"
                      aria-invalid={!!validationErrors.customer_email}
                      aria-describedby={validationErrors.customer_email ? "customer-email-error" : undefined}
                      className={`block w-full pl-10 pr-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all ${
                        validationErrors.customer_email
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                   {validationErrors.customer_email && (
                    <p id="customer-email-error" className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.customer_email}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">We'll send your confirmation here</p>
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number (WhatsApp preferred) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                     <input
                      id="customer_phone"
                      name="customer_phone"
                      data-testid="customer-phone-input"
                      aria-label="Phone Number"
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => handleFieldChange('customer_phone', e.target.value)}
                      onBlur={() => handleFieldBlur('customer_phone')}
                      placeholder="+1 (555) 123-4567"
                      aria-required="true"
                      aria-invalid={!!validationErrors.customer_phone}
                      aria-describedby={validationErrors.customer_phone ? "customer-phone-error" : undefined}
                      className={`block w-full pl-10 pr-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all ${
                        validationErrors.customer_phone
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                   {validationErrors.customer_phone && (
                    <p id="customer-phone-error" className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.customer_phone}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">For confirmation and reminders</p>
                </div>

                {/* Address (Call-Out Service Only) */}
                {bookingContext.is_callout && (
                  <div>
                    <label htmlFor="customer_address" className="block text-sm font-medium text-gray-700 mb-2">
                      Service Address <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-orange-500" />
                      </div>
                      <input
                        id="customer_address"
                        name="customer_address"
                        data-testid="customer-address-input"
                        aria-label="Service Address"
                        type="text"
                        value={formData.customer_address || ''}
                        onChange={(e) => handleFieldChange('customer_address', e.target.value)}
                        onBlur={() => handleFieldBlur('customer_address')}
                        placeholder="123 Main St, Dublin 1, D01 ABC1"
                        aria-required="true"
                        aria-invalid={!!validationErrors.customer_address}
                        aria-describedby={validationErrors.customer_address ? "customer-address-error" : undefined}
                        className={`block w-full pl-10 pr-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all ${
                          validationErrors.customer_address
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-orange-200 focus:border-orange-500'
                        }`}
                      />
                    </div>
                    {validationErrors.customer_address && (
                      <p id="customer-address-error" className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {validationErrors.customer_address}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">
                      <span className="flex items-center text-orange-600 font-medium">
                        <MapPin className="w-4 h-4 mr-1" />
                        A Master Fade barber will come to your location
                      </span>
                    </p>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Optional Fields Header */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Additional Information</h3>
                  <p className="text-sm text-gray-600">Optional - help us serve you better</p>
                </div>

                {/* Special Request - Expandable */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSpecialRequest(!showSpecialRequest)}
                    className="flex items-center justify-between w-full text-left text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <span className="flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Add special request (optional)
                    </span>
                    {showSpecialRequest ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  {showSpecialRequest && (
                    <div className="mt-4 space-y-2">
                      <label htmlFor="special_request" className="block text-sm font-medium text-gray-700">
                        Special Request
                      </label>
                      <textarea
                        id="special_request"
                        value={formData.special_request || ''}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) {
                            handleFieldChange('special_request', e.target.value);
                          }
                        }}
                        onBlur={() => handleFieldBlur('special_request')}
                        placeholder="e.g., 'low fade', 'beard only', 'sensitive skin', 'don't call, text only'"
                        rows={4}
                        maxLength={500}
                        className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none"
                      />
                      <div className="flex items-center justify-between text-sm">
                        <p className="text-gray-500">Tell us your preferences or requirements</p>
                        <span className={`font-medium ${characterCount > 450 ? 'text-red-600' : 'text-gray-600'}`}>
                          {characterCount}/500
                        </span>
                      </div>
                      {validationErrors.special_request && (
                        <p className="text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {validationErrors.special_request}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Booking for Someone Else - Checkbox */}
                <div>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBookingForField}
                      onChange={(e) => {
                        setShowBookingForField(e.target.checked);
                        if (!e.target.checked) {
                          handleFieldChange('booking_for_name', '');
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-900 font-medium">I'm booking this appointment for someone else</span>
                  </label>

                  {showBookingForField && (
                    <div className="mt-4">
                      <label htmlFor="booking_for_name" className="block text-sm font-medium text-gray-700 mb-2">
                        Person's Name
                      </label>
                      <input
                        id="booking_for_name"
                        type="text"
                        value={formData.booking_for_name || ''}
                        onChange={(e) => handleFieldChange('booking_for_name', e.target.value)}
                        onBlur={() => handleFieldBlur('booking_for_name')}
                        placeholder="Child's name, family member, etc."
                        className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      />
                      <p className="mt-1 text-sm text-gray-500">We'll still use your contact for confirmations</p>
                      {validationErrors.booking_for_name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {validationErrors.booking_for_name}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Inspiration Photos - Expandable */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowInspirationPhotos(!showInspirationPhotos)}
                    className="flex items-center justify-between w-full text-left text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <span className="flex items-center">
                      <Image className="w-5 h-5 mr-2" />
                      Add photos or style inspiration (optional)
                    </span>
                    {showInspirationPhotos ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  {showInspirationPhotos && (
                    <div className="mt-4 space-y-4">
                      {/* URL Input Method */}
                      <div>
                        <label htmlFor="photo_url" className="block text-sm font-medium text-gray-700 mb-2">
                          Paste Image URL
                        </label>
                        <div className="flex space-x-2">
                          <input
                            id="photo_url"
                            type="url"
                            value={photoUrlInput}
                            onChange={(e) => {
                              setPhotoUrlInput(e.target.value);
                              setPhotoUrlError('');
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handlePhotoUrlAdd();
                              }
                            }}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                          />
                          <button
                            type="button"
                            onClick={handlePhotoUrlAdd}
                            disabled={!photoUrlInput.trim() || (formData.inspiration_photos?.length || 0) >= 3}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Add
                          </button>
                        </div>
                        {photoUrlError && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {photoUrlError}
                          </p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">Maximum 3 images</p>
                      </div>

                      {/* Photo Thumbnails */}
                      {formData.inspiration_photos && formData.inspiration_photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-4">
                          {formData.inspiration_photos.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Inspiration ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                                onError={(e) => {
                                  // Handle broken image
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index)}
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors shadow-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Update Profile Checkbox (Registered Users Only) */}
                {isAuthenticated && (
                  <div className="pt-6 border-t border-gray-200">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateProfileWithChanges}
                        onChange={(e) => setUpdateProfileWithChanges(e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900">Update my profile with these changes</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              to="/book/time"
              data-testid="back-button"
              id="back-button"
              aria-label="Back to Time Selection"
              role="button"
              tabIndex={0}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 border border-gray-300 text-center transition-colors"
            >
              Back
            </Link>
            <button
              onClick={handleContinue}
              disabled={!isFormValid || updateProfileMutation.isPending || isNavigating}
              data-testid="continue-to-review-button"
              id="continue-to-review-button"
              name="continue-to-review"
              aria-label="Continue to Review"
              title="Continue to Review"
              type="button"
              role="button"
              tabIndex={0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              {(updateProfileMutation.isPending || isNavigating) ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isNavigating ? 'Loading...' : 'Processing...'}
                </span>
              ) : (
                'Continue to Review'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_BookingFlow_Details;