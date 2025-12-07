import React, { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  RefreshCw, 
  Printer, 
  Download,
  Search,
  Filter,
  Grid3x3,
  List,
  Clock,
  Phone,
  User,
  MapPin
} from 'lucide-react';

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
  customer_phone: string;
  service_id: string | null;
  special_request: string | null;
}

interface Service {
  service_id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_callout?: boolean;
}

interface CapacityOverride {
  override_id: string;
  override_date: string;
  time_slot: string;
  capacity: number;
  is_active: boolean;
}

interface BlockedSlot {
  block_id: string;
  block_date: string;
  time_slot: string | null;
  reason: string | null;
}

interface GroupedBookings {
  [date: string]: {
    [time: string]: Booking[];
  };
}

type ViewType = 'month' | 'week' | 'day' | 'list';
type StatusFilter = 'all' | 'upcoming' | 'completed' | 'cancelled' | 'no-show';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIME_SLOTS = ['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:20'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 border-yellow-500 text-yellow-900',
  confirmed: 'bg-blue-100 border-blue-500 text-blue-900',
  completed: 'bg-gray-100 border-gray-500 text-white',
  cancelled: 'bg-red-100 border-red-500 text-red-900',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const parseDate = (dateStr: string): Date => {
  return new Date(dateStr + 'T00:00:00');
};

const getDayOfWeek = (dateStr: string): number => {
  return parseDate(dateStr).getDay();
};

const getDefaultCapacity = (dayOfWeek: number): number => {
  // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Mon-Wed (1-3): 2, Thu-Sun (4-6, 0): 3
  return dayOfWeek >= 1 && dayOfWeek <= 3 ? 2 : 3;
};

const getMonthDates = (year: number, month: number): Date[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Date[] = [];
  
  // Add padding days from previous month
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    dates.push(date);
  }
  
  // Add all days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    dates.push(new Date(year, month, i));
  }
  
  // Add padding days from next month to complete grid
  const endPadding = 7 - (dates.length % 7);
  if (endPadding < 7) {
    for (let i = 1; i <= endPadding; i++) {
      dates.push(new Date(year, month + 1, i));
    }
  }
  
  return dates;
};

const getWeekDates = (date: Date): Date[] => {
  const dayOfWeek = date.getDay();
  const dates: Date[] = [];
  
  // Get Sunday of current week
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);
  
  // Add 7 days
  for (let i = 0; i < 7; i++) {
    const weekDate = new Date(sunday);
    weekDate.setDate(sunday.getDate() + i);
    dates.push(weekDate);
  }
  
  return dates;
};

const groupBookingsByDateAndTime = (bookings: Booking[]): GroupedBookings => {
  const grouped: GroupedBookings = {};
  
  bookings.forEach(booking => {
    const date = booking.appointment_date;
    const time = booking.appointment_time;
    
    if (!grouped[date]) {
      grouped[date] = {};
    }
    
    if (!grouped[date][time]) {
      grouped[date][time] = [];
    }
    
    grouped[date][time].push(booking);
  });
  
  return grouped;
};

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

const fetchBookings = async (
  token: string,
  filters: {
    status?: string;
    service_id?: string;
    start_date: string;
    end_date: string;
    search?: string;
  }
): Promise<Booking[]> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters.service_id) {
      params.append('service_id', filters.service_id);
    }
    params.append('appointment_date_from', filters.start_date);
    params.append('appointment_date_to', filters.end_date);
    if (filters.search) {
      params.append('query', filters.search);
    }
    
    const response = await axios.get(
      `${getApiBaseUrl()}/api/admin/bookings?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const data = response.data.bookings || response.data.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    return [];
  }
};

const fetchServices = async (token: string): Promise<Service[]> => {
  const response = await axios.get(
    `${getApiBaseUrl()}/api/services?is_active=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  return response.data.services || [];
};

const fetchCapacityOverrides = async (
  token: string,
  startDate: string,
  endDate: string
): Promise<CapacityOverride[]> => {
  try {
    const response = await axios.get(
      `${getApiBaseUrl()}/api/admin/capacity-overrides?override_date_from=${startDate}&override_date_to=${endDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const data = response.data.overrides || response.data.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch capacity overrides:', error);
    return [];
  }
};

const fetchBlockedSlots = async (
  token: string,
  startDate: string,
  endDate: string
): Promise<BlockedSlot[]> => {
  try {
    const response = await axios.get(
      `${getApiBaseUrl()}/api/admin/blocked-slots?block_date_from=${startDate}&block_date_to=${endDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const data = response.data.blocked_slots || response.data.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch blocked slots:', error);
    return [];
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminBookingsCalendar: React.FC = () => {
  // ============================================================================
  // STATE & URL PARAMS
  // ============================================================================
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Auth state
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  
  // View state from URL or defaults
  const [viewType, setViewType] = useState<ViewType>(
    (searchParams.get('view_type') as ViewType) || 'month'
  );
  
  const [focusedDate, setFocusedDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? parseDate(dateParam) : new Date();
  });
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status_filter') as StatusFilter) || 'all'
  );
  
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // ============================================================================
  // DEBOUNCED SEARCH
  // ============================================================================
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // ============================================================================
  // DATE RANGE CALCULATION
  // ============================================================================
  
  const dateRange = useMemo(() => {
    let start: Date;
    let end: Date;
    
    if (viewType === 'month') {
      const year = focusedDate.getFullYear();
      const month = focusedDate.getMonth();
      const dates = getMonthDates(year, month);
      start = dates[0];
      end = dates[dates.length - 1];
    } else if (viewType === 'week') {
      const dates = getWeekDates(focusedDate);
      start = dates[0];
      end = dates[6];
    } else {
      // day view
      start = new Date(focusedDate);
      end = new Date(focusedDate);
    }
    
    return {
      start: formatDate(start),
      end: formatDate(end)
    };
  }, [focusedDate, viewType]);
  
  // ============================================================================
  // DATA QUERIES
  // ============================================================================
  
  const { data: bookings = [], isLoading: loadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ['admin-bookings', dateRange.start, dateRange.end, statusFilter, serviceFilter, debouncedSearch],
    queryFn: () => fetchBookings(authToken!, {
      status: statusFilter,
      service_id: serviceFilter || undefined,
      start_date: dateRange.start,
      end_date: dateRange.end,
      search: debouncedSearch || undefined
    }),
    enabled: !!authToken,
    staleTime: 30000,
  });
  
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => fetchServices(authToken!),
    enabled: !!authToken,
    staleTime: 300000, // 5 minutes
  });
  
  const { data: capacityOverrides = [] } = useQuery({
    queryKey: ['capacity-overrides', dateRange.start, dateRange.end],
    queryFn: () => fetchCapacityOverrides(authToken!, dateRange.start, dateRange.end),
    enabled: !!authToken,
    staleTime: 60000,
  });
  
  const { data: blockedSlots = [] } = useQuery({
    queryKey: ['blocked-slots', dateRange.start, dateRange.end],
    queryFn: () => fetchBlockedSlots(authToken!, dateRange.start, dateRange.end),
    enabled: !!authToken,
    staleTime: 60000,
  });
  
  // ============================================================================
  // GROUPED DATA
  // ============================================================================
  
  const groupedBookings = useMemo(() => {
    return groupBookingsByDateAndTime(bookings);
  }, [bookings]);
  
  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================
  
  const handlePrevious = useCallback(() => {
    const newDate = new Date(focusedDate);
    
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    
    setFocusedDate(newDate);
  }, [focusedDate, viewType]);
  
  const handleNext = useCallback(() => {
    const newDate = new Date(focusedDate);
    
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    
    setFocusedDate(newDate);
  }, [focusedDate, viewType]);
  
  const handleToday = useCallback(() => {
    setFocusedDate(new Date());
  }, []);
  
  const handleViewChange = useCallback((newView: ViewType) => {
    setViewType(newView);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('view_type', newView);
      return params;
    });
  }, [setSearchParams]);
  
  // ============================================================================
  // CAPACITY CALCULATION
  // ============================================================================
  
  const getSlotCapacity = useCallback((date: string, time: string): { capacity: number; booked: number; isBlocked: boolean } => {
    // Check if slot is blocked
    const blocked = blockedSlots.find(
      b => b.block_date === date && (b.time_slot === null || b.time_slot === time)
    );
    
    if (blocked) {
      return { capacity: 0, booked: 0, isBlocked: true };
    }
    
    // Check for capacity override
    const override = capacityOverrides.find(
      o => o.override_date === date && o.time_slot === time && o.is_active
    );
    
    const capacity = override 
      ? override.capacity 
      : getDefaultCapacity(getDayOfWeek(date));
    
    const booked = groupedBookings[date]?.[time]?.length || 0;
    
    return { capacity, booked, isBlocked: false };
  }, [blockedSlots, capacityOverrides, groupedBookings]);
  
  // ============================================================================
  // EXPORT HANDLERS
  // ============================================================================
  
  const handleExport = useCallback(() => {
    // Create CSV content
    const headers = ['Ticket Number', 'Date', 'Time', 'Customer Name', 'Phone', 'Status', 'Service'];
    const rows = bookings.map(b => [
      b.ticket_number,
      b.appointment_date,
      b.appointment_time,
      b.customer_name,
      b.customer_phone,
      b.status,
      b.service_id || 'N/A'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookings_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [bookings, dateRange]);
  
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const renderDateHeader = () => {
    let dateStr = '';
    
    if (viewType === 'month') {
      dateStr = focusedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewType === 'week') {
      const dates = getWeekDates(focusedDate);
      const start = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dateStr = `${start} - ${end}`;
    } else {
      dateStr = focusedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    
    return (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrevious}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 text-gray-100" />
          </button>
          
          <h2 className="text-2xl font-bold text-white">{dateStr}</h2>
          
          <button
            onClick={handleNext}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/20"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 text-gray-100" />
          </button>
          
          <button
            onClick={handleToday}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-colors text-sm font-semibold shadow-lg"
          >
            Today
          </button>
        </div>
      </div>
    );
  };
  
  const renderMonthView = () => {
    const year = focusedDate.getFullYear();
    const month = focusedDate.getMonth();
    const dates = getMonthDates(year, month);
    
    return (
      <div className="glass-card-light rounded-xl shadow-master-elevated overflow-hidden border-white/25">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/20">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="px-4 py-3 text-center text-sm font-bold text-white bg-[#6B2020] border-r border-white/15 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {dates.map((date, index) => {
            const dateStr = formatDate(date);
            const isCurrentMonth = date.getMonth() === month;
            const isToday = formatDate(new Date()) === dateStr;
            const dayBookings = groupedBookings[dateStr];
            const totalBookings = dayBookings ? Object.values(dayBookings).flat().length : 0;
            
            // Calculate total capacity for the day
            const allSlotsForDate = new Set(TIME_SLOTS);
            if (dayBookings) {
              Object.keys(dayBookings).forEach(time => allSlotsForDate.add(time));
            }
            
            let totalCapacity = 0;
            let totalBooked = 0;
            Array.from(allSlotsForDate).forEach(time => {
              const { capacity, booked } = getSlotCapacity(dateStr, time);
              totalCapacity += capacity;
              totalBooked += booked;
            });
            
            return (
              <div
                key={index}
                className={`min-h-[120px] border-b border-r border-white/15 p-2 hover:bg-white/10 transition-colors cursor-pointer ${
                  !isCurrentMonth ? 'bg-[#5C1B1B]/30 text-gray-300' : 'bg-white/5'
                } ${isToday ? 'bg-amber-600/20 border-2 border-amber-500/50' : ''}`}
                onClick={() => {
                  setFocusedDate(date);
                  setViewType('day');
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${isToday ? 'text-amber-300' : 'text-white'}`}>
                    {date.getDate()}
                  </span>
                  {totalBookings > 0 && (
                    <span className="text-xs bg-blue-600/30 text-blue-200 px-2 py-1 rounded-full font-semibold border border-blue-500/30">
                      {totalBookings}
                    </span>
                  )}
                </div>
                
                {/* Capacity indicator */}
                {isCurrentMonth && (
                  <div className="text-xs text-gray-300 mb-2">
                    <span className={totalBooked >= totalCapacity ? 'text-red-600 font-semibold' : ''}>
                      {totalBooked}/{totalCapacity} booked
                    </span>
                  </div>
                )}
                
                {/* Status dots */}
                {dayBookings && isCurrentMonth && (
                  <div className="flex flex-wrap gap-1">
                    {Object.values(dayBookings).flat().slice(0, 3).map((booking, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          booking.status === 'confirmed' || booking.status === 'pending' ? 'bg-[#2D0808]0' :
                          booking.status === 'completed' ? 'bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]0' :
                          'bg-red-500'
                        }`}
                      />
                    ))}
                    {totalBookings > 3 && (
                      <span className="text-xs text-gray-400">+{totalBookings - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const renderWeekView = () => {
    const dates = getWeekDates(focusedDate);
    
    // Calculate all time slots for the week
    const slots = new Set(TIME_SLOTS);
    dates.forEach(date => {
      const dateStr = formatDate(date);
      if (groupedBookings[dateStr]) {
        Object.keys(groupedBookings[dateStr]).forEach(time => {
          slots.add(time);
        });
      }
    });
    const allTimeSlotsForWeek = Array.from(slots).sort();
    
    return (
      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b border-white/10">
          <div className="px-4 py-3 text-center text-sm font-semibold text-gray-300 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
            Time
          </div>
          {dates.map((date, index) => {
            const isToday = formatDate(new Date()) === formatDate(date);
            return (
              <div
                key={index}
                className={`px-2 py-3 text-center text-sm font-semibold border-l border-white/10 ${
                  isToday ? 'bg-[#2D0808] text-blue-700' : 'bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] text-gray-300'
                }`}
              >
                <div>{DAYS_OF_WEEK[date.getDay()]}</div>
                <div className="text-lg font-bold">{date.getDate()}</div>
              </div>
            );
          })}
        </div>
        
        {/* Time slot grid */}
        <div className="grid grid-cols-8">
          {allTimeSlotsForWeek.map((time) => (
            <React.Fragment key={time}>
              {/* Time label */}
              <div className="px-4 py-4 text-sm font-medium text-gray-300 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] border-b border-white/10">
                {time}
              </div>
              
              {/* Day columns */}
              {dates.map((date, dateIndex) => {
                const dateStr = formatDate(date);
                const slotBookings = groupedBookings[dateStr]?.[time] || [];
                const { capacity, booked, isBlocked } = getSlotCapacity(dateStr, time);
                
                return (
                  <div
                    key={dateIndex}
                    className="p-2 min-h-[100px] border-b border-l border-white/10 hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] transition-colors"
                  >
                    {isBlocked ? (
                      <div className="text-xs text-gray-400 italic bg-gray-100 p-2 rounded">
                        Blocked
                      </div>
                    ) : slotBookings.length > 0 ? (
                      <div className="space-y-2">
                        {slotBookings.map(booking => (
                          <Link
                            key={booking.booking_id}
                            to={`/admin/bookings/${booking.ticket_number}`}
                            className={`block p-2 rounded-lg border-l-4 text-xs ${STATUS_COLORS[booking.status]} hover:shadow-md transition-shadow`}
                          >
                            <div className="font-semibold truncate">{booking.customer_name}</div>
                            <div className="text-xs truncate">{booking.ticket_number}</div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">
                        {booked}/{capacity} booked
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };
  
  const renderDayView = () => {
    const dateStr = formatDate(focusedDate);
    
    // Calculate all time slots for the day
    const slots = new Set(TIME_SLOTS);
    if (groupedBookings[dateStr]) {
      Object.keys(groupedBookings[dateStr]).forEach(time => {
        slots.add(time);
      });
    }
    const allTimeSlots = Array.from(slots).sort();
    
    return (
      <div className="space-y-4">
        {allTimeSlots.map(time => {
          const slotBookings = groupedBookings[dateStr]?.[time] || [];
          const { capacity, booked, isBlocked } = getSlotCapacity(dateStr, time);
          
          return (
            <div key={time} className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Clock className="w-5 h-5 text-gray-300" />
                  <span className="text-xl font-bold text-white">{time}</span>
                </div>
                <div className="flex items-center space-x-4">
                  {isBlocked ? (
                    <span className="text-sm text-red-600 font-semibold">Blocked</span>
                  ) : (
                    <span className={`text-sm font-semibold ${
                      booked >= capacity ? 'text-red-600' : 'text-gray-300'
                    }`}>
                      {booked}/{capacity} booked
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {isBlocked ? (
                  <p className="text-gray-400 italic">This time slot is blocked</p>
                ) : slotBookings.length > 0 ? (
                  <div className="space-y-4">
                    {slotBookings.map(booking => (
                      <div
                        key={booking.booking_id}
                        className={`border-l-4 rounded-lg p-4 ${STATUS_COLORS[booking.status]}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <User className="w-5 h-5" />
                              <span className="font-bold text-lg">{booking.customer_name}</span>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4" />
                                <a href={`tel:${booking.customer_phone}`} className="hover:underline">
                                  {booking.customer_phone}
                                </a>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4" />
                                <span>{booking.ticket_number}</span>
                              </div>
                              
                              {booking.special_request && (
                                <div className="mt-2 text-xs text-gray-300 bg-[#2D0808] bg-opacity-50 p-2 rounded">
                                  <strong>Note:</strong> {booking.special_request.substring(0, 100)}
                                  {booking.special_request.length > 100 && '...'}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-2">
                            <Link
                              to={`/admin/bookings/${booking.ticket_number}`}
                              className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-colors text-sm font-medium text-center"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                      <Calendar className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-green-600 font-semibold">Available</p>
                    <p className="text-sm text-gray-400 mt-1">{capacity - booked} spots remaining</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#600000] via-[#730000] to-[#8b0000] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Bookings Calendar</h1>
            <p className="text-gray-200">Manage and view all appointments</p>
          </div>
          
          {/* View Toggles */}
          <div className="glass-card-light rounded-xl shadow-master-elevated p-6 mb-6 border-white/25">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              {/* View Type Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewChange('month')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    viewType === 'month'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                      : 'bg-white/10 text-gray-100 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                  <span>Month</span>
                </button>
                
                <button
                  onClick={() => handleViewChange('week')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    viewType === 'week'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                      : 'bg-white/10 text-gray-100 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Week</span>
                </button>
                
                <button
                  onClick={() => handleViewChange('day')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    viewType === 'day'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                      : 'bg-white/10 text-gray-100 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Day</span>
                </button>
                
                <Link
                  to="/admin/bookings"
                  className="px-4 py-2 rounded-lg font-medium bg-white/10 text-gray-100 hover:bg-white/20 border border-white/20 transition-colors flex items-center space-x-2"
                >
                  <List className="w-4 h-4" />
                  <span>List</span>
                </Link>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <Link
                  to="/admin/bookings/new"
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-colors flex items-center space-x-2 font-medium shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Booking</span>
                </Link>
                
                <button
                  onClick={() => refetchBookings()}
                  className="p-2 bg-white/10 text-gray-100 rounded-lg hover:bg-white/20 border border-white/20 transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                
                <button
                  onClick={handlePrint}
                  className="p-2 bg-white/10 text-gray-100 rounded-lg hover:bg-white/20 border border-white/20 transition-colors"
                  aria-label="Print"
                >
                  <Printer className="w-5 h-5" />
                </button>
                
                <button
                  onClick={handleExport}
                  className="p-2 bg-white/10 text-gray-100 rounded-lg hover:bg-white/20 border border-white/20 transition-colors"
                  aria-label="Export"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="glass-card-light rounded-xl shadow-master-elevated p-6 mb-6 border-white/25">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, or ticket..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-gray-300"
                />
              </div>
              
              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none text-white"
                >
                  <option value="all" className="bg-[#4A1515] text-white">All Statuses</option>
                  <option value="upcoming" className="bg-[#4A1515] text-white">Upcoming</option>
                  <option value="completed" className="bg-[#4A1515] text-white">Completed</option>
                  <option value="cancelled" className="bg-[#4A1515] text-white">Cancelled</option>
                </select>
              </div>
              
              {/* Service Filter */}
              <div>
                <select
                  value={serviceFilter || ''}
                  onChange={(e) => setServiceFilter(e.target.value || null)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none text-white"
                >
                  <option value="" className="bg-[#4A1515] text-white">All Services</option>
                  {services.map(service => (
                    <option key={service.service_id} value={service.service_id} className="bg-[#4A1515] text-white">
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Date Navigation */}
          {renderDateHeader()}
          
          {/* Calendar Views */}
          {loadingBookings ? (
            <div className="glass-card-light rounded-xl shadow-master-elevated p-12 text-center border-white/25">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-500 mx-auto mb-4"></div>
              <p className="text-gray-200 font-medium">Loading bookings...</p>
            </div>
          ) : (
            <>
              {viewType === 'month' && renderMonthView()}
              {viewType === 'week' && renderWeekView()}
              {viewType === 'day' && renderDayView()}
            </>
          )}
          
          {/* Legend */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-[#2D0808]0"></div>
                <span className="text-sm text-gray-300">Upcoming</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]0"></div>
                <span className="text-sm text-gray-300">Completed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-sm text-gray-300">Cancelled</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm text-gray-300">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AdminBookingsCalendar;