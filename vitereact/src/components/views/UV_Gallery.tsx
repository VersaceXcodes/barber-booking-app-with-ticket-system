import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

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
}

interface Service {
  service_id: string;
  name: string;
  is_callout?: boolean;
}

interface GalleryResponse {
  images: GalleryImage[];
  total: number;
  has_more: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_Gallery: React.FC = () => {
  // ==========================================================================
  // URL PARAMS & ROUTING
  // ==========================================================================
  const [searchParams, setSearchParams] = useSearchParams();
  
  // ==========================================================================
  // LOCAL STATE
  // ==========================================================================
  const [activeServiceFilter, setActiveServiceFilter] = useState<string | null>(
    searchParams.get('service_filter') || null
  );
  const [sortOrder, setSortOrder] = useState<'newest_first' | 'oldest_first'>('newest_first');
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(null);
  
  // Constants
  const imagesPerPage = 20;
  
  // ==========================================================================
  // GLOBAL STATE ACCESS
  // ==========================================================================
  // CRITICAL: Individual selector to avoid infinite loops
  const galleryEnabled = useAppStore(state => state.app_settings.gallery_enabled);
  
  // ==========================================================================
  // API BASE URL
  // ==========================================================================
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  // ==========================================================================
  // DATA FETCHING - SERVICES LIST
  // ==========================================================================
  const { data: servicesData } = useQuery<Service[]>({
    queryKey: ['services', 'active'],
    queryFn: async () => {
      const response = await axios.get(`${apiBaseUrl}/api/services`, {
        params: {
          is_active: true,
          sort_by: 'display_order',
          sort_order: 'asc'
        }
      });
      return response.data.services || response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  
  // ==========================================================================
  // DATA FETCHING - GALLERY IMAGES
  // ==========================================================================
  const { data: galleryData, isLoading: loadingImages } = useQuery<GalleryResponse>({
    queryKey: ['gallery', activeServiceFilter, sortOrder, currentPage],
    queryFn: async () => {
      const params: any = {
        sort_by: 'created_at',
        sort_order: sortOrder === 'newest_first' ? 'desc' : 'asc',
        limit: imagesPerPage,
        offset: (currentPage - 1) * imagesPerPage
      };
      
      if (activeServiceFilter) {
        params.service_id = activeServiceFilter;
      }
      
      const response = await axios.get(`${apiBaseUrl}/api/gallery`, { params });
      
      return {
        images: response.data.images || [],
        total: response.data.total || 0,
        has_more: response.data.has_more || false
      };
    },
    staleTime: 2 * 60 * 1000,
  });
  
  const galleryImages = galleryData?.images || [];
  const totalImages = galleryData?.total || 0;
  
  // ==========================================================================
  // URL PARAMS SYNC
  // ==========================================================================
  useEffect(() => {
    const params: any = {};
    if (activeServiceFilter) params.service_filter = activeServiceFilter;
    if (currentPage > 1) params.page = currentPage.toString();
    setSearchParams(params, { replace: true });
  }, [activeServiceFilter, currentPage, setSearchParams]);
  
  // ==========================================================================
  // EVENT HANDLERS - FILTERS & SORTING
  // ==========================================================================
  const handleServiceFilterChange = useCallback((serviceId: string | null) => {
    setActiveServiceFilter(serviceId);
    setCurrentPage(1); // Reset to page 1
  }, []);
  
  const handleSortOrderChange = useCallback((order: 'newest_first' | 'oldest_first') => {
    setSortOrder(order);
    setCurrentPage(1); // Reset to page 1
  }, []);
  
  // ==========================================================================
  // EVENT HANDLERS - PAGINATION
  // ==========================================================================
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // ==========================================================================
  // EVENT HANDLERS - LIGHTBOX
  // ==========================================================================
  const openLightbox = useCallback((index: number) => {
    setLightboxImageIndex(index);
    setLightboxOpen(true);
  }, []);
  
  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxImageIndex(null);
  }, []);
  
  const navigateLightbox = useCallback((direction: 'prev' | 'next') => {
    if (lightboxImageIndex === null) return;
    
    if (direction === 'prev' && lightboxImageIndex > 0) {
      setLightboxImageIndex(lightboxImageIndex - 1);
    } else if (direction === 'next' && lightboxImageIndex < galleryImages.length - 1) {
      setLightboxImageIndex(lightboxImageIndex + 1);
    }
  }, [lightboxImageIndex, galleryImages.length]);
  
  // ==========================================================================
  // KEYBOARD NAVIGATION FOR LIGHTBOX
  // ==========================================================================
  useEffect(() => {
    if (!lightboxOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigateLightbox('next');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, navigateLightbox]);
  
  // ==========================================================================
  // TOUCH GESTURES FOR LIGHTBOX
  // ==========================================================================
  const touchStartX = useRef<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        navigateLightbox('next');
      } else {
        navigateLightbox('prev');
      }
    }
    
    touchStartX.current = null;
  };
  
