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
  is_callout: boolean;
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
      service_name: service.name,
      is_callout: service.is_callout
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
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-master-text-primary-dark mb-3 leading-tight">
              What service do you need?
            </h1>
            <p className="text-lg md:text-xl text-master-text-secondary-dark leading-relaxed">
              Choose the service that best fits your needs
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8 flex items-center justify-center">
            <div className="flex items-center space-x-2 backdrop-blur-xl bg-white/10 border border-white/20 rounded-full px-6 py-3 shadow-lg">
              <span className="bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold shadow-md">
                1
              </span>
              <span className="text-sm font-semibold text-master-text-primary-dark hidden sm:inline">Service</span>
              <span className="text-master-text-muted-dark mx-1">→</span>
              <span className="bg-white/10 text-master-text-muted-dark border border-white/10 rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-sm text-master-text-secondary-dark hidden sm:inline">Date</span>
              <span className="text-master-text-muted-dark mx-1">→</span>
              <span className="bg-white/10 text-master-text-muted-dark border border-white/10 rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span className="text-sm text-master-text-secondary-dark hidden sm:inline">Time</span>
              <span className="text-master-text-muted-dark mx-1">→</span>
              <span className="bg-white/10 text-master-text-muted-dark border border-white/10 rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium">
                4
              </span>
              <span className="text-sm text-master-text-secondary-dark hidden sm:inline">Details</span>
            </div>
          </div>

          {/* Skip Link */}
          <div className="mb-8 text-center">
            <button
              onClick={handleSkip}
              className="text-amber-400 hover:text-amber-300 text-sm md:text-base font-medium underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
              aria-label="Skip service selection and continue with standard haircut"
            >
              Skip this step (continue with standard haircut)
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col justify-center items-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mb-4"></div>
              <p className="text-master-text-secondary-dark text-lg">Loading services...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="max-w-md mx-auto">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center shadow-lg">
                <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Services</h3>
                <p className="text-red-300 mb-4">
                  We couldn't load the available services. Please try again.
                </p>
                <button
                  onClick={() => refetch()}
                  className="bg-red-600 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 shadow-md hover:shadow-xl"
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
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">No Services Available</h3>
                <p className="text-yellow-300 mb-4">
                  No services are currently available. Please check back later.
                </p>
                <button
                  onClick={handleSkip}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark px-6 py-3 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-colors duration-200 shadow-md hover:shadow-xl"
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
                    transition-all duration-200 transform focus:outline-none focus:ring-4
                    ${service.is_callout 
                      ? selectedServiceId === service.service_id
                        ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-xl scale-105 ring-4 ring-orange-100'
                        : 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 hover:border-orange-400 hover:shadow-lg hover:scale-102'
                      : selectedServiceId === service.service_id
                        ? 'border-red-600 bg-[#2D0808] shadow-xl scale-105 ring-4 ring-red-100'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg hover:scale-102'
                    }
                    ${service.is_callout ? 'focus:ring-orange-100' : 'focus:ring-red-100'}
                  `}
                  aria-pressed={selectedServiceId === service.service_id}
                  aria-label={`Select ${service.name} service`}
                >
                  {/* Premium Call-Out Badge */}
                  {service.is_callout && (
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-orange-500 text-master-text-primary-dark px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center z-10">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      PREMIUM
                    </div>
                  )}

                  {/* Checkmark Indicator */}
                  {selectedServiceId === service.service_id && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-red-600 to-red-700 rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-lg animate-in zoom-in duration-200 z-10">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-master-text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      } else if (lowerName.includes('call') || lowerName.includes('mobile') || lowerName.includes('home')) {
                        return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=450&fit=crop';
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
                  <h3 className={`text-lg md:text-xl font-semibold mb-2 leading-tight ${
                    service.is_callout 
                      ? 'text-[#3B1612]' // Dark maroon on light orange/cream background
                      : selectedServiceId === service.service_id
                        ? 'text-[#F6E7D8]' // Warm off-white on dark red selected background
                        : 'text-[#3B1612]' // Dark maroon on white/light background
                  }`}>
                    {service.name}
                    {service.is_callout && (
                      <span className="ml-2 inline-flex items-center text-xs font-medium text-[#6A3A2E]">
                        <svg className="w-4 h-4 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        We come to you
                      </span>
                    )}
                  </h3>

                  {/* Service Description */}
                  <p className={`text-xs md:text-sm mb-4 line-clamp-2 leading-relaxed ${
                    service.is_callout 
                      ? 'text-[#6A3A2E]' // Warm brown on light orange/cream background
                      : selectedServiceId === service.service_id
                        ? 'text-[#E8D4C4]' // Lighter warm neutral on dark red selected background
                        : 'text-[#6A3A2E]' // Warm brown on white/light background
                  }`}>
                    {service.description}
                  </p>

                  {/* Duration & Price Footer */}
                  <div className={`flex items-center justify-between pt-3 border-t ${
                    service.is_callout 
                      ? 'border-[#E8B895]' // Warm border for orange cards
                      : selectedServiceId === service.service_id
                        ? 'border-[#5C1B1B]' // Darker red border for selected dark cards
                        : 'border-gray-200' // Standard border for white cards
                  }`}>
                    {/* Duration */}
                    <div className={`flex items-center text-xs md:text-sm ${
                      service.is_callout 
                        ? 'text-[#7A4A3A]' // Darker warm brown on light background
                        : selectedServiceId === service.service_id
                          ? 'text-[#E8D4C4]' // Lighter warm neutral on dark red background
                          : 'text-[#7A4A3A]' // Darker warm brown on white background
                    }`}>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{service.duration} min</span>
                    </div>

                    {/* Price */}
                    {service.price !== null && service.price !== undefined && (
                      <div className={`text-xs md:text-sm font-semibold ${
                        service.is_callout 
                          ? 'text-[#D97706]' // Darker warm orange on light background (better contrast)
                          : selectedServiceId === service.service_id
                            ? 'text-[#FCD34D]' // Warm gold on dark red background
                            : 'text-[#D97706]' // Darker warm orange on white background
                      }`}>
                        {service.is_callout ? '€' : 'From $'}{typeof service.price === 'number' ? service.price.toFixed(2) : parseFloat(String(service.price)).toFixed(2)}
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
              className="px-6 py-3 rounded-lg font-medium text-master-text-secondary-dark bg-[#2D0808] border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-gray-200"
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
                flex-1 max-w-xs px-8 py-3 rounded-lg font-medium text-master-text-primary-dark 
                transition-all duration-200 shadow-lg focus:outline-none focus:ring-4
                ${selectedServiceId
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:shadow-xl focus:ring-red-300 cursor-pointer'
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
              <p className="text-sm text-master-text-secondary-dark">
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