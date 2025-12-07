import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_Footer: React.FC = () => {
  // ============================================================================
  // STATE - ZUSTAND (Individual Selectors - CRITICAL Pattern)
  // ============================================================================
  
  const shopName = useAppStore(state => state.app_settings.shop_name);
  const shopAddress = useAppStore(state => state.app_settings.shop_address);
  const shopPhone = useAppStore(state => state.app_settings.shop_phone);
  const shopEmail = useAppStore(state => state.app_settings.shop_email);
  const operatingHours = useAppStore(state => state.app_settings.operating_hours);
  const socialFacebook = useAppStore(state => state.app_settings.social_facebook);
  const socialInstagram = useAppStore(state => state.app_settings.social_instagram);
  const socialTwitter = useAppStore(state => state.app_settings.social_twitter);
  const userType = useAppStore(state => state.authentication_state.authentication_status.user_type);

  // ============================================================================
  // LOCAL STATE - Modal Visibility
  // ============================================================================
  
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================
  
  const showAdminLoginLink = userType !== 'admin';
  const currentYear = new Date().getFullYear();
  
  // Google Maps link for address
  const mapsLink = shopAddress 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopAddress)}`
    : '#';

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const openTermsModal = () => {
    setTermsModalOpen(true);
    setPrivacyModalOpen(false);
    setCancellationModalOpen(false);
  };

  const openPrivacyModal = () => {
    setPrivacyModalOpen(true);
    setTermsModalOpen(false);
    setCancellationModalOpen(false);
  };

  const openCancellationModal = () => {
    setCancellationModalOpen(true);
    setTermsModalOpen(false);
    setPrivacyModalOpen(false);
  };

  const closeAllModals = () => {
    setTermsModalOpen(false);
    setPrivacyModalOpen(false);
    setCancellationModalOpen(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <>
      {/* ====================================================================== */}
      {/* FOOTER SECTION */}
      {/* ====================================================================== */}
      
      <footer className="bg-gradient-to-br from-[#1A0505] via-[#2D0808] to-[#1A0505] text-gray-300 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            
            {/* ================================================================ */}
            {/* COLUMN 1: SHOP INFORMATION */}
            {/* ================================================================ */}
            
            <div className="space-y-4">
              <h3 className="text-white text-lg font-semibold mb-4">
                {shopName}
              </h3>
              
              {/* Address with map link */}
              {shopAddress && (
                <div className="flex items-start space-x-3">
                  <svg 
                    className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-white transition-colors text-sm leading-relaxed hover:text-amber-400"
                  >
                    {shopAddress}
                  </a>
                </div>
              )}
              
              {/* Phone number */}
              {shopPhone && (
                <div className="flex items-center space-x-3">
                  <svg 
                    className="w-5 h-5 text-gray-400 flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                    />
                  </svg>
                  <a
                    href={`tel:${shopPhone}`}
                    className="text-gray-300 hover:text-white transition-colors text-sm hover:text-amber-400"
                  >
                    {shopPhone}
                  </a>
                </div>
              )}
              
              {/* Email */}
              {shopEmail && (
                <div className="flex items-center space-x-3">
                  <svg 
                    className="w-5 h-5 text-gray-400 flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                    />
                  </svg>
                  <a
                    href={`mailto:${shopEmail}`}
                    className="text-gray-300 hover:text-white transition-colors text-sm hover:text-amber-400"
                  >
                    {shopEmail}
                  </a>
                </div>
              )}
              
              {/* Operating hours */}
              {operatingHours && (
                <div className="flex items-start space-x-3">
                  <svg 
                    className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {operatingHours}
                  </p>
                </div>
              )}
            </div>
            
            {/* ================================================================ */}
            {/* COLUMN 2: QUICK LINKS */}
            {/* ================================================================ */}
            
            <div className="space-y-4">
              <h3 className="text-white text-lg font-semibold mb-4">
                Quick Links
              </h3>
              <nav className="flex flex-col space-y-3">
                <Link
                  to="/book/service"
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 inline-block"
                >
                  Book Appointment
                </Link>
                <Link
                  to="/search"
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 inline-block"
                >
                  Find Booking
                </Link>
                <Link
                  to="/gallery"
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 inline-block"
                >
                  Gallery
                </Link>
                <Link
                  to="/#about"
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 inline-block"
                >
                  About
                </Link>
                {showAdminLoginLink && (
                  <Link
                    to="/admin/login"
                    className="text-gray-500 hover:text-amber-400 transition-colors text-xs py-1 inline-block"
                  >
                    Admin Login
                  </Link>
                )}
              </nav>
            </div>
            
            {/* ================================================================ */}
            {/* COLUMN 3: LEGAL LINKS */}
            {/* ================================================================ */}
            
            <div className="space-y-4">
              <h3 className="text-white text-lg font-semibold mb-4">
                Legal
              </h3>
              <nav className="flex flex-col space-y-3">
                <button
                  onClick={openTermsModal}
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 text-left"
                >
                  Terms of Service
                </button>
                <button
                  onClick={openPrivacyModal}
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 text-left"
                >
                  Privacy Policy
                </button>
                <button
                  onClick={openCancellationModal}
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 text-left"
                >
                  Cancellation Policy
                </button>
                <a
                  href={`mailto:${shopEmail || 'info@barberslot.com'}`}
                  className="text-gray-300 hover:text-amber-400 transition-colors text-sm py-1 inline-block"
                >
                  Contact Us
                </a>
              </nav>
            </div>
            
            {/* ================================================================ */}
            {/* COLUMN 4: SOCIAL MEDIA */}
            {/* ================================================================ */}
            
            <div className="space-y-4">
              <h3 className="text-white text-lg font-semibold mb-4">
                Follow Us
              </h3>
              <div className="flex space-x-4">
                
                {/* Facebook */}
                {socialFacebook && (
                  <a
                    href={socialFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow us on Facebook"
                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
                
                {/* Instagram */}
                {socialInstagram && (
                  <a
                    href={socialInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow us on Instagram"
                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                )}
                
                {/* Twitter */}
                {socialTwitter && (
                  <a
                    href={socialTwitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow us on Twitter"
                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-400 transition-colors backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {/* ================================================================== */}
          {/* BRANDING SECTION - Bottom Row */}
          {/* ================================================================== */}
          
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-gray-400">
            <p>
              &copy; {currentYear} {shopName || 'Master Fade'}. All rights reserved.
            </p>
            <p className="mt-2 text-xs">
              13 Synnott Pl, Phibsborough, Dublin 7, D07 E7N5 | {shopPhone || '+353833276229'}
            </p>
          </div>
        </div>
      </footer>
      
      {/* ====================================================================== */}
      {/* MODALS - Terms, Privacy, Cancellation Policy */}
      {/* ====================================================================== */}
      
      {/* Terms of Service Modal */}
      {termsModalOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={closeAllModals}
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div 
              className="inline-block w-full max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  Terms of Service
                </h3>
                <button
                  onClick={closeAllModals}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none text-gray-700 max-h-96 overflow-y-auto">
                <p className="mb-4">
                  Welcome to {shopName}. By accessing and using our services, you agree to be bound by these Terms of Service.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">1. Booking & Appointments</h4>
                <p className="mb-4">
                  - All bookings must be made through our online system or by phone.<br/>
                  - Cancellations must be made at least 2 hours before your scheduled appointment.<br/>
                  - No-shows may result in restrictions on future bookings.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">2. Services</h4>
                <p className="mb-4">
                  - Services are provided by licensed professionals.<br/>
                  - Service duration and pricing are subject to change.<br/>
                  - Special requests are accommodated when possible but not guaranteed.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">3. Customer Conduct</h4>
                <p className="mb-4">
                  - Respectful behavior is required at all times.<br/>
                  - The shop reserves the right to refuse service.<br/>
                  - Damage to property will result in charges.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">4. Liability</h4>
                <p className="mb-4">
                  - {shopName} is not liable for personal items lost or stolen.<br/>
                  - We are not responsible for allergic reactions to products.<br/>
                  - Service results may vary based on individual hair type and condition.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">5. Changes to Terms</h4>
                <p className="mb-4">
                  We reserve the right to modify these terms at any time. Continued use of our services constitutes acceptance of updated terms.
                </p>
                
                <p className="mt-6 text-sm text-gray-500">
                   Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeAllModals}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md hover:from-red-700 hover:to-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Privacy Policy Modal */}
      {privacyModalOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={closeAllModals}
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div 
              className="inline-block w-full max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  Privacy Policy
                </h3>
                <button
                  onClick={closeAllModals}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none text-gray-700 max-h-96 overflow-y-auto">
                <p className="mb-4">
                  At {shopName}, we are committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">1. Information We Collect</h4>
                <p className="mb-4">
                  - Name, email address, and phone number for bookings<br/>
                  - Appointment preferences and special requests<br/>
                  - Payment information (processed securely by third-party providers)<br/>
                  - Usage data and cookies for website functionality
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">2. How We Use Your Information</h4>
                <p className="mb-4">
                  - To process and confirm your bookings<br/>
                  - To send appointment reminders and notifications<br/>
                  - To improve our services and customer experience<br/>
                  - To comply with legal obligations
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">3. Information Sharing</h4>
                <p className="mb-4">
                  - We do not sell your personal information to third parties<br/>
                  - Information is shared only with service providers necessary for operations<br/>
                  - We may disclose information if required by law
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">4. Data Security</h4>
                <p className="mb-4">
                  - We use industry-standard encryption to protect your data<br/>
                  - Access to personal information is restricted to authorized personnel<br/>
                  - Regular security audits are conducted
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">5. Your Rights</h4>
                <p className="mb-4">
                  - You can access, update, or delete your personal information<br/>
                  - You can opt-out of marketing communications<br/>
                  - You can request a copy of your data
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">6. Cookies</h4>
                <p className="mb-4">
                  Our website uses cookies to enhance user experience. You can disable cookies in your browser settings, though this may affect functionality.
                </p>
                
                <p className="mt-6 text-sm text-gray-500">
                   Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeAllModals}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md hover:from-red-700 hover:to-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Cancellation Policy Modal */}
      {cancellationModalOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={closeAllModals}
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div 
              className="inline-block w-full max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  Cancellation Policy
                </h3>
                <button
                  onClick={closeAllModals}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none text-gray-700 max-h-96 overflow-y-auto">
                <p className="mb-4">
                  We understand that plans can change. Please review our cancellation policy below.
                </p>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">Cancellation Window</h4>
                <p className="mb-4">
                  You can cancel your appointment <strong>up to 2 hours before</strong> your scheduled time without any penalty. Cancellations can be made through:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Your booking confirmation email</li>
                  <li>Our website using your ticket number</li>
                  <li>Calling us at {shopPhone || '(555) 123-4567'}</li>
                </ul>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">Late Cancellations</h4>
                <p className="mb-4">
                  Cancellations made <strong>less than 2 hours before</strong> your appointment time cannot be processed online. Please contact us directly:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Phone: {shopPhone || '(555) 123-4567'}</li>
                  <li>Email: {shopEmail || 'info@barberslot.com'}</li>
                </ul>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">No-Show Policy</h4>
                <p className="mb-4">
                  If you miss your appointment without cancelling:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Your booking will be marked as a no-show</li>
                  <li>Repeated no-shows may result in booking restrictions</li>
                  <li>We appreciate your understanding as this helps us serve all customers better</li>
                </ul>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">Rescheduling</h4>
                <p className="mb-4">
                  To reschedule your appointment:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Cancel your existing booking (following the 2-hour rule)</li>
                  <li>Create a new booking for your preferred date and time</li>
                  <li>Your service preferences will be saved for convenience</li>
                </ul>
                
                <h4 className="text-lg font-semibold mt-6 mb-2">Emergency Situations</h4>
                <p className="mb-4">
                  We understand emergencies happen. If you need to cancel due to an emergency, please contact us as soon as possible. We'll do our best to accommodate your situation.
                </p>
                
                <p className="mt-6 text-sm text-gray-500">
                   Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeAllModals}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md hover:from-red-700 hover:to-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_Footer;