  // ==========================================================================
  // PAGINATION CALCULATIONS
  // ==========================================================================
  const totalPages = Math.ceil(totalImages / imagesPerPage);
  
  // ==========================================================================
  // RENDER - GALLERY DISABLED STATE
  // ==========================================================================
  if (!galleryEnabled) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
          <div className="text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Gallery Not Available</h2>
            <p className="mt-2 text-gray-600">The gallery is currently disabled.</p>
            <Link 
              to="/"
              className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
            >
              Return Home
            </Link>
          </div>
        </div>
      </>
    );
  }
  
  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* ================================================================ */}
          {/* HEADER */}
          {/* ================================================================ */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Our Work
            </h1>
            <p className="mt-4 text-lg md:text-xl text-gray-600 leading-relaxed">
              Check out our latest styles
            </p>
          </div>
          
          {/* ================================================================ */}
          {/* FILTER AND SORT CONTROLS */}
          {/* ================================================================ */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Service Filter */}
              <div className="flex-1">
                <label htmlFor="service-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Service
                </label>
                <select
                  id="service-filter"
                  value={activeServiceFilter || ''}
                  onChange={(e) => handleServiceFilterChange(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                >
                  <option value="">All Services</option>
                  {servicesData?.map(service => (
                    <option key={service.service_id} value={service.service_id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Sort Order */}
              <div className="flex-1">
                <label htmlFor="sort-order" className="block text-sm font-medium text-gray-700 mb-2">
                  Sort Order
                </label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(e) => handleSortOrderChange(e.target.value as 'newest_first' | 'oldest_first')}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                >
                  <option value="newest_first">Newest First</option>
                  <option value="oldest_first">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* ================================================================ */}
          {/* LOADING STATE */}
          {/* ================================================================ */}
          {loadingImages && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse"></div>
              ))}
            </div>
          )}
          
          {/* ================================================================ */}
          {/* EMPTY STATE */}
          {/* ================================================================ */}
          {!loadingImages && galleryImages.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="mt-6 text-2xl font-semibold text-gray-900">Gallery coming soon!</h3>
              <p className="mt-2 text-gray-600">We're adding new photos regularly. Check back soon.</p>
            </div>
          )}
          
          {/* ================================================================ */}
          {/* GALLERY GRID */}
          {/* ================================================================ */}
          {!loadingImages && galleryImages.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {galleryImages.map((image, index) => {
                  const service = servicesData?.find(s => s.service_id === image.service_id);
                  
                  return (
                    <div
                      key={image.image_id}
                      className="group relative aspect-square rounded-xl overflow-hidden shadow-lg border border-gray-100 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-xl"
                      onClick={() => openLightbox(index)}
                    >
                      <img
                        src={image.thumbnail_url}
                        alt={image.caption || 'Gallery image'}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                        loading="lazy"
                      />
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200"></div>
                      
                      {/* Caption and Service Badge */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        {image.caption && (
                          <p className="text-white font-medium text-sm md:text-base mb-1">
                            {image.caption}
                          </p>
                        )}
                        {service && (
                          <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded-md">
                            {service.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* ============================================================ */}
              {/* PAGINATION INFO */}
              {/* ============================================================ */}
              <div className="text-center text-gray-600 mb-6">
                Showing {((currentPage - 1) * imagesPerPage) + 1}-{Math.min(currentPage * imagesPerPage, totalImages)} of {totalImages}
              </div>
              
              {/* ============================================================ */}
              {/* PAGINATION CONTROLS */}
              {/* ============================================================ */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Previous
                  </button>
                  
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* ==================================================================== */}
      {/* LIGHTBOX MODAL */}
      {/* ==================================================================== */}
      {lightboxOpen && lightboxImageIndex !== null && galleryImages[lightboxImageIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-2 text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white rounded-lg"
            aria-label="Close lightbox"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Image Counter */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-lg font-medium bg-black bg-opacity-50 px-4 py-2 rounded-lg">
            {lightboxImageIndex + 1} / {galleryImages.length}
          </div>
          
          {/* Previous Button */}
          {lightboxImageIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox('prev');
              }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white rounded-lg"
              aria-label="Previous image"
            >
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Image Container */}
          <div className="max-w-7xl max-h-screen w-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={galleryImages[lightboxImageIndex].image_url}
              alt={galleryImages[lightboxImageIndex].caption || 'Gallery image'}
              className="max-w-full max-h-[80vh] object-contain"
            />
            {galleryImages[lightboxImageIndex].caption && (
              <p className="text-white text-center mt-4 text-lg font-medium max-w-2xl">
                {galleryImages[lightboxImageIndex].caption}
              </p>
            )}
          </div>
          
          {/* Next Button */}
          {lightboxImageIndex < galleryImages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox('next');
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white rounded-lg"
              aria-label="Next image"
            >
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default UV_Gallery;