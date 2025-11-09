import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { motion } from 'framer-motion';
import { Scissors, Clock, MapPin, Phone, Star, Calendar, ChevronRight } from 'lucide-react';
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
    shop_name: response.data.shop_name || 'Master Fade',
    shop_address: response.data.shop_address || '13 Synnott Pl, Phibsborough, Dublin 7, D07 E7N5',
    shop_phone: response.data.shop_phone || '+353833276229',
    shop_email: response.data.shop_email || '',
    operating_hours: response.data.operating_hours || '10:00 AM - 3:00 PM',
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
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
    error: settings_error,
  } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: fetchShopSettings,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    // Use cached data from global state if available
    initialData: appSettings.shop_name !== 'Master Fade' ? {
      shop_name: appSettings.shop_name || 'Master Fade',
      shop_address: appSettings.shop_address || '13 Synnott Pl, Phibsborough, Dublin 7, D07 E7N5',
      shop_phone: appSettings.shop_phone || '+353833276229',
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
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
              transition={{ duration: 0.6 }}
              className="text-left"
            >
              {/* Personalized Greeting for Authenticated Users */}
              {isAuthenticated && currentUser && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-4"
                >
                  <p className="text-lg text-blue-400 font-medium">
                    Welcome back, {currentUser.name}!
                  </p>
                </motion.div>
              )}

              {/* Admin Notice */}
              {userType === 'admin' && (
                <div className="mb-4">
                  <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-4 py-2 backdrop-blur-sm">
                    <p className="text-sm text-yellow-200 font-medium">
                      👋 Admin View - <Link to="/admin" className="underline hover:text-yellow-100">Go to Admin Dashboard</Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-full px-4 py-2 mb-6"
              >
                <Scissors className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Dublin's Premier Barbershop</span>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6"
              >
                <span className="text-white">Master Your</span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Perfect Fade
                </span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xl md:text-2xl text-gray-300 leading-relaxed mb-8 max-w-2xl"
              >
                Expert cuts, seamless booking. Walk in with confidence, walk out with style.
              </motion.p>

              {/* Features list */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
              >
                {[
                  { icon: Clock, text: 'Book in 2 minutes' },
                  { icon: Calendar, text: 'Choose your time' },
                  { icon: Star, text: '5-star service' },
                  { icon: Scissors, text: 'Expert barbers' },
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-gray-300 font-medium">{feature.text}</span>
                  </div>
                ))}
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <button
                  onClick={handleBookNowClick}
                  className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-lg font-semibold rounded-xl shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <span>Book Your Cut Now</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Auth CTAs for Guests */}
                {!isAuthenticated && (
                  <div className="flex gap-3">
                    <Link
                      to="/login"
                      className="px-6 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-medium rounded-xl border border-white/20 transition-all duration-200"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      Log In
                    </Link>
                  </div>
                )}

                {/* Dashboard Link for Authenticated Users */}
                {isAuthenticated && userType === 'user' && (
                  <Link
                    to="/dashboard"
                    className="px-6 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-medium rounded-xl border border-white/20 transition-all duration-200"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    My Dashboard
                  </Link>
                )}
              </motion.div>
            </motion.div>

            {/* Right Column - Visual/Stats */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                {/* Main card */}
                <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white mb-2">500+</div>
                      <div className="text-sm text-gray-400">Happy Clients</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white mb-2">5.0</div>
                      <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        Google Rating
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white mb-2">10+</div>
                      <div className="text-sm text-gray-400">Years Experience</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white mb-2">24/7</div>
                      <div className="text-sm text-gray-400">Online Booking</div>
                    </div>
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl"></div>
                </div>
              </div>
            </motion.div>
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
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Welcome to <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{shop_info?.shop_name || 'Master Fade'}</span>
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Located in the heart of Phibsborough, Dublin 7, we're your destination for premium cuts and exceptional service.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Scissors,
                title: 'Expert Craftsmanship',
                description: 'Our experienced barbers deliver precision cuts tailored to your style and personality.'
              },
              {
                icon: Clock,
                title: 'Seamless Booking',
                description: 'Book online in minutes, choose your preferred time, and skip the waiting. Your time is valuable.'
              },
              {
                icon: Star,
                title: 'Premium Experience',
                description: 'From consultation to finish, we ensure every visit leaves you looking and feeling your best.'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-8 hover:shadow-xl hover:border-blue-200 transition-all duration-300"
              >
                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
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
                {services_preview.map((service) => (
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
                        {service.price !== null && service.price !== undefined && (
                          <span className="text-lg font-semibold text-blue-600">
                            ${typeof service.price === 'number' ? service.price.toFixed(2) : parseFloat(String(service.price)).toFixed(2)}
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

      {/* Contact & Google Reviews Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Visit Us Today
            </h2>
            <p className="text-xl text-gray-600">We're conveniently located in Phibsborough, Dublin 7</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            {/* Contact Cards */}
            <div className="space-y-6">
              {/* Address */}
              {shop_info?.shop_address && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <MapPin className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-900 mb-3">Our Location</h3>
                      <p className="text-gray-600 mb-4 leading-relaxed">{shop_info.shop_address}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop_info.shop_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors group"
                      >
                        <span>Get Directions</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Phone */}
              {shop_info?.shop_phone && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Phone className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-900 mb-3">Call Us</h3>
                      <p className="text-gray-600 mb-4 text-lg font-medium">{shop_info.shop_phone}</p>
                      <button
                        onClick={() => handlePhoneClick(shop_info.shop_phone)}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors group"
                        style={{ minHeight: '44px', minWidth: '44px' }}
                      >
                        <span>Call Now</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Hours */}
              {shop_info?.operating_hours && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Clock className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-900 mb-3">Opening Hours</h3>
                      <p className="text-gray-600 text-lg">{shop_info.operating_hours}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Google Map & Reviews */}
            <div className="space-y-6">
              {/* Google Map */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden h-[400px]"
              >
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2380.8487556267477!2d-6.278427223704396!3d53.36294097228234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48670e9c2baf8e6d%3A0x8e4b1c8c3e0e4b8c!2s13%20Synnott%20Pl%2C%20Phibsborough%2C%20Dublin%207%2C%20D07%20E7N5!5e0!3m2!1sen!2sie!4v1699999999999!5m2!1sen!2sie"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Master Fade Location"
                ></iframe>
              </motion.div>

              {/* Google Reviews Widget */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-2xl text-gray-900">Google Reviews</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <span className="font-bold text-gray-900">5.0</span>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Our customers love us! Check out what they're saying about their experience at Master Fade.
                </p>
                <a
                  href={`https://search.google.com/local/writereview?placeid=ChIJbY6vK5wOZ0gRjEsO4Iweh44`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  <Star className="w-5 h-5" />
                  <span>View All Reviews</span>
                </a>
              </motion.div>
            </div>
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