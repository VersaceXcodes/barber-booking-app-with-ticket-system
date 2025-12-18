import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Users, 
  Clock, 
  MapPin, 
  Phone, 
  Calendar,
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  PlayCircle,
  Car,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QueueEntry {
  queue_id: string;
  customer_name: string;
  customer_phone: string;
  status: 'waiting' | 'in_service' | 'completed' | 'no_show';
  position: number;
  estimated_wait_minutes: number;
  created_at: string;
  updated_at: string;
  served_at: string | null;
}

interface CallOutBooking {
  callout_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service_address: string;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'en_route' | 'completed' | 'cancelled';
  price: number;
  special_request: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  admin_notes: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminQueueDashboard: React.FC = () => {
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const queryClient = useQueryClient();

  // Local state
  const [calloutFilter, setCalloutFilter] = useState<'all' | 'today' | 'upcoming'>('all');
  const [_, setSelectedQueueEntry] = useState<string | null>(null);
  const [__, setSelectedCallout] = useState<string | null>(null);

  // ============================================================================
  // API BASE URL
  // ============================================================================

  const getApiBaseUrl = (): string => {
    if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.API_BASE_URL) {
      return (window as any).__RUNTIME_CONFIG__.API_BASE_URL;
    }
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  // ============================================================================
  // QUERIES
  // ============================================================================

  // Fetch queue entries
  const { data: queueData, isLoading: loadingQueue } = useQuery({
    queryKey: ['admin-queue'],
    queryFn: async () => {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/admin/queue`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    enabled: !!authToken
  });

  // Fetch call-out bookings
  const { data: calloutsData, isLoading: loadingCallouts } = useQuery({
    queryKey: ['admin-callouts', calloutFilter],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const params: any = { limit: 100 };
      
      if (calloutFilter === 'today') {
        params.appointment_date_from = today;
        params.appointment_date_to = today;
      } else if (calloutFilter === 'upcoming') {
        params.appointment_date_from = today;
      }

      const response = await axios.get(
        `${getApiBaseUrl()}/api/admin/callouts`,
        { 
          headers: { Authorization: `Bearer ${authToken}` },
          params
        }
      );
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!authToken
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  // Update queue status
  const updateQueueMutation = useMutation({
    mutationFn: async ({ queue_id, status }: { queue_id: string; status: string }) => {
      const response = await axios.patch(
        `${getApiBaseUrl()}/api/admin/queue/${queue_id}`,
        { status },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-queue'] });
      queryClient.invalidateQueries({ queryKey: ['waitTime'] });
      setSelectedQueueEntry(null);
    },
    onError: (error: any) => {
      console.error('Update queue error:', error);
      alert(error.response?.data?.message || 'Failed to update queue status');
    }
  });

  // Update call-out status
  const updateCalloutMutation = useMutation({
    mutationFn: async ({ callout_id, status, cancellation_reason }: { 
      callout_id: string; 
      status: string;
      cancellation_reason?: string;
    }) => {
      const response = await axios.patch(
        `${getApiBaseUrl()}/api/admin/callouts/${callout_id}`,
        { status, cancellation_reason },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-callouts'] });
      setSelectedCallout(null);
    },
    onError: (error: any) => {
      console.error('Update callout error:', error);
      alert(error.response?.data?.message || 'Failed to update call-out status');
    }
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleQueueStatusChange = (queueId: string, status: string) => {
    if (confirm(`Are you sure you want to change this queue entry to "${status}"?`)) {
      updateQueueMutation.mutate({ queue_id: queueId, status });
    }
  };

  const handleCalloutStatusChange = (calloutId: string, status: string) => {
    let cancellation_reason: string | undefined = undefined;
    
    if (status === 'cancelled') {
      cancellation_reason = prompt('Cancellation reason (optional):') || 'Cancelled by admin';
    }

    if (confirm(`Are you sure you want to change this call-out to "${status}"?`)) {
      updateCalloutMutation.mutate({ callout_id: calloutId, status, cancellation_reason });
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
      case 'scheduled':
        return 'bg-blue-900/30 text-blue-400 border-blue-200';
      case 'in_service':
      case 'en_route':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-200';
      case 'completed':
        return 'bg-green-900/30 text-green-400 border-green-200';
      case 'no_show':
      case 'cancelled':
        return 'bg-red-900/30 text-red-400 border-red-200';
      default:
        return 'bg-gray-100 text-master-text-secondary-dark border-white/10';
    }
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const queue: QueueEntry[] = queueData?.queue || [];
  const callouts: CallOutBooking[] = calloutsData?.callouts || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#600000] via-[#730000] to-[#8b0000]">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#730000] to-[#8b0000] shadow-master-elevated border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-master-text-primary-dark">Queue & Call-Out Management</h1>
              <p className="mt-1 text-sm text-master-text-secondary-dark">
                Manage walk-in queue and call-out bookings in real-time
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['admin-queue'] });
                  queryClient.invalidateQueries({ queryKey: ['admin-callouts'] });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white text-master-text-primary-light rounded-lg hover:bg-gray-100 transition-colors font-semibold shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* LIVE WALK-IN QUEUE SECTION */}
          <div className="glass-card-light rounded-xl shadow-master-elevated border-white/25 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600/30 rounded-lg border border-blue-500/30">
                  <Users className="w-6 h-6 text-blue-200" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-master-text-primary-dark">Live Walk-In Queue</h2>
                  <p className="text-sm text-master-text-primary-dark font-medium">{queue.filter(q => q.status === 'waiting').length} customers waiting</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                <span className="text-sm text-master-text-primary-dark font-medium">Live</span>
              </div>
            </div>

            {loadingQueue ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
              </div>
            ) : queue.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-master-text-secondary-dark mx-auto mb-3" />
                <p className="text-master-text-secondary-dark">No one in queue</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {queue.map((entry) => (
                  <motion.div
                    key={entry.queue_id}
                    className="bg-white/10 border border-white/20 rounded-lg p-4 hover:shadow-master-glow hover:bg-white/15 transition-all"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-amber-600/30 border border-amber-500/50 rounded-full font-bold text-amber-200">
                          #{entry.position}
                        </div>
                        <div>
                          <h3 className="font-semibold text-master-text-primary-dark">{entry.customer_name}</h3>
                          <div className="flex items-center gap-2 text-sm text-master-text-primary-dark">
                            <Phone className="w-4 h-4" />
                            {entry.customer_phone}
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(entry.status)}`}>
                        {entry.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-master-text-primary-dark mb-3 font-medium">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>~{entry.estimated_wait_minutes} min wait</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(entry.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {entry.status === 'waiting' && (
                      <div className="flex gap-2 pt-3 border-t border-white/15">
                        <button
                          onClick={() => handleQueueStatusChange(entry.queue_id, 'in_service')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 text-master-text-primary-dark rounded-lg hover:from-yellow-700 hover:to-yellow-800 transition-colors text-sm font-semibold shadow-lg"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Start Service
                        </button>
                        <button
                          onClick={() => handleQueueStatusChange(entry.queue_id, 'no_show')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg hover:from-red-700 hover:to-red-800 transition-colors text-sm font-semibold shadow-lg"
                        >
                          <XCircle className="w-4 h-4" />
                          No-Show
                        </button>
                      </div>
                    )}

                    {entry.status === 'in_service' && (
                      <div className="flex gap-2 pt-3 border-t border-white/15">
                        <button
                          onClick={() => handleQueueStatusChange(entry.queue_id, 'completed')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-master-text-primary-dark rounded-lg hover:from-green-700 hover:to-green-800 transition-colors text-sm font-semibold shadow-lg"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* CALL-OUT JOBS SECTION */}
          <div className="glass-card-light rounded-xl shadow-master-elevated border-white/25 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-600/30 rounded-lg border border-orange-500/30">
                  <Car className="w-6 h-6 text-orange-200" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-master-text-primary-dark">Call-Out Jobs</h2>
                  <p className="text-sm text-master-text-primary-dark font-medium">{callouts.length} bookings</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalloutFilter('all')}
                  className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors ${
                    calloutFilter === 'all' 
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark shadow-lg' 
                      : 'bg-white/10 text-master-text-primary-dark hover:bg-white/20 border border-white/20'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setCalloutFilter('today')}
                  className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors ${
                    calloutFilter === 'today' 
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark shadow-lg' 
                      : 'bg-white/10 text-master-text-primary-dark hover:bg-white/20 border border-white/20'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setCalloutFilter('upcoming')}
                  className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors ${
                    calloutFilter === 'upcoming' 
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark shadow-lg' 
                      : 'bg-white/10 text-master-text-primary-dark hover:bg-white/20 border border-white/20'
                  }`}
                >
                  Upcoming
                </button>
              </div>
            </div>

            {loadingCallouts ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : callouts.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 text-master-text-secondary-dark mx-auto mb-3" />
                <p className="text-master-text-secondary-dark">No call-out bookings</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {callouts.map((callout) => (
                  <motion.div
                    key={callout.callout_id}
                    className="border border-white/10 rounded-lg p-4 hover:shadow-md transition-shadow"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-master-text-primary-dark">{callout.customer_name}</h3>
                        <div className="flex items-center gap-2 text-sm text-master-text-secondary-dark mt-1">
                          <Phone className="w-4 h-4" />
                          {callout.customer_phone}
                        </div>
                        {callout.customer_email && (
                          <div className="flex items-center gap-2 text-sm text-master-text-secondary-dark mt-1">
                            <Mail className="w-4 h-4" />
                            {callout.customer_email}
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(callout.status)}`}>
                        {callout.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2 text-sm text-master-text-secondary-dark">
                        <Calendar className="w-4 h-4 mt-0.5 text-master-text-muted-dark" />
                        <div>
                          <span className="font-medium">{formatDate(callout.appointment_date)}</span>
                          <span className="text-master-text-muted-dark"> at {formatTime(callout.appointment_time)}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-master-text-secondary-dark">
                        <MapPin className="w-4 h-4 mt-0.5 text-master-text-muted-dark" />
                        <span>{callout.service_address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-600">€{callout.price.toFixed(2)}</span>
                      </div>
                    </div>

                    {callout.special_request && (
                      <div className="mb-3 p-3 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg">
                        <p className="text-sm text-master-text-secondary-dark">
                          <span className="font-medium">Note: </span>
                          {callout.special_request}
                        </p>
                      </div>
                    )}

                    {callout.status === 'scheduled' && (
                      <div className="flex gap-2 pt-3 border-t border-white/10">
                        <button
                          onClick={() => handleCalloutStatusChange(callout.callout_id, 'en_route')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-master-text-primary-dark rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                        >
                          <Car className="w-4 h-4" />
                          On the Way
                        </button>
                        <button
                          onClick={() => handleCalloutStatusChange(callout.callout_id, 'cancelled')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-master-text-primary-dark rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}

                    {callout.status === 'en_route' && (
                      <div className="flex gap-2 pt-3 border-t border-white/10">
                        <button
                          onClick={() => handleCalloutStatusChange(callout.callout_id, 'completed')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-master-text-primary-dark rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                        <button
                          onClick={() => handleCalloutStatusChange(callout.callout_id, 'cancelled')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-master-text-primary-dark rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_AdminQueueDashboard;
