import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BlockedSlot {
  block_id: string;
  block_date: string;
  time_slot: string | null;
  reason: string | null;
  created_at: string;
}

interface ExistingBooking {
  booking_id: string;
  ticket_number: string;
  customer_name: string;
}

interface ExistingBookingsWarning {
  bookings_count: number;
  bookings: ExistingBooking[];
}

interface ValidationErrors {
  date: string | null;
  time_slot: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVAILABLE_TIME_SLOTS = [
  '10:00',
  '10:40',
  '11:20',
  '12:00',
  '12:40',
  '13:20',
  '14:00',
  '14:20'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const isDateInPast = (dateString: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(dateString);
  selected.setHours(0, 0, 0, 0);
  return selected < today;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminBlockingSettings: React.FC = () => {
  // ======================================================================
  // URL PARAMS
  // ======================================================================
  const [searchParams] = useSearchParams();
  const urlDateParam = searchParams.get('date');

  // ======================================================================
  // ZUSTAND STORE - CRITICAL: Individual selectors only
  // ======================================================================
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // ======================================================================
  // LOCAL STATE
  // ======================================================================
  const [blockTypeSelection, setBlockTypeSelection] = useState<'entire_day' | 'specific_slot'>('entire_day');
  const [selectedDateForBlock, setSelectedDateForBlock] = useState<string | null>(urlDateParam || null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    date: null,
    time_slot: null
  });

  // Modal states
  const [unblockConfirmation, setUnblockConfirmation] = useState<{
    block_id: string;
    block_date: string;
    time_slot: string | null;
  } | null>(null);
  const [existingBookingsWarning, setExistingBookingsWarning] = useState<ExistingBookingsWarning | null>(null);
  const [cancelBookingsAction, setCancelBookingsAction] = useState(false);
  const [cancellationReasonForBookings, setCancellationReasonForBookings] = useState<string | null>(null);

  // ======================================================================
  // REACT QUERY
  // ======================================================================
  const queryClient = useQueryClient();

  // Fetch blocked slots
  const {
    data: blockedSlotsData,
    isLoading: loadingBlockedSlots,
    error: blockedSlotsError
  } = useQuery({
    queryKey: ['blocked-slots'],
    queryFn: async () => {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/admin/blocked-slots`,
        {
          params: {
            sort_by: 'block_date',
            sort_order: 'asc',
            limit: 100
          },
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data.data as BlockedSlot[];
    },
    staleTime: 30000,
    enabled: !!authToken
  });

  const blockedSlots = blockedSlotsData || [];

  // Create blocked slot mutation
  const createBlockMutation = useMutation({
    mutationFn: async (data: {
      block_date: string;
      time_slot: string | null;
      reason: string | null;
    }) => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/admin/blocked-slots`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-slots'] });
      // Clear form
      setSelectedDateForBlock(null);
      setSelectedTimeSlot(null);
      setBlockReason(null);
      setBlockTypeSelection('entire_day');
      setExistingBookingsWarning(null);
    }
  });

  // Delete blocked slot mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const response = await axios.delete(
        `${getApiBaseUrl()}/api/admin/blocked-slots/${blockId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-slots'] });
      setUnblockConfirmation(null);
    }
  });

  // Cancel booking mutation (single)
  const cancelBookingMutation = useMutation({
    mutationFn: async (data: {
      booking_id: string;
      cancellation_reason: string;
    }) => {
      const response = await axios.patch(
        `${getApiBaseUrl()}/api/admin/bookings/${data.booking_id}/cancel`,
        {
          cancellation_reason: data.cancellation_reason,
          cancelled_by: 'admin'
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    }
  });

  // ======================================================================
  // FORM VALIDATION
  // ======================================================================
  const validateForm = (): boolean => {
    const errors: ValidationErrors = { date: null, time_slot: null };
    let isValid = true;

    if (!selectedDateForBlock) {
      errors.date = 'Please select a date';
      isValid = false;
    } else if (isDateInPast(selectedDateForBlock)) {
      errors.date = 'Cannot block dates in the past';
      isValid = false;
    }

    if (blockTypeSelection === 'specific_slot' && !selectedTimeSlot) {
      errors.time_slot = 'Please select a time slot';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  // ======================================================================
  // CHECK EXISTING BOOKINGS
  // ======================================================================
  const checkExistingBookings = async (): Promise<ExistingBookingsWarning | null> => {
    if (!selectedDateForBlock) return null;

    try {
      const params: any = {
        appointment_date: selectedDateForBlock,
        status: 'upcoming'
      };

      if (blockTypeSelection === 'specific_slot' && selectedTimeSlot) {
        params.appointment_time = selectedTimeSlot;
      }

      const response = await axios.get(
        `${getApiBaseUrl()}/api/admin/bookings`,
        {
          params,
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      const affectedBookings = response.data.data || [];
      if (affectedBookings.length > 0) {
        return {
          bookings_count: affectedBookings.length,
          bookings: affectedBookings.map((b: any) => ({
            booking_id: b.booking_id,
            ticket_number: b.ticket_number,
            customer_name: b.customer_name
          }))
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking existing bookings:', error);
      return null;
    }
  };

  // ======================================================================
  // HANDLE BLOCK SUBMISSION
  // ======================================================================
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) return;

    // Check for existing bookings
    const warning = await checkExistingBookings();
    
    if (warning) {
      // Show warning modal
      setExistingBookingsWarning(warning);
      setCancellationReasonForBookings(blockReason || 'Slot blocked by admin');
    } else {
      // No conflicts, create block directly
      await createBlock();
    }
  };

  // ======================================================================
  // CREATE BLOCK
  // ======================================================================
  const createBlock = async () => {
    if (!selectedDateForBlock) return;

    const blockData = {
      block_date: selectedDateForBlock,
      time_slot: blockTypeSelection === 'specific_slot' ? selectedTimeSlot : null,
      reason: blockReason
    };

    await createBlockMutation.mutateAsync(blockData);
  };

  // ======================================================================
  // HANDLE BLOCK WITH BOOKINGS
  // ======================================================================
  const handleBlockAnyway = async () => {
    await createBlock();
    setExistingBookingsWarning(null);
  };

  const handleBlockAndCancelBookings = async () => {
    if (!existingBookingsWarning || !cancellationReasonForBookings) return;

    // Cancel all affected bookings
    const cancelPromises = existingBookingsWarning.bookings.map(booking =>
      cancelBookingMutation.mutateAsync({
        booking_id: booking.booking_id,
        cancellation_reason: cancellationReasonForBookings
      })
    );

    try {
      await Promise.all(cancelPromises);
      // Then create the block
      await createBlock();
      setExistingBookingsWarning(null);
      setCancelBookingsAction(false);
    } catch (error) {
      console.error('Error canceling bookings:', error);
    }
  };

  // ======================================================================
  // HANDLE UNBLOCK
  // ======================================================================
  const handleUnblockClick = (block: BlockedSlot) => {
    setUnblockConfirmation({
      block_id: block.block_id,
      block_date: block.block_date,
      time_slot: block.time_slot
    });
  };

  const handleUnblockConfirm = async () => {
    if (!unblockConfirmation) return;
    await deleteBlockMutation.mutateAsync(unblockConfirmation.block_id);
  };

  // ======================================================================
  // EFFECTS
  // ======================================================================
  useEffect(() => {
    // Clear time slot when switching to entire day
    if (blockTypeSelection === 'entire_day') {
      setSelectedTimeSlot(null);
    }
  }, [blockTypeSelection]);

  // ======================================================================
  // RENDER
  // ======================================================================
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
        {/* Header */}
        <div className="bg-[#2D0808] shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-master-text-primary-dark">Blocked Slots and Days</h1>
            <p className="mt-2 text-sm text-master-text-secondary-dark">
              Block specific time slots or entire days to prevent customer bookings during closures
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#2D0808] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                className="border-b-2 border-red-600 py-4 px-1 text-sm font-medium text-amber-400"
                aria-current="page"
              >
                Blocked Slots
              </button>
              <Link
                to="/admin/capacity"
                className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-master-text-muted-dark hover:text-master-text-secondary-dark hover:border-white/20 transition-colors"
              >
                Daily Overrides
              </Link>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-1">
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-master-text-primary-dark mb-6">Add New Block</h2>
                
                <form onSubmit={handleBlockSubmit} className="space-y-6">
                  {/* Block Type */}
                  <div>
                    <label className="block text-sm font-medium text-master-text-secondary-dark mb-3">
                      Block Type <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="block_type"
                          value="entire_day"
                          checked={blockTypeSelection === 'entire_day'}
                          onChange={(e) => setBlockTypeSelection(e.target.value as 'entire_day')}
                          className="h-4 w-4 text-amber-400 focus:ring-red-500 border-white/20"
                        />
                        <span className="ml-3 text-sm text-master-text-secondary-dark">Entire Day</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="block_type"
                          value="specific_slot"
                          checked={blockTypeSelection === 'specific_slot'}
                          onChange={(e) => setBlockTypeSelection(e.target.value as 'specific_slot')}
                          className="h-4 w-4 text-amber-400 focus:ring-red-500 border-white/20"
                        />
                        <span className="ml-3 text-sm text-master-text-secondary-dark">Specific Time Slot</span>
                      </label>
                    </div>
                  </div>

                  {/* Date Picker */}
                  <div>
                    <label htmlFor="block_date" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                      Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      id="block_date"
                      value={selectedDateForBlock || ''}
                      onChange={(e) => {
                        setSelectedDateForBlock(e.target.value);
                        setValidationErrors(prev => ({ ...prev, date: null }));
                      }}
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all"
                    />
                    {validationErrors.date && (
                      <p className="mt-2 form-error-text">{validationErrors.date}</p>
                    )}
                  </div>

                  {/* Time Slot Dropdown (conditional) */}
                  {blockTypeSelection === 'specific_slot' && (
                    <div>
                      <label htmlFor="time_slot" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                        Time Slot <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="time_slot"
                        value={selectedTimeSlot || ''}
                        onChange={(e) => {
                          setSelectedTimeSlot(e.target.value);
                          setValidationErrors(prev => ({ ...prev, time_slot: null }));
                        }}
                        className="w-full px-4 py-3 border-2 border-white/10 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all"
                      >
                        <option value="">Select a time slot</option>
                        {AVAILABLE_TIME_SLOTS.map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                      {validationErrors.time_slot && (
                        <p className="mt-2 form-error-text">{validationErrors.time_slot}</p>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <label htmlFor="block_reason" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                      Reason (Optional)
                    </label>
                    <input
                      type="text"
                      id="block_reason"
                      placeholder="e.g., Vacation, Holiday, Emergency"
                      value={blockReason || ''}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all"
                      maxLength={200}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={createBlockMutation.isPending}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createBlockMutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Blocking...
                      </span>
                    ) : (
                      'Block'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Blocks List Section */}
            <div className="lg:col-span-2">
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="text-xl font-semibold text-master-text-primary-dark">Blocked Slots</h2>
                </div>

                {/* Loading State */}
                {loadingBlockedSlots && (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-master-text-secondary-dark">Loading blocked slots...</p>
                  </div>
                )}

                {/* Error State */}
                {blockedSlotsError && (
                  <div className="p-8 text-center">
                    <div className="text-red-600 mb-4">
                      <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-master-text-primary-dark font-medium">Failed to load blocked slots</p>
                    <p className="text-master-text-secondary-dark text-sm mt-1">Please try refreshing the page</p>
                  </div>
                )}

                {/* Empty State */}
                {!loadingBlockedSlots && !blockedSlotsError && blockedSlots.length === 0 && (
                  <div className="p-8 text-center">
                    <div className="text-master-text-muted-dark mb-4">
                      <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-master-text-primary-dark font-medium text-lg">No blocked slots</p>
                    <p className="text-master-text-secondary-dark text-sm mt-1">Add a new block using the form on the left</p>
                  </div>
                )}

                {/* Table */}
                {!loadingBlockedSlots && !blockedSlotsError && blockedSlots.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#2D0808] divide-y divide-gray-200">
                        {blockedSlots.map((block) => (
                          <tr key={block.block_id} className="hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-master-text-primary-dark">
                                {formatDate(block.block_date)}
                              </div>
                              <div className="text-xs text-master-text-muted-dark">
                                {block.block_date}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                                block.time_slot 
                                  ? 'bg-blue-900/30 text-blue-400' 
                                  : 'bg-gray-100 text-master-text-secondary-dark'
                              }`}>
                                {block.time_slot || 'All Day'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-master-text-primary-dark max-w-xs truncate">
                                {block.reason || <span className="text-master-text-muted-dark italic">No reason provided</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleUnblockClick(block)}
                                className="text-red-600 hover:text-red-900 font-medium transition-colors"
                              >
                                Unblock
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Warning Modal - Existing Bookings */}
        {existingBookingsWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-xl font-semibold text-master-text-primary-dark">Existing Bookings Found</h3>
                    <p className="mt-2 text-sm text-master-text-secondary-dark">
                      Warning: {existingBookingsWarning.bookings_count} booking{existingBookingsWarning.bookings_count > 1 ? 's' : ''} exist for this {blockTypeSelection === 'entire_day' ? 'day' : 'time slot'}. Blocking will not cancel them automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Affected Bookings List */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-master-text-primary-dark mb-3">Affected Bookings:</h4>
                  <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-4 max-h-40 overflow-y-auto">
                    <ul className="space-y-2">
                      {existingBookingsWarning.bookings.map((booking) => (
                        <li key={booking.booking_id} className="text-sm text-master-text-secondary-dark">
                          <span className="font-medium">{booking.ticket_number}</span> - {booking.customer_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Cancel Bookings Section */}
                {!cancelBookingsAction ? (
                  <div className="space-y-4">
                    <button
                      onClick={handleBlockAnyway}
                      className="w-full bg-amber-600 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:bg-amber-700 transition-all"
                    >
                      Block anyway (keep bookings)
                    </button>
                    <button
                      onClick={() => setCancelBookingsAction(true)}
                      className="w-full bg-red-600 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-all"
                    >
                      Block and cancel bookings
                    </button>
                    <button
                      onClick={() => {
                        setExistingBookingsWarning(null);
                        setCancelBookingsAction(false);
                      }}
                      className="w-full bg-gray-100 text-master-text-secondary-dark px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-red-900 mb-2">
                        Cancel {existingBookingsWarning.bookings_count} booking{existingBookingsWarning.bookings_count > 1 ? 's' : ''} and notify customers?
                      </p>
                      <label htmlFor="cancellation_reason" className="block text-sm font-medium text-red-900 mb-2">
                        Reason for cancellation:
                      </label>
                      <textarea
                        id="cancellation_reason"
                        rows={3}
                        value={cancellationReasonForBookings || ''}
                        onChange={(e) => setCancellationReasonForBookings(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all"
                        placeholder="Explain why bookings are being cancelled..."
                      />
                    </div>
                    <button
                      onClick={handleBlockAndCancelBookings}
                      disabled={cancelBookingMutation.isPending}
                      className="w-full bg-red-600 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelBookingMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Bookings'}
                    </button>
                    <button
                      onClick={() => setCancelBookingsAction(false)}
                      className="w-full bg-gray-100 text-master-text-secondary-dark px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Unblock Confirmation Modal */}
        {unblockConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-master-text-primary-dark mb-4">Unblock Slot?</h3>
                <p className="text-master-text-secondary-dark mb-2">
                  Unblock <span className="font-medium text-master-text-primary-dark">{formatDate(unblockConfirmation.block_date)}</span>
                  {unblockConfirmation.time_slot && (
                    <span> at <span className="font-medium text-master-text-primary-dark">{unblockConfirmation.time_slot}</span></span>
                  )}
                  {!unblockConfirmation.time_slot && <span> (All Day)</span>}?
                </p>
                <p className="text-sm text-master-text-muted-dark">
                  This will become available for booking again.
                </p>
              </div>
              <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-6 py-4 flex gap-3">
                <button
                  onClick={handleUnblockConfirm}
                  disabled={deleteBlockMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteBlockMutation.isPending ? 'Unblocking...' : 'Unblock'}
                </button>
                <button
                  onClick={() => setUnblockConfirmation(null)}
                  className="flex-1 bg-gray-100 text-master-text-secondary-dark px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_AdminBlockingSettings;