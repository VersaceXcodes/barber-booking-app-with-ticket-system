import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

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

interface Service {
  service_id: string;
  name: string;
  description: string;
  image_url: string | null;
  duration: number;
  price: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface BookingsResponse {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

interface FilterState {
  status: string;
  service_id: string;
  start_date: string;
  end_date: string;
  search: string;
  page: number;
  limit: number;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const formatDateTime = (date: string, time: string): string => {
  try {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return `${date} ${time}`;
  }
};

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-orange-100 text-orange-800';
  }
};

const getCurrentWeekDates = (): { start: string; end: string } => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  const end = new Date(now);
  end.setDate(now.getDate() + (6 - dayOfWeek));
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

const exportToCSV = (bookings: Booking[], services: Service[]): void => {
  const headers = [
    'Ticket Number',
    'Date',
    'Time',
    'Customer Name',
    'Email',
    'Phone',
    'Service',
    'Status',
    'Special Request',
    'Admin Notes',
    'Created At'
  ];

  const serviceMap = new Map(services.map(s => [s.service_id, s.name]));

  const rows = bookings.map(booking => [
    booking.ticket_number,
    booking.appointment_date,
    booking.appointment_time,
    booking.customer_name,
    booking.customer_email,
    booking.customer_phone,
    booking.service_id ? serviceMap.get(booking.service_id) || 'N/A' : 'N/A',
    booking.status,
    booking.special_request || '',
    booking.admin_notes || '',
    booking.created_at
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  link.setAttribute('href', url);
  link.setAttribute('download', `bookings_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminBookingsList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // CRITICAL: Individual selectors from Zustand store
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Initialize filters from URL params or defaults
  const weekDates = getCurrentWeekDates();
  const initialFilters: FilterState = {
    status: searchParams.get('status') || 'all',
    service_id: searchParams.get('service_id') || 'all',
    start_date: searchParams.get('start_date') || weekDates.start,
    end_date: searchParams.get('end_date') || weekDates.end,
    search: searchParams.get('search') || '',
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
    sort_by: searchParams.get('sort') || 'appointment_date',
    sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.service_id !== 'all') params.set('service_id', filters.service_id);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);
    if (filters.search) params.set('search', filters.search);
    if (filters.page > 1) params.set('page', filters.page.toString());
    if (filters.limit !== 20) params.set('limit', filters.limit.toString());
    if (filters.sort_by !== 'appointment_date') params.set('sort', filters.sort_by);
    if (filters.sort_order !== 'desc') params.set('sort_order', filters.sort_order);
    
    setSearchParams(params);
  }, [filters, setSearchParams]);

  // Fetch bookings query
  const { data: bookingsData, isLoading: isLoadingBookings, error: bookingsError, refetch: refetchBookings } = useQuery({
    queryKey: ['admin-bookings', filters],
    queryFn: async (): Promise<BookingsResponse> => {
      const params = new URLSearchParams();
      
      // Apply filters
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.service_id !== 'all') params.set('service_id', filters.service_id);
      if (filters.start_date) params.set('appointment_date_from', filters.start_date);
      if (filters.end_date) params.set('appointment_date_to', filters.end_date);
      if (filters.search) params.set('query', filters.search);
      params.set('limit', filters.limit.toString());
      params.set('offset', ((filters.page - 1) * filters.limit).toString());
      params.set('sort_by', filters.sort_by);
      params.set('sort_order', filters.sort_order);

      const response = await axios.get(
        `${getApiBaseUrl()}/api/bookings/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const bookings = response.data.bookings || [];
      const total = response.data.total || bookings.length;

      return {
        bookings,
        total,
        page: filters.page,
        limit: filters.limit,
        has_more: total > filters.page * filters.limit
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!authToken
  });

  // Fetch services query
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async (): Promise<Service[]> => {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/services?is_active=true&sort_by=display_order&sort_order=asc`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await axios.post(
        `${getApiBaseUrl()}/api/bookings/${bookingId}/cancel`,
        {
          cancellation_reason: 'Cancelled by admin',
          cancelled_by: 'admin'
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      await axios.patch(
        `${getApiBaseUrl()}/api/bookings/${bookingId}`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    }
  });

  // Handlers
  const handleSort = useCallback((column: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setFilters(prev => ({ ...prev, limit: newLimit, page: 1 }));
  }, []);

  const handleSelectRow = useCallback((bookingId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      setShowBulkActions(newSet.size > 0);
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!bookingsData?.bookings) return;
    
    const allIds = bookingsData.bookings.map(b => b.booking_id);
    if (selectedRows.size === allIds.length) {
      setSelectedRows(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedRows(new Set(allIds));
      setShowBulkActions(true);
    }
  }, [bookingsData, selectedRows.size]);

  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set());
    setShowBulkActions(false);
  }, []);

  const handleExportSelected = useCallback(() => {
    if (!bookingsData?.bookings) return;
    const selectedBookings = bookingsData.bookings.filter(b => selectedRows.has(b.booking_id));
    exportToCSV(selectedBookings, services);
  }, [bookingsData, selectedRows, services]);

  const handleExportAll = useCallback(() => {
    if (!bookingsData?.bookings) return;
    exportToCSV(bookingsData.bookings, services);
  }, [bookingsData, services]);

  const handleBulkCancel = useCallback(async () => {
    if (!confirm(`Cancel ${selectedRows.size} selected booking(s)?`)) return;
    
    const promises = Array.from(selectedRows).map(id => 
      cancelBookingMutation.mutateAsync(id).catch(() => null)
    );
    
    await Promise.all(promises);
    handleDeselectAll();
  }, [selectedRows, cancelBookingMutation, handleDeselectAll]);

  const handleCancelBooking = useCallback(async (bookingId: string, ticketNumber: string) => {
    if (!confirm(`Cancel booking ${ticketNumber}?`)) return;
    await cancelBookingMutation.mutateAsync(bookingId);
  }, [cancelBookingMutation]);

  const handleUpdateStatus = useCallback(async (bookingId: string, newStatus: string) => {
    await updateStatusMutation.mutateAsync({ bookingId, status: newStatus });
    setShowMoreMenu(null);
  }, [updateStatusMutation]);

  // Memoized values
  const totalPages = useMemo(() => {
    if (!bookingsData) return 0;
    return Math.ceil(bookingsData.total / filters.limit);
  }, [bookingsData, filters.limit]);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (filters.page > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, filters.page - 1);
      const end = Math.min(totalPages - 1, filters.page + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (filters.page < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  }, [filters.page, totalPages]);

  // Render helpers
  const renderSortIndicator = (column: string) => {
    if (filters.sort_by !== column) return null;
    return (
      <span className="ml-1">
        {filters.sort_order === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const renderEmptyState = () => (
    <div className="text-center py-16 px-4">
      <div className="mb-4">
        <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings found</h3>
      <p className="text-gray-600 mb-4">Try adjusting your filters or date range</p>
      <Link
        to="/admin/bookings/new"
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Add New Booking
      </Link>
    </div>
  );

  const renderLoadingSkeleton = () => (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-b border-gray-200 p-4">
          <div className="flex items-center space-x-4">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const bookings = bookingsData?.bookings || [];
  const total = bookingsData?.total || 0;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Title and View Toggle */}
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-900">All Bookings</h1>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => navigate('/admin/bookings/calendar')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-white hover:shadow-sm transition-all"
                  >
                    Calendar View
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm"
                  >
                    List View
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/admin/bookings/new')}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Add Booking
                </button>
                <button
                  onClick={handleExportAll}
                  className="px-4 py-3 bg-gray-100 text-gray-900 font-medium rounded-lg border border-gray-300 hover:bg-gray-200 transition-all duration-200"
                >
                  Export to CSV
                </button>
                <button
                  onClick={() => refetchBookings()}
                  className="p-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All</option>
                  <option value="confirmed">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Service Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <select
                  value={filters.service_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, service_id: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All</option>
                  {services.map(service => (
                    <option key={service.service_id} value={service.service_id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Name, phone, or ticket"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {showBulkActions && (
          <div className="bg-blue-50 border-b border-blue-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {selectedRows.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportSelected}
                    className="px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-md border border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    Export Selected
                  </button>
                  <button
                    onClick={handleBulkCancel}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-white rounded-md border border-red-300 hover:bg-red-50 transition-colors"
                  >
                    Cancel Selected
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="text-sm text-blue-700 hover:text-blue-900 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Error State */}
          {bookingsError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">Failed to load bookings. Please try again.</p>
              <button
                onClick={() => refetchBookings()}
                className="mt-2 text-sm text-red-800 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {isLoadingBookings ? (
              renderLoadingSkeleton()
            ) : bookings.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={bookings.length > 0 && selectedRows.size === bookings.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('ticket_number')}
                        >
                          Ticket Number {renderSortIndicator('ticket_number')}
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('appointment_date')}
                        >
                          Date & Time {renderSortIndicator('appointment_date')}
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('customer_name')}
                        >
                          Customer {renderSortIndicator('customer_name')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bookings.map((booking) => {
                        const service = services.find(s => s.service_id === booking.service_id);
                        return (
                          <tr
                            key={booking.booking_id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedRows.has(booking.booking_id)}
                                onChange={() => handleSelectRow(booking.booking_id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Link
                                to={`/admin/bookings/${booking.ticket_number}`}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {booking.ticket_number}
                              </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(booking.appointment_date, booking.appointment_time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
                              <div className="text-sm text-gray-500">{booking.customer_email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <a href={`tel:${booking.customer_phone}`} className="text-blue-600 hover:text-blue-800">
                                {booking.customer_phone}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {service?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(booking.status)}`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  to={`/admin/bookings/${booking.ticket_number}`}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="View"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </Link>
                                {booking.status === 'confirmed' && (
                                  <button
                                    onClick={() => handleCancelBooking(booking.booking_id, booking.ticket_number)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Cancel"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                                <div className="relative">
                                  <button
                                    onClick={() => setShowMoreMenu(showMoreMenu === booking.booking_id ? null : booking.booking_id)}
                                    className="text-gray-600 hover:text-gray-900"
                                    title="More"
                                  >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                  </button>
                                  {showMoreMenu === booking.booking_id && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                                      <button
                                        onClick={() => handleUpdateStatus(booking.booking_id, 'completed')}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      >
                                        Mark Completed
                                      </button>
                                      <button
                                        onClick={() => handleUpdateStatus(booking.booking_id, 'cancelled')}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      >
                                        Mark No-show
                                      </button>
                                      <Link
                                        to={`/admin/bookings/${booking.ticket_number}`}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      >
                                        Add Note
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                      Showing <span className="font-medium">{((filters.page - 1) * filters.limit) + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(filters.page * filters.limit, total)}</span> of{' '}
                      <span className="font-medium">{total}</span> bookings
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Rows per page */}
                      <select
                        value={filters.limit}
                        onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>

                      {/* Page numbers */}
                      <nav className="flex items-center gap-1">
                        <button
                          onClick={() => handlePageChange(filters.page - 1)}
                          disabled={filters.page === 1}
                          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>

                        {pageNumbers.map((page, index) => (
                          typeof page === 'number' ? (
                            <button
                              key={index}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-1 text-sm font-medium rounded-md ${
                                filters.page === page
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          ) : (
                            <span key={index} className="px-2 text-gray-500">
                              {page}
                            </span>
                          )
                        ))}

                        <button
                          onClick={() => handlePageChange(filters.page + 1)}
                          disabled={!bookingsData?.has_more}
                          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AdminBookingsList;