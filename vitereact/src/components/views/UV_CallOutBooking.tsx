import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, User, Phone, Mail, FileText, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CallOutFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  preferred_date: string;
  preferred_time: string;
  special_request: string;
}

interface ValidationErrors {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  preferred_date?: string;
  preferred_time?: string;
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const callOutSchema = z.object({
  customer_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  customer_email: z.string().email('Please enter a valid email address').max(255, 'Email too long'),
  customer_phone: z.string()
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long')
    .refine((val) => {
      const cleaned = val.replace(/[\s()-]/g, '');
      return /^\+?[1-9]\d{1,14}$/.test(cleaned);
    }, 'Please enter a valid phone number'),
  customer_address: z.string().min(10, 'Please provide a complete address').max(500, 'Address too long'),
  preferred_date: z.string().min(1, 'Please select a date'),
  preferred_time: z.string().min(1, 'Please select a time'),
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_CallOutBooking: React.FC = () => {
  const navigate = useNavigate();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<CallOutFormData>({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    preferred_date: '',
    preferred_time: '',
    special_request: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // ============================================================================
  // API BASE URL
  // ============================================================================

  const getApiBaseUrl = (): string => {
    if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.API_BASE_URL) {
      return (window as any).__RUNTIME_CONFIG__.API_BASE_URL;
    }
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  // ============================================================================
  // MUTATION - CREATE CALL-OUT BOOKING
  // ============================================================================

  const createCallOutBooking = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/callouts/book`,
        bookingData,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Navigate to confirmation page with callout ID
      navigate(`/callout/confirmation?callout=${data.callout.callout_id}`);
    },
    onError: (error: any) => {
      console.error('Call-out booking error:', error);
      alert(error.response?.data?.message || 'Failed to create call-out booking. Please try again.');
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleInputChange = (field: keyof CallOutFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    try {
      callOutSchema.parse(formData);
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
      }
      return false;
    }
  };

  const handleContinueToConfirmation = () => {
    if (validateForm()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToDetails = () => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const bookingData = {
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone,
      service_address: formData.customer_address,
      appointment_date: formData.preferred_date,
      appointment_time: formData.preferred_time,
      special_request: formData.special_request || null,
    };

    createCallOutBooking.mutate(bookingData);
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getMinDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getMaxDate = (): string => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);
    return maxDate.toISOString().split('T')[0];
  };

  // ============================================================================
  // RENDER STEP 1: DETAILS + DATE/TIME
  // ============================================================================

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white font-bold text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              PREMIUM SERVICE
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Book Call-Out Service
            </h1>
            <p className="text-xl text-gray-300 mb-2">
              We Come To You - €150 All-Inclusive
            </p>
            <p className="text-gray-400">
              Professional barbering at your doorstep
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="space-y-6">
              {/* Personal Details Section */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <User className="w-6 h-6 text-amber-400" />
                  Your Details
                </h2>

                {/* Full Name */}
                <div className="mb-4">
                  <label className="block text-white font-medium mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    className={`w-full px-4 py-3 bg-white/10 border ${
                      validationErrors.customer_name ? 'border-red-500' : 'border-white/30'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    placeholder="Enter your full name"
                  />
                  {validationErrors.customer_name && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {validationErrors.customer_name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label className="block text-white font-medium mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleInputChange('customer_email', e.target.value)}
                    className={`w-full px-4 py-3 bg-white/10 border ${
                      validationErrors.customer_email ? 'border-red-500' : 'border-white/30'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    placeholder="your@email.com"
                  />
                  {validationErrors.customer_email && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {validationErrors.customer_email}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <label className="block text-white font-medium mb-2">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    className={`w-full px-4 py-3 bg-white/10 border ${
                      validationErrors.customer_phone ? 'border-red-500' : 'border-white/30'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    placeholder="+353 83 327 6229"
                  />
                  {validationErrors.customer_phone && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {validationErrors.customer_phone}
                    </p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-white font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-amber-400" />
                    Service Address *
                  </label>
                  <textarea
                    value={formData.customer_address}
                    onChange={(e) => handleInputChange('customer_address', e.target.value)}
                    rows={3}
                    className={`w-full px-4 py-3 bg-white/10 border ${
                      validationErrors.customer_address ? 'border-red-500' : 'border-white/30'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    placeholder="Street address, apartment/suite number, city, postcode"
                  />
                  {validationErrors.customer_address && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {validationErrors.customer_address}
                    </p>
                  )}
                  <p className="text-gray-400 text-sm mt-1">
                    Include apartment number, buzzer code, or parking instructions
                  </p>
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="border-t border-white/20 pt-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-amber-400" />
                  Preferred Date & Time
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Preferred Date *
                    </label>
                    <input
                      type="date"
                      value={formData.preferred_date}
                      onChange={(e) => handleInputChange('preferred_date', e.target.value)}
                      min={getMinDate()}
                      max={getMaxDate()}
                      className={`w-full px-4 py-3 bg-white/10 border ${
                        validationErrors.preferred_date ? 'border-red-500' : 'border-white/30'
                      } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    />
                    {validationErrors.preferred_date && (
                      <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.preferred_date}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Preferred Time *
                    </label>
                    <input
                      type="time"
                      value={formData.preferred_time}
                      onChange={(e) => handleInputChange('preferred_time', e.target.value)}
                      className={`w-full px-4 py-3 bg-white/10 border ${
                        validationErrors.preferred_time ? 'border-red-500' : 'border-white/30'
                      } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    />
                    {validationErrors.preferred_time && (
                      <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.preferred_time}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Request */}
              <div className="border-t border-white/20 pt-6">
                <label className="block text-white font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Special Request (Optional)
                </label>
                <textarea
                  value={formData.special_request}
                  onChange={(e) => handleInputChange('special_request', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Any special requests, parking instructions, or notes for the barber?"
                  maxLength={500}
                />
                <p className="text-gray-400 text-sm mt-1">
                  {formData.special_request.length}/500 characters
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 px-6 py-3 bg-white/10 text-white border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinueToConfirmation}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-amber-500/50 transition-all"
                >
                  Continue to Confirmation
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER STEP 2: CONFIRMATION
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white font-bold text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            CONFIRM YOUR BOOKING
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Review Details
          </h1>
          <p className="text-gray-300">
            Please confirm your call-out service details
          </p>
        </motion.div>

        {/* Confirmation Card */}
        <motion.div
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="space-y-6">
            {/* Service Summary */}
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-2">Call-Out Barber Service</h2>
              <p className="text-gray-300 mb-4">Professional barbering at your location</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total Price</span>
                <span className="text-3xl font-bold text-amber-400">€150</span>
              </div>
            </div>

            {/* Contact Details */}
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Contact Information</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-gray-300">
                  <User className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <span className="text-gray-400 text-sm">Name</span>
                    <p className="text-white">{formData.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-gray-300">
                  <Mail className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <span className="text-gray-400 text-sm">Email</span>
                    <p className="text-white">{formData.customer_email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-gray-300">
                  <Phone className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <span className="text-gray-400 text-sm">Phone</span>
                    <p className="text-white">{formData.customer_phone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Location */}
            <div className="border-t border-white/20 pt-6">
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                Service Location
              </h3>
              <p className="text-white bg-white/10 p-4 rounded-lg">{formData.customer_address}</p>
            </div>

            {/* Date & Time */}
            <div className="border-t border-white/20 pt-6">
              <h3 className="text-xl font-bold text-white mb-3">Scheduled For</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-white/10 p-4 rounded-lg">
                  <Calendar className="w-6 h-6 text-amber-400" />
                  <div>
                    <span className="text-gray-400 text-sm">Date</span>
                    <p className="text-white font-medium">
                      {new Date(formData.preferred_date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-4 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-400" />
                  <div>
                    <span className="text-gray-400 text-sm">Time</span>
                    <p className="text-white font-medium">{formData.preferred_time}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Request */}
            {formData.special_request && (
              <div className="border-t border-white/20 pt-6">
                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Special Request
                </h3>
                <p className="text-white bg-white/10 p-4 rounded-lg">{formData.special_request}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleBackToDetails}
                disabled={createCallOutBooking.isPending}
                className="flex-1 px-6 py-3 bg-white/10 text-white border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                onClick={handleSubmit}
                disabled={createCallOutBooking.isPending}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-amber-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createCallOutBooking.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm Booking
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UV_CallOutBooking;
