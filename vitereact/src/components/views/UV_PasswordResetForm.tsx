import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PasswordStrength {
  level: 'weak' | 'medium' | 'strong';
  score: number;
  feedback: string;
}

interface PasswordRequirements {
  min_length: boolean;
  has_letters: boolean;
  has_numbers: boolean;
}

interface ValidationErrors {
  new_password?: string;
  confirm_password?: string;
  token?: string;
}

interface ResetPasswordRequest {
  reset_token: string;
  new_password: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return { level: 'weak', score: 0, feedback: 'Enter a password' };
  }

  let score = 0;
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const minLength = password.length >= 8;

  if (minLength) score += 1;
  if (hasLowerCase) score += 1;
  if (hasUpperCase) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecialChars) score += 1;

  if (score <= 2) {
    return { level: 'weak', score, feedback: 'Weak - Add more variety' };
  } else if (score <= 4) {
    return { level: 'medium', score, feedback: 'Medium - Good password' };
  } else {
    return { level: 'strong', score, feedback: 'Strong - Excellent!' };
  }
};

const checkPasswordRequirements = (password: string): PasswordRequirements => {
  return {
    min_length: password.length >= 8,
    has_letters: /[a-zA-Z]/.test(password),
    has_numbers: /\d/.test(password),
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_PasswordResetForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Extract token from URL
  const reset_token = searchParams.get('token') || '';

  // Form state
  const [new_password, setNewPassword] = useState('');
  const [confirm_password, setConfirmPassword] = useState('');
  const [show_password, setShowPassword] = useState({
    new_password: false,
    confirm_password: false,
  });
  const [validation_errors, setValidationErrors] = useState<ValidationErrors>({});

  // Calculate password strength and requirements
  const password_strength = useMemo(
    () => calculatePasswordStrength(new_password),
    [new_password]
  );

  const password_requirements_met = useMemo(
    () => checkPasswordRequirements(new_password),
    [new_password]
  );

  // Check if token exists on mount
  useEffect(() => {
    if (!reset_token) {
      setValidationErrors({
        token: 'No reset token found. Please request a new password reset link.',
      });
    }
  }, [reset_token]);

  // API mutation for password reset
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordRequest) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/reset-password`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      navigate('/reset-password/success');
    },
    onError: (error: any) => {
      const errorCode = error.response?.data?.error?.code;
      const errorMessage = error.response?.data?.error?.message;

      const newErrors: ValidationErrors = {};

      if (errorCode === 'INVALID_TOKEN') {
        newErrors.token = 'Reset link is invalid or expired. Please request a new one.';
      } else if (errorCode === 'TOKEN_EXPIRED') {
        newErrors.token = 'Reset link has expired. Please request a new one.';
      } else if (errorCode === 'TOKEN_USED') {
        newErrors.token = 'This reset link has already been used. Please request a new one.';
      } else if (errorCode === 'WEAK_PASSWORD') {
        newErrors.new_password = errorMessage || 'Password does not meet security requirements.';
      } else {
        newErrors.new_password = 'Failed to reset password. Please try again.';
      }

      setValidationErrors(newErrors);
    },
  });

  // Form validation
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    // Token validation
    if (!reset_token) {
      errors.token = 'No reset token found.';
      setValidationErrors(errors);
      return false;
    }

    // Password requirements validation
    if (!password_requirements_met.min_length) {
      errors.new_password = 'Password must be at least 8 characters long.';
    } else if (!password_requirements_met.has_letters) {
      errors.new_password = 'Password must contain letters.';
    } else if (!password_requirements_met.has_numbers) {
      errors.new_password = 'Password must contain numbers.';
    }

    // Password match validation
    if (new_password !== confirm_password) {
      errors.confirm_password = 'Passwords do not match.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setValidationErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Submit password reset
    resetPasswordMutation.mutate({
      reset_token,
      new_password,
    });
  };

  // Password visibility toggles
  const togglePasswordVisibility = (field: 'new_password' | 'confirm_password') => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Password match validation on blur
  const handleConfirmPasswordBlur = () => {
    if (confirm_password && new_password !== confirm_password) {
      setValidationErrors((prev) => ({
        ...prev,
        confirm_password: 'Passwords do not match.',
      }));
    } else {
      setValidationErrors((prev) => {
        const { confirm_password, ...rest } = prev;
        return rest;
      });
    }
  };

  // Check if form is valid and can be submitted
  const isFormValid =
    reset_token &&
    password_requirements_met.min_length &&
    password_requirements_met.has_letters &&
    password_requirements_met.has_numbers &&
    new_password === confirm_password &&
    new_password.length > 0 &&
    confirm_password.length > 0;

  const is_submitting = resetPasswordMutation.isPending;

  // Password strength color
  const getStrengthColor = (level: string) => {
    switch (level) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStrengthTextColor = (level: string) => {
    switch (level) {
      case 'weak':
        return 'text-red-700';
      case 'medium':
        return 'text-yellow-700';
      case 'strong':
        return 'text-green-700';
      default:
        return 'text-gray-500';
    }
  };

  // If token error exists and is critical, show error page
  if (validation_errors.token && !reset_token) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
              <p className="text-gray-600 mb-6">{validation_errors.token}</p>
              <Link
                to="/reset-password"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Create New Password
            </h1>
            <p className="text-gray-600">
              Enter your new password below. Make sure it's strong and secure.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 lg:p-8">
              {/* Token Error Banner */}
              {validation_errors.token && reset_token && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium">
                        {validation_errors.token}
                      </p>
                      <Link
                        to="/reset-password"
                        className="text-sm text-red-600 hover:text-red-700 font-medium underline mt-2 inline-block"
                      >
                        Request a new reset link →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* New Password Field */}
                <div>
                  <label
                    htmlFor="new_password"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={show_password.new_password ? 'text' : 'password'}
                      id="new_password"
                      value={new_password}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        // Clear error on change
                        setValidationErrors((prev) => {
                          const { new_password, ...rest } = prev;
                          return rest;
                        });
                      }}
                      placeholder="Enter new password"
                      className={`w-full px-4 py-3 pr-12 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                        validation_errors.new_password
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                      disabled={is_submitting}
                      aria-invalid={!!validation_errors.new_password}
                      aria-describedby={
                        validation_errors.new_password
                          ? 'new_password_error'
                          : 'new_password_helper'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new_password')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={show_password.new_password ? 'Hide password' : 'Show password'}
                    >
                      {show_password.new_password ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {new_password && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">
                          Password Strength:
                        </span>
                        <span
                          className={`text-xs font-semibold ${getStrengthTextColor(
                            password_strength.level
                          )}`}
                        >
                          {password_strength.feedback}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getStrengthColor(
                            password_strength.level
                          )}`}
                          style={{
                            width: `${(password_strength.score / 5) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {validation_errors.new_password ? (
                    <p
                      id="new_password_error"
                      className="mt-2 text-sm text-red-600 flex items-start"
                    >
                      <X className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                      {validation_errors.new_password}
                    </p>
                  ) : (
                    <p id="new_password_helper" className="mt-2 text-sm text-gray-600">
                      Minimum 8 characters, include letters and numbers
                    </p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirm_password"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={show_password.confirm_password ? 'text' : 'password'}
                      id="confirm_password"
                      value={confirm_password}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        // Clear error on change
                        setValidationErrors((prev) => {
                          const { confirm_password, ...rest } = prev;
                          return rest;
                        });
                      }}
                      onBlur={handleConfirmPasswordBlur}
                      placeholder="Re-enter new password"
                      className={`w-full px-4 py-3 pr-12 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                        validation_errors.confirm_password
                          ? 'border-red-300 focus:border-red-500'
                          : confirm_password &&
                            new_password === confirm_password
                          ? 'border-green-300 focus:border-green-500'
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                      disabled={is_submitting}
                      aria-invalid={!!validation_errors.confirm_password}
                      aria-describedby={
                        validation_errors.confirm_password
                          ? 'confirm_password_error'
                          : 'confirm_password_helper'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm_password')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={
                        show_password.confirm_password ? 'Hide password' : 'Show password'
                      }
                    >
                      {show_password.confirm_password ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                    {confirm_password && new_password === confirm_password && (
                      <div className="absolute right-12 top-1/2 -translate-y-1/2">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                    )}
                  </div>

                  {validation_errors.confirm_password ? (
                    <p
                      id="confirm_password_error"
                      className="mt-2 text-sm text-red-600 flex items-start"
                    >
                      <X className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                      {validation_errors.confirm_password}
                    </p>
                  ) : (
                    <p id="confirm_password_helper" className="mt-2 text-sm text-gray-600">
                      Re-enter your new password
                    </p>
                  )}
                </div>

                {/* Password Requirements Checklist */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">
                    Password Requirements:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start text-sm">
                      {password_requirements_met.min_length ? (
                        <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                      )}
                      <span
                        className={
                          password_requirements_met.min_length
                            ? 'text-green-700 font-medium'
                            : 'text-gray-600'
                        }
                      >
                        At least 8 characters
                      </span>
                    </li>
                    <li className="flex items-start text-sm">
                      {password_requirements_met.has_letters ? (
                        <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                      )}
                      <span
                        className={
                          password_requirements_met.has_letters
                            ? 'text-green-700 font-medium'
                            : 'text-gray-600'
                        }
                      >
                        Contains letters
                      </span>
                    </li>
                    <li className="flex items-start text-sm">
                      {password_requirements_met.has_numbers ? (
                        <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                      )}
                      <span
                        className={
                          password_requirements_met.has_numbers
                            ? 'text-green-700 font-medium'
                            : 'text-gray-600'
                        }
                      >
                        Contains numbers
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!isFormValid || is_submitting}
                  className="w-full px-6 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  {is_submitting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      Resetting Password...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </button>

                {/* Back to Login Link */}
                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    ← Back to Login
                  </Link>
                </div>
              </form>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              For your security, you'll be logged out of all devices after resetting your password.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordResetForm;