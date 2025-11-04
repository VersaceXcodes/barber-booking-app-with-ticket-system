import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import type { Service } from '@/../../shared/zodSchemas';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GalleryImage {
  image_id: string;
  image_url: string;
  thumbnail_url: string;
  caption: string | null;
  service_id: string | null;
  display_order: number;
  uploaded_at: string;
}

interface ShopInfo {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_email: string;
  operating_hours: string;
}

// ============================================================================
// API HELPER FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const fetchServicesPreview = async (): Promise<Service[]> => {
  const response = await axios.get(`${getApiBaseUrl()}/api/services`, {
    params: {
      is_active: true,
      limit: 6,
      sort_by: 'display_order',
      sort_order: 'asc',
    },
  });
  
  // API may return { services: Service[] } or just Service[]
  return response.data.services || response.data || [];
};

const fetchGalleryPreview = async (): Promise<GalleryImage[]> => {
  const response = await axios.get(`${getApiBaseUrl()}/api/gallery`, {
    params: {
      limit: 6,
    },
  });
  
  // Handle both response formats: { images: [] } or plain array
  return response.data.images || response.data || [];
};

const fetchShopSettings = async (): Promise<ShopInfo> => {
  const response = await axios.get(`${getApiBaseUrl()}/api/settings`);
  
  return {
    shop_name: response.data.shop_name || 'BarberSlot',
    shop_address: response.data.shop_address || '',
    shop_phone: response.data.shop_phone || '',
    shop_email: response.data.shop_email || '',
    operating_hours: response.data.operating_hours || '10:00 AM - 3:00 PM',
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  
  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );
  const userType = useAppStore(
    state => state.authentication_state.authentication_status.user_type
  );
  const currentUser = useAppStore(
    state => state.authentication_state.current_user
  );
  const appSettings = useAppStore(state => state.app_settings);
  const servicesEnabled = useAppStore(state => state.app_settings.services_enabled);

  // ============================================================================
  // DATA FETCHING WITH REACT QUERY
  // ============================================================================

  const {
    data: services_preview = [],
    isLoading: loading_services,
    error: services_error,
  } = useQuery({
    queryKey: ['services-preview'],
    queryFn: fetchServicesPreview,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: gallery_preview = [],
    isLoading: loading_gallery,
    error: gallery_error,
  } = useQuery({
    queryKey: ['gallery-preview'],
    queryFn: fetchGalleryPreview,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: shop_info,
    isLoading: loading_settings,
    error: settings_error,
  } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: fetchShopSettings,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    // Use cached data from global state if available
    initialData: appSettings.shop_name !== 'BarberSlot' ? {
      shop_name: appSettings.shop_name,
      shop_address: appSettings.shop_address,
      shop_phone: appSettings.shop_phone,
      shop_email: appSettings.shop_email,
      operating_hours: appSettings.operating_hours,
    } : undefined,
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleBookNowClick = () => {
    // Navigate based on services_enabled setting
    if (servicesEnabled) {
      navigate('/book/service');
    } else {
      navigate('/book/date');
    }
  };

  const handleGalleryImageClick = () => {
    navigate('/gallery');
  };

  const handlePhoneClick = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="text-center">
            {/* Personalized Greeting for Authenticated Users */}
            {isAuthenticated && currentUser && (
              <div className="mb-4">
                <p className="text-lg text-blue-700 font-medium">
                  Welcome back, {currentUser.name}!
                </p>
              </div>
            )}

            {/* Admin Notice */}
            {userType === 'admin' && (
              <div className="mb-4 inline-block">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                  <p className="text-sm text-yellow-800 font-medium">
                    👋 Admin View - <Link to="/admin" className="underline hover:text-yellow-900">Go to Admin Dashboard</Link>
                  </p>
                </div>
              </div>
            )}

            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Book Your Haircut
              <br />
              <span className="text-blue-600">In Under 2 Minutes</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-8 max-w-3xl mx-auto">
              Professional haircuts with easy online booking. No phone calls, no waiting.
            </p>

            {/* Primary CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleBookNowClick}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                Book Your Haircut Now
              </button>

              {/* Auth CTAs for Guests */}
              {!isAuthenticated && (
                <div className="flex gap-3">
                  <Link
                    to="/login"
                    className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg border-2 border-gray-300 transition-all duration-200"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg border border-gray-300 transition-all duration-200"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              {/* Dashboard Link for Authenticated Users */}
              {isAuthenticated && userType === 'user' && (
                <Link
                  to="/dashboard"
                  className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg border-2 border-gray-300 transition-all duration-200"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  My Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Decorative wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 48h1440V0c-240 48-480 48-720 0S240 0 0 48z" fill="white" />
          </svg>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Welcome to {shop_info?.shop_name || 'BarberSlot'}
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-4">
            We provide professional haircut services with a focus on quality and customer satisfaction. 
            Book your appointment online in just a few clicks, choose your preferred time slot, and arrive without waiting.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed">
            Our experienced barbers are ready to give you the perfect cut. Walk in with confidence, walk out with style.
          </p>
        </div>
      </section>

      {/* Services Preview Section (if services exist) */}
      {services_preview.length > 0 && (
        <section className="py-12 lg:py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Our Services
              </h2>
              <p className="text-lg text-gray-600">
                Choose from our range of professional services
              </p>
            </div>

            {loading_services ? (
              /* Loading Skeleton */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 animate-pulse">
                    <div className="w-full h-48 bg-gray-200"></div>
                    <div className="p-6">
                      <div className="h-6 bg-gray-200 rounded mb-3"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Services Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services_preview.slice(0, 6).map((service) => (
                  <div
                    key={service.service_id}
                    className="bg-white rounded-xl shadow-lg hover:shadow-xl overflow-hidden border border-gray-100 transition-all duration-200 transform hover:scale-105"
                  >
                    {service.image_url && (
                      <div className="w-full h-48 overflow-hidden bg-gray-100">
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {service.name}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {service.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          {service.duration} minutes
                        </span>
                        {service.price && (
                          <span className="text-lg font-semibold text-blue-600">
                            ${Number(service.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gallery Preview Section */}
      <section className="py-12 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Work
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Check out our latest haircuts and styles
            </p>
          </div>

          {loading_gallery ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="aspect-square bg-gray-200 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : gallery_preview.length > 0 ? (
            <>
              {/* Gallery Grid */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {gallery_preview.slice(0, 6).map((image) => (
                  <button
                    key={image.image_id}
                    onClick={handleGalleryImageClick}
                    className="relative aspect-square group overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    <img
                      src={image.thumbnail_url || image.image_url}
                      alt={image.caption || 'Gallery image'}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200 flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 font-medium transition-opacity duration-200">
                        View Gallery
                      </span>
                    </div>
                    {image.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                        <p className="text-white text-sm font-medium truncate">
                          {image.caption}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* View Full Gallery Button */}
              <div className="text-center">
                <Link
                  to="/gallery"
                  className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  View Full Gallery
                </Link>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-lg text-gray-600 mb-2">Gallery coming soon!</p>
              <p className="text-gray-500">We're adding new photos regularly. Check back soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Visit Us
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            {/* Address */}
            {shop_info?.shop_address && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="text-blue-600 mb-3">
                  <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Address</h3>
                <p className="text-gray-600 mb-3">{shop_info.shop_address}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop_info.shop_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Get Directions →
                </a>
              </div>
            )}

            {/* Phone */}
            {shop_info?.shop_phone && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="text-blue-600 mb-3">
                  <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Phone</h3>
                <p className="text-gray-600 mb-3">{shop_info.shop_phone}</p>
                <button
                  onClick={() => handlePhoneClick(shop_info.shop_phone)}
                  className="inline-block text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  Call Now →
                </button>
              </div>
            )}

            {/* Hours */}
            {shop_info?.operating_hours && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="text-blue-600 mb-3">
                  <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Hours</h3>
                <p className="text-gray-600">{shop_info.operating_hours}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Error Banner (if critical error) */}
      {(services_error || gallery_error || settings_error) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  Some content could not be loaded. Please refresh the page or try again later.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_Landing;