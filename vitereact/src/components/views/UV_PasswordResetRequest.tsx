import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { CheckCircle2, Mail, ArrowLeft, AlertCircle } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PasswordResetRequestPayload {
  email: string;
}

interface PasswordResetResponse {
  message: string;
}

// Zod schema for email validation (from backend schema)
const requestPasswordResetInputSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});



// ============================================================================
// API FUNCTIONS
// ============================================================================

const requestPasswordReset = async (payload: PasswordResetRequestPayload): Promise<PasswordResetResponse> => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.post<PasswordResetResponse>(
    `${apiBaseUrl}/api/auth/request-password-reset`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_PasswordResetRequest: React.FC = () => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resetRequested, setResetRequested] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendAttempts, setResendAttempts] = useState(0);

  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================
  // REACT QUERY MUTATION
  // ========================================================================

  const resetMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => {
      // Always show success state for security (prevent email enumeration)
      setResetRequested(true);
      startCooldownTimer();
    },
    onError: (error: any) => {
      // Even on error, show success for security
      // Only show actual error if it's a network/server issue
      if (axios.isAxiosError(error) && !error.response) {
        setValidationError('Network error. Please check your connection and try again.');
      } else {
        // For any other error (including rate limit), show success state
        setResetRequested(true);
        startCooldownTimer();
      }
    },
  });

  // ========================================================================
  // VALIDATION LOGIC
  // ========================================================================

  const validateEmail = (emailValue: string): boolean => {
    try {
      requestPasswordResetInputSchema.parse({ email: emailValue });
      setValidationError(null);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
      }
      return false;
    }
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleEmailBlur = () => {
    if (email.trim()) {
      validateEmail(email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email before submission
    if (!validateEmail(email)) {
      return;
    }

    // Submit password reset request
    resetMutation.mutate({ email: email.trim() });
  };

  const handleResend = () => {
    if (!canResend) return;

    // Increment resend attempts
    setResendAttempts((prev) => prev + 1);

    // Reset cooldown state
    setCanResend(false);
    setResendCooldown(60);

    // Submit password reset request again
    resetMutation.mutate({ email: email.trim() });
  };

  // ========================================================================
  // COOLDOWN TIMER
  // ========================================================================

  const startCooldownTimer = () => {
    setCanResend(false);
    setResendCooldown(60);

    // Clear any existing interval
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    // Start new countdown
    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const isEmailValid = email.trim().length > 0 && !validationError;
  const isSubmitting = resetMutation.isPending;

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Card Container */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {!resetRequested ? (
              // ============================================================
              // INITIAL STATE - Email Input Form
              // ============================================================
              <>
                {/* Header */}
                <div className="px-6 py-8 sm:px-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-100">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                      <Mail className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h2 className="text-center text-3xl font-bold text-gray-900 leading-tight">
                    Reset Your Password
                  </h2>
                  <p className="mt-3 text-center text-base text-gray-600 leading-relaxed">
                    Enter your email and we'll send you a reset link
                  </p>
                </div>

                {/* Form */}
                <div className="px-6 py-8 sm:px-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Input */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                        Email Address <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={handleEmailChange}
                          onBlur={handleEmailBlur}
                          placeholder="john@example.com"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                            validationError
                              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                              : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                          } text-gray-900 placeholder-gray-400 focus:outline-none`}
                          disabled={isSubmitting}
                        />
                        {validationError && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          </div>
                        )}
                      </div>
                      {validationError && (
                        <p className="mt-2 text-sm text-red-600 flex items-center" role="alert">
                          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                          {validationError}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-gray-500">
                        We'll send a password reset link to this email address
                      </p>
                    </div>

                    {/* Submit Button */}
                    <div>
                      <button
                        type="submit"
                        disabled={!isEmailValid || isSubmitting}
                        className="w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:hover:shadow-lg"
                      >
                        {isSubmitting ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-5 h-5 mr-2" />
                            Send Reset Link
                          </>
                        )}
                      </button>
                    </div>

                    {/* Back to Login Link */}
                    <div className="text-center">
                      <Link
                        to="/login"
                        className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Login
                      </Link>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              // ============================================================
              // SUCCESS STATE - Email Sent Confirmation
              // ============================================================
              <>
                {/* Success Header */}
                <div className="px-6 py-8 sm:px-8 bg-gradient-to-br from-green-50 to-emerald-50 border-b border-green-100">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center animate-scale-in">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <h2 className="text-center text-3xl font-bold text-gray-900 leading-tight">
                    Check Your Email
                  </h2>
                  <p className="mt-3 text-center text-base text-gray-700 leading-relaxed">
                    We sent a password reset link to
                  </p>
                  <p className="mt-2 text-center text-lg font-semibold text-blue-600">
                    {email}
                  </p>
                </div>

                {/* Success Body */}
                <div className="px-6 py-8 sm:px-8 space-y-6">
                  {/* Important Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      The link expires in 1 hour
                    </p>
                    <p className="text-sm text-blue-700">
                      Click the link in the email to create your new password. If you don't see the email, check your spam folder.
                    </p>
                  </div>

                  {/* Didn't Receive Email Section */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Didn't receive it?
                    </h3>
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-start text-sm text-gray-600">
                        <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Check your spam or junk folder</span>
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Make sure you entered the correct email address</span>
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Wait a few minutes for the email to arrive</span>
                      </li>
                    </ul>

                    {/* Resend Button */}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={!canResend || isSubmitting}
                      className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Sending...
                        </>
                      ) : !canResend && resendCooldown > 0 ? (
                        <>Resend in {resendCooldown}s</>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Resend reset link
                        </>
                      )}
                    </button>

                    {resendAttempts > 0 && (
                      <p className="mt-3 text-xs text-gray-500 text-center">
                        {resendAttempts === 1 ? '1 resend attempt' : `${resendAttempts} resend attempts`}
                      </p>
                    )}
                  </div>

                  {/* Back to Login Link */}
                  <div className="border-t border-gray-200 pt-6">
                    <Link
                      to="/login"
                      className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100 transition-all duration-200"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Login
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Help Text Below Card */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <a
                href="tel:+15551234567"
                className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes scale-in {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
      `}</style>
    </>
  );
};

export default UV_PasswordResetRequest;