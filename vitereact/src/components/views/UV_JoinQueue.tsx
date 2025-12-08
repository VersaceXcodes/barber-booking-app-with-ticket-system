import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Phone, AlertCircle, Users, Clock, CheckCircle, Home, X, Ticket, Scissors, Users as UsersIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QueueFormData {
  customer_name: string;
  customer_phone: string;
  barber_id: string | null;
}

interface Barber {
  barber_id: string;
  name: string;
  photo_url: string | null;
  specialties: string[] | null;
  is_working_today: boolean;
  is_active: boolean;
}

interface ValidationErrors {
  customer_name?: string;
  customer_phone?: string;
}

interface WaitTimeData {
  currentWaitMinutes: number;
  queueLength: number;
  activeBarbers: number;
  nextAvailableSlot?: string;
  timestamp: string;
}

interface QueueJoinResponse {
  queue_id: string;
  customer_name: string;
  customer_phone: string;
  position: number;
  estimated_wait_minutes: number;
  status: string;
  created_at: string;
  message: string;
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const queueSchema = z.object({
  customer_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  customer_phone: z.string()
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long')
    .refine((val) => {
      const cleaned = val.replace(/[\s()-]/g, '');
      return /^\+?[1-9]\d{1,14}$/.test(cleaned);
    }, 'Please enter a valid phone number'),
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_JoinQueue: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [formData, setFormData] = useState<QueueFormData>({
    customer_name: '',
    customer_phone: '',
    barber_id: null,
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [queueResponse, setQueueResponse] = useState<QueueJoinResponse | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

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
  // FETCH WAIT TIME
  // ============================================================================

  const { data: waitTimeData, isLoading: waitTimeLoading } = useQuery<WaitTimeData>({
    queryKey: ['waitTime'],
    queryFn: async () => {
      const response = await axios.get(`${getApiBaseUrl()}/api/wait-time`);
      return response.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // ============================================================================
  // FETCH ACTIVE BARBERS
  // ============================================================================

  const { data: barbersData, isLoading: barbersLoading } = useQuery({
    queryKey: ['activeBarbers'],
    queryFn: async () => {
      const response = await axios.get(`${getApiBaseUrl()}/api/barbers`);
      return response.data.barbers as Barber[];
    },
    staleTime: 60000,
  });

  // ============================================================================
  // MUTATION - JOIN QUEUE
  // ============================================================================

  const joinQueueMutation = useMutation({
    mutationFn: async (queueData: any) => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/queue/join`,
        queueData,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: (data: QueueJoinResponse) => {
      // Store response and show confirmation view
      setQueueResponse(data);
      setShowConfirmation(true);
      setErrorMessage('');
      
      // Invalidate wait time query to refresh stats
      queryClient.invalidateQueries({ queryKey: ['waitTime'] });
    },
    onError: (error: any) => {
      console.error('Join queue error:', error);
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.error || 
                       "We couldn't add you to the queue. Please try again.";
      setErrorMessage(errorMsg);
    },
  });

  // ============================================================================
  // MUTATION - LEAVE QUEUE
  // ============================================================================

  const leaveQueueMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/queue/leave/${queueId}`,
        {},
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      // Reset state and return to form
      setShowConfirmation(false);
      setQueueResponse(null);
      setShowLeaveConfirm(false);
      setFormData({ customer_name: '', customer_phone: '' });
      
      // Invalidate wait time query to refresh stats
      queryClient.invalidateQueries({ queryKey: ['waitTime'] });
    },
    onError: (error: any) => {
      console.error('Leave queue error:', error);
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.error || 
                       'Failed to leave queue. Please try again.';
      setErrorMessage(errorMsg);
      setShowLeaveConfirm(false);
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleInputChange = (field: keyof QueueFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    try {
      queueSchema.parse(formData);
      setValidationErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationErrors = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof ValidationErrors] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const queueData = {
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      barber_id: formData.barber_id || null,
    };

    setErrorMessage(''); // Clear any previous errors
    joinQueueMutation.mutate(queueData);
  };

  const handleDone = () => {
    navigate('/');
  };

  const handleLeaveQueue = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveQueue = () => {
    if (queueResponse?.queue_id) {
      leaveQueueMutation.mutate(queueResponse.queue_id);
    }
  };

  const cancelLeaveQueue = () => {
    setShowLeaveConfirm(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show confirmation view after successful join
  if (showConfirmation && queueResponse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4 animate-pulse">
              <CheckCircle className="w-10 h-10 text-master-text-primary-dark" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-master-text-primary-dark mb-3">
              You're in the queue!
            </h1>
            <p className="text-xl text-master-text-secondary-dark">
              We'll text you when you're next
            </p>
          </motion.div>

          {/* Queue Details Card */}
          <motion.div
            className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="space-y-6">
              {/* Ticket Number */}
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Ticket className="w-6 h-6 text-blue-400" />
                  <p className="text-master-text-secondary-dark text-sm font-medium">Your Ticket</p>
                </div>
                <p className="text-5xl font-bold text-master-text-primary-dark mb-2">
                  #{queueResponse.position}
                </p>
                <p className="text-master-text-muted-dark text-sm">Queue Position</p>
              </div>

              {/* Position and Wait Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-master-text-muted-dark text-sm mb-1">Position</p>
                  <p className="text-2xl font-bold text-master-text-primary-dark">#{queueResponse.position} in line</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <Clock className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-master-text-muted-dark text-sm mb-1">Estimated Wait</p>
                  <p className="text-2xl font-bold text-master-text-primary-dark">{queueResponse.estimated_wait_minutes} mins</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="border-t border-white/20 pt-6">
                <div className="flex items-center gap-3 text-master-text-secondary-dark">
                  <Phone className="w-5 h-5 text-blue-400" />
                  <div>
                    <span className="text-master-text-muted-dark text-sm">We'll text you at</span>
                    <p className="text-master-text-primary-dark font-medium">{queueResponse.customer_phone}</p>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-[#2D0808]0/20 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-master-text-primary-dark font-semibold mb-2">What Happens Next:</h3>
                <ul className="space-y-1 text-sm text-master-text-secondary-dark">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>We'll text you when you're next (usually ~5 minutes before)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Please arrive within 10 minutes when notified</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>You can leave the page - we'll still text you</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={handleLeaveQueue}
              disabled={leaveQueueMutation.isPending}
              className="flex-1 px-6 py-3 bg-red-600 text-master-text-primary-dark rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              Leave Queue
            </button>
            <button
              onClick={handleDone}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-master-text-primary-dark rounded-lg font-bold hover:shadow-lg hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Done
            </button>
          </motion.div>

          {/* Additional Info */}
          <motion.p
            className="text-center text-master-text-muted-dark text-sm mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Your position updates automatically • Check status anytime at masterfade.ie
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
                Are you sure you want to leave the queue? You'll lose your current position (#{queueResponse.position}).
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
  }

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
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4 border border-white/20">
            <Users className="w-10 h-10 text-master-text-primary-dark" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-master-text-primary-dark mb-3">
            Join Walk-In Queue
          </h1>
          <p className="text-xl text-master-text-secondary-dark">
            Skip the physical wait - we'll text you when it's your turn
          </p>
        </motion.div>

        {/* Current Queue Stats */}
        <motion.div
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl p-6 mb-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {waitTimeLoading && !waitTimeData ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-master-text-primary-dark mb-1">
                  {waitTimeData?.queueLength ?? 0}
                </p>
                <p className="text-master-text-secondary-dark text-sm">In Queue</p>
              </div>
              <div>
                <Clock className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-master-text-primary-dark mb-1">
                  {waitTimeData?.currentWaitMinutes === 0 ? (
                    'No Wait'
                  ) : (
                    `~${waitTimeData?.currentWaitMinutes ?? 15} min`
                  )}
                </p>
                <p className="text-master-text-secondary-dark text-sm">Est. Wait</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-master-text-primary-dark font-semibold mb-1">Error</h3>
                  <p className="text-master-text-secondary-dark text-sm">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className="block text-master-text-primary-dark font-medium mb-2 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Your Name *
              </label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  validationErrors.customer_name ? 'border-red-500' : 'border-white/30'
                } rounded-lg text-master-text-primary-dark placeholder-master-text-muted-dark focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Enter your name"
                disabled={joinQueueMutation.isPending}
              />
              {validationErrors.customer_name && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.customer_name}
                </p>
              )}
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-master-text-primary-dark font-medium mb-2 flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-400" />
                Mobile Number *
              </label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  validationErrors.customer_phone ? 'border-red-500' : 'border-white/30'
                } rounded-lg text-master-text-primary-dark placeholder-master-text-muted-dark focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="+353 83 327 6229"
                disabled={joinQueueMutation.isPending}
              />
              {validationErrors.customer_phone && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.customer_phone}
                </p>
              )}
              <p className="text-master-text-muted-dark text-sm mt-2">
                We'll text you when you're next in line
              </p>
            </div>

            {/* Barber Selection */}
            <div>
              <label className="block text-master-text-primary-dark font-medium mb-3 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-blue-400" />
                Preferred Barber (Optional)
              </label>
              {barbersLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="mt-2 text-master-text-secondary-dark text-sm">Loading barbers...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* First Available Option */}
                  <button
                    type="button"
                    onClick={() => handleInputChange('barber_id', '')}
                    disabled={joinQueueMutation.isPending}
                    className={`p-4 rounded-lg border-2 transition-all disabled:opacity-50 ${
                      !formData.barber_id
                        ? 'border-blue-500 bg-[#2D0808]0/20'
                        : 'border-white/30 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <UsersIcon className="w-6 h-6 text-master-text-primary-dark" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-master-text-primary-dark">First Available</p>
                        <p className="text-xs text-master-text-secondary-dark">Fastest service</p>
                      </div>
                    </div>
                  </button>

                  {/* Individual Barbers */}
                  {barbersData?.filter(b => b.is_active && b.is_working_today).map((barber) => (
                    <button
                      key={barber.barber_id}
                      type="button"
                      onClick={() => handleInputChange('barber_id', barber.barber_id)}
                      disabled={joinQueueMutation.isPending}
                      className={`p-4 rounded-lg border-2 transition-all disabled:opacity-50 ${
                        formData.barber_id === barber.barber_id
                          ? 'border-blue-500 bg-[#2D0808]0/20'
                          : 'border-white/30 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {barber.photo_url ? (
                          <img
                            src={barber.photo_url}
                            alt={barber.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-master-text-primary-dark" />
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-semibold text-master-text-primary-dark truncate">{barber.name}</p>
                          {barber.specialties && barber.specialties.length > 0 && (
                            <p className="text-xs text-master-text-secondary-dark truncate">{barber.specialties.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-sm text-master-text-secondary-dark">Select a barber or choose "First Available" for faster service</p>
            </div>

            {/* Info Box */}
            <div className="bg-[#2D0808]0/20 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-master-text-primary-dark font-semibold mb-2">What to Expect:</h3>
              <ul className="space-y-1 text-sm text-master-text-secondary-dark">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>You'll receive your queue position immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>We'll text you when you're next (usually 5 minutes before)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Please arrive within 10 minutes when notified</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                disabled={joinQueueMutation.isPending}
                className="flex-1 px-6 py-3 bg-white/10 text-master-text-primary-dark border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinQueueMutation.isPending}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-master-text-primary-dark rounded-lg font-bold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {joinQueueMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Joining...
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5" />
                    Join Queue
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Additional Info */}
        <motion.p
          className="text-center text-master-text-muted-dark text-sm mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          By joining the queue, you agree to our terms of service
        </motion.p>
      </div>
    </div>
  );
};

export default UV_JoinQueue;
