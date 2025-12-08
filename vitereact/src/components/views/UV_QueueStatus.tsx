import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Clock, CheckCircle, AlertCircle, Phone, Home, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QueueStatusData {
  queue_id: string;
  customer_name: string;
  customer_phone: string;
  position: number;
  estimated_wait_minutes: number;
  total_in_queue: number;
  status: 'waiting' | 'ready' | 'called' | 'completed' | 'cancelled';
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_QueueStatus: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queueId = searchParams.get('id');

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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
  // QUERY - FETCH QUEUE STATUS
  // ============================================================================

  const { data: queueStatus, isLoading, error, refetch } = useQuery<QueueStatusData>({
    queryKey: ['queueStatus', queueId],
    queryFn: async () => {
      if (!queueId) throw new Error('No queue ID provided');
      const response = await axios.get(`${getApiBaseUrl()}/api/queue/status/${queueId}`);
      return response.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds for real-time updates
    enabled: !!queueId,
  });

  // ============================================================================
  // MUTATION - LEAVE QUEUE
  // ============================================================================

  const leaveQueueMutation = useMutation({
    mutationFn: async () => {
      if (!queueId) throw new Error('No queue ID');
      const response = await axios.post(
        `${getApiBaseUrl()}/api/queue/leave/${queueId}`,
        {},
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      navigate('/');
    },
    onError: (error: any) => {
      console.error('Leave queue error:', error);
      alert(error.response?.data?.error || 'Failed to leave queue. Please try again.');
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLeaveQueue = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveQueue = () => {
    leaveQueueMutation.mutate();
  };

  const cancelLeaveQueue = () => {
    setShowLeaveConfirm(false);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStatusColor = () => {
    if (!queueStatus) return 'blue';
    switch (queueStatus.status) {
      case 'ready':
      case 'called':
        return 'green';
      case 'completed':
        return 'gray';
      case 'cancelled':
        return 'red';
      default:
        return 'blue';
    }
  };

  const getStatusMessage = () => {
    if (!queueStatus) return '';
    switch (queueStatus.status) {
      case 'ready':
        return "You're next! Please head to the shop now.";
      case 'called':
        return "You've been called! Please arrive within 10 minutes.";
      case 'completed':
        return 'Your queue session has been completed.';
      case 'cancelled':
        return 'You have left the queue.';
      default:
        return "You're in the queue";
    }
  };

  // ============================================================================
  // RENDER - LOADING STATE
  // ============================================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-master-text-primary-dark text-xl">Loading queue status...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - ERROR STATE
  // ============================================================================

  if (error || !queueStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] flex items-center justify-center px-4">
        <div className="max-w-md w-full backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-master-text-primary-dark mb-3">Queue Not Found</h1>
          <p className="text-master-text-secondary-dark mb-6">
            We couldn't find your queue status. You may have already been served or left the queue.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-master-text-primary-dark rounded-lg font-bold hover:shadow-lg transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - MAIN QUEUE STATUS
  // ============================================================================

  const statusColor = getStatusColor();
  const isActive = queueStatus.status === 'waiting' || queueStatus.status === 'ready' || queueStatus.status === 'called';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {queueStatus.status === 'ready' || queueStatus.status === 'called' ? (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4 animate-pulse">
              <CheckCircle className="w-10 h-10 text-master-text-primary-dark" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4 border border-white/20">
              <Users className="w-10 h-10 text-master-text-primary-dark" />
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-master-text-primary-dark mb-3">
            {getStatusMessage()}
          </h1>
          <p className="text-xl text-master-text-secondary-dark">
            {queueStatus.customer_name}
          </p>
        </motion.div>

        {/* Status Card */}
        <motion.div
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="space-y-6">
            {/* Position Indicator */}
            {isActive && (
              <div className={`bg-gradient-to-br from-${statusColor}-500/20 to-${statusColor}-600/20 border border-${statusColor}-500/30 rounded-xl p-6 text-center`}>
                <div className="flex items-center justify-center gap-8">
                  <div>
                    <p className="text-master-text-secondary-dark mb-2">Your Position</p>
                    <p className="text-5xl font-bold text-master-text-primary-dark">#{queueStatus.position}</p>
                  </div>
                  <div className="h-16 w-px bg-white/20"></div>
                  <div>
                    <p className="text-master-text-secondary-dark mb-2">Estimated Wait</p>
                    <p className="text-5xl font-bold text-master-text-primary-dark">{queueStatus.estimated_wait_minutes}<span className="text-2xl text-master-text-secondary-dark">min</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-4 flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-master-text-muted-dark text-sm">Total in Queue</p>
                  <p className="text-2xl font-bold text-master-text-primary-dark">{queueStatus.total_in_queue}</p>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 flex items-center gap-3">
                <Clock className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-master-text-muted-dark text-sm">Joined At</p>
                  <p className="text-lg font-semibold text-master-text-primary-dark">
                    {new Date(queueStatus.created_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="border-t border-white/20 pt-6">
              <div className="flex items-center gap-3 text-master-text-secondary-dark">
                <Phone className="w-5 h-5 text-blue-400" />
                <div>
                  <span className="text-master-text-muted-dark text-sm">We'll text you at</span>
                  <p className="text-master-text-primary-dark font-medium">{queueStatus.customer_phone}</p>
                </div>
              </div>
            </div>

            {/* Status-specific Messages */}
            {queueStatus.status === 'ready' && (
              <div className="border-t border-white/20 pt-6">
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <h3 className="text-master-text-primary-dark font-bold mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    You're Next!
                  </h3>
                  <p className="text-master-text-secondary-dark text-sm">
                    Please head to Master Fade barbershop now. Your barber is ready for you!
                  </p>
                </div>
              </div>
            )}

            {queueStatus.status === 'waiting' && (
              <div className="border-t border-white/20 pt-6">
                <div className="bg-[#2D0808]0/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-master-text-primary-dark font-semibold mb-2">While You Wait</h3>
                  <ul className="space-y-1 text-sm text-master-text-secondary-dark">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>We'll text you 5 minutes before your turn</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>This page updates automatically every 15 seconds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>Please arrive within 10 minutes when notified</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {isActive && (
            <button
              onClick={handleLeaveQueue}
              disabled={leaveQueueMutation.isPending}
              className="flex-1 px-6 py-3 bg-red-600 text-master-text-primary-dark rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              Leave Queue
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="flex-1 px-6 py-3 bg-white/10 text-master-text-primary-dark border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>
        </motion.div>

        {/* Auto-refresh indicator */}
        <motion.p
          className="text-center text-master-text-muted-dark text-sm mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Status updates automatically • Last updated: {new Date().toLocaleTimeString('en-GB')}
        </motion.p>
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-gradient-to-br from-gray-900 to-black border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-master-text-primary-dark text-center mb-3">
              Leave Queue?
            </h2>
            <p className="text-master-text-secondary-dark text-center mb-6">
              Are you sure you want to leave the queue? You'll lose your current position.
            </p>
            <div className="flex gap-4">
              <button
                onClick={cancelLeaveQueue}
                disabled={leaveQueueMutation.isPending}
                className="flex-1 px-6 py-3 bg-white/10 text-master-text-primary-dark border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveQueue}
                disabled={leaveQueueMutation.isPending}
                className="flex-1 px-6 py-3 bg-red-600 text-master-text-primary-dark rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {leaveQueueMutation.isPending ? 'Leaving...' : 'Yes, Leave'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default UV_QueueStatus;
