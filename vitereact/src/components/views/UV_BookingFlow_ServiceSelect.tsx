import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Service type definition based on Zod schema
interface Service {
  service_id: string;
  name: string;
  description: string;
  image_url: string | null;
  duration: number;
  price: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const UV_BookingFlow_ServiceSelect: React.FC = () => {
  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // ============================================================================
  // ZUSTAND STORE ACCESS - CRITICAL: Individual selectors only
  // ============================================================================
  const bookingContext = useAppStore(state => state.booking_context);
  const servicesEnabled = useAppStore(state => state.app_settings.services_enabled);
  const updateBookingContext = useAppStore(state => state.update_booking_context);

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  const navigate = useNavigate();

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Redirect if services are disabled globally
  useEffect(() => {
    if (!servicesEnabled) {
      navigate('/book/date');
    }
  }, [servicesEnabled, navigate]);

  // Restore previously selected service on mount (back navigation support)
  useEffect(() => {
    if (bookingContext.service_id) {
      setSelectedServiceId(bookingContext.service_id);
    }
  }, [bookingContext.service_id]);

  // ============================================================================
  // DATA FETCHING - React Query
  // ============================================================================
  const {
    data: services = [],
    isLoading,
    error,
    refetch
  } = useQuery<Service[]>({
    queryKey: ['services', 'active'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/services`,
        {
          params: {
            is_active: true,
            sort_by: 'display_order',
            sort_order: 'asc'
          }
        }
      );
      // Handle both response formats: direct array or wrapped in services property
      return response.data.services || response.data;
    },
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false,
    retry: 1
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSelectService = (service: Service) => {
    setSelectedServiceId(service.service_id);
    // Update global booking context
    updateBookingContext({
      service_id: service.service_id,
      service_name: service.name
    });
  };

  const handleSkip = () => {
    // Clear service selection and proceed with null service
    updateBookingContext({
      service_id: null,
      service_name: null
    });
    navigate('/book/date');
  };

  const handleContinue = () => {
    if (selectedServiceId) {
      navigate('/book/date');
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 leading-tight">
              What service do you need?
            </h1>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              Choose the service that best fits your needs
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8 flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-white rounded-full px-6 py-3 shadow-lg">
              <span className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold shadow-md">
                1
              </span>
              <span className="text-sm font-semibold text-gray-900 hidden sm:inline">Service</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="bg-gray-200 text-gray-500 rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-sm text-gray-500 hidden sm:inline">Date</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="bg-gray-200 text-gray-500 rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span className="text-sm text-gray-500 hidden sm:inline">Time</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="bg-gray-200 text-gray-500 rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium">
                4
              </span>
              <span className="text-sm text-gray-500 hidden sm:inline">Details</span>
            </div>
          </div>

          {/* Skip Link */}
          <div className="mb-8 text-center">
            <button
              onClick={handleSkip}
              className="text-blue-600 hover:text-blue-800 text-sm md:text-base font-medium underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              aria-label="Skip service selection and continue with standard haircut"
            >
              Skip this step (continue with standard haircut)
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col justify-center items-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Loading services...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="max-w-md mx-auto">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center shadow-lg">
                <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load Services</h3>
                <p className="text-red-700 mb-4">
                  We couldn't load the available services. Please try again.
                </p>
                <button
                  onClick={() => refetch()}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 shadow-md hover:shadow-xl"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && services.length === 0 && (
            <div className="max-w-md mx-auto">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center shadow-lg">
                <svg className="w-12 h-12 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Services Available</h3>
                <p className="text-yellow-700 mb-4">
                  No services are currently available. Please check back later.
                </p>
                <button
                  onClick={handleSkip}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-xl"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          )}

          {/* Services Grid */}
          {!isLoading && !error && services.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
              {services.map((service) => (
                <button
                  key={service.service_id}
                  onClick={() => handleSelectService(service)}
                  className={`
                    relative overflow-hidden rounded-xl border-2 p-4 md:p-6 text-left 
                    transition-all duration-200 transform focus:outline-none focus:ring-4 focus:ring-blue-100
                    ${selectedServiceId === service.service_id
                      ? 'border-blue-600 bg-blue-50 shadow-xl scale-105 ring-4 ring-blue-100'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg hover:scale-102'
                    }
                  `}
                  aria-pressed={selectedServiceId === service.service_id}
                  aria-label={`Select ${service.name} service`}
                >
                  {/* Checkmark Indicator */}
                  {selectedServiceId === service.service_id && (
                    <div className="absolute top-3 right-3 bg-blue-600 rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Service Image */}
                  {(() => {
                    // Determine tailored image based on service name/type
                    const getServiceImage = (serviceName: string, imageUrl: string | null) => {
                      if (imageUrl) return imageUrl;
                      
                      // Tailored placeholder images based on service category
                      const lowerName = serviceName.toLowerCase();
                      
                      if (lowerName.includes('fade') || lowerName.includes('taper')) {
                        return 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('beard') || lowerName.includes('shave')) {
                        return 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('buzz') || lowerName.includes('crew')) {
                        return 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('kid') || lowerName.includes('child')) {
                        return 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('design') || lowerName.includes('pattern') || lowerName.includes('line')) {
                        return 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('wash') || lowerName.includes('treatment') || lowerName.includes('scalp')) {
                        return 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('color') || lowerName.includes('dye')) {
                        return 'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('styling') || lowerName.includes('style')) {
                        return 'https://images.unsplash.com/photo-1534620808146-d33bb39128b2?w=800&h=450&fit=crop';
                      } else if (lowerName.includes('trim') || lowerName.includes('cut')) {
                        return 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&h=450&fit=crop';
                      } else {
                        // Default barbershop image
                        return 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&h=450&fit=crop';
                      }
                    };

                    const displayImage = getServiceImage(service.name, service.image_url);
                    
                    return (
                      <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={displayImage}
                          alt={`${service.name} service preview`}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                          loading="lazy"
                        />
                      </div>
                    );
                  })()}

                  {/* Service Name */}
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 leading-tight">
                    {service.name}
                  </h3>

                  {/* Service Description */}
                  <p className="text-xs md:text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Duration & Price Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    {/* Duration */}
                    <div className="flex items-center text-xs md:text-sm text-gray-500">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{service.duration} min</span>
                    </div>

                    {/* Price */}
                    {service.price !== null && service.price !== undefined && (
                      <div className="text-xs md:text-sm font-semibold text-blue-600">
                        From ${typeof service.price === 'number' ? service.price.toFixed(2) : parseFloat(String(service.price)).toFixed(2)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="max-w-3xl mx-auto flex justify-between items-center gap-4 mt-8">
            {/* Back Button */}
            <Link
              to="/"
              className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-gray-200"
            >
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </span>
            </Link>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={!selectedServiceId}
              className={`
                flex-1 max-w-xs px-8 py-3 rounded-lg font-medium text-white 
                transition-all duration-200 shadow-lg focus:outline-none focus:ring-4
                ${selectedServiceId
                  ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl focus:ring-blue-300 cursor-pointer'
                  : 'bg-gray-300 cursor-not-allowed opacity-50'
                }
              `}
              aria-label="Continue to date selection"
            >
              <span className="flex items-center justify-center">
                Continue
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>

          {/* Helper Text */}
          {!selectedServiceId && !isLoading && services.length > 0 && (
            <div className="text-center mt-6">
              <p className="text-sm text-gray-500">
                Select a service to continue or skip this step
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_BookingFlow_ServiceSelect;