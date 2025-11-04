import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SummaryStats {
  total_bookings: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  show_up_rate: number;
  cancellation_rate: number;
  total_revenue: number | null;
}

interface ServiceBreakdown {
  service_name: string;
  count: number;
  percentage: number;
}

interface DayBreakdown {
  day: string;
  count: number;
  average: number;
}

interface TimeSlotBreakdown {
  time: string;
  count: number;
  utilization: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

interface ReportData {
  total_bookings: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  show_up_rate: number;
  total_revenue: number | null;
  by_service: Array<{ service_name: string; count: number }>;
  by_day_of_week: Array<{ day: string; count: number }>;
  by_time_slot: Array<{ time: string; count: number; total_capacity?: number }>;
}

interface ExportConfig {
  include_fields: string[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const calculatePresetRange = (preset: string): { start_date: string; end_date: string } => {
  const today = new Date();
  
  switch(preset) {
    case 'today':
      return { start_date: formatDate(today), end_date: formatDate(today) };
    
    case 'this_week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return { start_date: formatDate(weekStart), end_date: formatDate(today) };
    
    case 'this_month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: formatDate(monthStart), end_date: formatDate(today) };
    
    default:
      return { start_date: formatDate(today), end_date: formatDate(today) };
  }
};

const calculateDateRangeDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminReports: React.FC = () => {
  // URL Params
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global State - CRITICAL: Individual selectors only!
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const shopName = useAppStore(state => state.app_settings.shop_name);
  
  // API Base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  // Initialize state from URL params
  const urlPreset = searchParams.get('preset');
  const urlStartDate = searchParams.get('start_date');
  const urlEndDate = searchParams.get('end_date');
  const urlGroupBy = searchParams.get('group_by') || 'service';
  
  // Calculate initial date range
  const initialRange = useMemo(() => {
    if (urlStartDate && urlEndDate) {
      return { start_date: urlStartDate, end_date: urlEndDate, preset: 'custom' };
    }
    const preset = urlPreset || 'today';
    const range = calculatePresetRange(preset);
    return { ...range, preset };
  }, [urlStartDate, urlEndDate, urlPreset]);
  
  // Local State
  const [dateRange, setDateRange] = useState(initialRange);
  const [customStartDate, setCustomStartDate] = useState(initialRange.start_date);
  const [customEndDate, setCustomEndDate] = useState(initialRange.end_date);
  const [groupBy, setGroupBy] = useState<string>(urlGroupBy);
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    include_fields: ['ticket_number', 'customer_name', 'appointment_date', 'appointment_time', 'service_name', 'status', 'special_request'],
    date_range: {
      start_date: dateRange.start_date,
      end_date: dateRange.end_date,
    },
  });
  
  // Update export config when date range changes
  useEffect(() => {
    setExportConfig(prev => ({
      ...prev,
      date_range: {
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
      },
    }));
  }, [dateRange]);
  
