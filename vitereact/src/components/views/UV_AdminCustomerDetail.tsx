import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  is_registered: boolean;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_shows: number;
  last_booking_date: string | null;
  created_at: string;
}

interface CustomerBooking {
  booking_id: string;
  ticket_number: string;
  status: string;
  appointment_date: string;
  appointment_time: string;
  service_id: string | null;
  service_name: string | null;
  customer_name: string;
  special_request: string | null;
  created_at: string;
  cancelled_at: string | null;
}

interface CustomerNote {
  note_id: string;
  customer_id: string;
  note_text: string;
  created_by: string;
  created_at: string;
}

interface BookingFilters {
  status: string | null;
  start_date: string | null;
  end_date: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const calculateFavoriteService = (bookings: CustomerBooking[]): string | null => {
  const serviceNames = bookings
    .map(b => b.service_name)
    .filter((name): name is string => name !== null && name !== '');

  if (serviceNames.length === 0) return null;

  const frequency: Record<string, number> = {};
  serviceNames.forEach(name => {
    frequency[name] = (frequency[name] || 0) + 1;
  });

  let maxCount = 0;
  let favorite: string | null = null;
  for (const [name, count] of Object.entries(frequency)) {
    if (count > maxCount) {
      maxCount = count;
      favorite = name;
    }
  }

  return favorite;
};

const calculateAverageFrequency = (bookings: CustomerBooking[]): number | null => {
  const completedBookings = bookings
    .filter(b => b.status === 'completed' && b.appointment_date)
    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

  if (completedBookings.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < completedBookings.length; i++) {
    const prevDate = new Date(completedBookings[i - 1].appointment_date);
    const currDate = new Date(completedBookings[i].appointment_date);
    const diff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) intervals.push(diff);
  }

  if (intervals.length === 0) return null;

