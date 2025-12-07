import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Calendar, 
  DollarSign, 
  XCircle, 
  AlertTriangle,
  Plus,
  Lock,
  Upload,
  Download,
  Eye,
  Phone,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DashboardStats {
  today_bookings: number;
  today_completed: number;
  today_upcoming: number;
  week_bookings: number;
  week_revenue: number | null;
  week_cancelled: number;
  cancellation_rate: number;
  month_no_shows: number;
}

interface UpcomingAppointment {
  booking_id: string;
  ticket_number: string;
  appointment_time: string;
  customer_name: string;
  customer_phone: string;
  service_id: string | null;
  service_name: string | null;
}

interface Booking {
  booking_id: string;
  ticket_number: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  customer_phone: string;
  service_id: string | null;
  service_name: string | null;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
}

interface ActivityItem {
  id: string;
  type: 'new_booking' | 'cancelled' | 'completed';
  description: string;
  timestamp: string;
  icon: React.ReactNode;
}

type DateRangeOption = 'today' | 'this_week' | 'this_month' | 'custom';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const formatTime = (time: string): string => {
  // Convert 24h to 12h format
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminDashboardHome: React.FC = () => {
  // CRITICAL: Individual Zustand selectors, no object destructuring
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);

  // Local state
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>('today');
  const [exportingCsv, setExportingCsv] = useState(false);

  // ============================================================================
  // API QUERIES
  // ============================================================================

  // Fetch dashboard statistics
  const { 
    data: stats, 
    isLoading: loadingStats,
    error: statsError 
  } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard-stats', selectedDateRange],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/dashboard/stats`,
        {
          params: { date_range: selectedDateRange },
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    staleTime: 60000, // 1 minute
    retry: 1,
    enabled: !!authToken,
    select: (data) => ({
      today_bookings: Number(data.today_bookings || 0),
      today_completed: Number(data.today_completed || 0),
      today_upcoming: Number(data.today_upcoming || 0),
      week_bookings: Number(data.week_bookings || 0),
      week_revenue: data.week_revenue !== null ? Number(data.week_revenue) : null,
      week_cancelled: Number(data.week_cancelled || 0),
      cancellation_rate: Number(data.cancellation_rate || 0),
      month_no_shows: Number(data.month_no_shows || 0)
    })
  });

  // Fetch upcoming appointments
  const { 
    data: upcomingAppointments, 
    isLoading: loadingAppointments 
  } = useQuery<UpcomingAppointment[]>({
    queryKey: ['admin-upcoming-appointments'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/bookings`,
        {
          params: {
            status: 'upcoming',
            sort_by: 'appointment_date',
            sort_order: 'asc',
            limit: 10
          },
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      // Transform to simplified view
      return response.data.bookings.map((booking: Booking) => ({
        booking_id: booking.booking_id,
        ticket_number: booking.ticket_number,
        appointment_time: booking.appointment_time,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        service_id: booking.service_id,
        service_name: booking.service_name || 'Haircut'
      }));
    },
    staleTime: 60000,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    enabled: !!authToken
  });

  // Fetch recent bookings for activity feed
  const { data: recentBookings } = useQuery<Booking[]>({
    queryKey: ['admin-recent-bookings-activity'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/bookings`,
        {
          params: {
            limit: 20,
            sort_by: 'created_at',
            sort_order: 'desc'
          },
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data.bookings;
    },
    staleTime: 60000,
    enabled: !!authToken
  });

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Generate activity feed from recent bookings
  const recentActivity = useMemo<ActivityItem[]>(() => {
    if (!recentBookings) return [];
    
    const activities: ActivityItem[] = [];
    
    recentBookings.forEach(booking => {
      // New booking activity
      activities.push({
        id: `new-${booking.booking_id}`,
        type: 'new_booking',
        description: `New booking: ${booking.customer_name} at ${formatTime(booking.appointment_time)}`,
        timestamp: booking.created_at,
        icon: <Calendar className="w-4 h-4 text-amber-400" />
      });
      
      // Cancellation activity
      if (booking.status === 'cancelled' && booking.cancelled_at) {
        activities.push({
          id: `cancel-${booking.booking_id}`,
          type: 'cancelled',
          description: `Cancelled: ${booking.customer_name} at ${formatTime(booking.appointment_time)}`,
          timestamp: booking.cancelled_at,
          icon: <XCircle className="w-4 h-4 text-red-600" />
        });
      }
      
      // Completion activity
      if (booking.status === 'completed' && booking.completed_at) {
        activities.push({
          id: `complete-${booking.booking_id}`,
          type: 'completed',
          description: `Completed: ${booking.customer_name}`,
          timestamp: booking.completed_at,
          icon: <Calendar className="w-4 h-4 text-green-600" />
        });
      }
    });
    
    // Sort by timestamp descending
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [recentBookings]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleExportBookings = async () => {
    if (!authToken) return;
    
    setExportingCsv(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/bookings/export`,
        {
          params: { start_date: today, end_date: today },
          headers: { Authorization: `Bearer ${authToken}` },
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export bookings. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };



  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
        {/* Page Header */}
        <div className="bg-[#2D0808] shadow-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="mt-1 text-sm text-gray-300">
                  Welcome back, {currentUser?.name || 'Admin'}
                </p>
              </div>
              
              {/* Date Range Selector */}
              <div className="mt-4 sm:mt-0">
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value as DateRangeOption)}
                  className="block w-full sm:w-auto px-4 py-2 bg-[#2D0808] border border-white/20 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-all"
                  aria-label="Select date range"
                >
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Today's Bookings Card */}
            <Link 
              to="/admin/bookings?status=upcoming"
              className="group"
            >
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
                {loadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Calendar className="w-6 h-6 text-amber-400" />
                      </div>
                      {stats && stats.today_bookings > 0 && (
                        <div className="flex items-center text-green-600 text-sm font-medium">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          <span>Active</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">
                      {stats?.today_bookings || 0}
                    </h3>
                    <p className="text-sm text-gray-300 mb-2">Today's Bookings</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <span>{stats?.today_completed || 0} completed</span>
                      <span>•</span>
                      <span>{stats?.today_upcoming || 0} upcoming</span>
                    </div>
                  </>
                )}
              </div>
            </Link>

            {/* Revenue Card (conditional) */}
            {stats?.week_revenue !== null && (
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6">
                {loadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-12 w-12 bg-green-100 rounded-lg mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">
                      ${stats?.week_revenue?.toFixed(2) || '0.00'}
                    </h3>
                    <p className="text-sm text-gray-300">
                      {selectedDateRange === 'this_week' ? 'This Week' : 'This Month'}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Cancellations Card */}
            <Link 
              to="/admin/bookings?status=cancelled"
              className="group"
            >
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
                {loadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-12 w-12 bg-red-100 rounded-lg mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      {stats && stats.cancellation_rate > 0 && (
                        <div className="flex items-center text-red-600 text-sm font-medium">
                          <TrendingDown className="w-4 h-4 mr-1" />
                          <span>{stats.cancellation_rate.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">
                      {stats?.week_cancelled || 0}
                    </h3>
                    <p className="text-sm text-gray-300 mb-2">Cancellations</p>
                    <p className="text-xs text-gray-400">This week</p>
                  </>
                )}
              </div>
            </Link>

            {/* No-Shows Card */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6">
              {loadingStats ? (
                <div className="animate-pulse">
                  <div className="h-12 w-12 bg-yellow-100 rounded-lg mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-1">
                    {stats?.month_no_shows || 0}
                  </h3>
                  <p className="text-sm text-gray-300 mb-2">No-Shows</p>
                  <p className="text-xs text-gray-400">This month</p>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                to="/admin/bookings/new"
                className="flex flex-col items-center justify-center p-4 bg-[#2D0808] hover:bg-blue-100 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 group"
              >
                <Plus className="w-8 h-8 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-blue-900 text-center">Add Manual Booking</span>
              </Link>

              <Link 
                to="/admin/blocking"
                className="flex flex-col items-center justify-center p-4 bg-red-50 hover:bg-red-100 rounded-lg border-2 border-red-200 hover:border-red-400 transition-all duration-200 group"
              >
                <Lock className="w-8 h-8 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-red-900 text-center">Block Time Slot</span>
              </Link>

              <Link 
                to="/admin/gallery/upload"
                className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-all duration-200 group"
              >
                <Upload className="w-8 h-8 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-purple-900 text-center">Upload to Gallery</span>
              </Link>

              <button 
                onClick={handleExportBookings}
                disabled={exportingCsv}
                className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg border-2 border-green-200 hover:border-green-400 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className={`w-8 h-8 text-green-600 mb-2 group-hover:scale-110 transition-transform ${exportingCsv ? 'animate-bounce' : ''}`} />
                <span className="text-sm font-medium text-green-900 text-center">
                  {exportingCsv ? 'Exporting...' : "Export Today's Bookings"}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upcoming Appointments */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Next Appointments</h2>
                <Link 
                  to="/admin/bookings/calendar"
                  className="text-sm text-amber-400 hover:text-blue-700 font-medium transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loadingAppointments ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center space-x-4 p-3 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg">
                      <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment) => (
                    <div 
                      key={appointment.booking_id}
                      className="flex items-center justify-between p-3 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] hover:bg-[#3D0F0F] rounded-lg border border-white/10 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">
                            {formatTime(appointment.appointment_time)}
                          </p>
                          <p className="text-sm text-gray-300 truncate">
                            {appointment.customer_name}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {appointment.service_name}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-400 font-mono">
                              {appointment.ticket_number}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <a 
                          href={`tel:${appointment.customer_phone}`}
                          className="p-2 text-gray-300 hover:text-amber-400 hover:bg-[#2D0808] rounded-lg transition-colors"
                          aria-label="Call customer"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <Link 
                          to={`/admin/bookings/${appointment.ticket_number}`}
                          className="p-2 text-gray-300 hover:text-amber-400 hover:bg-[#2D0808] rounded-lg transition-colors"
                          aria-label="View booking details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-300 text-sm">No upcoming appointments</p>
                  <Link 
                    to="/admin/bookings/new"
                    className="inline-block mt-3 text-amber-400 hover:text-blue-700 text-sm font-medium"
                  >
                    Add a booking →
                  </Link>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>

              {recentActivity.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentActivity.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-start space-x-3 p-3 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg border border-white/10"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {activity.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {getRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-300 text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Error State */}
          {statsError && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <p className="text-red-400 text-sm">
                  Failed to load dashboard data. Please try refreshing the page.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default UV_AdminDashboardHome;