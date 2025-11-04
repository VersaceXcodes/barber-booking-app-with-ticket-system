import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';

/**
 * UV_Login - User Login and Authentication View
 * 
 * Authentication page for registered users to access dashboard and saved features.
 * Implements secure login with remember me, password visibility toggle, and comprehensive error handling.
 */
const UV_Login: React.FC = () => {
  // ============================================================================
  // URL PARAMS
  // ============================================================================
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirect_url = searchParams.get('redirect_url') || '/dashboard';

  // ============================================================================
  // GLOBAL STATE (ZUSTAND) - CRITICAL: Individual selectors only
  // ============================================================================
  const isLoading = useAppStore(
    state => state.authentication_state.authentication_status.is_loading
  );
  const errorMessage = useAppStore(
    state => state.authentication_state.error_message
  );
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );
  const loginUser = useAppStore(state => state.login_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  const [form_data, setFormData] = useState({
    email: '',
    password: '',
  });
  const [remember_me, setRememberMe] = useState(false);
  const [show_password, setShowPassword] = useState(false);
  const [validation_errors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirect_url, { replace: true });
    }
  }, [isAuthenticated, navigate, redirect_url]);

  // Clear errors when user starts typing
  useEffect(() => {
    if (errorMessage) {
      clearAuthError();
    }
  }, [form_data.email, form_data.password]);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateEmail = (email: string): string | undefined => {
    if (!email) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return 'Password is required';
    }
    return undefined;
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleEmailBlur = () => {
    const error = validateEmail(form_data.email);
    setValidationErrors(prev => ({ ...prev, email: error }));
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(form_data.password);
    setValidationErrors(prev => ({ ...prev, password: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    clearAuthError();
    setValidationErrors({});

    // Validate all fields
    const emailError = validateEmail(form_data.email);
    const passwordError = validatePassword(form_data.password);

    if (emailError || passwordError) {
      setValidationErrors({
        email: emailError,
        password: passwordError,
      });
      return;
    }

    try {
      // Call Zustand store action (handles API call and state updates)
      await loginUser(form_data.email, form_data.password);
      
      // Navigation handled by useEffect when isAuthenticated becomes true
    } catch (error) {
      // Error is already in store.error_message, displayed in UI
      console.error('Login error:', error);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    // OAuth endpoints not in OpenAPI spec - show as disabled/coming soon
    alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon`);
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isFormValid = form_data.email && form_data.password && !validation_errors.email && !validation_errors.password;
  const canSubmit = isFormValid && !isLoading;

  // Determine error banner type and message
  const getErrorBannerConfig = () => {
    if (!errorMessage) return null;

    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('verified') || lowerError.includes('verify')) {
      return {
        type: 'warning' as const,
        message: errorMessage,
        showResend: true,
      };
    }

    if (lowerError.includes('locked') || lowerError.includes('attempts')) {
      return {
        type: 'error' as const,
        message: errorMessage,
        showRetry: false,
      };
    }

    if (lowerError.includes('connection') || lowerError.includes('network')) {
      return {
        type: 'error' as const,
        message: errorMessage,
        showRetry: true,
      };
    }

    return {
      type: 'error' as const,
      message: errorMessage,
      showRetry: false,
    };
  };

  const errorConfig = getErrorBannerConfig();

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">
              Welcome Back
            </h1>
            <p className="mt-2 text-base text-gray-600">
              Sign in to access your dashboard and bookings
            </p>
          </div>

          {/* Error Banner */}
          {errorConfig && (
            <div
              className={`rounded-xl p-4 border ${
                errorConfig.type === 'warning'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
              }`}
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start">
                <AlertCircle
                  className={`size-5 mt-0.5 mr-3 flex-shrink-0 ${
                    errorConfig.type === 'warning' ? 'text-amber-600' : 'text-red-600'
                  }`}
                />
                <div className="flex-1">
                  <p
                    className={`text-sm ${
                      errorConfig.type === 'warning' ? 'text-amber-700' : 'text-red-700'
                    }`}
                  >
                    {errorConfig.message}
                  </p>
                  {errorConfig.showResend && (
                    <button
                      type="button"
                      className="mt-2 text-sm font-medium text-amber-700 hover:text-amber-800 underline"
                      onClick={() => {
                        // Future enhancement: trigger resend verification email
                        alert('Resend verification email - to be implemented');
                      }}
                    >
                      Resend verification link
                    </button>
                  )}
                  {errorConfig.showRetry && (
                    <button
                      type="button"
                      className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline"
                      onClick={() => clearAuthError()}
                    >
                      Try again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-8 py-8">
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="size-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form_data.email}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }));
                        setValidationErrors(prev => ({ ...prev, email: undefined }));
                      }}
                      onBlur={handleEmailBlur}
                      placeholder="john@example.com"
                      className={`block w-full pl-10 pr-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                        validation_errors.email
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                      } text-gray-900 placeholder-gray-400 focus:outline-none`}
                      aria-invalid={validation_errors.email ? 'true' : 'false'}
                      aria-describedby={validation_errors.email ? 'email-error' : undefined}
                    />
                  </div>
                  {validation_errors.email && (
                    <p id="email-error" className="mt-2 text-sm text-red-600" role="alert">
                      {validation_errors.email}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                      Password
                    </label>
                    <Link
                      to="/reset-password"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="size-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={show_password ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={form_data.password}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, password: e.target.value }));
                        setValidationErrors(prev => ({ ...prev, password: undefined }));
                      }}
                      onBlur={handlePasswordBlur}
                      placeholder="Enter your password"
                      className={`block w-full pl-10 pr-12 py-3 rounded-lg border-2 transition-all duration-200 ${
                        validation_errors.password
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                      } text-gray-900 placeholder-gray-400 focus:outline-none`}
                      aria-invalid={validation_errors.password ? 'true' : 'false'}
                      aria-describedby={validation_errors.password ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!show_password)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={show_password ? 'Hide password' : 'Show password'}
                    >
                      {show_password ? (
                        <EyeOff className="size-5" />
                      ) : (
                        <Eye className="size-5" />
                      )}
                    </button>
                  </div>
                  {validation_errors.password && (
                    <p id="password-error" className="mt-2 text-sm text-red-600" role="alert">
                      {validation_errors.password}
                    </p>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={remember_me}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                    Remember me for 30 days
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full flex justify-center items-center px-6 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:hover:shadow-lg"
                >
                  {isLoading ? (
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
                      Logging in...
                    </>
                  ) : (
                    'Log In'
                  )}
                </button>
              </form>

              {/* Social Login - Coming Soon */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or log in with</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    disabled
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Coming soon"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialLogin('facebook')}
                    disabled
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Coming soon"
                  >
                    <svg className="w-5 h-5 mr-2" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>
                </div>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <p className="text-center text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </>
  );
};

export default UV_Login;