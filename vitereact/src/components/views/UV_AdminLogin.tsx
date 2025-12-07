import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { Eye, EyeOff, AlertCircle, Lock, Mail, Shield } from 'lucide-react';

const UV_AdminLogin: React.FC = () => {
  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [two_factor_code, setTwoFactorCode] = useState('');
  const [remember_me, setRememberMe] = useState(false);
  const [show_password, setShowPassword] = useState(false);
  const [show_2fa_field, setShow2faField] = useState(false);
  const [is_submitting, setIsSubmitting] = useState(false);
  const [login_attempts, setLoginAttempts] = useState(0);
  const [lockout_until, setLockoutUntil] = useState<string | null>(null);
  const [validation_errors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    two_factor_code?: string;
    general?: string;
  }>({});

  // ============================================================================
  // GLOBAL STATE (CRITICAL: Individual selectors, NO object destructuring)
  // ============================================================================
  const isLoading = useAppStore(
    state => state.authentication_state.authentication_status.is_loading
  );
  const globalErrorMessage = useAppStore(
    state => state.authentication_state.error_message
  );
  const loginAdmin = useAppStore(state => state.login_admin);
  const clearAuthError = useAppStore(state => state.clear_auth_error);

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  const navigate = useNavigate();

  // ============================================================================
  // LOCKOUT COUNTDOWN
  // ============================================================================
  const [lockoutCountdown, setLockoutCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!lockout_until) {
      setLockoutCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const lockoutTime = new Date(lockout_until).getTime();
      const diff = lockoutTime - now;

      if (diff <= 0) {
        setLockoutCountdown(null);
        setLockoutUntil(null);
        setLoginAttempts(0);
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setLockoutCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockout_until]);

  // ============================================================================
  // VALIDATION
  // ============================================================================
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const errors: typeof validation_errors = {};

    if (!email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    if (show_2fa_field && !two_factor_code) {
      errors.two_factor_code = 'Two-factor code is required';
    } else if (show_2fa_field && two_factor_code.length !== 6) {
      errors.two_factor_code = 'Code must be 6 digits';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validation_errors.email) {
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
    clearAuthError();
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (validation_errors.password) {
      setValidationErrors(prev => ({ ...prev, password: undefined }));
    }
    clearAuthError();
  };

  const handleTwoFactorCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTwoFactorCode(value);
    if (validation_errors.two_factor_code) {
      setValidationErrors(prev => ({ ...prev, two_factor_code: undefined }));
    }
    clearAuthError();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!show_password);
  };

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check lockout status
    if (lockout_until) {
      const now = new Date().getTime();
      const lockoutTime = new Date(lockout_until).getTime();
      if (now < lockoutTime) {
        setValidationErrors({
          general: 'Too many failed attempts. Please try again later.',
        });
        return;
      } else {
        // Lockout expired
        setLockoutUntil(null);
        setLoginAttempts(0);
      }
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Clear previous errors
    clearAuthError();
    setValidationErrors({});
    setIsSubmitting(true);

    try {
      // Call global store login_admin function
      const result = await loginAdmin(
        email,
        password,
        show_2fa_field ? two_factor_code : undefined
      );

      if (result.requires_2fa) {
        // Show 2FA field
        setShow2faField(true);
        setValidationErrors({
          general: 'Please enter your two-factor authentication code',
        });
        setIsSubmitting(false);
      } else {
        // Success - navigate to admin dashboard
        navigate('/admin');
      }
    } catch (error: any) {
      setIsSubmitting(false);

      // Parse error message
      const errorMessage = error.message || 'Login failed';

      // Map error codes to user-friendly messages and handle specific errors
      if (errorMessage.includes('Invalid email or password')) {
        setValidationErrors({
          general: 'Invalid email or password',
        });
        setLoginAttempts(prev => prev + 1);

        // Check if we should lock out (client-side tracking, server enforces actual lockout)
        if (login_attempts + 1 >= 5) {
          const lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          setLockoutUntil(lockoutTime);
          setValidationErrors({
            general: 'Too many failed attempts. Try again in 15 minutes.',
          });
        }
      } else if (errorMessage.includes('Account locked') || errorMessage.includes('Too many')) {
        // Server-side lockout
        setValidationErrors({
          general: 'Too many failed attempts. Try again in 15 minutes.',
        });
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        setLockoutUntil(lockoutTime);
      } else if (errorMessage.includes('Invalid two-factor code')) {
        setValidationErrors({
          two_factor_code: 'Invalid two-factor code',
        });
      } else if (errorMessage.includes('Account disabled')) {
        setValidationErrors({
          general: 'Account disabled. Contact administrator.',
        });
      } else if (errorMessage.includes('Two-factor authentication required')) {
        setShow2faField(true);
        setValidationErrors({
          general: 'Please enter your two-factor authentication code',
        });
      } else {
        // Generic error or network error
        setValidationErrors({
          general: errorMessage || 'Connection error. Please try again.',
        });
      }
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  const isFormDisabled = is_submitting || isLoading || !!lockout_until;

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-full p-4">
                <Shield className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">BarberSlot Admin</h1>
            <p className="text-gray-400 text-sm">Administrative Portal</p>
          </div>

          {/* Login Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Admin Login
            </h2>

            {/* General Error Banner */}
            {validation_errors.general && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-300">{validation_errors.general}</p>
                    {lockoutCountdown && (
                      <p className="text-xs text-red-600 mt-1 font-mono">
                        Time remaining: {lockoutCountdown}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {globalErrorMessage && !validation_errors.general && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-sm text-red-300">{globalErrorMessage}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isFormDisabled}
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="admin@example.com"
                    className={`block w-full pl-10 pr-3 py-3 border ${
                      validation_errors.email ? 'border-red-500' : 'border-white/20'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  />
                </div>
                {validation_errors.email && (
                  <p className="mt-1 text-sm text-red-600">{validation_errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={show_password ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={isFormDisabled}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className={`block w-full pl-10 pr-10 py-3 border ${
                      validation_errors.password ? 'border-red-500' : 'border-white/20'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={isFormDisabled}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-300 disabled:opacity-50"
                  >
                    {show_password ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {validation_errors.password && (
                  <p className="mt-1 text-sm text-red-600">{validation_errors.password}</p>
                )}
              </div>

              {/* Two-Factor Code Field (conditional) */}
              {show_2fa_field && (
                <div>
                  <label htmlFor="two_factor_code" className="block text-sm font-medium text-gray-300 mb-2">
                    Two-Factor Code <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="two_factor_code"
                      name="two_factor_code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required={show_2fa_field}
                      disabled={isFormDisabled}
                      value={two_factor_code}
                      onChange={handleTwoFactorCodeChange}
                      placeholder="000000"
                      className={`block w-full pl-10 pr-3 py-3 border ${
                        validation_errors.two_factor_code ? 'border-red-500' : 'border-white/20'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono text-center text-lg tracking-widest`}
                    />
                  </div>
                  {validation_errors.two_factor_code && (
                    <p className="mt-1 text-sm text-red-600">{validation_errors.two_factor_code}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
              )}

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <input
                  id="remember_me"
                  name="remember_me"
                  type="checkbox"
                  disabled={isFormDisabled}
                  checked={remember_me}
                  onChange={handleRememberMeChange}
                  className="h-4 w-4 text-amber-400 focus:ring-red-500 border-white/20 rounded disabled:opacity-50"
                />
                <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-300">
                  Remember me for 30 days
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isFormDisabled}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {is_submitting || isLoading ? (
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

              {/* Secondary Links */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="text-center">
                  <button
                    type="button"
                    disabled={isFormDisabled}
                    className="text-sm text-amber-400 hover:text-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-sm text-gray-300 hover:text-white font-medium transition-colors"
                  >
                    Customer Login →
                  </Link>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">Powered by BarberSlot</p>
            <p className="text-xs text-gray-400 mt-1">v1.0.0</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AdminLogin;