import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface TimeSlot {
  time: string;
  available_slots: number;
  total_capacity: number;
  is_available: boolean;
  status: 'available' | 'limited' | 'full' | 'blocked';
}

interface AvailabilityResponse {
  date: string;
  slots: Array<{
    time: string;
    available_slots: number;
    total_capacity: number;
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
  const [selectedTime, setSelectedTime] = React.useState<string | null>(selectedTimeFromContext);

  // Sync local state with context when returning to this page
  React.useEffect(() => {
    if (selectedTimeFromContext && selectedTimeFromContext !== selectedTime) {
      console.log('[Time Selection] Syncing time from context:', selectedTimeFromContext);
      setSelectedTime(selectedTimeFromContext);
    }
  }, [selectedTimeFromContext]);

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
        available_slots: slot.available_slots,
        total_capacity: slot.total_capacity,
        is_available: slot.is_available,
        status: !slot.is_available || slot.available_slots === 0
          ? (slot.available_slots === 0 ? 'full' : 'blocked')
          : slot.available_slots === 1
          ? 'limited'
          : ('available' as const),
      })) as TimeSlot[];
    },
    enabled: !!selectedDate,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  // Redirect if no date selected (with guard to prevent multiple redirects)
  useEffect(() => {
    if (!selectedDate && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/book/date', { replace: true });
    }
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
    if (!slot.is_available || slot.available_slots === 0) {
      return; // Cannot select unavailable slots
    }

    console.log('[Time Selection] Time slot selected:', slot.time);

    // Update both local state and context
    setSelectedTime(slot.time);
    updateBookingContext({
      selected_time: slot.time,
    });
  };

  // Handle continue to details
  const handleContinue = () => {
    if (!selectedTime) {
      return; // Button should be disabled
    }

    // Verify slot is still available
    const slot = timeSlots?.find(s => s.time === selectedTime);
    if (!slot || !slot.is_available || slot.available_slots === 0) {
      alert('Sorry, this slot was just booked. Please choose another time.');
      refetch(); // Refresh availability
      setSelectedTime(null);
      updateBookingContext({ selected_time: null });
      return;
    }

    // Final check: ensure context is updated before navigation
    updateBookingContext({
      selected_time: selectedTime,
    });

    navigate('/book/details');
  };

  // Get slot status styling
  const getSlotStatusClass = (slot: TimeSlot, isSelected: boolean): string => {
    if (isSelected) {
      return 'bg-blue-600 border-blue-600 text-white';
    }
    
    switch (slot.status) {
      case 'available':
        return 'bg-white border-gray-300 text-gray-900 hover:border-blue-500 hover:shadow-md';
      case 'limited':
        return 'bg-amber-50 border-amber-400 text-gray-900 hover:border-amber-500 hover:shadow-md';
      case 'full':
      case 'blocked':
        return 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed';
      default:
        return 'bg-white border-gray-300 text-gray-900';
    }
  };

  // Get capacity text
  const getCapacityText = (slot: TimeSlot): string => {
    const booked = slot.total_capacity - slot.available_slots;
    const remaining = slot.available_slots;

    if (!slot.is_available) {
      return 'Blocked';
    }
    if (slot.available_slots === 0) {
      return 'Fully Booked';
    }
    if (slot.available_slots === 1) {
      return 'Last spot!';
    }
    return `${booked}/${slot.total_capacity} booked • ${remaining} left`;
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <Link
                to="/book/date"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
              <span className="text-sm text-gray-600 font-medium">Step 3 of 4</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 leading-tight">
              What time works for you?
            </h1>
            <p className="text-xl text-gray-700 mb-1">{formattedDate}</p>
            <p className="text-sm text-gray-600">Each appointment is 40 minutes</p>
            
            <Link
              to="/book/date"
              className="inline-block mt-3 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
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
              <p className="text-red-800 font-medium mb-2">Failed to load time slots</p>
              <p className="text-red-600 text-sm mb-4">Please try again</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* No Slots Available */}
          {!isLoading && !error && timeSlots && timeSlots.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                No slots available for this date
              </h2>
              <p className="text-gray-600 mb-6">
                Please choose another day
              </p>
              <Link
                to="/book/date"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
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
                  const isSelected = selectedTime === slot.time;
                  const isDisabled = !slot.is_available || slot.available_slots === 0;
                  
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
                            <p className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                              {formatTime(slot.time)}
                            </p>
                            {isSelected && (
                              <svg className="w-6 h-6 text-white ml-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <p className={`text-sm mt-1 ${isSelected ? 'text-blue-100' : slot.status === 'limited' ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                            {getCapacityText(slot)}
                          </p>
                        </div>
                        
                        {!isDisabled && !isSelected && (
                          <div className="ml-4">
                            <span className={`inline-block px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              slot.status === 'limited' 
                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}>
                              Select
                            </span>
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="ml-4">
                            <span className="inline-block px-4 py-2 rounded-lg font-medium text-sm bg-white text-blue-600">
                              Selected ✓
                            </span>
                          </div>
                        )}
                        
                        {isDisabled && (
                          <div className="ml-4">
                            <span className="inline-block px-4 py-2 rounded-lg font-medium text-sm bg-gray-300 text-gray-600">
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
                  disabled={!selectedTime}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg ${
                    selectedTime
                      ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {selectedTime ? 'Continue to Details' : 'Select a time to continue'}
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