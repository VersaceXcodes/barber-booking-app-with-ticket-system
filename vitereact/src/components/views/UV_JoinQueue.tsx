import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Phone, AlertCircle, Users, Clock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QueueFormData {
  customer_name: string;
  customer_phone: string;
}

interface ValidationErrors {
  customer_name?: string;
  customer_phone?: string;
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

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [formData, setFormData] = useState<QueueFormData>({
    customer_name: '',
    customer_phone: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

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
    onSuccess: (data) => {
      // Navigate to queue status page with queue ID
      navigate(`/queue/status?id=${data.queue_id}`);
    },
    onError: (error: any) => {
      console.error('Join queue error:', error);
      alert(error.response?.data?.error || 'Failed to join queue. Please try again.');
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
    };

    joinQueueMutation.mutate(queueData);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

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
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Join Walk-In Queue
          </h1>
          <p className="text-xl text-gray-300">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white mb-1">4</p>
              <p className="text-gray-300 text-sm">In Queue</p>
            </div>
            <div>
              <Clock className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white mb-1">~15 min</p>
              <p className="text-gray-300 text-sm">Est. Wait</p>
            </div>
          </div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className="block text-white font-medium mb-2 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Your Name *
              </label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  validationErrors.customer_name ? 'border-red-500' : 'border-white/30'
                } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
              <label className="block text-white font-medium mb-2 flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-400" />
                Mobile Number *
              </label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                className={`w-full px-4 py-3 bg-white/10 border ${
                  validationErrors.customer_phone ? 'border-red-500' : 'border-white/30'
                } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="+353 83 327 6229"
                disabled={joinQueueMutation.isPending}
              />
              {validationErrors.customer_phone && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.customer_phone}
                </p>
              )}
              <p className="text-gray-400 text-sm mt-2">
                We'll text you when you're next in line
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">What to Expect:</h3>
              <ul className="space-y-1 text-sm text-gray-300">
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
                className="flex-1 px-6 py-3 bg-white/10 text-white border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinQueueMutation.isPending}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
          className="text-center text-gray-400 text-sm mt-6"
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