  // Fetch Report Data
  const { data: reportData, isLoading: loadingReport, error: reportError, refetch } = useQuery<ReportData>({
    queryKey: ['admin-reports', dateRange.start_date, dateRange.end_date, groupBy, serviceFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        group_by: groupBy,
      });
      
      if (serviceFilter) params.append('service_id', serviceFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await axios.get(
        `${apiBaseUrl}/api/admin/reports/bookings?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    enabled: !!authToken && !!dateRange.start_date && !!dateRange.end_date,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  
  // Transform Report Data
  const summaryStats: SummaryStats = useMemo(() => {
    if (!reportData) {
      return {
        total_bookings: 0,
        completed: 0,
        cancelled: 0,
        no_shows: 0,
        show_up_rate: 0,
        cancellation_rate: 0,
        total_revenue: null,
      };
    }
    
    const total = reportData.total_bookings || 0;
    const completed = reportData.completed || 0;
    const cancelled = reportData.cancelled || 0;
    const noShows = reportData.no_shows || 0;
    
    const showUpRate = (completed + noShows) > 0 
      ? (completed / (completed + noShows)) * 100 
      : 0;
    
    const cancellationRate = total > 0 
      ? (cancelled / total) * 100 
      : 0;
    
    return {
      total_bookings: total,
      completed: completed,
      cancelled: cancelled,
      no_shows: noShows,
      show_up_rate: showUpRate,
      cancellation_rate: cancellationRate,
      total_revenue: reportData.total_revenue || null,
    };
  }, [reportData]);
  
  const breakdownByService: ServiceBreakdown[] = useMemo(() => {
    if (!reportData?.by_service || summaryStats.total_bookings === 0) return [];
    
    return reportData.by_service.map(item => ({
      service_name: item.service_name,
      count: item.count,
      percentage: (item.count / summaryStats.total_bookings) * 100,
    }));
  }, [reportData, summaryStats.total_bookings]);
  
  const breakdownByDayOfWeek: DayBreakdown[] = useMemo(() => {
    if (!reportData?.by_day_of_week) return [];
    
    const days = calculateDateRangeDays(dateRange.start_date, dateRange.end_date);
    
    return reportData.by_day_of_week.map(item => ({
      day: item.day,
      count: item.count,
      average: days > 0 ? item.count / Math.ceil(days / 7) : 0,
    }));
  }, [reportData, dateRange]);
  
  const breakdownByTimeSlot: TimeSlotBreakdown[] = useMemo(() => {
    if (!reportData?.by_time_slot) return [];
    
    return reportData.by_time_slot.map(item => ({
      time: item.time,
      count: item.count,
      utilization: item.total_capacity && item.total_capacity > 0 
        ? (item.count / item.total_capacity) * 100 
        : 0,
    }));
  }, [reportData]);
  
  const breakdownByStatus: StatusBreakdown[] = useMemo(() => {
    if (!reportData || summaryStats.total_bookings === 0) return [];
    
    return [
      {
        status: 'Completed',
        count: summaryStats.completed,
        percentage: (summaryStats.completed / summaryStats.total_bookings) * 100,
      },
      {
        status: 'Cancelled',
        count: summaryStats.cancelled,
        percentage: (summaryStats.cancelled / summaryStats.total_bookings) * 100,
      },
      {
        status: 'No-show',
        count: summaryStats.no_shows,
        percentage: (summaryStats.no_shows / summaryStats.total_bookings) * 100,
      },
    ].filter(item => item.count > 0);
  }, [summaryStats]);
  
  // Export CSV Mutation
  const exportMutation = useMutation({
    mutationFn: async (config: ExportConfig) => {
      const params = new URLSearchParams({
        start_date: config.date_range.start_date,
        end_date: config.date_range.end_date,
        fields: config.include_fields.join(','),
        format: 'csv',
      });
      
      const response = await axios.get(
        `${apiBaseUrl}/api/admin/reports/export?${params}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          responseType: 'blob',
        }
      );
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookings_report_${config.date_range.start_date}_${config.date_range.end_date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
  
  // Event Handlers
  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setDateRange({ start_date: customStartDate, end_date: customEndDate, preset: 'custom' });
    } else {
      const range = calculatePresetRange(preset);
      setDateRange({ ...range, preset });
      setCustomStartDate(range.start_date);
      setCustomEndDate(range.end_date);
    }
  };
  
  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate) {
      setDateRange({ start_date: customStartDate, end_date: customEndDate, preset: 'custom' });
    }
  };
  
  const handleGenerateReport = () => {
    refetch();
  };
  
  const handleExportCSV = () => {
    exportMutation.mutate(exportConfig);
    setShowExportModal(false);
  };
  
  const handleFieldToggle = (field: string) => {
    setExportConfig(prev => ({
      ...prev,
      include_fields: prev.include_fields.includes(field)
        ? prev.include_fields.filter(f => f !== field)
        : [...prev.include_fields, field],
    }));
  };
  
  // Available Export Fields
  const availableFields = [
    { value: 'ticket_number', label: 'Ticket Number' },
    { value: 'customer_name', label: 'Customer Name' },
    { value: 'customer_email', label: 'Customer Email' },
    { value: 'customer_phone', label: 'Customer Phone' },
    { value: 'appointment_date', label: 'Date' },
    { value: 'appointment_time', label: 'Time' },
    { value: 'service_name', label: 'Service' },
    { value: 'status', label: 'Status' },
    { value: 'special_request', label: 'Special Request' },
    { value: 'admin_notes', label: 'Admin Notes' },
  ];
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Reports and Analytics</h1>
                <p className="mt-2 text-sm text-gray-600">Business intelligence and booking insights for {shopName}</p>
              </div>
              <Link
                to="/admin"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
          
          {/* Date Range Selector */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePresetChange('today')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                        dateRange.preset === 'today'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => handlePresetChange('this_week')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                        dateRange.preset === 'this_week'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => handlePresetChange('this_month')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                        dateRange.preset === 'this_month'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => handlePresetChange('custom')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                        dateRange.preset === 'custom'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                </div>
                
                {dateRange.preset === 'custom' && (
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        max={formatDate(new Date())}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        max={formatDate(new Date())}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleCustomDateChange}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                    >
                      Apply
                    </button>
                  </div>
                )}
                
                <div className="ml-auto">
                  <button
                    onClick={handleGenerateReport}
                    disabled={loadingReport}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingReport ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      'Generate Report'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Error State */}
          {reportError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-red-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Failed to load report</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {reportError instanceof Error ? reportError.message : 'An error occurred while fetching the report data.'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {loadingReport && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 mb-6">
              <div className="flex flex-col items-center justify-center">
                <svg className="animate-spin h-12 w-12 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600 font-medium">Loading report data...</p>
              </div>
            </div>
          )}
          
          {/* Empty State */}
          {!loadingReport && !reportError && summaryStats.total_bookings === 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 mb-6">
              <div className="text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings in selected date range</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Try expanding your date range or adjusting your filters to see data.
                </p>
                <button
                  onClick={() => handlePresetChange('this_month')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  View This Month
                </button>
              </div>
            </div>
          )}
          
          {/* Summary Statistics */}
          {!loadingReport && !reportError && summaryStats.total_bookings > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {/* Total Bookings */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Total Bookings</h3>
                    <svg className="h-8 w-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-4xl font-bold">{summaryStats.total_bookings}</p>
                </div>
                
                {/* Completed */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Completed</h3>
                    <svg className="h-8 w-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-4xl font-bold">{summaryStats.completed}</p>
                  <p className="text-sm opacity-90 mt-1">
                    {summaryStats.total_bookings > 0 ? ((summaryStats.completed / summaryStats.total_bookings) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                
                {/* Cancelled */}
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Cancelled</h3>
                    <svg className="h-8 w-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-4xl font-bold">{summaryStats.cancelled}</p>
                  <p className="text-sm opacity-90 mt-1">
                    {summaryStats.cancellation_rate.toFixed(1)}% cancellation rate
                  </p>
                </div>
                
                {/* No-shows */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">No-shows</h3>
                    <svg className="h-8 w-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-4xl font-bold">{summaryStats.no_shows}</p>
                  <p className="text-sm opacity-90 mt-1">
                    {summaryStats.total_bookings > 0 ? ((summaryStats.no_shows / summaryStats.total_bookings) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                
                {/* Show-up Rate */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Show-up Rate</h3>
                    <svg className="h-8 w-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className="text-4xl font-bold">{summaryStats.show_up_rate.toFixed(1)}%</p>
                  <p className="text-sm opacity-90 mt-1">of scheduled appointments</p>
                </div>
                
                {/* Revenue */}
                {summaryStats.total_revenue !== null && (
                  <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium opacity-90">Total Revenue</h3>
                      <svg className="h-8 w-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-4xl font-bold">${summaryStats.total_revenue.toFixed(2)}</p>
                    <p className="text-sm opacity-90 mt-1">from completed bookings</p>
                  </div>
                )}
              </div>
              
              {/* Breakdown by Service */}
              {breakdownByService.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Breakdown by Service</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visual</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {breakdownByService.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.service_name || 'No Service'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{item.count}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{item.percentage.toFixed(1)}%</td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full max-w-xs bg-gray-200 rounded-full h-4 overflow-hidden">
                                  <div
                                    className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Breakdown by Day of Week */}
              {breakdownByDayOfWeek.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Breakdown by Day of Week</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average per Week</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {breakdownByDayOfWeek.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.day}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{item.count}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{item.average.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Breakdown by Time Slot */}
              {breakdownByTimeSlot.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Breakdown by Time Slot</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visual</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {breakdownByTimeSlot.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.time}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{item.count}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{item.utilization.toFixed(1)}%</td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full max-w-xs bg-gray-200 rounded-full h-4 overflow-hidden">
                                  <div
                                    className={`h-4 rounded-full transition-all duration-500 ${
                                      item.utilization >= 80 ? 'bg-red-500' : item.utilization >= 50 ? 'bg-orange-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(item.utilization, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Breakdown by Status */}
              {breakdownByStatus.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Breakdown by Status</h2>
                  <div className="space-y-4">
                    {breakdownByStatus.map((item, index) => (
                      <div key={index} className="flex items-center">
                        <div className="flex-shrink-0 w-32 text-sm font-medium text-gray-900">{item.status}</div>
                        <div className="flex-1 ml-4">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                              <div
                                className={`h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all duration-500 ${
                                  item.status === 'Completed' ? 'bg-green-600' : item.status === 'Cancelled' ? 'bg-red-600' : 'bg-orange-600'
                                }`}
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              >
                                {item.percentage > 10 && `${item.percentage.toFixed(1)}%`}
                              </div>
                            </div>
                            <div className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {item.count} ({item.percentage.toFixed(1)}%)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Trend Graph Placeholder */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Booking Trend</h2>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200 p-12 text-center">
                  <svg className="mx-auto h-16 w-16 text-blue-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-gray-600 font-medium mb-2">Trend Chart Coming Soon</p>
                  <p className="text-sm text-gray-500">
                    The time series trend endpoint is currently being implemented.
                    <br />
                    This will show booking trends over the selected date range.
                  </p>
                </div>
              </div>
              
              {/* Export Options */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Export Data</h2>
                    <p className="text-sm text-gray-600 mt-1">Download your report data as a CSV file</p>
                  </div>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                  >
                    Export to CSV
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Export to CSV</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Date Range Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-sm text-gray-900">
                    {exportConfig.date_range.start_date} to {exportConfig.date_range.end_date}
                  </p>
                </div>
              </div>
              
              {/* Field Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Include Fields</label>
                <div className="grid grid-cols-2 gap-3">
                  {availableFields.map((field) => (
                    <label key={field.value} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_fields.includes(field.value)}
                        onChange={() => handleFieldToggle(field.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exportMutation.isPending || exportConfig.include_fields.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </span>
                ) : (
                  'Export CSV'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminReports;