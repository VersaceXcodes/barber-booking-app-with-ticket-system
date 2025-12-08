import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface TimeSlot {
  time: string;
  available_spots: number;
  total_capacity: number;
  booked_count: number;
  is_available: boolean;
  status: 'available' | 'limited' | 'full' | 'blocked';
}

interface AvailabilityResponse {
  date: string;
  slots: Array<{
    time: string;
    available_spots: number;
    total_capacity: number;
    booked_count: number;
    is_available: boolean;
  }>;
}

const UV_BookingFlow_TimeSelect: React.FC = () => {
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  // CRITICAL: Individual selectors, no object destructuring
  const selectedDate = useAppStore(state => state.booking_context.selected_date);
  const serviceId = useAppStore(state => state.booking_context.service_id);
  const selectedTimeFromContext = useAppStore(state => state.booking_context.selected_time);
  const updateBookingContext = useAppStore(state => state.update_booking_context);

  // Local state for selected time to prevent loss during scrolling/interaction
  // Initialize from context to preserve selection when navigating back
  const [selectedTime, setSelectedTime] = React.useState<string | null>(selectedTimeFromContext);
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Sync local state with context - use context as source of truth
  // Only sync when context value actually changes (not on every render)
  React.useEffect(() => {
    // Always sync from context to ensure we have the latest value
    if (selectedTimeFromContext !== selectedTime) {
      console.log('[Time Selection] Syncing time from context:', selectedTimeFromContext);
      setSelectedTime(selectedTimeFromContext);
    }
  }, [selectedTimeFromContext, selectedTime]);

  // Log current state for debugging
  React.useEffect(() => {
    console.log('[Time Selection] Current state:', {
      selectedDate,
      selectedTime,
      selectedTimeFromContext,
      serviceId,
    });
  }, [selectedDate, selectedTime, selectedTimeFromContext, serviceId]);

  // Format date for display
  const getFormattedDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formattedDate = getFormattedDate(selectedDate);

  // Fetch time slots availability
  const {
    data: timeSlots,
    isLoading,
    error,
    refetch,
  } = useQuery<TimeSlot[]>({
    queryKey: ['availability-slots', selectedDate, serviceId],
    queryFn: async () => {
      if (!selectedDate) {
        throw new Error('No date selected');
      }

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      // Build query params
      const params: Record<string, string> = {};
      if (serviceId) {
        params.service_id = serviceId;
      }

      const response = await axios.get<AvailabilityResponse>(
        `${apiBaseUrl}/api/availability/${selectedDate}`,
        { params }
      );

      // Transform response to add computed status field
      return (response.data.slots || []).map(slot => ({
        time: slot.time,
        available_spots: slot.available_spots,
        total_capacity: slot.total_capacity,
        booked_count: slot.booked_count,
        is_available: slot.is_available,
        status: !slot.is_available || slot.available_spots === 0
          ? (slot.available_spots === 0 ? 'full' : 'blocked')
          : slot.available_spots === 1
          ? 'limited'
          : ('available' as const),
      })) as TimeSlot[];
    },
    enabled: !!selectedDate,
    staleTime: 0, // Always fetch fresh data to ensure availability is up-to-date
    refetchInterval: false, // Disable auto-refresh to prevent unwanted re-renders
    refetchOnWindowFocus: true, // Refetch when window regains focus to get latest availability
    refetchOnMount: true, // Always refetch when component mounts to get fresh data
  });

  // Redirect if no date selected (with guard to prevent multiple redirects)
  useEffect(() => {
    // Wait for initial render and context hydration before checking
    // This prevents premature redirects during page load
    const timer = setTimeout(() => {
      if (!selectedDate && !hasRedirected.current) {
        console.log('[Time Selection] No date selected, redirecting to date selection');
        hasRedirected.current = true;
        navigate('/book/date', { replace: true });
      }
    }, 100); // Small delay to allow context to hydrate from localStorage
    
    return () => clearTimeout(timer);
  }, [selectedDate, navigate]);

  // Format time to 12-hour format with AM/PM
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Handle slot selection
  const handleSelectSlot = (slot: TimeSlot) => {
    if (!slot.is_available || slot.available_spots === 0) {
      return; // Cannot select unavailable slots
    }

    console.log('[Time Selection] Time slot selected:', slot.time);

    // Update local state first for immediate UI feedback
    setSelectedTime(slot.time);
    
    // Then update context (source of truth) - this will persist across navigation
    updateBookingContext({
      selected_time: slot.time,
    });
  };

  // Handle continue to details
  const handleContinue = () => {
    // Use selected time from either local state or context
    const timeToUse = selectedTime || selectedTimeFromContext;
    
    if (!timeToUse) {
      console.log('[Time Selection] No time selected, cannot continue');
      return; // Button should be disabled
    }

    // Verify slot is still available
    const slot = timeSlots?.find(s => s.time === timeToUse);
    if (!slot || !slot.is_available || slot.available_spots === 0) {
      alert('Sorry, this slot was just booked. Please choose another time.');
      refetch(); // Refresh availability
      setSelectedTime(null);
      updateBookingContext({ selected_time: null });
      return;
    }

    // Show loading indicator
    setIsNavigating(true);

    // Final check: ensure context is updated before navigation
    console.log('[Time Selection] Continuing with time:', timeToUse);
    updateBookingContext({
      selected_time: timeToUse,
    });

    // Use setTimeout to ensure state update is flushed before navigation
    // This prevents race conditions where navigation happens before state persists
    setTimeout(() => {
      navigate('/book/details');
    }, 0);
  };

  // Get slot status styling
  const getSlotStatusClass = (slot: TimeSlot, isSelected: boolean): string => {
    if (isSelected) {
      return 'bg-gradient-to-r from-red-600 to-red-700 border-red-600 text-master-text-primary-dark';
    }
    
    switch (slot.status) {
      case 'available':
        return 'bg-[#2D0808] border-gray-300 text-master-text-primary-dark hover:border-blue-500 hover:shadow-md';
      case 'limited':
        return 'bg-amber-50 border-amber-400 text-master-text-primary-dark hover:border-amber-500 hover:shadow-md';
      case 'full':
      case 'blocked':
        return 'bg-gray-100 border-gray-300 text-master-text-muted-dark cursor-not-allowed';
      default:
        return 'bg-[#2D0808] border-gray-300 text-master-text-primary-dark';
    }
  };

  // Get capacity text
  const getCapacityText = (slot: TimeSlot): string => {
    const booked = slot.booked_count;
    const remaining = slot.available_spots;

    if (!slot.is_available) {
      return 'Blocked';
    }
    if (slot.available_spots === 0) {
      return 'Fully Booked';
    }
    if (slot.available_spots === 1) {
      return 'Last spot!';
    }
    return `${booked}/${slot.total_capacity} booked • ${remaining} left`;
  };

  // Compute if we have a valid time selection
  // Use useMemo to prevent unnecessary re-computations
  const hasValidSelection = React.useMemo(() => {
    return !!(selectedTime || selectedTimeFromContext);
  }, [selectedTime, selectedTimeFromContext]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <Link
                to="/book/date"
                className="inline-flex items-center text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
              <span className="text-sm text-master-text-secondary-dark font-medium">Step 3 of 4</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-master-text-primary-dark mb-2 leading-tight">
              What time works for you?
            </h1>
            <p className="text-xl text-master-text-secondary-dark mb-1">{formattedDate}</p>
            <p className="text-sm text-master-text-secondary-dark">Each appointment is 40 minutes</p>
            
            <Link
              to="/book/date"
              className="inline-block mt-3 text-amber-400 hover:text-amber-300 font-medium text-sm transition-colors"
            >
              Change Date
            </Link>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="bg-white rounded-xl h-24 shadow-lg"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 font-medium mb-2">Failed to load time slots</p>
              <p className="text-red-600 text-sm mb-4">Please try again</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-master-text-primary-dark rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* No Slots Available */}
          {!isLoading && !error && timeSlots && timeSlots.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
              <svg className="w-16 h-16 text-master-text-muted-dark mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-master-text-primary-dark mb-2">
                No slots available for this date
              </h2>
              <p className="text-master-text-secondary-dark mb-6">
                Please choose another day
              </p>
              <Link
                to="/book/date"
                className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-colors shadow-lg"
              >
                Change Date
              </Link>
            </div>
          )}

          {/* Time Slots List */}
          {!isLoading && !error && timeSlots && timeSlots.length > 0 && (
            <>
              <div className="space-y-4 mb-6">
                {timeSlots.map((slot) => {
                  // Check both local state and context for selection
                  const isSelected = selectedTime === slot.time || selectedTimeFromContext === slot.time;
                  const isDisabled = !slot.is_available || slot.available_spots === 0;
                  
                  return (
                    <button
                      key={slot.time}
                      onClick={() => handleSelectSlot(slot)}
                      disabled={isDisabled}
                      className={`w-full text-left rounded-xl border-2 p-6 transition-all duration-200 ${getSlotStatusClass(slot, isSelected)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className={`text-2xl font-bold ${isSelected ? 'text-master-text-primary-dark' : 'text-master-text-primary-dark'}`}>
                              {formatTime(slot.time)}
                            </p>
                            {isSelected && (
                              <svg className="w-6 h-6 text-master-text-primary-dark ml-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <p className={`text-sm mt-1 ${isSelected ? 'text-blue-100' : slot.status === 'limited' ? 'text-amber-700 font-semibold' : 'text-master-text-secondary-dark'}`}>
                            {getCapacityText(slot)}
                          </p>
                        </div>
                        
                        {!isDisabled && !isSelected && (
                          <div className="ml-4">
                            <span className={`inline-block px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              slot.status === 'limited' 
                                ? 'bg-amber-600 text-master-text-primary-dark hover:bg-amber-700'
                                : 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark hover:from-red-700 hover:to-red-800'
                            }`}>
                              Select
                            </span>
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="ml-4">
                            <span className="inline-block px-4 py-2 rounded-lg font-medium text-sm bg-white text-amber-400">
                              Selected ✓
                            </span>
                          </div>
                        )}
                        
                        {isDisabled && (
                          <div className="ml-4">
                            <span className="inline-block px-4 py-2 rounded-lg font-medium text-sm bg-gray-300 text-master-text-secondary-dark">
                              {!slot.is_available ? 'Blocked' : 'Fully Booked'}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Continue Button - Sticky at bottom */}
              <div className="sticky bottom-0 pb-4 pt-6 bg-gradient-to-t from-blue-50 via-blue-50 to-transparent">
                <button
                  onClick={handleContinue}
                  disabled={!hasValidSelection || isNavigating}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg flex items-center justify-center ${
                    hasValidSelection && !isNavigating
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark hover:from-red-700 hover:to-red-800 hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-300 text-master-text-muted-dark cursor-not-allowed'
                  }`}
                >
                  {isNavigating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    hasValidSelection ? 'Continue to Details' : 'Select a time to continue'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_BookingFlow_TimeSelect;