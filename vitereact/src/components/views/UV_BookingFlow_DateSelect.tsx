import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DateAvailability {
  available_slots: number;
  total_capacity: number;
  status: 'available' | 'limited' | 'full' | 'blocked' | 'past';
}

interface AvailabilityData {
  [date: string]: DateAvailability;
}

interface CalendarDay {
  date: number;
  dateString: string;
  availability: DateAvailability | null;
}

interface AvailabilityResponse {
  dates: Array<{
    date: string;
    available_slots: number;
    total_capacity: number;
    is_blocked: boolean;
  }>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const parseMonth = (monthString: string): Date => {
  const [year, month] = monthString.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const formatMonth = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonthDisplay = (monthString: string): string => {
  const date = parseMonth(monthString);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const formatLongDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getFirstAndLastDayOfMonth = (monthString: string): { start_date: string; end_date: string } => {
  const [year, month] = monthString.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    start_date: formatDate(firstDay),
    end_date: formatDate(lastDay)
  };
};

const transformAvailability = (response: AvailabilityResponse, bookingWindowDays: number): AvailabilityData => {
  const availabilityMap: AvailabilityData = {};
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + bookingWindowDays);
  maxDate.setHours(23, 59, 59, 999);
  
  (response.dates || []).forEach(dateData => {
    const dateObj = new Date(dateData.date + 'T00:00:00');
    const isPast = dateObj < today;
    const isBeyondBookingWindow = dateObj > maxDate;
    
    availabilityMap[dateData.date] = {
      available_slots: dateData.available_slots,
      total_capacity: dateData.total_capacity,
      status: dateData.is_blocked ? 'blocked' :
              isPast ? 'past' :
              isBeyondBookingWindow ? 'blocked' :
              dateData.available_slots === 0 ? 'full' :
              dateData.available_slots <= 1 ? 'limited' : 'available'
    };
  });
  
  return availabilityMap;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_BookingFlow_DateSelect: React.FC = () => {
  const navigate = useNavigate();

  // ============================================================================
  // ZUSTAND STATE (CRITICAL: Individual selectors only!)
  // ============================================================================
  
  const selectedDateFromContext = useAppStore(state => state.booking_context.selected_date);
  const serviceId = useAppStore(state => state.booking_context.service_id);
  const serviceName = useAppStore(state => state.booking_context.service_name);
  const bookingWindowDays = useAppStore(state => state.app_settings.booking_window_days);
  const updateBookingContext = useAppStore(state => state.update_booking_context);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  
  const [calendar_month, setCalendarMonth] = useState<string>(() => {
    // If there's a selected date, start with that month
    if (selectedDateFromContext) {
      return selectedDateFromContext.slice(0, 7); // "YYYY-MM"
    }
    return new Date().toISOString().slice(0, 7); // "YYYY-MM"
  });
  
  const [selected_date, setSelectedDate] = useState<string | null>(selectedDateFromContext);
  
  // ============================================================================
  // SYNC LOCAL STATE WITH CONTEXT
  // ============================================================================
  
  // When user navigates back from time selection, sync the context date
  useEffect(() => {
    if (selectedDateFromContext && selectedDateFromContext !== selected_date) {
      setSelectedDate(selectedDateFromContext);
      // Update calendar month to match selected date only if we're not already viewing it
      const contextMonth = selectedDateFromContext.slice(0, 7);
      if (calendar_month !== contextMonth) {
        setCalendarMonth(contextMonth);
      }
    }
  }, [selectedDateFromContext]);
  
  // ============================================================================
  // REACT QUERY - FETCH AVAILABILITY
  // ============================================================================
  
  const { start_date, end_date } = getFirstAndLastDayOfMonth(calendar_month);
  
  const {
    data: availability_data = {},
    isLoading: loading_availability,
    error: error_message
  } = useQuery<AvailabilityData>({
    queryKey: ['availability', calendar_month, serviceId, bookingWindowDays],
    queryFn: async () => {
      const response = await axios.get<AvailabilityResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/availability`,
        {
          params: {
            start_date,
            end_date,
            service_id: serviceId || undefined
          }
        }
      );
      return transformAvailability(response.data, bookingWindowDays);
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1
  });

  // ============================================================================
  // MONTH NAVIGATION LOGIC
  // ============================================================================
  
  const currentMonth = formatMonth(new Date());
  const maxMonth = useMemo(() => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + bookingWindowDays);
    return formatMonth(maxDate);
  }, [bookingWindowDays]);

  const canGoToPreviousMonth = calendar_month > currentMonth;
  const canGoToNextMonth = calendar_month < maxMonth;

  const navigatePreviousMonth = () => {
    if (canGoToPreviousMonth) {
      const currentDate = parseMonth(calendar_month);
      currentDate.setMonth(currentDate.getMonth() - 1);
      setCalendarMonth(formatMonth(currentDate));
    }
  };

  const navigateNextMonth = () => {
    if (canGoToNextMonth) {
      const currentDate = parseMonth(calendar_month);
      currentDate.setMonth(currentDate.getMonth() + 1);
      setCalendarMonth(formatMonth(currentDate));
    }
  };

  // ============================================================================
  // CALENDAR GRID GENERATION
  // ============================================================================
  
  const calendarWeeks = useMemo(() => {
    const [year, month] = calendar_month.split('-').map(Number);
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const paddingDays = firstDayOfMonth;
    const totalCells = paddingDays + daysInMonth;
    const totalWeeks = Math.ceil(totalCells / 7);
    
    const weeks: (CalendarDay | null)[][] = [];
    let dayCounter = 1 - paddingDays;
    
    for (let week = 0; week < totalWeeks; week++) {
      const days: (CalendarDay | null)[] = [];
      for (let day = 0; day < 7; day++) {
        const dayNumber = dayCounter;
        dayCounter++;
        
        if (dayNumber <= 0 || dayNumber > daysInMonth) {
          days.push(null); // Empty cell
        } else {
          const dateString = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
          const availability = availability_data[dateString] || null;
          days.push({
            date: dayNumber,
            dateString,
            availability
          });
        }
      }
      weeks.push(days);
    }
    
    return weeks;
  }, [calendar_month, availability_data]);

  // ============================================================================
  // DATE SELECTION HANDLER
  // ============================================================================
  
  const handleSelectDate = (day: CalendarDay) => {
    if (!day.availability) return;
    
    const status = day.availability.status;
    if (status === 'full' || status === 'blocked' || status === 'past') {
      return; // Not selectable
    }
    
    // Additional validation: check if date is within valid range
    const dateObj = new Date(day.dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + bookingWindowDays);
    maxDate.setHours(23, 59, 59, 999);
    
    if (dateObj < today || dateObj > maxDate) {
      return; // Date is outside valid range
    }
    
    // Update local state
    setSelectedDate(day.dateString);
    
    // Update global booking context
    // CRITICAL: Only clear selected_time if the date actually changed
    const dateChanged = day.dateString !== selectedDateFromContext;
    updateBookingContext({
      selected_date: day.dateString,
      ...(dateChanged ? { selected_time: null } : {}),
    });
  };

  // ============================================================================
  // CONTINUE TO TIME SELECTION
  // ============================================================================
  
  const handleContinue = () => {
    if (!selected_date) return;
    
    // If we're loading availability, wait
    if (loading_availability) {
      return;
    }
    
    // Final validation - check availability status
    const availability = availability_data[selected_date];
    if (!availability) {
      // Availability data not loaded for this date - this shouldn't happen
      // but if it does, we can still proceed (time selection will validate)
      console.warn('No availability data for selected date, proceeding anyway');
    } else if (availability.status !== 'available' && availability.status !== 'limited') {
      // Date is not available - clear selection
      alert('This date is no longer available. Please select another date.');
      setSelectedDate(null);
      updateBookingContext({ selected_date: null, selected_time: null });
      return;
    }
    
    // Final validation - check date range
    const dateObj = new Date(selected_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + bookingWindowDays);
    maxDate.setHours(23, 59, 59, 999);
    
    if (dateObj < today || dateObj > maxDate) {
      // Date is outside valid range - clear selection
      alert('This date is outside the booking window. Please select another date.');
      setSelectedDate(null);
      updateBookingContext({ selected_date: null, selected_time: null });
      return;
    }
    
    // Ensure the context is definitely updated before navigation
    updateBookingContext({
      selected_date: selected_date,
    });
    
    console.log('[Date Selection] Navigating to time selection with date:', selected_date);
    
    // All validations passed - proceed to time selection
    navigate('/book/time');
  };

  // ============================================================================
  // BACK NAVIGATION
  // ============================================================================
  
  const handleBack = () => {
    if (serviceId) {
      navigate('/book/service');
    } else {
      navigate('/');
    }
  };

  // ============================================================================
  // TODAY'S DATE STRING
  // ============================================================================
  
  const todayString = new Date().toISOString().slice(0, 10);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Main Container */}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Step 2 of 4</span>
              <span className="text-sm text-gray-500">Date Selection</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: '50%' }}></div>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={handleBack}
            className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </button>

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-8 border-b border-gray-200">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                When would you like to come?
              </h1>
              
              {/* Selected Service Pill */}
              {serviceName && (
                <div className="mt-4 inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span className="font-medium">{serviceName}</span>
                  <Link
                    to="/book/service"
                    className="ml-3 text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    Change
                  </Link>
                </div>
              )}
            </div>

            {/* Calendar Section */}
            <div className="px-6 py-8">
              
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={navigatePreviousMonth}
                  disabled={!canGoToPreviousMonth || loading_availability}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                
                <h2 className="text-2xl font-semibold text-gray-900">
                  {formatMonthDisplay(calendar_month)}
                </h2>
                
                <button
                  onClick={navigateNextMonth}
                  disabled={!canGoToNextMonth || loading_availability}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-6 h-6 text-gray-700" />
                </button>
              </div>

              {/* Error Message */}
              {error_message && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                  <XCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Couldn't load availability</p>
                    <p className="text-sm mt-1">Please try again or select a different month.</p>
                  </div>
                </div>
              )}

              {/* Calendar Grid */}
              <div className="mb-6">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-600 uppercase">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Weeks */}
                {loading_availability ? (
                  // Loading Skeleton
                  <div className="space-y-2">
                    {[...Array(5)].map((_, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7 gap-2">
                        {[...Array(7)].map((_, dayIndex) => (
                          <div
                            key={dayIndex}
                            className="aspect-square rounded-lg bg-gray-200 animate-pulse"
                          ></div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calendarWeeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7 gap-2">
                        {week.map((day, dayIndex) => {
                          if (!day) {
                            // Empty cell
                            return <div key={dayIndex} className="aspect-square"></div>;
                          }

                          const isToday = day.dateString === todayString;
                          const isSelected = day.dateString === selected_date;
                          const availability = day.availability;
                          const status = availability?.status || 'available';

                          // Cell styling based on status
                          let cellClasses = 'aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1 transition-all duration-200 ';
                          let isClickable = false;

                          if (isSelected) {
                            cellClasses += 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105 ';
                            isClickable = true;
                          } else if (status === 'available') {
                            cellClasses += 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer ';
                            isClickable = true;
                          } else if (status === 'limited') {
                            cellClasses += 'bg-amber-50 border-amber-300 hover:border-amber-500 hover:shadow-md cursor-pointer ';
                            isClickable = true;
                          } else if (status === 'full') {
                            cellClasses += 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed ';
                          } else if (status === 'blocked') {
                            cellClasses += 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)] ';
                          } else if (status === 'past') {
                            cellClasses += 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed ';
                          }

                          if (isToday && !isSelected) {
                            cellClasses += 'ring-2 ring-blue-400 ';
                          }

                          return (
                            <button
                              key={dayIndex}
                              onClick={() => isClickable && handleSelectDate(day)}
                              disabled={!isClickable}
                              className={cellClasses}
                              aria-label={`${day.dateString} - ${status}`}
                            >
                              <span className={`text-base font-semibold ${isSelected ? 'text-white' : status === 'past' || status === 'blocked' || status === 'full' ? 'text-gray-400' : 'text-gray-900'}`}>
                                {day.date}
                              </span>
                              
                              {isToday && !isSelected && (
                                <span className="text-[10px] font-medium text-blue-600 mt-0.5">Today</span>
                              )}
                              
                              {status === 'limited' && !isSelected && availability && (
                                <span className="text-[9px] font-medium text-amber-700 mt-0.5">
                                  {availability.available_slots} left
                                </span>
                              )}
                              
                              {status === 'full' && (
                                <span className="text-[9px] font-medium text-gray-500 mt-0.5">Full</span>
                              )}
                              
                              {status === 'blocked' && (
                                <span className="text-[9px] font-medium text-gray-500 mt-0.5">Closed</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded border-2 border-gray-200 bg-white mr-2"></div>
                    <span className="text-gray-700">Available</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded border-2 border-amber-300 bg-amber-50 mr-2"></div>
                    <span className="text-gray-700">Limited</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded border-2 border-gray-200 bg-gray-100 mr-2"></div>
                    <span className="text-gray-700">Fully Booked</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded border-2 border-gray-200 bg-gray-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.05)_5px,rgba(0,0,0,0.05)_10px)] mr-2"></div>
                    <span className="text-gray-700">Blocked/Closed</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded border-2 border-blue-400 bg-white mr-2"></div>
                    <span className="text-gray-700">Today</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded border-2 border-blue-600 bg-blue-600 mr-2"></div>
                    <span className="text-gray-700">Selected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <div className="px-6 py-6 bg-gray-50 border-t border-gray-200">
              <button
                onClick={handleContinue}
                disabled={!selected_date || loading_availability}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
              >
                {selected_date ? `Continue to Time Selection` : 'Select a date to continue'}
              </button>
              
              {selected_date && (
                <p className="text-center text-sm text-gray-600 mt-3">
                  Selected: <span className="font-semibold text-gray-900">{formatLongDate(selected_date)}</span>
                </p>
              )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default UV_BookingFlow_DateSelect;