  const avgDays = Math.round(intervals.reduce((sum, val) => sum + val, 0) / intervals.length);
  return avgDays;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'confirmed':
    case 'upcoming':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminCustomerDetail: React.FC = () => {
  const { customer_id } = useParams<{ customer_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // CRITICAL: Individual Zustand selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const userType = useAppStore(state => state.authentication_state.authentication_status.user_type);

  // Local state
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'notes'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [bookingFilters, setBookingFilters] = useState<BookingFilters>({
    status: null,
    start_date: null,
    end_date: null,
  });
  const [showDeleteNoteModal, setShowDeleteNoteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // API base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Redirect if not admin
  useEffect(() => {
    if (userType !== 'admin') {
      navigate('/admin/login');
    }
  }, [userType, navigate]);

  // Sync URL param with active tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bookings' || tabParam === 'notes') {
      setActiveTab(tabParam);
    } else if (tabParam === 'overview' || !tabParam) {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'overview' | 'bookings' | 'notes') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ============================================================================
  // API CALLS - Customer Profile
  // ============================================================================

  const {
    data: customerProfile,
    isLoading: loadingProfile,
    error: profileError,
  } = useQuery<Customer>({
    queryKey: ['admin', 'customer', customer_id],
    queryFn: async () => {
      const response = await axios.get(
        `${apiBaseUrl}/api/admin/customers/${customer_id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      return response.data;
    },
    enabled: !!customer_id && !!authToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // ============================================================================
  // API CALLS - Customer Bookings
  // ============================================================================

  const {
    data: customerBookings,
    isLoading: loadingBookings,
    error: bookingsError,
  } = useQuery<CustomerBooking[]>({
    queryKey: ['admin', 'customer', customer_id, 'bookings', bookingFilters],
    queryFn: async () => {
      const params: Record<string, string> = {
        customer_id: customer_id!,
        sort_by: 'appointment_date',
        sort_order: 'desc',
        limit: '100',
      };

      if (bookingFilters.status) params.status = bookingFilters.status;
      if (bookingFilters.start_date) params.appointment_date_from = bookingFilters.start_date;
      if (bookingFilters.end_date) params.appointment_date_to = bookingFilters.end_date;

      const response = await axios.get(
        `${apiBaseUrl}/api/admin/bookings`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params,
        }
      );

      return response.data.bookings.map((booking: any) => ({
        booking_id: booking.booking_id,
        ticket_number: booking.ticket_number,
        status: booking.status,
        appointment_date: booking.appointment_date,
        appointment_time: booking.appointment_time,
        service_id: booking.service_id,
        service_name: booking.service_name || 'N/A',
        customer_name: booking.customer_name,
        special_request: booking.special_request,
        created_at: booking.created_at,
        cancelled_at: booking.cancelled_at,
      }));
    },
    enabled: !!customer_id && !!authToken && activeTab === 'bookings',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // ============================================================================
  // API CALLS - Customer Notes
  // ============================================================================

  const {
    data: customerNotes,
    isLoading: loadingNotes,
    error: notesError,
  } = useQuery<CustomerNote[]>({
    queryKey: ['admin', 'customer', customer_id, 'notes'],
    queryFn: async () => {
      const response = await axios.get(
        `${apiBaseUrl}/api/admin/customers/${customer_id}/notes`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!customer_id && !!authToken && activeTab === 'notes',
    staleTime: 2 * 60 * 1000,
  });

  // ============================================================================
  // MUTATIONS - Add Note
  // ============================================================================

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const response = await axios.post(
        `${apiBaseUrl}/api/admin/customers/${customer_id}/notes`,
        { note_text: noteText },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.note || response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer', customer_id, 'notes'] });
      setNewNoteText('');
    },
  });

  const handleAddNote = () => {
    if (newNoteText.trim().length === 0) return;
    if (newNoteText.length > 2000) {
      alert('Note text cannot exceed 2000 characters');
      return;
    }
    addNoteMutation.mutate(newNoteText.trim());
  };

  // ============================================================================
  // MUTATIONS - Edit Note
  // ============================================================================

  const editNoteMutation = useMutation({
    mutationFn: async ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      const response = await axios.patch(
        `${apiBaseUrl}/api/admin/customers/${customer_id}/notes/${noteId}`,
        { note_text: noteText },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.note || response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer', customer_id, 'notes'] });
      setEditingNoteId(null);
      setEditNoteText('');
    },
  });

  const handleEditNote = (noteId: string) => {
    if (editNoteText.trim().length === 0) return;
    if (editNoteText.length > 2000) {
      alert('Note text cannot exceed 2000 characters');
      return;
    }
    editNoteMutation.mutate({ noteId, noteText: editNoteText.trim() });
  };

  const startEditingNote = (note: CustomerNote) => {
    setEditingNoteId(note.note_id);
    setEditNoteText(note.note_text);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditNoteText('');
  };

  // ============================================================================
  // MUTATIONS - Delete Note
  // ============================================================================

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await axios.delete(
        `${apiBaseUrl}/api/admin/customers/${customer_id}/notes/${noteId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer', customer_id, 'notes'] });
      setShowDeleteNoteModal(false);
      setNoteToDelete(null);
    },
  });

  const handleDeleteNote = () => {
    if (noteToDelete) {
      deleteNoteMutation.mutate(noteToDelete);
    }
  };

  const confirmDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
    setShowDeleteNoteModal(true);
  };

  const cancelDeleteNote = () => {
    setShowDeleteNoteModal(false);
    setNoteToDelete(null);
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const statistics = useMemo(() => {
    if (!customerBookings) return null;

    const favoriteService = calculateFavoriteService(customerBookings);
    const averageFrequency = calculateAverageFrequency(customerBookings);

    return {
      favoriteService: favoriteService || 'N/A',
      averageFrequency: averageFrequency !== null ? `Every ${averageFrequency} days` : 'N/A',
    };
  }, [customerBookings]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateBooking = () => {
    if (!customerProfile) return;
    const params = new URLSearchParams({
      customer_id: customerProfile.customer_id,
      customer_name: customerProfile.name,
      customer_email: customerProfile.email,
      customer_phone: customerProfile.phone,
    });
    navigate(`/admin/bookings/new?${params.toString()}`);
  };

  const handleFilterChange = (key: keyof BookingFilters, value: string | null) => {
    setBookingFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-gray-600">
              <li>
                <Link to="/admin/customers" className="hover:text-blue-600 transition-colors">
                  Customers
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li className="text-gray-900 font-medium">
                {loadingProfile ? 'Loading...' : customerProfile?.name || 'Customer Detail'}
              </li>
            </ol>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {loadingProfile ? 'Loading...' : customerProfile?.name || 'Customer Detail'}
            </h1>
          </div>

          {/* Error States */}
          {profileError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm font-medium">Failed to load customer profile</p>
              <p className="text-sm mt-1">{(profileError as any)?.message || 'Please try again'}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => handleTabChange('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Overview
              </button>
              <button
                onClick={() => handleTabChange('bookings')}
                className={`${
                  activeTab === 'bookings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Booking History
              </button>
              <button
                onClick={() => handleTabChange('notes')}
                className={`${
                  activeTab === 'notes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Notes
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {loadingProfile ? (
                <div className="animate-pulse space-y-6">
                  <div className="bg-white rounded-xl shadow-lg h-64"></div>
                  <div className="bg-white rounded-xl shadow-lg h-64"></div>
                </div>
              ) : customerProfile ? (
                <>
                  {/* Customer Information Card */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900">Customer Information</h2>
                    </div>
                    <div className="px-6 py-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Name</p>
                          <p className="text-base font-medium text-gray-900">{customerProfile.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Email</p>
                          <a
                            href={`mailto:${customerProfile.email}`}
                            className="text-base font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {customerProfile.email}
                          </a>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Phone</p>
                          <a
                            href={`tel:${customerProfile.phone}`}
                            className="text-base font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {customerProfile.phone}
                          </a>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Type</p>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              customerProfile.is_registered
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {customerProfile.is_registered ? 'Registered' : 'Guest'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">
                            {customerProfile.is_registered ? 'Member Since' : 'First Booking'}
                          </p>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(customerProfile.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Statistics Card */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900">Statistics</h2>
                    </div>
                    <div className="px-6 py-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-gray-900">{customerProfile.total_bookings}</p>
                          <p className="text-sm text-gray-600 mt-1">Total Bookings</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-green-600">{customerProfile.completed_bookings}</p>
                          <p className="text-sm text-gray-600 mt-1">Completed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-red-600">{customerProfile.cancelled_bookings}</p>
                          <p className="text-sm text-gray-600 mt-1">Cancelled</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-orange-600">{customerProfile.no_shows}</p>
                          <p className="text-sm text-gray-600 mt-1">No-shows</p>
                        </div>
                      </div>
                      <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Favorite Service</p>
                          <p className="text-base font-medium text-gray-900">
                            {statistics?.favoriteService || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Average Frequency</p>
                          <p className="text-base font-medium text-gray-900">
                            {statistics?.averageFrequency || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Last Visit</p>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(customerProfile.last_booking_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
                    </div>
                    <div className="px-6 py-5">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button
                          onClick={handleCreateBooking}
                          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create Booking for Customer
                        </button>
                        <a
                          href={`mailto:${customerProfile.email}`}
                          className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send Email
                        </a>
                        <a
                          href={`tel:${customerProfile.phone}`}
                          className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call
                        </a>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Booking History</h2>
              </div>

              {/* Filters */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      id="status-filter"
                      value={bookingFilters.status || ''}
                      onChange={(e) => handleFilterChange('status', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start-date"
                      value={bookingFilters.start_date || ''}
                      onChange={(e) => handleFilterChange('start_date', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end-date"
                      value={bookingFilters.end_date || ''}
                      onChange={(e) => handleFilterChange('end_date', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="overflow-x-auto">
                {loadingBookings ? (
                  <div className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading bookings...</p>
                  </div>
                ) : bookingsError ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-red-600 font-medium">Failed to load bookings</p>
                    <p className="text-sm text-gray-600 mt-1">{(bookingsError as any)?.message || 'Please try again'}</p>
                  </div>
                ) : customerBookings && customerBookings.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ticket
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customerBookings.map((booking) => (
                        <tr key={booking.booking_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              to={`/admin/bookings/${booking.ticket_number}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                              {booking.ticket_number}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(booking.appointment_date)} at {booking.appointment_time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {booking.service_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(booking.status)}`}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <Link
                              to={`/admin/bookings/${booking.ticket_number}`}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 font-medium">No bookings found</p>
                    <p className="text-sm text-gray-500 mt-1">This customer hasn't made any bookings yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Add Note Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Private Notes About This Customer</h2>
                  <p className="text-sm text-gray-600 mt-1">Notes are shared with all admins for institutional knowledge</p>
                </div>
                <div className="px-6 py-5">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add a note about preferences, issues, or other information..."
                    rows={4}
                    maxLength={2000}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-gray-500">
                      {newNoteText.length} / 2000 characters
                    </p>
                    <button
                      onClick={handleAddNote}
                      disabled={newNoteText.trim().length === 0 || addNoteMutation.isPending}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addNoteMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : (
                        'Save Note'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Previous Notes List */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Previous Notes</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {loadingNotes ? (
                    <div className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Loading notes...</p>
                    </div>
                  ) : notesError ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-red-600 font-medium">Failed to load notes</p>
                      <p className="text-sm text-gray-600 mt-1">{(notesError as any)?.message || 'Please try again'}</p>
                    </div>
                  ) : customerNotes && customerNotes.length > 0 ? (
                    customerNotes.map((note) => (
                      <div key={note.note_id} className="px-6 py-5">
                        {editingNoteId === note.note_id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              rows={4}
                              maxLength={2000}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-500">{editNoteText.length} / 2000 characters</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={cancelEditingNote}
                                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleEditNote(note.note_id)}
                                  disabled={editNoteText.trim().length === 0 || editNoteMutation.isPending}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {editNoteMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-900 whitespace-pre-wrap mb-3">{note.note_text}</p>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-600">
                                <span className="font-medium">Created by:</span> {note.created_by}
                                <span className="mx-2">•</span>
                                <span>{formatDate(note.created_at)}</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditingNote(note)}
                                  className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => confirmDeleteNote(note.note_id)}
                                  className="text-red-600 hover:text-red-700 font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-600 font-medium">No notes yet</p>
                      <p className="text-sm text-gray-500 mt-1">Add the first note about this customer</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Note Confirmation Modal */}
      {showDeleteNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Delete Note?</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-700">
                Are you sure you want to delete this note? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={cancelDeleteNote}
                disabled={deleteNoteMutation.isPending}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNote}
                disabled={deleteNoteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminCustomerDetail;