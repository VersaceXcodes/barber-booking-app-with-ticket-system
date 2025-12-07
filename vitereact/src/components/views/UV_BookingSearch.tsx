import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Search, Calendar, Phone, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Booking {
  booking_id: string;
  ticket_number: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  service_id: string | null;
}

interface SearchResponse {
  bookings: Booking[];
  total: number;
  message?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatTicketNumber = (value: string): string => {
  if (!value) return '';
  
  const uppercased = value.toUpperCase();
  const cleaned = uppercased.replace(/[^A-Z0-9-]/g, '');
  
  return cleaned;
};

const isValidTicketFormat = (ticket: string): boolean => {
  if (!ticket || ticket.length < 5) return false;
  
  const standardPattern = /^TKT-\d{4,8}-\d{3}$/;
  if (standardPattern.test(ticket)) return true;
  
  const relaxedPattern = /^TKT-\d+-\d+$/;
  return relaxedPattern.test(ticket);
};

const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.trim().length === 0) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 7 && cleaned.length <= 15;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const getStatusBadgeClasses = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'upcoming':
    case 'confirmed':
      return 'bg-blue-900/30 text-blue-400 border-blue-200';
    case 'completed':
      return 'bg-gray-100 text-gray-200 border-white/10';
    case 'cancelled':
      return 'bg-red-900/30 text-red-400 border-red-200';
    default:
      return 'bg-gray-100 text-gray-200 border-white/10';
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_BookingSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Global state access (individual selectors)
  const appSettings = useAppStore(state => state.app_settings);

  // Local state
  const [searchMethod, setSearchMethod] = useState<'ticket' | 'phone_date'>('ticket');
  const [ticketNumber, setTicketNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Pre-fill from URL params on mount
  useEffect(() => {
    const urlTicket = searchParams.get('ticket_number');
    const urlPhone = searchParams.get('phone');
    const urlDate = searchParams.get('date');

    if (urlTicket) {
      setSearchMethod('ticket');
      setTicketNumber(formatTicketNumber(urlTicket));
    } else if (urlPhone || urlDate) {
      setSearchMethod('phone_date');
      if (urlPhone) setPhone(urlPhone);
      if (urlDate) setDate(urlDate);
    }
  }, [searchParams]);

  // Validation
  const isTicketValid = searchMethod === 'ticket' && isValidTicketFormat(ticketNumber);
  const isPhoneDateValid = searchMethod === 'phone_date' && isValidPhone(phone) && date.length > 0;
  const canSearch = isTicketValid || isPhoneDateValid;

  // React Query for search
  const { data, isLoading, error, refetch } = useQuery<SearchResponse>({
    queryKey: ['bookingSearch', searchMethod, ticketNumber, phone, date],
    queryFn: async () => {
      // Get API URL from runtime config or environment variable
      const getApiBaseUrl = (): string => {
        if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.API_BASE_URL) {
          return (window as any).__RUNTIME_CONFIG__.API_BASE_URL;
        }
        return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      };
      
      const apiUrl = `${getApiBaseUrl()}/api/bookings/search`;
      const params: Record<string, string> = {};

      if (searchMethod === 'ticket') {
        params.ticket_number = ticketNumber;
      } else {
        params.phone = phone;
        params.date = date;
      }

      try {
        const response = await axios.get<SearchResponse>(apiUrl, { 
          params,
          timeout: 15000,
          validateStatus: (status) => status < 500,
        });
        
        if (response.status >= 400) {
          const errorMessage = response.data?.message || 'Search failed. Please try again.';
          throw new Error(errorMessage);
        }
        
        return response.data;
      } catch (error: any) {
        console.error('Search API error:', error);
        
        // Handle timeout errors
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        }
        
        // Handle Axios errors
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorData = error.response?.data;
          
          // Check for specific error message from backend
          if (errorData?.message) {
            throw new Error(errorData.message);
          }
          
          // Handle specific HTTP status codes
          if (status === 400) {
            // Bad request - validation errors
            throw new Error(errorData?.message || 'Invalid search parameters. Please check your input.');
          }
          
          if (status === 404) {
            // Not found
            throw new Error('Booking not found. Please check your ticket number or search criteria.');
          }
          
          if (status === 502) {
            throw new Error('Service temporarily unavailable. The server is having issues. Please try again in a moment.');
          }
          
          if (status === 503) {
            throw new Error('Database connection failed. Please try again later.');
          }
          
          if (status === 504) {
            throw new Error('Gateway timeout. The request took too long. Please try again.');
          }
          
          if (status && status >= 500) {
            throw new Error('Server error occurred. Please try again later.');
          }
          
          // Network error (no response from server)
          if (!error.response) {
            throw new Error('Unable to connect to server. Please check your internet connection and try again.');
          }
        }
        
        // Re-throw the original error if it's already an Error object
        if (error instanceof Error) {
          throw error;
        }
        
        // Fallback error
        throw new Error('An unexpected error occurred. Please try again.');
      }
    },
    enabled: false, // Manual trigger only
    retry: (failureCount, error: any) => {
      // Retry up to 2 times for 502/503 errors, once for others
      if (error?.response?.status === 502 || error?.response?.status === 503) {
        return failureCount < 2;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 0,
  });

  // Handle search results
  useEffect(() => {
    if (data && searchTriggered) {
      setSearchTriggered(false);
      
      if (data.total === 1 && data.bookings.length === 1) {
        // Single result - auto-redirect
        navigate(`/booking/${data.bookings[0].ticket_number}`);
      } else if (data.total === 0) {
        setSearchError('No bookings found. Please check your information and try again.');
      }
      // Multiple results will be displayed in the UI
    }
  }, [data, searchTriggered, navigate]);

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed. Please try again.';
      setSearchError(errorMessage);
      setSearchTriggered(false);
    }
  }, [error]);

  // Event handlers
  const handleSearchMethodChange = (method: 'ticket' | 'phone_date') => {
    setSearchMethod(method);
    setSearchError(null);
    // Don't clear form data when switching tabs
  };

  const handleTicketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatTicketNumber(rawValue);
    setTicketNumber(formatted);
    setSearchError(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setSearchError(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(value)) {
        setDate(value);
        setSearchError(null);
      } else {
        console.warn('Invalid date format received:', value);
      }
    } else {
      setDate(value);
      setSearchError(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return;
    
    if (!canSearch) {
      if (searchMethod === 'ticket') {
        if (!ticketNumber) {
          setSearchError('Please enter a ticket number');
        } else if (!isValidTicketFormat(ticketNumber)) {
          setSearchError('Invalid ticket format. Expected format: TKT-YYYYMMDD-XXX');
        }
      } else {
        if (!phone) {
          setSearchError('Please enter a phone number');
        } else if (!isValidPhone(phone)) {
          setSearchError('Please enter a valid phone number (7-15 digits)');
        } else if (!date) {
          setSearchError('Please select a booking date');
        }
      }
      return;
    }
    
    setSearchError(null);
    setSearchTriggered(true);
    refetch();
  };

  const handleClearSearch = () => {
    setTicketNumber('');
    setPhone('');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
    setSearchError(null);
    setSearchTriggered(false);
  };

  const handleViewDetails = (booking: Booking) => {
    navigate(`/booking/${booking.ticket_number}`);
  };

  // Render
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Find Your Booking</h1>
            <p className="text-lg text-gray-300">
              Search for your appointment using your ticket number or phone and date
            </p>
          </div>

          {/* Search Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-white/10">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => handleSearchMethodChange('ticket')}
                  className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    searchMethod === 'ticket'
                      ? 'border-red-600 text-amber-400 bg-[#2D0808]'
                      : 'border-transparent text-gray-300 hover:text-white hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <Search className="inline-block size-5 mr-2" />
                  Search by Ticket Number
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchMethodChange('phone_date')}
                  className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    searchMethod === 'phone_date'
                      ? 'border-red-600 text-amber-400 bg-[#2D0808]'
                      : 'border-transparent text-gray-300 hover:text-white hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <Phone className="inline-block size-5 mr-2" />
                  Search by Phone & Date
                </button>
              </div>
            </div>

            {/* Search Form */}
            <form 
              onSubmit={handleSearch}
              className="p-6 lg:p-8 space-y-6"
              data-testid="search-form"
              role="search"
              aria-label="Booking search form"
              autoComplete="off"
            >
              {/* Ticket Number Tab */}
              {searchMethod === 'ticket' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ticket-number" className="block text-sm font-medium text-white mb-2">
                      Ticket Number
                    </label>
                      <input
                        type="text"
                        id="ticket-number"
                        name="ticket-number"
                        data-testid="ticket-number-input"
                        aria-label="Ticket number"
                        value={ticketNumber}
                        onChange={handleTicketChange}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedText = e.clipboardData.getData('text');
                          const formatted = formatTicketNumber(pastedText);
                          setTicketNumber(formatted);
                        }}
                        placeholder="TKT-20241105-003"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        inputMode="text"
                        data-form-type="other"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        className="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all text-white text-base"
                        autoFocus
                      />
                    <p className="mt-2 text-sm text-gray-300">
                      Format: TKT-YYYYMMDD-XXX (e.g., TKT-20241105-003)
                    </p>
                  </div>
                </div>
              )}

              {/* Phone & Date Tab */}
              {searchMethod === 'phone_date' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-white mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-gray-400 pointer-events-none" />
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        data-testid="phone-input"
                        aria-label="Phone number"
                        value={phone}
                        onChange={handlePhoneChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearch(e as any);
                          }
                        }}
                        placeholder="+1 (555) 123-4567"
                        autoComplete="tel"
                        data-form-type="other"
                        className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all text-white text-base"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-white mb-2">
                      Booking Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        id="date"
                        name="date"
                        data-testid="date-input"
                        aria-label="Booking date"
                        value={date}
                        onChange={handleDateChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearch(e as any);
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                            setSearchError('Please enter a valid date in YYYY-MM-DD format');
                          }
                        }}
                        autoComplete="off"
                        data-form-type="other"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        min="2020-01-01"
                        max="2030-12-31"
                        pattern="\d{4}-\d{2}-\d{2}"
                        onInvalid={(e) => {
                          e.preventDefault();
                          setSearchError('Please enter a valid date in YYYY-MM-DD format');
                        }}
                        className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all text-white text-base [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-300">
                      Enter the date of your appointment (e.g., 2024-11-08)
                    </p>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {searchError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{searchError}</p>
                </div>
              )}

              {/* Search Button */}
              <button
                type="submit"
                id="search-submit-button"
                name="search-submit-button"
                data-testid="search-button"
                aria-label={isLoading ? 'Searching for booking...' : 'Search for booking'}
                aria-disabled={!canSearch || isLoading}
                aria-live="polite"
                aria-busy={isLoading}
                disabled={!canSearch || isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 focus:outline-none focus:ring-4 focus:ring-red-300"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin size-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="size-5" aria-hidden="true" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Search Results - Multiple Bookings */}
          {data && data.total > 1 && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {data.total} Bookings Found
                </h2>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-sm text-amber-400 hover:text-blue-700 font-medium flex items-center space-x-1"
                >
                  <X className="size-4" />
                  <span>Clear Search</span>
                </button>
              </div>

              <div className="space-y-4">
                {data.bookings.map((booking) => (
                  <div
                    key={booking.booking_id}
                    className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{booking.ticket_number}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-gray-300">
                          <Calendar className="inline size-4 mr-1" />
                          {formatDate(booking.appointment_date)} at {booking.appointment_time}
                        </p>
                        {booking.service_id && (
                          <p className="text-gray-300 text-sm mt-1">
                            Service: {booking.service_id}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewDetails(booking)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State - No Results */}
          {data && data.total === 0 && (
            <div className="mt-8 bg-[#2D0808] rounded-xl shadow-lg border border-gray-100 p-8 lg:p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                    <XCircle className="size-8 text-red-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">No Bookings Found</h3>
                  <p className="text-gray-300">We couldn't find any bookings matching your search.</p>
                </div>

                <div className="bg-[#2D0808] border border-blue-200 rounded-lg p-6 mb-6 text-left">
                  <p className="font-semibold text-white mb-3">Suggestions:</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start">
                      <CheckCircle className="size-4 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Check your ticket number format (TKT-YYYYMMDD-XXX)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="size-4 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Try a different date or phone number format</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="size-4 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Contact us if you need help</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] border border-white/10 rounded-lg p-6 mb-6 text-left">
                  <p className="font-semibold text-white mb-3">Need Help?</p>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a href={`tel:${appSettings.shop_phone}`} className="text-amber-400 hover:underline">
                        {appSettings.shop_phone || 'Not available'}
                      </a>
                    </p>
                    <p>
                      <strong>Email:</strong>{' '}
                      <a href={`mailto:${appSettings.shop_email}`} className="text-amber-400 hover:underline">
                        {appSettings.shop_email || 'Not available'}
                      </a>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Additional Help Section */}
          <div className="mt-8 text-center">
            <p className="text-gray-300 mb-4">
              Don't have an account yet?{' '}
              <Link to="/register" className="text-amber-400 hover:text-blue-700 font-medium hover:underline">
                Sign up
              </Link>{' '}
              for faster booking and history access.
            </p>
            <Link to="/" className="text-gray-300 hover:text-white text-sm hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_BookingSearch;