import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface VerifyEmailRequest {
  verification_token: string;
}

interface VerifyEmailResponse {
  user: {
    user_id: string;
    email: string;
    name: string;
    phone: string;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
  };
  token?: string;
  message: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  is_verified: boolean;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_EmailVerificationSuccess: React.FC = () => {
  // ========================================================================
  // HOOKS & STATE
  // ========================================================================

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract verification token from URL
  const verification_token = searchParams.get('token') || '';

  // Local state
  const [showToast, setShowToast] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const bookingContext = useAppStore(state => state.booking_context);
  const initializeAuth = useAppStore(state => state.initialize_auth);

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  const getApiBaseUrl = (): string => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  const mapBackendUserToFrontend = (backendUser: VerifyEmailResponse['user']): User => {
    return {
      id: backendUser.user_id,
      email: backendUser.email,
      name: backendUser.name,
      phone: backendUser.phone,
      is_verified: backendUser.is_verified,
      created_at: backendUser.created_at,
    };
  };

  const updatePersistedAuthState = (user: User, token: string) => {
    // Get current booking context to preserve it
    const currentBookingContext = bookingContext;

    // Construct the persisted state structure (matching Zustand persist format)
    const persistedState = {
      state: {
        authentication_state: {
          current_user: user,
          auth_token: token,
          authentication_status: {
            is_authenticated: true,
            is_loading: false,
            user_type: 'user' as const,
          },
          error_message: null,
        },
        booking_context: currentBookingContext,
      },
      version: 0,
    };

    // Save to localStorage (Zustand persist key)
    try {
      localStorage.setItem('barberslot-storage', JSON.stringify(persistedState));
      return true;
    } catch (error) {
      console.error('Failed to update persisted auth state:', error);
      return false;
    }
  };

  // ========================================================================
  // API MUTATION
  // ========================================================================

  const verifyEmailMutation = useMutation<VerifyEmailResponse, Error, VerifyEmailRequest>({
    mutationFn: async (data: VerifyEmailRequest) => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/auth/verify-email`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Map backend user to frontend format
      const mappedUser = mapBackendUserToFrontend(data.user);

      // Update persisted auth state if token provided
      if (data.token) {
        const success = updatePersistedAuthState(mappedUser, data.token);
        
        if (success) {
          // Show success toast
          setShowToast(true);
          
          // Initialize auth from updated localStorage
          setTimeout(async () => {
            await initializeAuth();
            setShowToast(false);
          }, 2000);
        }
      } else {
        // No token provided - just show success
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    },
    onError: (error: Error) => {
      console.error('Email verification failed:', error);
    },
  });

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Verify email on mount
  useEffect(() => {
    if (verification_token) {
      verifyEmailMutation.mutate({ verification_token });
    } else {
      verifyEmailMutation.mutate({ verification_token: 'invalid' });
    }
  }, [verification_token, verifyEmailMutation]);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  // Determine if booking flow was in progress
  const hasBookingContext = bookingContext.step_completed > 0;

  // Extract first name from verified user
  const firstName = verifyEmailMutation.data?.user.name.split(' ')[0] || 'there';

  // Get verified user email for display
  const verifiedEmail = verifyEmailMutation.data?.user.email || '';

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleContinueToDashboard = () => {
    setIsRedirecting(true);
    // Small delay to show redirecting state
    setTimeout(() => {
      navigate('/dashboard');
    }, 500);
  };

  const handleContinueBooking = () => {
    setIsRedirecting(true);
    
    // Determine which booking step to return to based on completed steps
    const step = bookingContext.step_completed;
    let targetRoute = '/book/service';

    if (step >= 4) {
      targetRoute = '/book/review';
    } else if (step >= 3) {
      targetRoute = '/book/details';
    } else if (step >= 2) {
      targetRoute = '/book/time';
    } else if (step >= 1) {
      targetRoute = '/book/date';
    }

    setTimeout(() => {
      navigate(targetRoute);
    }, 500);
  };

  const handleBookFirstAppointment = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      navigate('/book/service');
    }, 500);
  };

  // ========================================================================
  // RENDER: LOADING STATE
  // ========================================================================

  if (verifyEmailMutation.isPending) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
          <div className="text-center">
            <div className="mb-6 relative">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="w-12 h-12 animate-spin text-amber-400" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-master-text-primary-dark mb-3">
              Verifying Your Email...
            </h2>
            <p className="text-master-text-secondary-dark text-lg">
              Please wait while we confirm your account
            </p>
            <div className="mt-6 flex justify-center space-x-1">
              <div className="w-2 h-2 bg-gradient-to-r from-red-600 to-red-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gradient-to-r from-red-600 to-red-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gradient-to-r from-red-600 to-red-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ========================================================================
  // RENDER: ERROR STATE
  // ========================================================================

  if (verifyEmailMutation.isError || !verification_token) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-4 py-12">
          <div className="max-w-md w-full">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-red-100 overflow-hidden">
              {/* Error Header */}
              <div className="bg-gradient-to-br from-red-500 to-red-600 px-8 py-10 text-center">
                <div className="mb-4">
                  <AlertCircle className="w-16 h-16 text-master-text-primary-dark mx-auto" strokeWidth={2} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-master-text-primary-dark mb-2">
                  Verification Failed
                </h2>
              </div>

              {/* Error Content */}
              <div className="px-8 py-8">
                <div className="mb-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-400 text-sm leading-relaxed">
                      <strong className="font-semibold">The verification link is invalid or has expired.</strong>
                    </p>
                    <p className="text-red-300 text-sm mt-2">
                      This can happen if:
                    </p>
                    <ul className="text-red-300 text-sm mt-2 ml-4 list-disc space-y-1">
                      <li>The link is more than 24 hours old</li>
                      <li>The link has already been used</li>
                      <li>The link was copied incorrectly</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="block w-full bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark px-6 py-3 rounded-lg font-semibold text-center hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    Go to Login
                  </Link>
                  <p className="text-sm text-master-text-secondary-dark text-center px-4">
                    You can request a new verification email from the login page
                  </p>
                  <div className="pt-3 border-t border-white/10">
                    <Link
                      to="/"
                      className="block text-center text-master-text-secondary-dark hover:text-master-text-primary-dark text-sm font-medium transition-colors"
                    >
                      ← Return to Home
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ========================================================================
  // RENDER: SUCCESS STATE
  // ========================================================================

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-indigo-100 px-4 py-12">
        <div className="max-w-2xl w-full">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Success Header with Animation */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-8 py-12 text-center relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-[#2D0808] opacity-10 rounded-full -translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#2D0808] opacity-10 rounded-full translate-x-20 translate-y-20"></div>
              
              <div className="relative z-10">
                <div className="mb-6 inline-block">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#2D0808] opacity-20 rounded-full animate-ping"></div>
                    <CheckCircle 
                      className="w-20 h-20 text-master-text-primary-dark relative z-10 animate-bounce" 
                      strokeWidth={2.5} 
                      fill="rgba(255,255,255,0.2)"
                    />
                  </div>
                </div>
                
                <h1 className="text-3xl md:text-4xl font-bold text-master-text-primary-dark mb-3 leading-tight">
                  Email Verified!
                </h1>
                <p className="text-lg md:text-xl text-green-50 mb-3 leading-relaxed">
                  Your account is now active and ready to use
                </p>
                <p className="text-xl md:text-2xl font-semibold text-master-text-primary-dark">
                  Welcome to BarberSlot, {firstName}!
                </p>
              </div>
            </div>

            {/* Main Content */}
            <div className="px-6 sm:px-8 py-10">
              {/* Feature Highlights */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-master-text-primary-dark mb-5 text-center">
                  What you can do now:
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Feature 1: Faster Booking */}
                  <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-5 border border-blue-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-semibold text-master-text-primary-dark mb-1">
                          Faster Booking
                        </h4>
                        <p className="text-xs text-master-text-secondary-dark leading-relaxed">
                          Your details are saved for quick appointments
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feature 2: Booking History */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-semibold text-master-text-primary-dark mb-1">
                          Booking History
                        </h4>
                        <p className="text-xs text-master-text-secondary-dark leading-relaxed">
                          Track all your past and upcoming visits
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feature 3: Easy Management */}
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-5 border border-amber-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-semibold text-master-text-primary-dark mb-1">
                          Easy Management
                        </h4>
                        <p className="text-xs text-master-text-secondary-dark leading-relaxed">
                          Cancel or reschedule appointments anytime
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Primary CTA - Context Dependent */}
                {hasBookingContext ? (
                  <button
                    onClick={handleContinueBooking}
                    disabled={isRedirecting}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-master-text-primary-dark px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    {isRedirecting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        Continue Booking
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleContinueToDashboard}
                    disabled={isRedirecting}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-master-text-primary-dark px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    {isRedirecting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        Continue to Dashboard
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                )}

                {/* Secondary CTA - Book First Appointment (only if no booking context) */}
                {!hasBookingContext && (
                  <button
                    onClick={handleBookFirstAppointment}
                    disabled={isRedirecting}
                    className="w-full bg-[#2D0808] text-amber-400 px-8 py-4 rounded-lg font-semibold text-lg border-2 border-red-600 hover:bg-[#2D0808] transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Book Your First Appointment
                  </button>
                )}

                {/* Tertiary Link - Return Home */}
                <div className="text-center pt-2">
                  <Link
                    to="/"
                    className="text-master-text-secondary-dark hover:text-master-text-primary-dark text-sm font-medium transition-colors inline-flex items-center group"
                  >
                    <svg className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Return to Home
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info - Email Confirmation */}
          {verifiedEmail && (
            <div className="mt-6 text-center">
              <div className="bg-[#2D0808] bg-opacity-80 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 shadow-sm">
                <p className="text-sm text-master-text-secondary-dark leading-relaxed">
                  <span className="inline-flex items-center">
                    <svg className="w-4 h-4 mr-1.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    A confirmation email has been sent to
                  </span>
                  <br />
                  <span className="font-semibold text-master-text-primary-dark">{verifiedEmail}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-master-text-primary-dark px-6 py-4 rounded-lg shadow-2xl border border-green-500 flex items-center space-x-3 max-w-sm">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-semibold text-sm">Account verified successfully!</p>
              <p className="text-xs text-green-100 mt-0.5">You're all set to start booking</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default UV_EmailVerificationSuccess;