import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const UV_PasswordResetSuccess: React.FC = () => {
  // CRITICAL: Individual selectors, no object destructuring
  const shopPhone = useAppStore(state => state.app_settings.shop_phone);
  const shopEmail = useAppStore(state => state.app_settings.shop_email);

  // Local state for countdown and auto-redirect
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(true);

  const navigate = useNavigate();

  // Start countdown timer on mount
  useEffect(() => {
    if (!autoRedirectEnabled) return;

    const timer = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          // Navigate to login when countdown reaches zero
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(timer);
  }, [autoRedirectEnabled, navigate]);

  // Navigate to login immediately
  const handleLoginNow = () => {
    navigate('/login');
  };

  // Cancel auto-redirect
  const handleCancelRedirect = () => {
    setAutoRedirectEnabled(false);
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Success Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-12 sm:px-8">
              {/* Success Icon with Animation */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  {/* Animated Circle Background */}
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                  
                  {/* Checkmark Icon Container */}
                  <div className="relative bg-green-500 rounded-full p-4 shadow-lg">
                    <svg
                      className="h-12 w-12 text-white animate-bounce"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Header */}
              <h1 className="text-3xl font-bold text-white text-center mb-4 leading-tight">
                Password Reset Successfully
              </h1>

              {/* Message */}
              <p className="text-lg text-gray-300 text-center mb-2">
                Your password has been updated
              </p>

              {/* Subtext */}
              <p className="text-base text-gray-300 text-center mb-8">
                You can now log in with your new password
              </p>

              {/* Countdown Section */}
              {autoRedirectEnabled && (
                <div className="bg-[#2D0808] border border-blue-200 rounded-lg p-4 mb-6 text-center">
                  <p className="text-blue-700 text-sm font-medium mb-2">
                    Redirecting to login in{' '}
                    <span className="text-blue-900 font-bold text-lg">
                      {countdownSeconds}
                    </span>{' '}
                    {countdownSeconds === 1 ? 'second' : 'seconds'}...
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelRedirect}
                    className="text-amber-400 hover:text-blue-800 text-sm font-medium underline transition-colors"
                  >
                    Stay on this page
                  </button>
                </div>
              )}

              {/* Primary CTA Button */}
              <button
                onClick={handleLoginNow}
                className="w-full flex justify-center items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-red-100"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                Log In Now
              </button>

              {/* Security Notice */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="text-sm text-yellow-400 font-medium mb-1">
                        Security Notice
                      </p>
                      <p className="text-sm text-yellow-300 mb-2">
                        If you didn't make this change, contact us immediately.
                      </p>
                      <div className="text-sm text-yellow-400 space-y-1">
                        {shopPhone && (
                          <p>
                            <span className="font-medium">Phone:</span>{' '}
                            <a
                              href={`tel:${shopPhone}`}
                              className="underline hover:text-yellow-900 transition-colors"
                            >
                              {shopPhone}
                            </a>
                          </p>
                        )}
                        {shopEmail && (
                          <p>
                            <span className="font-medium">Email:</span>{' '}
                            <a
                              href={`mailto:${shopEmail}`}
                              className="underline hover:text-yellow-900 transition-colors"
                            >
                              {shopEmail}
                            </a>
                          </p>
                        )}
                        {!shopPhone && !shopEmail && (
                          <p>
                            Please contact our support team for assistance.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back to Home Link */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordResetSuccess;