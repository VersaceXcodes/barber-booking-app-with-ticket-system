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
  
  const standardPattern = /^TKT-\d{8}-\d{3}$/;
  if (standardPattern.test(ticket)) return true;
  
  const relaxedPattern = /^TKT-\d+-\d+$/;
  return relaxedPattern.test(ticket);
};

const isValidPhone = (phone: string): boolean => {
  // Basic international phone validation
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
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
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'completed':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
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
    // Default to today
    const today = new Date();
    return today.toISOString().split('T')[0];
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
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/search`;
      const params: Record<string, string> = {};

      if (searchMethod === 'ticket') {
        params.ticket_number = ticketNumber;
      } else {
        params.phone = phone;
        params.date = date;
      }

      const response = await axios.get<SearchResponse>(apiUrl, { params });
      return response.data;
    },
    enabled: false, // Manual trigger only
    retry: 1,
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

  // Handle search errors
  useEffect(() => {
    if (error) {
      const axiosError = error as any;
      if (axiosError.response?.status === 429) {
        setSearchError('Too many search attempts. Please try again later.');
      } else {
        setSearchError(axiosError.response?.data?.error?.message || 'Search failed. Please try again.');
      }
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
    setDate(e.target.value);
    setSearchError(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!canSearch) return;
    
    setSearchError(null);
    setSearchTriggered(true);
    refetch();
  };

  const handleClearSearch = () => {
    setTicketNumber('');
    setPhone('');
    setDate(new Date().toISOString().split('T')[0]);
    setSearchError(null);
    setSearchTriggered(false);
  };

  const handleViewDetails = (booking: Booking) => {
    navigate(`/booking/${booking.ticket_number}`);
  };

  // Render
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Find Your Booking</h1>
            <p className="text-lg text-gray-600">
              Search for your appointment using your ticket number or phone and date
            </p>
          </div>

          {/* Search Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => handleSearchMethodChange('ticket')}
                  className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    searchMethod === 'ticket'
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canSearch) {
                    handleSearch(e as any);
                  }
                }
              }}
              className="p-6 lg:p-8 space-y-6"
              data-testid="search-form"
              role="search"
              aria-label="Booking search form"
            >
              {/* Ticket Number Tab */}
              {searchMethod === 'ticket' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ticket-number" className="block text-sm font-medium text-gray-900 mb-2">
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
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 text-base"
                      autoFocus
                    />
                    <p className="mt-2 text-sm text-gray-600">
                      Format: TKT-YYYYMMDD-XXX (e.g., TKT-20241105-003)
                    </p>
                  </div>
                </div>
              )}

              {/* Phone & Date Tab */}
              {searchMethod === 'phone_date' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-900 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-gray-400" />
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        data-testid="phone-input"
                        aria-label="Phone number"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="+1 (555) 123-4567"
                        autoComplete="tel"
                        data-form-type="other"
                        className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 text-base"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-900 mb-2">
                      Booking Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-gray-400" />
                      <input
                        type="date"
                        id="date"
                        name="date"
                        data-testid="date-input"
                        aria-label="Booking date"
                        value={date}
                        onChange={handleDateChange}
                        autoComplete="off"
                        data-form-type="other"
                        className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 text-base"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {searchError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{searchError}</p>
                </div>
              )}

              {/* Search Button */}
              <button
                type="submit"
                data-testid="search-button"
                aria-label="Search for booking"
                disabled={!canSearch || isLoading}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin size-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="size-5" />
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
                <h2 className="text-2xl font-bold text-gray-900">
                  {data.total} Bookings Found
                </h2>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                >
                  <X className="size-4" />
                  <span>Clear Search</span>
                </button>
              </div>

              <div className="space-y-4">
                {data.bookings.map((booking) => (
                  <div
                    key={booking.booking_id}
                    className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{booking.ticket_number}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-gray-600">
                          <Calendar className="inline size-4 mr-1" />
                          {formatDate(booking.appointment_date)} at {booking.appointment_time}
                        </p>
                        {booking.service_id && (
                          <p className="text-gray-600 text-sm mt-1">
                            Service: {booking.service_id}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewDetails(booking)}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
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
            <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-100 p-8 lg:p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                    <XCircle className="size-8 text-red-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">No Bookings Found</h3>
                  <p className="text-gray-600">We couldn't find any bookings matching your search.</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
                  <p className="font-semibold text-gray-900 mb-3">Suggestions:</p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <CheckCircle className="size-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Check your ticket number format (TKT-YYYYMMDD-XXX)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="size-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Try a different date or phone number format</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="size-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Contact us if you need help</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 text-left">
                  <p className="font-semibold text-gray-900 mb-3">Need Help?</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a href={`tel:${appSettings.shop_phone}`} className="text-blue-600 hover:underline">
                        {appSettings.shop_phone || 'Not available'}
                      </a>
                    </p>
                    <p>
                      <strong>Email:</strong>{' '}
                      <a href={`mailto:${appSettings.shop_email}`} className="text-blue-600 hover:underline">
                        {appSettings.shop_email || 'Not available'}
                      </a>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Additional Help Section */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              Don't have an account yet?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                Sign up
              </Link>{' '}
              for faster booking and history access.
            </p>
            <Link to="/" className="text-gray-600 hover:text-gray-900 text-sm hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_BookingSearch;