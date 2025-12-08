import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

// Import Zod schema for validation
const createUserInputSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(100).regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain letters and numbers'),
  name: z.string().min(2).max(255).regex(/^[a-zA-Z\s]+$/, 'Name must contain only letters and spaces'),
  phone: z.string().min(10).max(20).regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
});

const UV_Registration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect_url = searchParams.get('redirect_url');

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [form_data, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });

  const [password_confirm, setPasswordConfirm] = useState('');
  const [show_password, setShowPassword] = useState(false);
  const [show_password_confirm, setShowPasswordConfirm] = useState(false);
  const [terms_accepted, setTermsAccepted] = useState(false);

  const [validation_errors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    password_confirm?: string;
    terms?: string;
  }>({});

  const [password_strength, setPasswordStrength] = useState<{
    score: number;
    label: 'weak' | 'medium' | 'strong';
    color: string;
  }>({
    score: 0,
    label: 'weak',
    color: 'red'
  });

  const [passwords_match, setPasswordsMatch] = useState(false);
  const [email_checking, setEmailChecking] = useState(false);

  // ============================================================================
  // ZUSTAND STORE (Individual Selectors - CRITICAL)
  // ============================================================================

  const is_loading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const error_message = useAppStore(state => state.authentication_state.error_message);
  const register_user = useAppStore(state => state.register_user);
  const clear_auth_error = useAppStore(state => state.clear_auth_error);
  const errorMessage = error_message;

  // ============================================================================
  // PASSWORD STRENGTH CALCULATION
  // ============================================================================

  const calculatePasswordStrength = useCallback((password: string): { score: number, label: 'weak' | 'medium' | 'strong', color: string } => {
    let score = 0;
    
    // Length checks
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Complexity checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    // Determine strength level
    if (score <= 2) {
      return { score, label: 'weak', color: 'red' };
    } else if (score <= 3) {
      return { score, label: 'medium', color: 'amber' };
    } else {
      return { score, label: 'strong', color: 'green' };
    }
  }, []);

  // ============================================================================
  // EMAIL UNIQUENESS CHECK (DEBOUNCED)
  // ============================================================================

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    if (!email || !z.string().email().safeParse(email).success) {
      return false;
    }

    setEmailChecking(true);
    try {
      const api_base_url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${api_base_url}/api/auth/check-email-exists?email=${encodeURIComponent(email)}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.exists || false;
      }
      
      return false;
    } catch {
      console.warn('Email uniqueness check endpoint not available');
      return false;
    } finally {
      setEmailChecking(false);
    }
  }, []);

  // Debounced email check
  useEffect(() => {
    if (!form_data.email) return;

    const timer = setTimeout(async () => {
      const exists = await checkEmailExists(form_data.email);
      if (exists) {
        setValidationErrors(prev => ({
          ...prev,
          email: 'Email already registered. Log in instead?'
        }));
      } else {
        setValidationErrors(prev => {
          const { email, ...rest } = prev;
          void email;
          return rest;
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form_data.email, checkEmailExists]);

  // ============================================================================
  // VALIDATION FUNCTIONS
  // ============================================================================

  const validateField = (field: keyof typeof form_data, value: string): string | undefined => {
    try {
      const field_schema = createUserInputSchema.shape[field];
      field_schema.parse(value);
      return undefined;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0].message;
      }
      return 'Invalid input';
    }
  };

  const validatePasswordMatch = (): boolean => {
    const matches = form_data.password === password_confirm;
    setPasswordsMatch(matches);
    
    if (password_confirm && !matches) {
      setValidationErrors(prev => ({
        ...prev,
        password_confirm: 'Passwords don\'t match'
      }));
      return false;
    } else {
      setValidationErrors(prev => {
        const { password_confirm, ...rest } = prev;
        void password_confirm;
        return rest;
      });
      return true;
    }
  };

  // ============================================================================
  // EFFECT: UPDATE PASSWORD STRENGTH
  // ============================================================================

  useEffect(() => {
    if (form_data.password) {
      const strength = calculatePasswordStrength(form_data.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, label: 'weak', color: 'red' });
    }
  }, [form_data.password, calculatePasswordStrength]);

  // ============================================================================
  // EFFECT: CHECK PASSWORD MATCH
  // ============================================================================

  useEffect(() => {
    if (password_confirm && form_data.password) {
      const matches = form_data.password === password_confirm;
      setPasswordsMatch(matches);
      
      if (password_confirm && !matches) {
        setValidationErrors(prev => ({
          ...prev,
          password_confirm: 'Passwords don\'t match'
        }));
      } else {
        setValidationErrors(prev => {
          const { password_confirm, ...rest } = prev;
          void password_confirm;
          return rest;
        });
      }
    }
  }, [form_data.password, password_confirm]);

  useEffect(() => {
    clear_auth_error();
  }, [clear_auth_error]);

  useEffect(() => {
    if (errorMessage) {
      console.log('Auth error:', errorMessage);
    }
  }, [errorMessage]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleInputChange = (field: keyof typeof form_data, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    setValidationErrors(prev => {
      const { [field]: removedField, ...rest } = prev;
      void removedField;
      return rest;
    });
    
    // Clear global auth error
    if (error_message) {
      clear_auth_error();
    }
  };

  const handleInputBlur = (field: keyof typeof form_data) => {
    const value = form_data[field];
    const error = validateField(field, value);
    
    if (error) {
      setValidationErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setValidationErrors(prev => {
        const { [field]: removedField, ...rest } = prev;
        void removedField;
        return rest;
      });
    }
  };

  const handlePasswordConfirmChange = (value: string) => {
    setPasswordConfirm(value);
    
    setValidationErrors(prev => {
      const { password_confirm, ...rest } = prev;
      void password_confirm;
      return rest;
    });
  };

  const handleTermsChange = (checked: boolean) => {
    setTermsAccepted(checked);
    
    if (checked) {
      setValidationErrors(prev => {
        const { terms, ...rest } = prev;
        void terms;
        return rest;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const errors: typeof validation_errors = {};
    
    // Validate form data against Zod schema
    const validation_result = createUserInputSchema.safeParse(form_data);
    if (!validation_result.success) {
      validation_result.error.errors.forEach(err => {
        const field = err.path[0] as keyof typeof form_data;
        errors[field] = err.message;
      });
    }
    
    // Validate password confirmation
    if (!password_confirm) {
      errors.password_confirm = 'Please confirm your password';
    } else if (form_data.password !== password_confirm) {
      errors.password_confirm = 'Passwords don\'t match';
    }
    
    // Validate terms acceptance
    if (!terms_accepted) {
      errors.terms = 'You must accept the terms to continue';
    }
    
    // If there are validation errors, show them and stop
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    // Clear any previous errors
    clear_auth_error();
    
    try {
      // Call Zustand store action
      await register_user(
        form_data.email,
        form_data.password,
        form_data.name,
        form_data.phone
      );
      
      // On success, navigate to email verification pending (replace to prevent back button issues)
      navigate('/verify-email', { 
        replace: true,
        state: { 
          email: form_data.email,
          redirect_url: redirect_url || '/dashboard'
        }
      });
    } catch (error: any) {
      // Error is handled in store and displayed via error_message
      console.error('Registration error:', error);
    }
  };

  const handleSocialRegistration = (provider: 'google' | 'facebook') => {
    // OAuth endpoints not implemented yet
    alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} registration is not available yet. Please use email registration.`);
  };

  // ============================================================================
  // FORM VALIDATION STATUS
  // ============================================================================

  const is_form_valid = 
    form_data.email &&
    form_data.password &&
    form_data.name &&
    form_data.phone &&
    password_confirm &&
    passwords_match &&
    terms_accepted &&
    Object.keys(validation_errors).length === 0 &&
    !email_checking;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-master-text-primary-dark leading-tight">
              Create Your Account
            </h2>
            <p className="mt-2 text-base text-master-text-secondary-dark leading-relaxed">
              Book faster with saved details and view your history
            </p>
          </div>

          {/* Registration Card */}
          <div className="bg-[#2D0808] shadow-lg shadow-gray-200/50 rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-6 lg:p-8">
              {/* Error Message Banner */}
              {error_message && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4" role="alert" aria-live="polite">
                  <div className="flex items-start">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-400">{error_message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                {/* Full Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-master-text-primary-dark mb-1">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={form_data.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    onBlur={() => handleInputBlur('name')}
                    placeholder="John Smith"
                    aria-invalid={!!validation_errors.name}
                    aria-describedby={validation_errors.name ? "name-error" : "name-helper"}
                    className={`
                      w-full px-4 py-3 rounded-lg border-2 transition-all duration-200
                      ${validation_errors.name 
                        ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                        : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                      }
                      focus:outline-none text-master-text-primary-dark placeholder-master-text-muted-dark
                    `}
                  />
                  {validation_errors.name ? (
                    <p id="name-error" className="mt-1 text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      {validation_errors.name}
                    </p>
                  ) : (
                    <p id="name-helper" className="mt-1 text-sm text-master-text-muted-dark">
                      First and last name
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-master-text-primary-dark mb-1">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form_data.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      onBlur={() => handleInputBlur('email')}
                      placeholder="john@example.com"
                      aria-invalid={!!validation_errors.email}
                      aria-describedby={validation_errors.email ? "email-error" : "email-helper"}
                      className={`
                        w-full px-4 py-3 rounded-lg border-2 transition-all duration-200
                        ${validation_errors.email 
                          ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                          : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                        }
                        focus:outline-none text-master-text-primary-dark placeholder-master-text-muted-dark
                      `}
                    />
                    {email_checking && (
                      <div className="absolute right-3 top-3.5">
                        <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {validation_errors.email ? (
                    <p id="email-error" className="mt-1 text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      {validation_errors.email}
                    </p>
                  ) : (
                    <p id="email-helper" className="mt-1 text-sm text-master-text-muted-dark">
                      We'll send a verification email
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-master-text-primary-dark mb-1">
                    Phone Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={form_data.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    onBlur={() => handleInputBlur('phone')}
                    placeholder="+1 (555) 123-4567"
                    aria-invalid={!!validation_errors.phone}
                    aria-describedby={validation_errors.phone ? "phone-error" : "phone-helper"}
                    className={`
                      w-full px-4 py-3 rounded-lg border-2 transition-all duration-200
                      ${validation_errors.phone 
                        ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                        : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                      }
                      focus:outline-none text-master-text-primary-dark placeholder-master-text-muted-dark
                    `}
                  />
                  {validation_errors.phone ? (
                    <p id="phone-error" className="mt-1 text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      {validation_errors.phone}
                    </p>
                  ) : (
                    <p id="phone-helper" className="mt-1 text-sm text-master-text-muted-dark">
                      For confirmation and reminders
                    </p>
                  )}
                </div>

                {/* Create Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-master-text-primary-dark mb-1">
                    Create Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={show_password ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={form_data.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      onBlur={() => handleInputBlur('password')}
                      placeholder="••••••••"
                      aria-invalid={!!validation_errors.password}
                      aria-describedby={validation_errors.password ? "password-error" : "password-helper"}
                      className={`
                        w-full px-4 py-3 pr-12 rounded-lg border-2 transition-all duration-200
                        ${validation_errors.password 
                          ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                          : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                        }
                        focus:outline-none text-master-text-primary-dark placeholder-master-text-muted-dark
                      `}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!show_password)}
                      className="absolute right-3 top-3 text-master-text-muted-dark hover:text-master-text-secondary-dark focus:outline-none focus:text-master-text-secondary-dark transition-colors"
                      aria-label={show_password ? 'Hide password' : 'Show password'}
                    >
                      {show_password ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {form_data.password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-master-text-secondary-dark">Password strength:</span>
                        <span className={`text-xs font-semibold ${
                          password_strength.color === 'red' ? 'text-red-600' :
                          password_strength.color === 'amber' ? 'text-amber-600' :
                          'text-green-600'
                        }`}>
                          {password_strength.label.charAt(0).toUpperCase() + password_strength.label.slice(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            password_strength.color === 'red' ? 'bg-red-500' :
                            password_strength.color === 'amber' ? 'bg-amber-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${(password_strength.score / 5) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {validation_errors.password ? (
                    <p id="password-error" className="mt-1 text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      {validation_errors.password}
                    </p>
                  ) : (
                    <p id="password-helper" className="mt-1 text-sm text-master-text-muted-dark">
                      Minimum 8 characters, include letters and numbers
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="password_confirm" className="block text-sm font-medium text-master-text-primary-dark mb-1">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password_confirm"
                      name="password_confirm"
                      type={show_password_confirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password_confirm}
                      onChange={(e) => handlePasswordConfirmChange(e.target.value)}
                      onBlur={validatePasswordMatch}
                      placeholder="••••••••"
                      aria-invalid={!!validation_errors.password_confirm}
                      aria-describedby={validation_errors.password_confirm ? "password-confirm-error" : "password-confirm-helper"}
                      className={`
                        w-full px-4 py-3 pr-12 rounded-lg border-2 transition-all duration-200
                        ${validation_errors.password_confirm 
                          ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                          : passwords_match && password_confirm
                            ? 'border-green-300 focus:border-green-500 focus:ring-4 focus:ring-green-100'
                            : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                        }
                        focus:outline-none text-master-text-primary-dark placeholder-master-text-muted-dark
                      `}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!show_password_confirm)}
                      className="absolute right-3 top-3 text-master-text-muted-dark hover:text-master-text-secondary-dark focus:outline-none focus:text-master-text-secondary-dark transition-colors"
                      aria-label={show_password_confirm ? 'Hide password' : 'Show password'}
                    >
                      {show_password_confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    {passwords_match && password_confirm && (
                      <div className="absolute right-12 top-3.5">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    )}
                  </div>
                  {validation_errors.password_confirm ? (
                    <p id="password-confirm-error" className="mt-1 text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      {validation_errors.password_confirm}
                    </p>
                  ) : (
                    <p id="password-confirm-helper" className="mt-1 text-sm text-master-text-muted-dark">
                      Re-enter your password
                    </p>
                  )}
                </div>

                {/* Terms Acceptance */}
                <div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={terms_accepted}
                        onChange={(e) => handleTermsChange(e.target.checked)}
                        aria-invalid={!!validation_errors.terms}
                        aria-describedby={validation_errors.terms ? "terms-error" : undefined}
                        className="h-5 w-5 rounded border-white/20 text-amber-400 focus:ring-4 focus:ring-red-100 focus:ring-offset-0 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="terms" className="text-sm text-master-text-secondary-dark cursor-pointer">
                        I agree to the{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-blue-700 font-medium underline">
                          Terms of Service
                        </a>
                        {' '}and{' '}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-blue-700 font-medium underline">
                          Privacy Policy
                        </a>
                        {' '}<span className="text-red-600">*</span>
                      </label>
                    </div>
                  </div>
                  {validation_errors.terms && (
                    <p id="terms-error" className="mt-1 ml-8 text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      {validation_errors.terms}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={!is_form_valid || is_loading}
                    className={`
                      w-full px-6 py-3 rounded-lg font-medium text-white
                      transition-all duration-200
                      ${is_form_valid && !is_loading
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl cursor-pointer'
                        : 'bg-gray-400 cursor-not-allowed opacity-50'
                      }
                      focus:outline-none focus:ring-4 focus:ring-red-100
                      flex items-center justify-center
                    `}
                    aria-busy={is_loading}
                  >
                    {is_loading ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </div>
              </form>

              {/* Social Registration */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#2D0808] text-master-text-muted-dark">Or sign up with</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSocialRegistration('google')}
                    className="w-full inline-flex justify-center items-center px-4 py-3 border border-white/20 rounded-lg shadow-sm bg-[#2D0808] text-sm font-medium text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200"
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialRegistration('facebook')}
                    className="w-full inline-flex justify-center items-center px-4 py-3 border border-white/20 rounded-lg shadow-sm bg-[#2D0808] text-sm font-medium text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200"
                  >
                    <svg className="h-5 w-5 mr-2" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </button>
                </div>
              </div>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-master-text-secondary-dark">
                  Already have an account?{' '}
                  <Link to="/login" className="text-amber-400 hover:text-blue-700 font-medium underline transition-colors">
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Registration;