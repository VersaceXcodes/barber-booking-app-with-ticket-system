import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Settings {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_email: string;
  operating_hours: string;
  capacity_mon_wed: number;
  capacity_thu_sun: number;
  booking_window_days: number;
  same_day_cutoff_hours: number;
  reminder_hours_before: number;
  email_confirmation_enabled: boolean;
  email_reminder_enabled: boolean;
  sms_enabled: boolean;
  email_sender_name: string;
  email_sender_address: string;
  sms_sender_name: string;
  cancellation_policy_text: string;
  updated_at?: string;
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
  is_callout: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceFormData {
  service_id: string | null;
  name: string;
  description: string;
  image_url: string | null;
  duration: number;
  price: number | null;
  is_active: boolean;
  display_order: number;
  is_callout: boolean;
}

type SectionType = 'shop' | 'booking' | 'notifications' | 'services';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminSettings: React.FC = () => {
  // ======================================================================
  // GLOBAL STATE (Zustand) - CRITICAL: Individual selectors only!
  // ======================================================================
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateAppSettings = useAppStore(state => state.update_app_settings);

  // ======================================================================
  // URL PARAMS & NAVIGATION
  // ======================================================================
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') as SectionType | null;
  const [activeSection, setActiveSection] = useState<SectionType>(
    sectionParam && ['shop', 'booking', 'notifications', 'services'].includes(sectionParam)
      ? sectionParam
      : 'shop'
  );

  // ======================================================================
  // LOCAL STATE
  // ======================================================================
  const [settingsData, setSettingsData] = useState<Settings | null>(null);
  const [formData, setFormData] = useState<Settings>({
    shop_name: '',
    shop_address: '',
    shop_phone: '',
    shop_email: '',
    operating_hours: '',
    capacity_mon_wed: 2,
    capacity_thu_sun: 3,
    booking_window_days: 90,
    same_day_cutoff_hours: 2,
    reminder_hours_before: 2,
    email_confirmation_enabled: true,
    email_reminder_enabled: true,
    sms_enabled: false,
    email_sender_name: '',
    email_sender_address: '',
    sms_sender_name: '',
    cancellation_policy_text: '',
  });

  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [serviceFormData, setServiceFormData] = useState<ServiceFormData>({
    service_id: null,
    name: '',
    description: '',
    image_url: null,
    duration: 40,
    price: null,
    is_active: true,
    display_order: 0,
  });
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceModalMode, setServiceModalMode] = useState<'add' | 'edit'>('add');
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmService, setDeleteConfirmService] = useState<Service | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testSmsRecipient, setTestSmsRecipient] = useState('');

  // ======================================================================
  // REACT QUERY CLIENT
  // ======================================================================
  const queryClient = useQueryClient();

  // ======================================================================
  // API BASE URL
  // ======================================================================
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ======================================================================
  // FETCH SETTINGS
  // ======================================================================
  const {
    data: fetchedSettings,
    isLoading: loadingSettings,
    error: settingsError,
  } = useQuery<Settings>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      try {
        console.log('[Settings] Fetching from:', `${API_BASE_URL}/api/admin/settings`);
        console.log('[Settings] Auth token:', authToken ? 'Present' : 'Missing');
        const response = await axios.get(`${API_BASE_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        console.log('[Settings] Fetched successfully:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('[Settings] Fetch error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    },
    enabled: !!authToken,
    staleTime: 60000,
  });

  // Initialize form data when settings are fetched
  useEffect(() => {
    if (fetchedSettings) {
      setSettingsData(fetchedSettings);
      setFormData({ ...fetchedSettings });
      setHasUnsavedChanges(false);
    }
  }, [fetchedSettings]);

  // ======================================================================
  // FETCH SERVICES
  // ======================================================================
  const {
    data: fetchedServices,
    isLoading: loadingServices,
  } = useQuery<Service[]>({
    queryKey: ['admin-services'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/services`, {
        params: { sort_by: 'display_order', sort_order: 'asc' },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data.services || [];
    },
    enabled: !!authToken && activeSection === 'services',
    staleTime: 60000,
  });

  useEffect(() => {
    if (fetchedServices) {
      setServicesList(fetchedServices);
    }
  }, [fetchedServices]);

  // ======================================================================
  // UPDATE SETTINGS MUTATION
  // ======================================================================
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const response = await axios.patch(`${API_BASE_URL}/api/admin/settings`, data, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    onSuccess: (updatedSettings) => {
      setSettingsData(updatedSettings);
      setFormData({ ...updatedSettings });
      setHasUnsavedChanges(false);
      setSuccessMessage('Settings saved successfully!');
      setErrorMessage(null);
      
      // Update global app settings
      updateAppSettings({
        shop_name: updatedSettings.shop_name,
        shop_address: updatedSettings.shop_address,
        shop_phone: updatedSettings.shop_phone,
        shop_email: updatedSettings.shop_email,
        operating_hours: updatedSettings.operating_hours,
        capacity_mon_wed: updatedSettings.capacity_mon_wed,
        capacity_thu_sun: updatedSettings.capacity_thu_sun,
        booking_window_days: updatedSettings.booking_window_days,
        same_day_cutoff_hours: updatedSettings.same_day_cutoff_hours,
        reminder_hours_before: updatedSettings.reminder_hours_before,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to save settings';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // ======================================================================
  // CREATE SERVICE MUTATION
  // ======================================================================
  const createServiceMutation = useMutation({
    mutationFn: async (data: Omit<ServiceFormData, 'service_id' | 'display_order'>) => {
      const response = await axios.post(`${API_BASE_URL}/api/admin/services`, data, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    onSuccess: (newService) => {
      setServicesList([...servicesList, newService]);
      setShowServiceModal(false);
      setSuccessMessage('Service created successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to create service';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // ======================================================================
  // UPDATE SERVICE MUTATION
  // ======================================================================
  const updateServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const { service_id, ...updateData } = data;
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/services/${service_id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: (updatedService) => {
      setServicesList(
        servicesList.map((s) => (s.service_id === updatedService.service_id ? updatedService : s))
      );
      setShowServiceModal(false);
      setSuccessMessage('Service updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to update service';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // ======================================================================
  // DELETE SERVICE MUTATION
  // ======================================================================
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      await axios.delete(`${API_BASE_URL}/api/admin/services/${serviceId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return serviceId;
    },
    onSuccess: (deletedId) => {
      setServicesList(servicesList.filter((s) => s.service_id !== deletedId));
      setDeleteConfirmService(null);
      setSuccessMessage('Service deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to delete service';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // ======================================================================
  // TEST EMAIL MUTATION
  // ======================================================================
  const testEmailMutation = useMutation({
    mutationFn: async (recipient: string) => {
      await axios.post(
        `${API_BASE_URL}/api/admin/notifications/test`,
        { type: 'email', recipient },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    },
    onSuccess: () => {
      setSuccessMessage('Test email sent successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to send test email';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // ======================================================================
  // TEST SMS MUTATION
  // ======================================================================
  const testSmsMutation = useMutation({
    mutationFn: async (recipient: string) => {
      await axios.post(
        `${API_BASE_URL}/api/admin/notifications/test`,
        { type: 'sms', recipient },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    },
    onSuccess: () => {
      setSuccessMessage('Test SMS sent successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to send test SMS';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // ======================================================================
  // EVENT HANDLERS
  // ======================================================================

  const handleSectionSwitch = useCallback((section: SectionType) => {
    setActiveSection(section);
    setSearchParams({ section });
  }, [setSearchParams]);

  const handleFormChange = useCallback((field: keyof Settings, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      return updated;
    });
    setHasUnsavedChanges(true);
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const handleSaveSettings = useCallback(() => {
    // Basic validation
    const errors: Record<string, string> = {};
    if (!formData.shop_name || formData.shop_name.trim().length === 0) {
      errors.shop_name = 'Shop name is required';
    }
    if (!formData.shop_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.shop_email)) {
      errors.shop_email = 'Valid email is required';
    }
    if (formData.capacity_mon_wed < 0) {
      errors.capacity_mon_wed = 'Capacity cannot be negative';
    }
    if (formData.capacity_thu_sun < 0) {
      errors.capacity_thu_sun = 'Capacity cannot be negative';
    }
    if (formData.booking_window_days < 1) {
      errors.booking_window_days = 'Booking window must be at least 1 day';
    }
    if (formData.same_day_cutoff_hours < 0) {
      errors.same_day_cutoff_hours = 'Cutoff hours cannot be negative';
    }
    if (formData.reminder_hours_before < 1 || formData.reminder_hours_before > 24) {
      errors.reminder_hours_before = 'Reminder hours must be between 1 and 24';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMessage('Please fix validation errors before saving');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    setValidationErrors({});
    updateSettingsMutation.mutate(formData);
  }, [formData, updateSettingsMutation]);

  const handleCancelChanges = useCallback(() => {
    if (settingsData) {
      setFormData({ ...settingsData });
      setHasUnsavedChanges(false);
      setValidationErrors({});
    }
  }, [settingsData]);

  const handleOpenServiceModal = useCallback((mode: 'add' | 'edit', service?: Service) => {
    setServiceModalMode(mode);
    setUploadedImageFile(null);
    setImagePreviewUrl(null);
    setImageInputMode('upload');
    
    if (mode === 'add') {
      setServiceFormData({
        service_id: null,
        name: '',
        description: '',
        image_url: null,
        duration: 40,
        price: null,
        is_active: true,
        display_order: servicesList.length,
        is_callout: false,
      });
    } else if (service) {
      setServiceFormData({
        service_id: service.service_id,
        name: service.name,
        description: service.description,
        image_url: service.image_url,
        duration: service.duration,
        price: service.price,
        is_active: service.is_active,
        display_order: service.display_order,
        is_callout: service.is_callout,
      });
      // If editing and has existing image, set preview
      if (service.image_url) {
        setImagePreviewUrl(service.image_url);
      }
    }
    setShowServiceModal(true);
  }, [servicesList.length]);

  const handleSaveService = useCallback(() => {
    // Validate service form
    const errors: Record<string, string> = {};
    if (!serviceFormData.name || serviceFormData.name.trim().length === 0) {
      errors.name = 'Service name is required';
    }
    if (!serviceFormData.description || serviceFormData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }
    if (serviceFormData.description && serviceFormData.description.length > 500) {
      errors.description = 'Description must not exceed 500 characters';
    }
    if (serviceFormData.duration < 1) {
      errors.duration = 'Duration must be positive';
    }
    if (serviceFormData.price !== null && serviceFormData.price < 0) {
      errors.price = 'Price cannot be negative';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    if (serviceModalMode === 'add') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { service_id, display_order, ...createData } = serviceFormData;
      createServiceMutation.mutate(createData);
    } else {
      updateServiceMutation.mutate(serviceFormData);
    }
  }, [serviceFormData, serviceModalMode, createServiceMutation, updateServiceMutation]);

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size must be less than 5MB.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    setUploadedImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the image immediately
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(`${API_BASE_URL}/api/admin/upload/service-image`, formData, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.imageUrl) {
        setServiceFormData({ ...serviceFormData, image_url: response.data.imageUrl });
        setSuccessMessage('Image uploaded successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to upload image');
      setTimeout(() => setErrorMessage(null), 5000);
      setUploadedImageFile(null);
      setImagePreviewUrl(null);
    } finally {
      setUploadingImage(false);
    }
  }, [authToken, API_BASE_URL, serviceFormData]);

  const handleRemoveImage = useCallback(() => {
    setUploadedImageFile(null);
    setImagePreviewUrl(null);
    setServiceFormData({ ...serviceFormData, image_url: null });
  }, [serviceFormData]);

  const handleDeleteService = useCallback((service: Service) => {
    setDeleteConfirmService(service);
  }, []);

  const confirmDeleteService = useCallback(() => {
    if (deleteConfirmService) {
      deleteServiceMutation.mutate(deleteConfirmService.service_id);
    }
  }, [deleteConfirmService, deleteServiceMutation]);

  const handleDragStart = useCallback((serviceId: string) => {
    setDraggedServiceId(serviceId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetServiceId: string) => {
    e.preventDefault();
    if (!draggedServiceId || draggedServiceId === targetServiceId) return;

    const draggedIndex = servicesList.findIndex((s) => s.service_id === draggedServiceId);
    const targetIndex = servicesList.findIndex((s) => s.service_id === targetServiceId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newList = [...servicesList];
    const [draggedItem] = newList.splice(draggedIndex, 1);
    newList.splice(targetIndex, 0, draggedItem);

    // Update display_order
    const updatedList = newList.map((service, index) => ({
      ...service,
      display_order: index,
    }));

    setServicesList(updatedList);
  }, [draggedServiceId, servicesList]);

  const handleDragEnd = useCallback(() => {
    setDraggedServiceId(null);
    // In a real implementation, send reorder request to backend
    // For now, just update local state
  }, []);

  const handleTestEmail = useCallback(() => {
    const recipient = testEmailRecipient || formData.email_sender_address;
    if (!recipient) {
      setErrorMessage('Please enter a recipient email address');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    testEmailMutation.mutate(recipient);
  }, [testEmailRecipient, formData.email_sender_address, testEmailMutation]);

  const handleTestSms = useCallback(() => {
    if (!testSmsRecipient) {
      setErrorMessage('Please enter a recipient phone number');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    testSmsMutation.mutate(testSmsRecipient);
  }, [testSmsRecipient, testSmsMutation]);

  // ======================================================================
  // BEFOREUNLOAD WARNING
  // ======================================================================
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ======================================================================
  // LOADING STATE
  // ======================================================================
  if (loadingSettings) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
            <p className="mt-4 text-master-text-secondary-dark text-lg">Loading settings...</p>
          </div>
        </div>
      </>
    );
  }

  // ======================================================================
  // ERROR STATE
  // ======================================================================
  if (settingsError) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-4">
          <div className="max-w-md w-full bg-[#2D0808] rounded-lg shadow-lg p-8">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-master-text-primary-dark">Failed to Load Settings</h2>
              <p className="mt-2 text-master-text-secondary-dark">
                {(settingsError as any)?.response?.data?.message || (settingsError as any)?.message || 'An error occurred while loading settings'}
              </p>
              {(settingsError as any)?.response?.status === 403 && (
                <p className="mt-2 text-sm text-master-text-muted-dark">
                  You may not have permission to access settings. Please check your admin credentials.
                </p>
              )}
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-settings'] })}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ======================================================================
  // MAIN RENDER
  // ======================================================================
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
        {/* Header */}
        <div className="bg-[#2D0808] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-master-text-primary-dark">Settings</h1>
                <p className="mt-1 text-sm text-master-text-secondary-dark">
                  Manage your shop information, booking rules, and preferences
                </p>
              </div>
              <Link
                to="/admin"
                className="inline-flex items-center px-4 py-2 border border-white/20 rounded-lg text-sm font-medium text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-green-400 font-medium">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-red-400 font-medium">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-3">
              <nav className="space-y-1 bg-[#2D0808] rounded-lg shadow-sm border border-white/10 p-2 sticky top-4">
                <button
                  onClick={() => handleSectionSwitch('shop')}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === 'shop'
                      ? 'bg-[#2D0808] text-blue-700 border-l-4 border-red-600'
                      : 'text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Shop Information
                </button>

                <button
                  onClick={() => handleSectionSwitch('booking')}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === 'booking'
                      ? 'bg-[#2D0808] text-blue-700 border-l-4 border-red-600'
                      : 'text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Booking Settings
                </button>

                <button
                  onClick={() => handleSectionSwitch('notifications')}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === 'notifications'
                      ? 'bg-[#2D0808] text-blue-700 border-l-4 border-red-600'
                      : 'text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Notification Settings
                </button>

                <button
                  onClick={() => handleSectionSwitch('services')}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === 'services'
                      ? 'bg-[#2D0808] text-blue-700 border-l-4 border-red-600'
                      : 'text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Services
                </button>
              </nav>

              {hasUnsavedChanges && activeSection !== 'services' && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-amber-800 font-medium">You have unsaved changes</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="mt-8 lg:mt-0 lg:col-span-9">
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg shadow-sm border border-white/10 p-6 lg:p-8">
                {/* SHOP INFORMATION SECTION */}
                {activeSection === 'shop' && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-master-text-primary-dark mb-6">Shop Information</h2>
                      
                      <div className="space-y-6">
                        {/* Shop Name */}
                        <div>
                          <label htmlFor="shop_name" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Shop Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="shop_name"
                            value={formData.shop_name}
                            onChange={(e) => handleFormChange('shop_name', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                              validationErrors.shop_name ? 'border-red-500' : 'border-white/20'
                            }`}
                            placeholder="BarberSlot Premium Cuts"
                          />
                          {validationErrors.shop_name && (
                            <p className="mt-1 form-error-text">{validationErrors.shop_name}</p>
                          )}
                        </div>

                        {/* Address */}
                        <div>
                          <label htmlFor="shop_address" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Address
                          </label>
                          <textarea
                            id="shop_address"
                            rows={3}
                            value={formData.shop_address}
                            onChange={(e) => handleFormChange('shop_address', e.target.value)}
                            className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                            placeholder="123 Main St, City, State 12345"
                          />
                        </div>

                        {/* Phone and Email */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="shop_phone" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              id="shop_phone"
                              value={formData.shop_phone}
                              onChange={(e) => handleFormChange('shop_phone', e.target.value)}
                              className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                              placeholder="+1 (555) 123-4567"
                            />
                          </div>

                          <div>
                            <label htmlFor="shop_email" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                              Email <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="email"
                              id="shop_email"
                              value={formData.shop_email}
                              onChange={(e) => handleFormChange('shop_email', e.target.value)}
                              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                                validationErrors.shop_email ? 'border-red-500' : 'border-white/20'
                              }`}
                              placeholder="info@barberslot.com"
                            />
                            {validationErrors.shop_email && (
                              <p className="mt-1 form-error-text">{validationErrors.shop_email}</p>
                            )}
                          </div>
                        </div>

                        {/* Operating Hours */}
                        <div>
                          <label htmlFor="operating_hours" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Operating Hours
                          </label>
                          <textarea
                            id="operating_hours"
                            rows={3}
                            value={formData.operating_hours}
                            onChange={(e) => handleFormChange('operating_hours', e.target.value)}
                            className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                            placeholder="Monday - Friday: 9:00 AM - 7:00 PM&#10;Saturday: 10:00 AM - 6:00 PM&#10;Sunday: Closed"
                          />
                          <p className="mt-1 text-xs text-master-text-muted-dark">Display information only, not enforced by booking system</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-white/10">
                      <button
                        onClick={handleCancelChanges}
                        disabled={!hasUnsavedChanges}
                        className="px-6 py-3 border border-white/20 rounded-lg text-sm font-medium text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                      >
                        {updateSettingsMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* BOOKING SETTINGS SECTION */}
                {activeSection === 'booking' && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-master-text-primary-dark mb-6">Booking Settings</h2>
                      
                      <div className="space-y-8">
                        {/* Capacity Rules */}
                        <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-master-text-primary-dark mb-4">Capacity Rules</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="capacity_mon_wed" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                Monday - Wednesday Capacity
                              </label>
                              <input
                                type="number"
                                id="capacity_mon_wed"
                                min="0"
                                value={formData.capacity_mon_wed}
                                onChange={(e) => handleFormChange('capacity_mon_wed', parseInt(e.target.value) || 0)}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                                  validationErrors.capacity_mon_wed ? 'border-red-500' : 'border-white/20'
                                }`}
                              />
                              {validationErrors.capacity_mon_wed && (
                                <p className="mt-1 form-error-text">{validationErrors.capacity_mon_wed}</p>
                              )}
                            </div>

                            <div>
                              <label htmlFor="capacity_thu_sun" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                Thursday - Sunday Capacity
                              </label>
                              <input
                                type="number"
                                id="capacity_thu_sun"
                                min="0"
                                value={formData.capacity_thu_sun}
                                onChange={(e) => handleFormChange('capacity_thu_sun', parseInt(e.target.value) || 0)}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                                  validationErrors.capacity_thu_sun ? 'border-red-500' : 'border-white/20'
                                }`}
                              />
                              {validationErrors.capacity_thu_sun && (
                                <p className="mt-1 form-error-text">{validationErrors.capacity_thu_sun}</p>
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-master-text-secondary-dark">Maximum number of customers per time slot</p>
                        </div>

                        {/* Booking Window */}
                        <div>
                          <label htmlFor="booking_window_days" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Booking Window (days in advance)
                          </label>
                          <input
                            type="number"
                            id="booking_window_days"
                            min="1"
                            value={formData.booking_window_days}
                            onChange={(e) => handleFormChange('booking_window_days', parseInt(e.target.value) || 1)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                              validationErrors.booking_window_days ? 'border-red-500' : 'border-white/20'
                            }`}
                          />
                          {validationErrors.booking_window_days && (
                            <p className="mt-1 form-error-text">{validationErrors.booking_window_days}</p>
                          )}
                          <p className="mt-1 text-xs text-master-text-secondary-dark">Customers can book up to this many days in advance</p>
                        </div>

                        {/* Same-Day Cutoff */}
                        <div>
                          <label htmlFor="same_day_cutoff_hours" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Same-Day Booking Cutoff (hours)
                          </label>
                          <input
                            type="number"
                            id="same_day_cutoff_hours"
                            min="0"
                            value={formData.same_day_cutoff_hours}
                            onChange={(e) => handleFormChange('same_day_cutoff_hours', parseInt(e.target.value) || 0)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                              validationErrors.same_day_cutoff_hours ? 'border-red-500' : 'border-white/20'
                            }`}
                          />
                          {validationErrors.same_day_cutoff_hours && (
                            <p className="mt-1 form-error-text">{validationErrors.same_day_cutoff_hours}</p>
                          )}
                          <p className="mt-1 text-xs text-master-text-secondary-dark">Bookings must be made at least this many hours before the appointment</p>
                        </div>

                        {/* Cancellation Policy */}
                        <div>
                          <label htmlFor="cancellation_policy_text" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Cancellation Policy
                          </label>
                          <textarea
                            id="cancellation_policy_text"
                            rows={4}
                            value={formData.cancellation_policy_text}
                            onChange={(e) => handleFormChange('cancellation_policy_text', e.target.value)}
                            className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                            placeholder="You can cancel up to 2 hours before your appointment without penalty."
                          />
                          <p className="mt-1 text-xs text-master-text-secondary-dark">Displayed to customers during booking and in confirmation</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-white/10">
                      <button
                        onClick={handleCancelChanges}
                        disabled={!hasUnsavedChanges}
                        className="px-6 py-3 border border-white/20 rounded-lg text-sm font-medium text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                      >
                        {updateSettingsMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* NOTIFICATION SETTINGS SECTION */}
                {activeSection === 'notifications' && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-master-text-primary-dark mb-6">Notification Settings</h2>
                      
                      <div className="space-y-8">
                        {/* Email Notifications */}
                        <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-master-text-primary-dark mb-4">Email Notifications</h3>
                          
                          <div className="space-y-4">
                            {/* Toggles */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-master-text-secondary-dark">Enable booking confirmation email</span>
                              <button
                                onClick={() => handleFormChange('email_confirmation_enabled', !formData.email_confirmation_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  formData.email_confirmation_enabled ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-[#2D0808] transition-transform ${
                                    formData.email_confirmation_enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-master-text-secondary-dark">Enable booking reminder email</span>
                              <button
                                onClick={() => handleFormChange('email_reminder_enabled', !formData.email_reminder_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  formData.email_reminder_enabled ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-[#2D0808] transition-transform ${
                                    formData.email_reminder_enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Sender Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div>
                                <label htmlFor="email_sender_name" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                  Sender Name
                                </label>
                                <input
                                  type="text"
                                  id="email_sender_name"
                                  value={formData.email_sender_name}
                                  onChange={(e) => handleFormChange('email_sender_name', e.target.value)}
                                  className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                                  placeholder="BarberSlot"
                                />
                              </div>

                              <div>
                                <label htmlFor="email_sender_address" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                  Sender Email
                                </label>
                                <input
                                  type="email"
                                  id="email_sender_address"
                                  value={formData.email_sender_address}
                                  onChange={(e) => handleFormChange('email_sender_address', e.target.value)}
                                  className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                                  placeholder="noreply@barberslot.com"
                                />
                              </div>
                            </div>

                            {/* Test Email */}
                            <div className="flex items-end space-x-3 mt-4 pt-4 border-t border-white/10">
                              <div className="flex-1">
                                <label htmlFor="test_email_recipient" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                  Test Recipient
                                </label>
                                <input
                                  type="email"
                                  id="test_email_recipient"
                                  value={testEmailRecipient}
                                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                                  className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                                  placeholder={formData.email_sender_address || "recipient@example.com"}
                                />
                              </div>
                              <button
                                onClick={handleTestEmail}
                                disabled={testEmailMutation.isPending}
                                className="px-6 py-3 bg-gray-600 text-master-text-primary-dark rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                              >
                                {testEmailMutation.isPending ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                  </>
                                ) : (
                                  'Send Test Email'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* SMS Notifications */}
                        <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-master-text-primary-dark mb-4">SMS Notifications</h3>
                          
                          <div className="space-y-4">
                            {/* Master Toggle */}
                            <div className="flex items-center justify-between pb-4 border-b border-white/10">
                              <span className="text-sm font-medium text-master-text-secondary-dark">Enable SMS notifications</span>
                              <button
                                onClick={() => handleFormChange('sms_enabled', !formData.sms_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  formData.sms_enabled ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-[#2D0808] transition-transform ${
                                    formData.sms_enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>

                            {formData.sms_enabled && (
                              <>
                                {/* SMS Sender */}
                                <div>
                                  <label htmlFor="sms_sender_name" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                    SMS Sender Name
                                  </label>
                                  <input
                                    type="text"
                                    id="sms_sender_name"
                                    value={formData.sms_sender_name}
                                    onChange={(e) => handleFormChange('sms_sender_name', e.target.value)}
                                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                                    placeholder="BarberSlot"
                                  />
                                </div>

                                {/* Test SMS */}
                                <div className="flex items-end space-x-3 mt-4 pt-4 border-t border-white/10">
                                  <div className="flex-1">
                                    <label htmlFor="test_sms_recipient" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                                      Test Recipient Phone
                                    </label>
                                    <input
                                      type="tel"
                                      id="test_sms_recipient"
                                      value={testSmsRecipient}
                                      onChange={(e) => setTestSmsRecipient(e.target.value)}
                                      className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                                      placeholder="+1 (555) 123-4567"
                                    />
                                  </div>
                                  <button
                                    onClick={handleTestSms}
                                    disabled={testSmsMutation.isPending}
                                    className="px-6 py-3 bg-gray-600 text-master-text-primary-dark rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                                  >
                                    {testSmsMutation.isPending ? (
                                      <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                      </>
                                    ) : (
                                      'Send Test SMS'
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Reminder Timing */}
                        <div>
                          <label htmlFor="reminder_hours_before" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                            Send reminder (hours before appointment)
                          </label>
                          <input
                            type="number"
                            id="reminder_hours_before"
                            min="1"
                            max="24"
                            value={formData.reminder_hours_before}
                            onChange={(e) => handleFormChange('reminder_hours_before', parseInt(e.target.value) || 2)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                              validationErrors.reminder_hours_before ? 'border-red-500' : 'border-white/20'
                            }`}
                          />
                          {validationErrors.reminder_hours_before && (
                            <p className="mt-1 form-error-text">{validationErrors.reminder_hours_before}</p>
                          )}
                          <p className="mt-1 text-xs text-master-text-secondary-dark">Reminder will be sent this many hours before the appointment (1-24)</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-white/10">
                      <button
                        onClick={handleCancelChanges}
                        disabled={!hasUnsavedChanges}
                        className="px-6 py-3 border border-white/20 rounded-lg text-sm font-medium text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                      >
                        {updateSettingsMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* SERVICES SECTION */}
                {activeSection === 'services' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-master-text-primary-dark">Services</h2>
                      <button
                        onClick={() => handleOpenServiceModal('add')}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 transition-colors inline-flex items-center"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New Service
                      </button>
                    </div>

                    {loadingServices ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600 mx-auto"></div>
                        <p className="mt-4 text-master-text-secondary-dark">Loading services...</p>
                      </div>
                    ) : servicesList.length === 0 ? (
                      <div className="text-center py-12 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg border-2 border-dashed border-white/20">
                        <svg className="mx-auto h-12 w-12 text-master-text-muted-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="mt-4 text-lg font-medium text-master-text-primary-dark">No services yet</h3>
                        <p className="mt-2 text-master-text-secondary-dark">Get started by creating your first service</p>
                        <button
                          onClick={() => handleOpenServiceModal('add')}
                          className="mt-4 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 transition-colors"
                        >
                          Create First Service
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {servicesList.map((service) => (
                          <div
                            key={service.service_id}
                            draggable
                            onDragStart={() => handleDragStart(service.service_id)}
                            onDragOver={(e) => handleDragOver(e, service.service_id)}
                            onDragEnd={handleDragEnd}
                            className="bg-[#2D0808] border border-white/10 rounded-lg p-4 hover:shadow-md transition-shadow cursor-move"
                          >
                            <div className="flex items-center">
                              {/* Drag Handle */}
                              <div className="flex-shrink-0 mr-4 text-master-text-muted-dark cursor-grab active:cursor-grabbing">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
                                </svg>
                              </div>

                              {/* Service Image */}
                              {(() => {
                                // Helper function to get tailored image based on service name
                                const getServiceImage = (serviceName: string, imageUrl: string | null) => {
                                  if (imageUrl) return imageUrl;
                                  
                                  // Tailored placeholder images based on service category
                                  const lowerName = serviceName.toLowerCase();
                                  
                                  if (lowerName.includes('fade') || lowerName.includes('taper')) {
                                    return 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('beard') || lowerName.includes('shave')) {
                                    return 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('buzz') || lowerName.includes('crew')) {
                                    return 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('kid') || lowerName.includes('child')) {
                                    return 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('design') || lowerName.includes('pattern') || lowerName.includes('line')) {
                                    return 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('wash') || lowerName.includes('treatment') || lowerName.includes('scalp')) {
                                    return 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('color') || lowerName.includes('dye')) {
                                    return 'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('styling') || lowerName.includes('style')) {
                                    return 'https://images.unsplash.com/photo-1534620808146-d33bb39128b2?w=200&h=200&fit=crop';
                                  } else if (lowerName.includes('trim') || lowerName.includes('cut')) {
                                    return 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&h=200&fit=crop';
                                  } else {
                                    // Default barbershop image
                                    return 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200&h=200&fit=crop';
                                  }
                                };
                                
                                const displayImage = getServiceImage(service.name, service.image_url);
                                
                                return (
                                  <img
                                    src={displayImage}
                                    alt={service.name}
                                    className="w-16 h-16 rounded-lg object-cover mr-4"
                                  />
                                );
                              })()}

                              {/* Service Info */}
                              <div className="flex-1">
                                <h4 className="text-lg font-semibold text-master-text-primary-dark">{service.name}</h4>
                                <p className="text-sm text-master-text-secondary-dark line-clamp-2">{service.description}</p>
                                <div className="flex items-center mt-2 space-x-4 text-sm text-master-text-muted-dark">
                                  <span>{service.duration} min</span>
                                  {service.price !== null && (
                                    <span>${typeof service.price === 'number' ? service.price.toFixed(2) : parseFloat(String(service.price)).toFixed(2)}</span>
                                  )}
                                </div>
                              </div>

                              {/* Active Toggle */}
                              <div className="flex items-center space-x-2 mr-4">
                                <span className="text-sm text-master-text-secondary-dark">Active</span>
                                <div
                                  className={`w-10 h-6 rounded-full transition-colors ${
                                    service.is_active ? 'bg-green-500' : 'bg-gray-300'
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 mt-1 rounded-full bg-[#2D0808] transition-transform ${
                                      service.is_active ? 'ml-5' : 'ml-1'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleOpenServiceModal('edit', service)}
                                  className="p-2 text-amber-400 hover:bg-[#2D0808] rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteService(service)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SERVICE MODAL */}
        {showServiceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-xl font-bold text-master-text-primary-dark">
                  {serviceModalMode === 'add' ? 'Add New Service' : 'Edit Service'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                {/* Service Name */}
                <div>
                  <label htmlFor="service_name" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="service_name"
                    value={serviceFormData.name}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                      validationErrors.name ? 'border-red-500' : 'border-white/20'
                    }`}
                    placeholder="Haircut"
                  />
                  {validationErrors.name && (
                    <p className="mt-1 form-error-text">{validationErrors.name}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="service_description" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="service_description"
                    rows={4}
                    value={serviceFormData.description}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors ${
                      validationErrors.description ? 'border-red-500' : 'border-white/20'
                    }`}
                    placeholder="Professional haircut service..."
                  />
                  <p className="mt-1 text-xs text-master-text-muted-dark">
                    {serviceFormData.description.length}/500 characters
                  </p>
                  {validationErrors.description && (
                    <p className="mt-1 form-error-text">{validationErrors.description}</p>
                  )}
                </div>

                {/* Duration and Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="service_duration" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      id="service_duration"
                      min="1"
                      value={serviceFormData.duration}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, duration: parseInt(e.target.value) || 40 })}
                      className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="service_price" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                      Price (optional)
                    </label>
                    <input
                      type="number"
                      id="service_price"
                      min="0"
                      step="0.01"
                      value={serviceFormData.price || ''}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, price: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                      placeholder="25.00"
                    />
                  </div>
                </div>

                {/* Image Upload / URL */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-master-text-secondary-dark">
                      Service Image (optional)
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setImageInputMode('upload')}
                        className={`text-xs px-3 py-1 rounded ${
                          imageInputMode === 'upload'
                            ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark'
                            : 'bg-gray-200 text-master-text-secondary-dark hover:bg-gray-300'
                        }`}
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('url')}
                        className={`text-xs px-3 py-1 rounded ${
                          imageInputMode === 'url'
                            ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark'
                            : 'bg-gray-200 text-master-text-secondary-dark hover:bg-gray-300'
                        }`}
                      >
                        URL
                      </button>
                    </div>
                  </div>

                  {imageInputMode === 'upload' ? (
                    <div>
                      {/* Image Preview */}
                      {imagePreviewUrl && (
                        <div className="mb-3 relative">
                          <img
                            src={imagePreviewUrl.startsWith('/') ? `${API_BASE_URL}${imagePreviewUrl}` : imagePreviewUrl}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg border border-white/20"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 bg-red-600 text-master-text-primary-dark p-2 rounded-full hover:bg-red-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* File Upload Input */}
                      {!imagePreviewUrl && (
                        <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                          <input
                            type="file"
                            id="service_image_file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleImageFileChange}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                          <label
                            htmlFor="service_image_file"
                            className="cursor-pointer flex flex-col items-center"
                          >
                            {uploadingImage ? (
                              <>
                                <svg className="animate-spin h-10 w-10 text-amber-400 mb-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-sm text-master-text-secondary-dark">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-10 h-10 text-master-text-muted-dark mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-sm font-medium text-master-text-secondary-dark mb-1">
                                  Click to upload or drag and drop
                                </span>
                                <span className="text-xs text-master-text-muted-dark">
                                  JPEG, PNG, GIF, WebP (max 5MB)
                                </span>
                              </>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="url"
                      id="service_image_url"
                      value={serviceFormData.image_url || ''}
                      onChange={(e) => {
                        setServiceFormData({ ...serviceFormData, image_url: e.target.value || null });
                        setImagePreviewUrl(e.target.value || null);
                      }}
                      className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500 transition-colors"
                      placeholder="https://example.com/image.jpg"
                    />
                  )}
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between py-3 border-t border-white/10">
                  <span className="text-sm font-medium text-master-text-secondary-dark">Service is active</span>
                  <button
                    onClick={() => setServiceFormData({ ...serviceFormData, is_active: !serviceFormData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      serviceFormData.is_active ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-[#2D0808] transition-transform ${
                        serviceFormData.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Call-Out Service Toggle */}
                <div className="flex items-center justify-between py-3 border-t border-white/10">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-master-text-secondary-dark">Call-Out Service (Premium)</span>
                    <div className="group relative">
                      <svg className="w-4 h-4 text-master-text-muted-dark cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-master-text-primary-dark text-xs rounded shadow-lg z-10">
                        Enable this for mobile/at-home services where the barber travels to the customer's location
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setServiceFormData({ ...serviceFormData, is_callout: !serviceFormData.is_callout })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      serviceFormData.is_callout ? 'bg-orange-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-[#2D0808] transition-transform ${
                        serviceFormData.is_callout ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowServiceModal(false);
                    setValidationErrors({});
                    setUploadedImageFile(null);
                    setImagePreviewUrl(null);
                  }}
                  className="px-6 py-3 border border-white/20 rounded-lg text-sm font-medium text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveService}
                  disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                >
                  {(createServiceMutation.isPending || updateServiceMutation.isPending) ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Service'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {deleteConfirmService && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-xl font-bold text-master-text-primary-dark">Delete Service?</h3>
                </div>
                
                <p className="text-master-text-secondary-dark mb-2">
                  Are you sure you want to delete <strong>{deleteConfirmService.name}</strong>?
                </p>
                <p className="text-sm text-master-text-muted-dark">
                  Existing bookings will retain this service for records.
                </p>
              </div>

              <div className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
                <button
                  onClick={() => setDeleteConfirmService(null)}
                  className="px-6 py-2 border border-white/20 rounded-lg text-sm font-medium text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteService}
                  disabled={deleteServiceMutation.isPending}
                  className="px-6 py-2 bg-red-600 text-master-text-primary-dark rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                >
                  {deleteServiceMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-master-text-primary-dark" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_AdminSettings;