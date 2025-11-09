import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Booking {
  booking_id: string;
  ticket_number: string;
  user_id: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  appointment_date: string;
  appointment_time: string;
  slot_duration: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_for_name: string | null;
  service_id: string | null;
  special_request: string | null;
  inspiration_photos: string[] | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  admin_notes: string | null;
  original_booking_id: string | null;
}

interface BookingWithDerived extends Booking {
  time_until_appointment?: string;
  service_name?: string;
  can_cancel?: boolean;
  can_reschedule?: boolean;
}

type TabType = 'upcoming' | 'past' | 'cancelled';

interface CancelModalState {
  isOpen: boolean;
  bookingId: string | null;
  ticketNumber: string | null;
  reason: string;
  isSubmitting: boolean;
}

interface UserStats {
  total_bookings: number;
  last_booking_date: string | null;
  most_booked_service: string | null;
  member_since: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const calculateTimeUntil = (appointmentDate: string, appointmentTime: string): string => {
  const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
  const now = new Date();
  const diffMs = appointmentDateTime.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Past';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Starting soon';
  if (diffHours < 24) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  
  return appointmentDate;
};

const canCancelBooking = (appointmentDate: string, appointmentTime: string): boolean => {
  const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
  const now = new Date();
  const diffHours = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours > 2;
};

const formatDisplayDate = (date: string, time: string): string => {
  const dateObj = new Date(`${date}T${time}`);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return dateObj.toLocaleDateString('en-US', options);
};

const truncateText = (text: string | null, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // CRITICAL: Individual Zustand selectors (NO object destructuring)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateBookingContext = useAppStore(state => state.update_booking_context);
  const clearBookingContext = useAppStore(state => state.clear_booking_context);
  
  // Local state
  const [selectedTab, setSelectedTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'upcoming'
  );
  const [highlightedBookingId] = useState<string | null>(
    searchParams.get('highlight_booking')
  );
  const [cancelModalState, setCancelModalState] = useState<CancelModalState>({
    isOpen: false,
    bookingId: null,
    ticketNumber: null,
    reason: '',
    isSubmitting: false
  });

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', selectedTab);
    if (highlightedBookingId) {
      params.set('highlight_booking', highlightedBookingId);
    }
    setSearchParams(params, { replace: true });
  }, [selectedTab, highlightedBookingId, setSearchParams]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const statusMap: Record<TabType, string> = {
    upcoming: 'confirmed',
    past: 'completed',
    cancelled: 'cancelled'
  };

  const sortOrderMap: Record<TabType, 'asc' | 'desc'> = {
    upcoming: 'asc',
    past: 'desc',
    cancelled: 'desc'
  };

  const { data: bookingsData, isLoading, error, refetch } = useQuery({
    queryKey: ['user-bookings', selectedTab, authToken],
    queryFn: async () => {
      if (!authToken) throw new Error('Not authenticated');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/user/bookings`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            status: statusMap[selectedTab]
          }
        }
      );
      return response.data;
    },
    select: (data): { bookings: BookingWithDerived[]; total: number } => {
      let bookings = (data.bookings || []).map((booking: Booking): BookingWithDerived => ({
        ...booking,
        time_until_appointment: selectedTab === 'upcoming' 
          ? calculateTimeUntil(booking.appointment_date, booking.appointment_time)
          : undefined,
        service_name: booking.service_id ? 'Haircut' : 'Haircut', // Default service name
        can_cancel: selectedTab === 'upcoming' 
          ? canCancelBooking(booking.appointment_date, booking.appointment_time)
          : false,
        can_reschedule: selectedTab === 'upcoming'
          ? canCancelBooking(booking.appointment_date, booking.appointment_time)
          : false
      }));
      
      // Sort bookings based on selected tab
      if (selectedTab === 'upcoming') {
        // For upcoming, show earliest first (ascending order)
        bookings.sort((a, b) => {
          const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
          const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
          return dateA.getTime() - dateB.getTime();
        });
      } else {
        // For past/cancelled, show latest first (descending order)
        bookings.sort((a, b) => {
          const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
          const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
          return dateB.getTime() - dateA.getTime();
        });
      }
      
      return {
        bookings,
        total: data.total || 0
      };
    },
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const { data: allBookingsData } = useQuery({
    queryKey: ['user-bookings-all', authToken],
    queryFn: async () => {
      if (!authToken) throw new Error('Not authenticated');
      
      const [confirmedRes, completedRes, cancelledRes] = await Promise.all([
        axios.get(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/user/bookings`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            params: { status: 'confirmed' }
          }
        ),
        axios.get(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/user/bookings`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            params: { status: 'completed' }
          }
        ),
        axios.get(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/user/bookings`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            params: { status: 'cancelled' }
          }
        )
      ]);
      
      const allBookings = [
        ...(confirmedRes.data.bookings || []),
        ...(completedRes.data.bookings || []),
        ...(cancelledRes.data.bookings || [])
      ];
      
      return {
        bookings: allBookings,
        total: allBookings.length
      };
    },
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // ============================================================================
  // CANCEL BOOKING MUTATION
  // ============================================================================

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ ticketNumber, reason }: { ticketNumber: string; reason: string }) => {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticketNumber}/cancel`,
        {
          cancellation_reason: reason || 'No reason provided',
          cancelled_by: 'customer'
        },
        {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      // Refetch bookings
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookings-all'] });
      
      // Close modal
      setCancelModalState({
        isOpen: false,
        bookingId: null,
        ticketNumber: null,
        reason: '',
        isSubmitting: false
      });
      
      // Switch to cancelled tab to show the result
      setSelectedTab('cancelled');
    },
    onError: (error: any) => {
      setCancelModalState(prev => ({ ...prev, isSubmitting: false }));
      alert(error.response?.data?.error?.message || 'Failed to cancel booking. Please try again.');
    }
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleTabSwitch = (tab: TabType) => {
    setSelectedTab(tab);
  };

  const handleOpenCancelModal = (booking: BookingWithDerived) => {
    if (!booking.can_cancel) {
      alert('Cannot cancel within 2 hours of appointment. Please call us.');
      return;
    }
    
    setCancelModalState({
      isOpen: true,
      bookingId: booking.booking_id,
      ticketNumber: booking.ticket_number,
      reason: '',
      isSubmitting: false
    });
  };

  const handleCloseCancelModal = () => {
    if (cancelModalState.isSubmitting) return;
    setCancelModalState({
      isOpen: false,
      bookingId: null,
      ticketNumber: null,
      reason: '',
      isSubmitting: false
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelModalState.ticketNumber) return;
    
    setCancelModalState(prev => ({ ...prev, isSubmitting: true }));
    cancelBookingMutation.mutate({
      ticketNumber: cancelModalState.ticketNumber,
      reason: cancelModalState.reason
    });
  };

  const handleReschedule = (booking: BookingWithDerived) => {
    if (!booking.can_reschedule) {
      alert('Cannot reschedule within 2 hours of appointment. Please call us.');
      return;
    }
    
    // Update booking context with original booking data
    // CRITICAL: Clear selected_date and selected_time to force fresh selection
    updateBookingContext({
      service_id: booking.service_id,
      service_name: booking.service_name || null,
      selected_date: null,
      selected_time: null,
      customer_name: booking.customer_name,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      booking_for_name: booking.booking_for_name,
      special_request: booking.special_request,
      step_completed: 0
    });
    
    // Navigate to date selection
    navigate('/book/date');
  };

  const handleQuickRebook = (booking: BookingWithDerived) => {
    // Clear context first
    clearBookingContext();
    
    // Update booking context with service and customer details (but NOT inspiration photos)
    updateBookingContext({
      service_id: booking.service_id,
      service_name: booking.service_name || null,
      customer_name: currentUser?.name || booking.customer_name,
      customer_email: currentUser?.email || booking.customer_email,
      customer_phone: currentUser?.phone || booking.customer_phone,
      booking_for_name: booking.booking_for_name,
      special_request: booking.special_request,
      inspiration_photos: null, // CRITICAL: Do not include photos
      step_completed: 0
    });
    
    // Navigate to date selection
    navigate('/book/date');
  };

  // ============================================================================
  // CALCULATE USER STATS
  // ============================================================================

  const userStats: UserStats = React.useMemo(() => {
    const allBookings = allBookingsData?.bookings || [];
    
    const sortedByDate = [...allBookings].sort((a, b) => {
      const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
      const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
      return dateB.getTime() - dateA.getTime();
    });
    
    return {
      total_bookings: allBookingsData?.total || 0,
      last_booking_date: sortedByDate.length > 0 
        ? sortedByDate[0].appointment_date 
        : null,
      most_booked_service: 'Haircut',
      member_since: currentUser?.created_at 
        ? new Date(currentUser.created_at).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })
        : 'Unknown'
    };
  }, [allBookingsData, currentUser]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const bookings = bookingsData?.bookings || [];
  const firstName = currentUser?.name?.split(' ')[0] || 'User';

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome back, {firstName}!
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Member since {userStats.member_since}
                </p>
              </div>
              <Link
                to="/book/service"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Book Appointment
              </Link>
            </div>

            {/* User Statistics */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Total Bookings</p>
                    <p className="text-2xl font-bold text-blue-600">{userStats.total_bookings}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Last Visit</p>
                    <p className="text-sm font-semibold text-green-600">
                      {userStats.last_booking_date 
                        ? new Date(userStats.last_booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'No visits yet'
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">Favorite Service</p>
                    <p className="text-sm font-semibold text-purple-600">{userStats.most_booked_service}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => handleTabSwitch('upcoming')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === 'upcoming'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upcoming Bookings
              </button>
              <button
                onClick={() => handleTabSwitch('past')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === 'past'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Past Bookings
              </button>
              <button
                onClick={() => handleTabSwitch('cancelled')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === 'cancelled'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Cancelled
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <p className="text-red-900 font-medium mb-2">Failed to load bookings</p>
              <p className="text-red-700 text-sm mb-4">
                {(error as any).response?.data?.error?.message || (error as Error).message}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Bookings List */}
          {!isLoading && !error && (
            <>
              {/* Empty State */}
              {bookings.length === 0 && (
                <div className="text-center py-12">
                  {selectedTab === 'upcoming' && (
                    <>
                      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming appointments</h3>
                      <p className="text-gray-600 mb-6">You don't have any bookings scheduled yet.</p>
                      <Link
                        to="/book/service"
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Book Now
                      </Link>
                    </>
                  )}
                  {selectedTab === 'past' && (
                    <>
                      <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No past bookings yet</h3>
                      <p className="text-gray-600">Your completed appointments will appear here.</p>
                    </>
                  )}
                  {selectedTab === 'cancelled' && (
                    <>
                      <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No cancelled bookings</h3>
                      <p className="text-gray-600">You haven't cancelled any appointments.</p>
                    </>
                  )}
                </div>
              )}

              {/* Booking Cards */}
              {bookings.length > 0 && (
                <div className="space-y-4">
                  {bookings.map(booking => (
                    <div
                      key={booking.booking_id}
                      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${
                        highlightedBookingId === booking.ticket_number
                          ? 'border-blue-500 ring-4 ring-blue-100'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Link
                                to={`/booking/${booking.ticket_number}`}
                                className="text-sm font-mono font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                {booking.ticket_number}
                              </Link>
                              {selectedTab === 'upcoming' && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                  Upcoming
                                </span>
                              )}
                              {selectedTab === 'past' && (
                                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                                  Completed
                                </span>
                              )}
                              {selectedTab === 'cancelled' && (
                                <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                                  Cancelled
                                </span>
                              )}
                            </div>
                            
                            <h3 className={`text-2xl font-bold mb-1 ${
                              selectedTab === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'
                            }`}>
                              {formatDisplayDate(booking.appointment_date, booking.appointment_time)}
                            </h3>
                            
                            {booking.service_name && (
                              <p className="text-gray-600">{booking.service_name}</p>
                            )}
                            
                            {selectedTab === 'upcoming' && booking.time_until_appointment && (
                              <div className="flex items-center mt-2 text-sm text-blue-600 font-medium">
                                <Clock className="w-4 h-4 mr-1" />
                                {booking.time_until_appointment}
                              </div>
                            )}
                            
                            {selectedTab === 'cancelled' && booking.cancelled_at && (
                              <p className="text-sm text-gray-500 mt-2">
                                Cancelled on {new Date(booking.cancelled_at).toLocaleDateString('en-US', { 
                                  month: 'long', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Special Request */}
                        {booking.special_request && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Special Request: </span>
                              {truncateText(booking.special_request, 100)}
                              {booking.special_request.length > 100 && (
                                <Link
                                  to={`/booking/${booking.ticket_number}`}
                                  className="text-blue-600 hover:text-blue-700 ml-1"
                                >
                                  Read more
                                </Link>
                              )}
                            </p>
                          </div>
                        )}

                        {/* Cancellation Reason */}
                        {selectedTab === 'cancelled' && booking.cancellation_reason && (
                          <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-sm text-red-700">
                              <span className="font-medium">Reason: </span>
                              {booking.cancellation_reason}
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3">
                          <Link
                            to={`/booking/${booking.ticket_number}`}
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            View Details
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>

                          {selectedTab === 'upcoming' && booking.can_reschedule && (
                            <button
                              onClick={() => handleReschedule(booking)}
                              className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors"
                            >
                              Reschedule
                            </button>
                          )}

                          {selectedTab === 'upcoming' && booking.can_cancel && (
                            <button
                              onClick={() => handleOpenCancelModal(booking)}
                              className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors"
                            >
                              Cancel
                            </button>
                          )}

                          {(selectedTab === 'past' || selectedTab === 'cancelled') && (
                            <button
                              onClick={() => handleQuickRebook(booking)}
                              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                            >
                              Book Again
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Cancel Booking Modal */}
        {cancelModalState.isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                aria-hidden="true"
                onClick={handleCloseCancelModal}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Cancel This Booking?
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-4">
                          Are you sure you want to cancel this booking? This action cannot be undone.
                        </p>
                        
                        <div className="mb-4">
                          <label htmlFor="cancellation-reason" className="block text-sm font-medium text-gray-700 mb-2">
                            Reason for cancellation (optional)
                          </label>
                          <textarea
                            id="cancellation-reason"
                            rows={3}
                            maxLength={200}
                            value={cancelModalState.reason}
                            onChange={(e) => setCancelModalState(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="e.g., schedule changed, found another barber, emergency"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={cancelModalState.isSubmitting}
                          />
                          <p className="mt-1 text-xs text-gray-500 text-right">
                            {cancelModalState.reason.length}/200
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={cancelModalState.isSubmitting}
                    className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelModalState.isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Cancelling...
                      </span>
                    ) : (
                      'Yes, Cancel Booking'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseCancelModal}
                    disabled={cancelModalState.isSubmitting}
                    className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    No, Keep Booking
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_UserDashboard;