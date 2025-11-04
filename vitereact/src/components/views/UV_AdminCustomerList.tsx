import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Search, Filter, Download, Eye, Calendar, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface CustomersResponse {
  data: Customer[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminCustomerList: React.FC = () => {
  // ====================================================================
  // ZUSTAND STORE - CRITICAL: Individual selectors only!
  // ====================================================================
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // ====================================================================
  // URL PARAMS & NAVIGATION
  // ====================================================================
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ====================================================================
  // LOCAL STATE
  // ====================================================================
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'total_bookings_desc');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState<string | null>(null);

  // ====================================================================
  // DEBOUNCED SEARCH EFFECT
  // ====================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // ====================================================================
  // SYNC URL PARAMS WITH STATE
  // ====================================================================
  useEffect(() => {
    const params: Record<string, string> = {};
    
    if (debouncedSearch) params.search = debouncedSearch;
    if (typeFilter !== 'all') params.type = typeFilter;
    if (sortBy !== 'total_bookings_desc') params.sort = sortBy;
    if (currentPage !== 1) params.page = currentPage.toString();

    setSearchParams(params, { replace: true });
  }, [debouncedSearch, typeFilter, sortBy, currentPage, setSearchParams]);

  // ====================================================================
  // API QUERY PARAMS MAPPING
  // ====================================================================
  const getSortParams = (sortByValue: string): { sort_by: string; sort_order: 'asc' | 'desc' } => {
    switch (sortByValue) {
      case 'total_bookings_desc':
        return { sort_by: 'total_bookings', sort_order: 'desc' };
      case 'last_booking_newest':
        return { sort_by: 'last_booking_date', sort_order: 'desc' };
      case 'name_asc':
        return { sort_by: 'name', sort_order: 'asc' };
      default:
        return { sort_by: 'total_bookings', sort_order: 'desc' };
    }
  };

  const offset = (currentPage - 1) * rowsPerPage;
  const { sort_by, sort_order } = getSortParams(sortBy);

  // ====================================================================
  // FETCH CUSTOMERS - REACT QUERY
  // ====================================================================
  const {
    data: customersData,
    isLoading: loadingCustomers,
    error: customersError,
    refetch: refetchCustomers,
  } = useQuery<CustomersResponse>({
    queryKey: ['admin-customers', debouncedSearch, typeFilter, sort_by, sort_order, rowsPerPage, offset],
    queryFn: async () => {
      const params: Record<string, any> = {
        limit: rowsPerPage,
        offset: offset,
        sort_by: sort_by,
        sort_order: sort_order,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter !== 'all') params.type = typeFilter;

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/customers`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          params,
        }
      );

      return response.data;
    },
    enabled: !!authToken,
    staleTime: 60000, // 1 minute
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const customers = customersData?.data || [];
  const totalCustomers = customersData?.pagination.total || 0;
  const totalPages = Math.ceil(totalCustomers / rowsPerPage);

  // ====================================================================
  // EXPORT CSV HANDLER
  // ====================================================================
  const handleExportCsv = async () => {
    setExportingCsv(true);

    try {
      const params: Record<string, any> = {
        sort_by: sort_by,
        sort_order: sort_order,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter !== 'all') params.type = typeFilter;

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/customers/export`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          params,
          responseType: 'blob',
        }
      );

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export customers. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  // ====================================================================
  // FILTER/SORT/PAGINATION HANDLERS
  // ====================================================================
  const handleTypeFilterChange = (newType: string) => {
    setTypeFilter(newType);
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setCurrentPage(1);
  };

  // ====================================================================
  // NAVIGATION HANDLERS
  // ====================================================================
  const handleRowClick = (customerId: string) => {
    navigate(`/admin/customers/${customerId}`);
  };

  const handleViewCustomer = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/customers/${customerId}`);
  };

  const handleViewBookings = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/bookings?customer_id=${customerId}`);
  };

  const toggleContactDropdown = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContactDropdownOpen(contactDropdownOpen === customerId ? null : customerId);
  };

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Page Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="mt-2 text-gray-600">Manage and view all customer records</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="w-full lg:w-48">
                <select
                  value={typeFilter}
                  onChange={(e) => handleTypeFilterChange(e.target.value)}
                  className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900"
                >
                  <option value="all">All Customers</option>
                  <option value="registered">Registered</option>
                  <option value="guest">Guest</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="w-full lg:w-56">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900"
                >
                  <option value="total_bookings_desc">Total Bookings (High to Low)</option>
                  <option value="last_booking_newest">Last Booking (Newest)</option>
                  <option value="name_asc">Name (A-Z)</option>
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportCsv}
                disabled={exportingCsv || loadingCustomers}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exportingCsv ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Export CSV
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Loading State */}
            {loadingCustomers && (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading customers...</p>
              </div>
            )}

            {/* Error State */}
            {customersError && (
              <div className="p-12 text-center">
                <div className="text-red-600 mb-4">
                  <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading customers</h3>
                <p className="text-gray-600 mb-4">Unable to fetch customer data. Please try again.</p>
                <button
                  onClick={() => refetchCustomers()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loadingCustomers && !customersError && customers.length === 0 && (
              <div className="p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers yet</h3>
                <p className="text-gray-600">Customers will appear after the first booking</p>
              </div>
            )}

            {/* Table with Data */}
            {!loadingCustomers && !customersError && customers.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Email
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Phone
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Total Bookings
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Last Booking
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customers.map((customer) => (
                        <tr
                          key={customer.customer_id}
                          onClick={() => handleRowClick(customer.customer_id)}
                          className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                        >
                          {/* Name with Avatar */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {getInitials(customer.name)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.email || 'N/A'}</div>
                          </td>

                          {/* Phone */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.phone || 'N/A'}</div>
                          </td>

                          {/* Type Badge */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {customer.is_registered ? (
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                Registered
                              </span>
                            ) : (
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Guest
                              </span>
                            )}
                          </td>

                          {/* Total Bookings */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{customer.total_bookings}</div>
                          </td>

                          {/* Last Booking */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{formatDate(customer.last_booking_date)}</div>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              {/* View Icon */}
                              <button
                                onClick={(e) => handleViewCustomer(customer.customer_id, e)}
                                className="text-blue-600 hover:text-blue-800 transition-colors p-2 rounded-lg hover:bg-blue-50"
                                title="View Details"
                              >
                                <Eye className="h-5 w-5" />
                              </button>

                              {/* Bookings Icon */}
                              <button
                                onClick={(e) => handleViewBookings(customer.customer_id, e)}
                                className="text-green-600 hover:text-green-800 transition-colors p-2 rounded-lg hover:bg-green-50"
                                title="View Bookings"
                              >
                                <Calendar className="h-5 w-5" />
                              </button>

                              {/* Contact Dropdown */}
                              <div className="relative">
                                <button
                                  onClick={(e) => toggleContactDropdown(customer.customer_id, e)}
                                  className="text-gray-600 hover:text-gray-800 transition-colors p-2 rounded-lg hover:bg-gray-50"
                                  title="Contact"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>

                                {contactDropdownOpen === customer.customer_id && (
                                  <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                    <div className="py-1">
                                      {customer.email && (
                                        <a
                                          href={`mailto:${customer.email}`}
                                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Mail className="h-4 w-4" />
                                          Email
                                        </a>
                                      )}
                                      {customer.phone && (
                                        <a
                                          href={`tel:${customer.phone}`}
                                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Phone className="h-4 w-4" />
                                          Call
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Showing Text */}
                  <div className="text-sm text-gray-700">
                    Showing {offset + 1}-{Math.min(offset + rowsPerPage, totalCustomers)} of {totalCustomers} customers
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-4">
                    {/* Rows Per Page */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Rows:</label>
                      <select
                        value={rowsPerPage}
                        onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AdminCustomerList;