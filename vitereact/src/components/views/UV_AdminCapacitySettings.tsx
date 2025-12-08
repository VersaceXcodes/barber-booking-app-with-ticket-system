import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ============================================================================
// INTERFACES
// ============================================================================

interface CapacityOverride {
  override_id: string;
  override_date: string;
  time_slot: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Settings {
  capacity_mon_wed: number;
  capacity_thu_sun: number;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_email: string;
  operating_hours: string;
  booking_window_days: number;
  same_day_cutoff_hours: number;
  reminder_hours_before: number;
  email_confirmation_enabled: boolean;
  email_reminder_enabled: boolean;
  sms_enabled: boolean;
  updated_at: string;
}

interface CreateOverridePayload {
  override_date: string;
  time_slot: string;
  capacity: number;
  is_active: boolean;
}

interface UpdateOverridePayload {
  override_date?: string;
  time_slot?: string;
  capacity?: number;
  is_active?: boolean;
}

interface UpdateSettingsPayload {
  capacity_mon_wed?: number;
  capacity_thu_sun?: number;
}

interface Booking {
  booking_id: string;
  appointment_date: string;
  status: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminCapacitySettings: React.FC = () => {
  // ====================================
  // URL PARAMS
  // ====================================
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date');

  // ====================================
  // ZUSTAND GLOBAL STATE (Individual Selectors)
  // ====================================
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const defaultCapacityMonWed = useAppStore(state => state.app_settings.capacity_mon_wed);
  const defaultCapacityThuSun = useAppStore(state => state.app_settings.capacity_thu_sun);
  const updateAppSettings = useAppStore(state => state.update_app_settings);

  // ====================================
  // LOCAL STATE
  // ====================================
  const [activeTab, setActiveTab] = useState<'overrides' | 'blocked' | 'defaults'>('overrides');
  
  // Form state for new override
  const [selectedDateForOverride, setSelectedDateForOverride] = useState<string | null>(urlDate || null);
  const [newOverrideCapacity, setNewOverrideCapacity] = useState<number | null>(null);
  const [newOverrideReason, setNewOverrideReason] = useState<string | null>(null);
  
  // Modal states
  const [editDefaultsModalOpen, setEditDefaultsModalOpen] = useState(false);
  const [tempCapacityMonWed, setTempCapacityMonWed] = useState<number | null>(null);
  const [tempCapacityThuSun, setTempCapacityThuSun] = useState<number | null>(null);
  
  const [editOverrideModalState, setEditOverrideModalState] = useState<{
    override_id: string;
    override_date: string;
    capacity: number;
    time_slot: string;
  } | null>(null);
  
  const [deleteOverrideConfirmation, setDeleteOverrideConfirmation] = useState<{
    override_id: string;
    override_date: string;
  } | null>(null);
  
  // Validation and warnings
  const [validationErrors, setValidationErrors] = useState<{
    date: string | null;
    capacity: string | null;
  }>({ date: null, capacity: null });
  
  const [bookingWarning, setBookingWarning] = useState<{
    show: boolean;
    count: number;
    date: string;
    capacity: number;
  } | null>(null);



  // ====================================
  // API BASE URL
  // ====================================
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ====================================
  // QUERIES
  // ====================================

  // Fetch settings
  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 60000,
  });

  // Fetch capacity overrides
  const { data: overridesData, isLoading: loadingOverrides, refetch: refetchOverrides } = useQuery<{
    overrides: CapacityOverride[];
  }>({
    queryKey: ['capacity-overrides'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/capacity-overrides`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          is_active: true,
          sort_by: 'override_date',
          sort_order: 'asc',
          limit: 100
        }
      });
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 30000,
  });

  const capacityOverrides = overridesData?.overrides || [];

  // ====================================
  // MUTATIONS
  // ====================================

  // Create override mutation
  const createOverrideMutation = useMutation({
    mutationFn: async (payload: CreateOverridePayload) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/capacity-overrides`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      refetchOverrides();
      setSelectedDateForOverride(null);
      setNewOverrideCapacity(null);
      setNewOverrideReason(null);
      setValidationErrors({ date: null, capacity: null });
      setBookingWarning(null);
    },
  });

  // Update override mutation
  const updateOverrideMutation = useMutation({
    mutationFn: async ({ override_id, payload }: { override_id: string; payload: UpdateOverridePayload }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/capacity-overrides/${override_id}`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      refetchOverrides();
      setEditOverrideModalState(null);
    },
  });

  // Delete override mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: async (override_id: string) => {
      const response = await axios.delete(
        `${API_BASE_URL}/api/admin/capacity-overrides/${override_id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      refetchOverrides();
      setDeleteOverrideConfirmation(null);
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/settings`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      updateAppSettings({
        capacity_mon_wed: data.capacity_mon_wed,
        capacity_thu_sun: data.capacity_thu_sun
      });
      setEditDefaultsModalOpen(false);
      setTempCapacityMonWed(null);
      setTempCapacityThuSun(null);
    },
  });

  // Check bookings query (triggered manually)
  const [checkingBookings, setCheckingBookings] = useState(false);
  const checkExistingBookings = async (date: string, newCapacity: number) => {
    setCheckingBookings(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/bookings`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          appointment_date: date,
          status: 'upcoming'
        }
      });
      
      const bookings: Booking[] = response.data.data || [];
      const currentBookingsCount = bookings.length;
      
      if (currentBookingsCount > newCapacity) {
        setBookingWarning({
          show: true,
          count: currentBookingsCount,
          date: date,
          capacity: newCapacity
        });
        return false; // Don't proceed
      }
      
      return true; // OK to proceed
    } catch (error) {
      console.error('Error checking bookings:', error);
      return true; // Proceed anyway if check fails
    } finally {
      setCheckingBookings(false);
    }
  };

  // ====================================
  // VALIDATION
  // ====================================
  const validateOverrideForm = (): boolean => {
    const errors = { date: null as string | null, capacity: null as string | null };
    
    if (!selectedDateForOverride) {
      errors.date = 'Please select a date';
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(selectedDateForOverride)) {
        errors.date = 'Date must be in YYYY-MM-DD format';
      } else {
        const selectedDate = new Date(selectedDateForOverride + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(selectedDate.getTime())) {
          errors.date = 'Invalid date';
        } else if (selectedDate < today) {
          errors.date = 'Cannot create override for past dates';
        } else {
          const existingOverride = capacityOverrides.find(
            o => o.override_date === selectedDateForOverride
          );
          if (existingOverride) {
            errors.date = 'Override already exists for this date. Edit the existing one instead.';
          }
        }
      }
    }
    
    if (newOverrideCapacity === null || newOverrideCapacity === undefined) {
      errors.capacity = 'Please enter capacity';
    } else if (newOverrideCapacity < 0 || newOverrideCapacity > 10) {
      errors.capacity = 'Capacity must be between 0 and 10';
    }
    
    setValidationErrors(errors);
    return !errors.date && !errors.capacity;
  };

  // ====================================
  // EVENT HANDLERS
  // ====================================

  const handleAddOverride = async () => {
    if (!validateOverrideForm()) return;
    if (!selectedDateForOverride || newOverrideCapacity === null) return;
    
    const normalizedDate = normalizeDate(selectedDateForOverride);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(normalizedDate)) {
      setValidationErrors({ ...validationErrors, date: 'Invalid date format. Must be YYYY-MM-DD.' });
      return;
    }
    
    const canProceed = await checkExistingBookings(normalizedDate, newOverrideCapacity);
    if (!canProceed) {
      return;
    }
    
    createOverrideMutation.mutate({
      override_date: normalizedDate,
      time_slot: '00:00',
      capacity: newOverrideCapacity,
      is_active: true
    });
  };

  const handleProceedWithWarning = () => {
    if (!selectedDateForOverride || newOverrideCapacity === null) return;
    
    const normalizedDate = normalizeDate(selectedDateForOverride);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(normalizedDate)) {
      setValidationErrors({ ...validationErrors, date: 'Invalid date format. Must be YYYY-MM-DD.' });
      setBookingWarning(null);
      return;
    }
    
    createOverrideMutation.mutate({
      override_date: normalizedDate,
      time_slot: '00:00',
      capacity: newOverrideCapacity,
      is_active: true
    });
    
    setBookingWarning(null);
  };

  const handleEditOverride = (override: CapacityOverride) => {
    setEditOverrideModalState({
      override_id: override.override_id,
      override_date: override.override_date,
      capacity: override.capacity,
      time_slot: override.time_slot
    });
  };

  const handleSaveEditOverride = () => {
    if (!editOverrideModalState) return;
    
    const normalizedDate = normalizeDate(editOverrideModalState.override_date);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(normalizedDate)) {
      alert('Invalid date format. Must be YYYY-MM-DD.');
      return;
    }
    
    updateOverrideMutation.mutate({
      override_id: editOverrideModalState.override_id,
      payload: {
        override_date: normalizedDate,
        capacity: editOverrideModalState.capacity,
        time_slot: editOverrideModalState.time_slot
      }
    });
  };

  const handleDeleteOverride = (override: CapacityOverride) => {
    setDeleteOverrideConfirmation({
      override_id: override.override_id,
      override_date: override.override_date
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteOverrideConfirmation) return;
    deleteOverrideMutation.mutate(deleteOverrideConfirmation.override_id);
  };

  const handleOpenEditDefaults = () => {
    setTempCapacityMonWed(settings?.capacity_mon_wed ?? defaultCapacityMonWed);
    setTempCapacityThuSun(settings?.capacity_thu_sun ?? defaultCapacityThuSun);
    setEditDefaultsModalOpen(true);
  };

  const handleSaveDefaults = () => {
    if (tempCapacityMonWed === null || tempCapacityThuSun === null) return;
    
    if (tempCapacityMonWed < 0 || tempCapacityMonWed > 10 || tempCapacityThuSun < 0 || tempCapacityThuSun > 10) {
      alert('Capacity must be between 0 and 10');
      return;
    }
    
    updateSettingsMutation.mutate({
      capacity_mon_wed: tempCapacityMonWed,
      capacity_thu_sun: tempCapacityThuSun
    });
  };

  // ====================================
  // HELPER FUNCTIONS
  // ====================================

  const normalizeDate = (dateString: string): string => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    return dateString;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getDefaultCapacityForDate = (dateString: string): number => {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Monday-Wednesday = 1, 2, 3 -> capacity_mon_wed
    // Thursday-Sunday = 4, 5, 6, 0 -> capacity_thu_sun
    if (dayOfWeek >= 1 && dayOfWeek <= 3) {
      return settings?.capacity_mon_wed ?? defaultCapacityMonWed;
    } else {
      return settings?.capacity_thu_sun ?? defaultCapacityThuSun;
    }
  };

  // ====================================
  // RENDER
  // ====================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-master-text-primary-dark">Capacity Management</h1>
            <p className="mt-2 text-master-text-secondary-dark leading-relaxed">
              Manage default slot capacity rules and date-specific overrides
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
            <div className="border-b border-white/10">
              <nav className="flex -mb-px" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('overrides')}
                  className={`py-4 px-8 text-center border-b-2 font-medium text-sm transition-all duration-200 ${
                    activeTab === 'overrides'
                      ? 'border-red-600 text-amber-400'
                      : 'border-transparent text-master-text-muted-dark hover:text-master-text-secondary-dark hover:border-white/20'
                  }`}
                >
                  Daily Overrides
                </button>
                <Link
                  to="/admin/blocking"
                  className="py-4 px-8 text-center border-b-2 border-transparent text-master-text-muted-dark hover:text-master-text-secondary-dark hover:border-white/20 font-medium text-sm transition-all duration-200"
                >
                  Blocked Slots
                </Link>
                <button
                  onClick={() => setActiveTab('defaults')}
                  className={`py-4 px-8 text-center border-b-2 font-medium text-sm transition-all duration-200 ${
                    activeTab === 'defaults'
                      ? 'border-red-600 text-amber-400'
                      : 'border-transparent text-master-text-muted-dark hover:text-master-text-secondary-dark hover:border-white/20'
                  }`}
                >
                  Default Settings
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Daily Overrides Tab */}
              {activeTab === 'overrides' && (
                <div className="space-y-8">
                  {/* Add Override Form */}
                  <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-6 border border-white/10">
                    <h2 className="text-xl font-semibold text-master-text-primary-dark mb-4">
                      Override Capacity for Specific Date
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Date Picker */}
                      <div>
                        <label htmlFor="override-date" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                          Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="override-date"
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={selectedDateForOverride || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                              setSelectedDateForOverride(value);
                            } else if (!value) {
                              setSelectedDateForOverride(null);
                            }
                            setValidationErrors({ ...validationErrors, date: null });
                          }}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                            validationErrors.date
                              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                              : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                          }`}
                        />
                        {validationErrors.date && (
                          <p className="mt-1 form-error-text">{validationErrors.date}</p>
                        )}
                      </div>

                      {/* Capacity Input */}
                      <div>
                        <label htmlFor="override-capacity" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                          New Capacity <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="override-capacity"
                          type="number"
                          min="0"
                          max="10"
                          value={newOverrideCapacity === null ? '' : newOverrideCapacity}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            setNewOverrideCapacity(val);
                            setValidationErrors({ ...validationErrors, capacity: null });
                          }}
                          placeholder="0-10"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                            validationErrors.capacity
                              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                              : 'border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100'
                          }`}
                        />
                        {validationErrors.capacity && (
                          <p className="mt-1 form-error-text">{validationErrors.capacity}</p>
                        )}
                      </div>

                      {/* Reason Input */}
                      <div>
                        <label htmlFor="override-reason" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                          Reason (Optional)
                        </label>
                        <input
                          id="override-reason"
                          type="text"
                          value={newOverrideReason || ''}
                          onChange={(e) => setNewOverrideReason(e.target.value)}
                          placeholder="e.g., Staff shortage"
                          className="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={handleAddOverride}
                        disabled={createOverrideMutation.isPending || checkingBookings}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg font-medium hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createOverrideMutation.isPending ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adding Override...
                          </span>
                        ) : checkingBookings ? (
                          'Checking Bookings...'
                        ) : (
                          'Add Override'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Overrides List */}
                  <div>
                    <h2 className="text-xl font-semibold text-master-text-primary-dark mb-4">
                      Existing Capacity Overrides
                    </h2>

                    {loadingOverrides ? (
                      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg border border-white/10 p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600 mx-auto"></div>
                        <p className="mt-4 text-master-text-secondary-dark">Loading overrides...</p>
                      </div>
                    ) : capacityOverrides.length === 0 ? (
                      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg border border-white/10 p-12 text-center">
                        <svg className="mx-auto h-12 w-12 text-master-text-muted-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-4 text-lg font-medium text-master-text-primary-dark">No capacity overrides set</h3>
                        <p className="mt-2 text-master-text-secondary-dark">Default capacity applies to all dates.</p>
                      </div>
                    ) : (
                      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg border border-white/10 overflow-hidden shadow-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                                Capacity
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
                            {capacityOverrides.map((override) => (
                              <tr key={override.override_id} className="hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-master-text-primary-dark">
                                  {formatDate(override.override_date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-master-text-secondary-dark">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/30 text-blue-400">
                                    {override.capacity} {override.capacity === 1 ? 'slot' : 'slots'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-master-text-secondary-dark">
                                  {/* Reason not in schema but can be displayed if added */}
                                  <span className="text-master-text-muted-dark italic">N/A</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                  <button
                                    onClick={() => handleEditOverride(override)}
                                    className="text-amber-400 hover:text-blue-900 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOverride(override)}
                                    className="text-red-600 hover:text-red-900 transition-colors"
                                  >
                                    Remove
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
              )}

              {/* Default Settings Tab */}
              {activeTab === 'defaults' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-master-text-primary-dark">
                    Default Capacity Rules
                  </h2>

                  {loadingSettings ? (
                    <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg border border-white/10 p-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600 mx-auto"></div>
                      <p className="mt-4 text-master-text-secondary-dark">Loading settings...</p>
                    </div>
                  ) : (
                    <>
                      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg border border-white/10 p-6 shadow-lg">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg">
                            <span className="text-master-text-secondary-dark font-medium">Monday - Wednesday:</span>
                            <span className="text-2xl font-bold text-amber-400">
                              {settings?.capacity_mon_wed ?? defaultCapacityMonWed} people per slot
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg">
                            <span className="text-master-text-secondary-dark font-medium">Thursday - Sunday:</span>
                            <span className="text-2xl font-bold text-amber-400">
                              {settings?.capacity_thu_sun ?? defaultCapacityThuSun} people per slot
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleOpenEditDefaults}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg font-medium hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        Edit Defaults
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Defaults Modal */}
      {editDefaultsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-master-text-primary-dark mb-4">Edit Default Capacity</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="modal-mon-wed" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                  Monday - Wednesday Capacity
                </label>
                <input
                  id="modal-mon-wed"
                  type="number"
                  min="0"
                  max="10"
                  value={tempCapacityMonWed === null ? '' : tempCapacityMonWed}
                  onChange={(e) => setTempCapacityMonWed(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                  className="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="modal-thu-sun" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                  Thursday - Sunday Capacity
                </label>
                <input
                  id="modal-thu-sun"
                  type="number"
                  min="0"
                  max="10"
                  value={tempCapacityThuSun === null ? '' : tempCapacityThuSun}
                  onChange={(e) => setTempCapacityThuSun(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                  className="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setEditDefaultsModalOpen(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-master-text-secondary-dark rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDefaults}
                disabled={updateSettingsMutation.isPending || tempCapacityMonWed === null || tempCapacityThuSun === null}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg font-medium hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Override Modal */}
      {editOverrideModalState && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-master-text-primary-dark mb-4">Edit Capacity Override</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="edit-date" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                  Date
                </label>
                <input
                  id="edit-date"
                  type="date"
                  value={editOverrideModalState.override_date}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                      setEditOverrideModalState({ ...editOverrideModalState, override_date: value });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="edit-capacity" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                  Capacity
                </label>
                <input
                  id="edit-capacity"
                  type="number"
                  min="0"
                  max="10"
                  value={editOverrideModalState.capacity}
                  onChange={(e) => setEditOverrideModalState({ ...editOverrideModalState, capacity: parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-red-100 transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setEditOverrideModalState(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-master-text-secondary-dark rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditOverride}
                disabled={updateOverrideMutation.isPending}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg font-medium hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateOverrideMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteOverrideConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-master-text-primary-dark">Remove Capacity Override?</h3>
              </div>
            </div>
            
            <p className="text-master-text-secondary-dark mb-2">
              Are you sure you want to remove the capacity override for{' '}
              <span className="font-semibold">{formatDate(deleteOverrideConfirmation.override_date)}</span>?
            </p>
            
            <p className="text-master-text-secondary-dark text-sm mb-6">
              Capacity will return to default:{' '}
              <span className="font-semibold">
                {getDefaultCapacityForDate(deleteOverrideConfirmation.override_date)} people per slot
              </span>
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteOverrideConfirmation(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-master-text-secondary-dark rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteOverrideMutation.isPending}
                className="flex-1 px-6 py-3 bg-red-600 text-master-text-primary-dark rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteOverrideMutation.isPending ? 'Removing...' : 'Remove Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Warning Modal */}
      {bookingWarning && bookingWarning.show && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-master-text-primary-dark">Capacity Warning</h3>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 font-semibold">
                Warning: {bookingWarning.count} bookings already scheduled for this date exceed new capacity {bookingWarning.capacity}.
              </p>
              <p className="text-yellow-300 text-sm mt-2">
                Existing bookings will be kept but no new bookings will be accepted.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setBookingWarning(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-master-text-secondary-dark rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedWithWarning}
                className="flex-1 px-6 py-3 bg-yellow-600 text-master-text-primary-dark rounded-lg font-medium hover:bg-yellow-700 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-200"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminCapacitySettings;