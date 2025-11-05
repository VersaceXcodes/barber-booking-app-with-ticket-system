import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Mail, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ResendVerificationPayload {
  email: string;
}

interface ResendVerificationResponse {
  message: string;
}

interface ChangeEmailPayload {
  email: string;
}

interface ChangeEmailResponse {
  user: {
    user_id: string;
    email: string;
    name: string;
    phone: string;
    is_verified: boolean;
    created_at: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_EmailVerificationPending: React.FC = () => {
  // ==========================================================================
  // LOCATION STATE
  // ==========================================================================
  
  const location = useLocation();
  const locationEmail = (location.state as any)?.email;
  
  // ==========================================================================
  // ZUSTAND STORE ACCESS (Individual selectors - CRITICAL for avoiding loops)
  // ==========================================================================
  
  const storeEmail = useAppStore(state => state.authentication_state.current_user?.email);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateCurrentUser = useAppStore(state => state.update_current_user);
  
  // Use email from store first, fallback to location state
  const userEmail = storeEmail || locationEmail;

  // ==========================================================================
  // LOCAL STATE
  // ==========================================================================
  
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [resendAttempts, setResendAttempts] = useState(0);

  // ==========================================================================
  // COUNTDOWN TIMER EFFECT
  // ==========================================================================
  
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [resendCooldown]);

  // ==========================================================================
  // RESEND VERIFICATION EMAIL MUTATION
  // ==========================================================================
  
  const resendVerificationMutation = useMutation<
    ResendVerificationResponse,
    Error,
    ResendVerificationPayload
  >({
    mutationFn: async (payload: ResendVerificationPayload) => {
      const response = await axios.post<ResendVerificationResponse>(
        `${getApiBaseUrl()}/api/auth/resend-verification`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        }
      );
      return response.data;
    },
  });

  useEffect(() => {
    if (resendVerificationMutation.isSuccess) {
      // Reset cooldown timer
      setResendCooldown(60);
      setCanResend(false);
      setResendAttempts((prev) => prev + 1);

      // Show success message
      setResendSuccess('Verification email sent! Check your inbox.');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(null);
      }, 5000);
    }

    if (resendVerificationMutation.isError) {
      console.error('Resend verification failed:', resendVerificationMutation.error);
    }
  }, [resendVerificationMutation.isSuccess, resendVerificationMutation.isError, resendVerificationMutation.error]);

  // ==========================================================================
  // CHANGE EMAIL MUTATION
  // ==========================================================================
  
  const changeEmailMutation = useMutation<
    ChangeEmailResponse,
    Error,
    ChangeEmailPayload
  >({
    mutationFn: async (payload: ChangeEmailPayload) => {
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      const response = await axios.patch<ChangeEmailResponse>(
        `${getApiBaseUrl()}/api/auth/me`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data;
    },
  });

  useEffect(() => {
    if (changeEmailMutation.isSuccess && changeEmailMutation.data) {
      // Update global state with new email
      updateCurrentUser({
        email: changeEmailMutation.data.user.email,
      });

      // Close modal
      setShowChangeEmailModal(false);

      // Reset new email input
      setNewEmail('');

      // Show success message
      setResendSuccess(`Verification email sent to new address: ${changeEmailMutation.data.user.email}`);

      // Reset cooldown timer
      setResendCooldown(60);
      setCanResend(false);
      setResendAttempts(0);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(null);
      }, 5000);
    }

    if (changeEmailMutation.isError) {
      console.error('Change email failed:', changeEmailMutation.error);
    }
  }, [changeEmailMutation.isSuccess, changeEmailMutation.isError, changeEmailMutation.error, changeEmailMutation.data, updateCurrentUser]);

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================
  
  const handleResendVerification = () => {
    if (!userEmail) {
      console.error('No user email available');
      return;
    }

    resendVerificationMutation.mutate({ email: userEmail });
  };

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || !newEmail.trim()) {
      return;
    }

    changeEmailMutation.mutate({ email: newEmail.trim() });
  };

  const handleOpenChangeEmailModal = () => {
    setNewEmail(userEmail || '');
    setShowChangeEmailModal(true);
  };

  const handleCloseChangeEmailModal = () => {
    setShowChangeEmailModal(false);
    setNewEmail('');
    changeEmailMutation.reset();
  };

  // ==========================================================================
  // RENDER - One big return block
  // ==========================================================================
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Header with Icon */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
              {/* Main Message */}
              <div className="text-center mb-6">
                <p className="text-gray-900 text-lg font-medium mb-2">
                  We sent a verification link to
                </p>
                <p className="text-blue-600 font-semibold text-lg break-all">
                  {userEmail || 'your email'}
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-900 text-sm mb-2">
                  Click the link in the email to activate your account.
                </p>
                <p className="text-blue-700 text-sm">
                  Check your spam folder if you don't see it within a few minutes.
                </p>
              </div>

              {/* Success Message */}
              {resendSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                  <p className="text-green-800 text-sm font-medium">
                    {resendSuccess}
                  </p>
                </div>
              )}

              {/* Resend Error */}
              {resendVerificationMutation.isError && !resendSuccess && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-800 text-sm font-medium">
                      {(resendVerificationMutation.error as any)?.response?.data?.error?.message || 
                       resendVerificationMutation.error?.message || 
                       'Failed to send verification email. Please try again.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Change Email Error */}
              {changeEmailMutation.isError && showChangeEmailModal && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-800 text-sm font-medium">
                      {(changeEmailMutation.error as any)?.response?.data?.error?.message || 
                       changeEmailMutation.error?.message || 
                       'Failed to update email. Please try again.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Support Section */}
              <div className="border-t border-gray-200 pt-6">
                <p className="text-gray-700 font-medium mb-4">Didn't receive the email?</p>
                
                <div className="space-y-3">
                  {/* Check Spam Suggestion */}
                  <p className="text-gray-600 text-sm flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Check your spam or junk folder
                  </p>

                  {/* Resend Button */}
                  <button
                    onClick={handleResendVerification}
                    disabled={!canResend || resendVerificationMutation.isPending}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      canResend && !resendVerificationMutation.isPending
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {resendVerificationMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : canResend ? (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Resend verification email
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        You can resend in {resendCooldown}s
                      </>
                    )}
                  </button>

                  {/* Escalation Message after 3 attempts */}
                  {resendAttempts >= 3 && (
                    <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Still not receiving? Contact support at{' '}
                      <a href="tel:+15551234567" className="font-medium underline">
                        +1 (555) 123-4567
                      </a>
                    </p>
                  )}

                  {/* Change Email Link */}
                  <button
                    onClick={handleOpenChangeEmailModal}
                    className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                  >
                    Change email address
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Note */}
          <p className="text-center text-gray-600 text-sm mt-6 px-4">
            For security reasons, please keep this page open while you check your email.
          </p>
        </div>
      </div>

      {/* Change Email Modal */}
      {showChangeEmailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseChangeEmailModal}
          ></div>

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              {/* Close Button */}
              <button
                onClick={handleCloseChangeEmailModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Modal Header */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Change Email Address
              </h2>

              {/* Form */}
              <form onSubmit={handleChangeEmail} className="space-y-4">
                <div>
                  <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 mb-2">
                    New Email Address
                  </label>
                  <input
                    id="new-email"
                    name="new-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                  />
                  <p className="text-gray-500 text-sm mt-2">
                    A new verification email will be sent to this address.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseChangeEmailModal}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changeEmailMutation.isPending || !newEmail.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    {changeEmailMutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </span>
                    ) : (
                      'Update Email'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_EmailVerificationPending;