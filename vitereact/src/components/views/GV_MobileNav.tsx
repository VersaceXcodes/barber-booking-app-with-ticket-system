import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * GV_MobileNav - Mobile Hamburger Navigation Menu
 * 
 * Collapsible slide-out navigation menu for mobile and tablet devices.
 * Triggered from hamburger icon in GV_TopNav via custom event.
 * 
 * Features:
 * - Full-screen overlay with semi-transparent backdrop
 * - Smooth slide-in/out animations
 * - Different navigation based on user type (guest/user/admin)
 * - Focus trap for accessibility
 * - ESC key and backdrop click to close
 * - Auto-closes on navigation
 * - Expandable sections for admin menu
 */
const GV_MobileNav: React.FC = () => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  
  // ========================================================================
  // REFS
  // ========================================================================
  
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  // ========================================================================
  // ROUTER HOOKS
  // ========================================================================
  
  const location = useLocation();
  const navigate = useNavigate();
  
  // ========================================================================
  // ZUSTAND STORE - CRITICAL: Individual selectors to avoid infinite loops
  // ========================================================================
  
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );
  const userType = useAppStore(
    state => state.authentication_state.authentication_status.user_type
  );
  const currentUser = useAppStore(
    state => state.authentication_state.current_user
  );
  const logout = useAppStore(state => state.logout);
  
  // ========================================================================
  // HANDLERS
  // ========================================================================
  
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setExpandedSections(new Set());
  }, []);
  
  const handleBackdropClick = useCallback(() => {
    handleClose();
  }, [handleClose]);
  
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);
  
  const handleLogout = useCallback(() => {
    logout();
    handleClose();
    navigate('/');
  }, [logout, navigate, handleClose]);
  
  const isCurrentPage = useCallback((path: string) => {
    return location.pathname === path;
  }, [location.pathname]);
  
  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  // Auto-close menu on route change
  useEffect(() => {
    setIsOpen(false);
    setExpandedSections(new Set());
  }, [location.pathname]);
  
  // Handle ESC key to close menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose]);
  
  // Focus trap implementation
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    
    // Store the element that triggered the menu (for focus return)
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    const menu = menuRef.current;
    const focusableElements = menu.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    document.addEventListener('keydown', handleTab);
    
    // Focus close button on open (with slight delay for animation)
    setTimeout(() => closeButtonRef.current?.focus(), 100);
    
    return () => {
      document.removeEventListener('keydown', handleTab);
      // Return focus to trigger element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);
  
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  // Listen for custom event to toggle from GV_TopNav
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggleMobileNav', handleToggle);
    return () => window.removeEventListener('toggleMobileNav', handleToggle);
  }, []);
  
  // Handle viewport resize - close if desktop size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && isOpen) {
        handleClose();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, handleClose]);
  
  // ========================================================================
  // RENDER PROTECTION
  // ========================================================================
  
  // Don't render on desktop when closed
  if (!isMobile && !isOpen) return null;
  
  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <>
      {/* Backdrop - Dark semi-transparent overlay */}
      {isOpen && (
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black bg-opacity-50 z-[9998] transition-opacity duration-300"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}
      
      {/* Menu Panel - Slide-out from left */}
      <div
        ref={menuRef}
        className={`fixed top-0 left-0 h-full w-4/5 max-w-sm bg-white z-[9999] transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation Menu"
      >
        {/* Header with Close Button - Sticky */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-master-text-primary-light">Menu</h2>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close menu"
          >
            <X className="h-6 w-6 text-master-text-secondary-dark" />
          </button>
        </div>
        
        {/* User Info Card - Only for authenticated users */}
        {isAuthenticated && currentUser && (
          <div className="p-4 bg-blue-50 border-b border-blue-100">
            <p className="text-sm font-medium text-master-text-primary-light">{currentUser.name}</p>
            <p className="text-xs text-master-text-muted-dark mt-1">{currentUser.email}</p>
          </div>
        )}
        
        {/* Navigation Links - Conditional based on user type */}
        <nav className="py-4" role="navigation">
          {/* ============================================================ */}
          {/* GUEST NAVIGATION */}
          {/* ============================================================ */}
          {!isAuthenticated && (
            <>
              <Link
                to="/"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/') ? 'page' : undefined}
              >
                Home
              </Link>
              
              <Link
                to="/book/service"
                className="block px-6 py-3 text-base font-semibold bg-blue-600 text-master-text-primary-dark hover:bg-blue-700 transition-colors mx-4 my-2 rounded-lg text-center shadow-md"
              >
                Book Appointment
              </Link>
              
              <Link
                to="/gallery"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/gallery') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/gallery') ? 'page' : undefined}
              >
                Our Work
              </Link>
              
              <Link
                to="/search"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/search') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/search') ? 'page' : undefined}
              >
                Find My Booking
              </Link>
              
              <div className="border-t border-gray-200 my-4" role="separator"></div>
              
              <Link
                to="/register"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/register') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/register') ? 'page' : undefined}
              >
                Sign Up
              </Link>
              
              <Link
                to="/login"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/login') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/login') ? 'page' : undefined}
              >
                Log In
              </Link>
            </>
          )}
          
          {/* ============================================================ */}
          {/* USER NAVIGATION */}
          {/* ============================================================ */}
          {isAuthenticated && userType === 'user' && (
            <>
              <Link
                to="/dashboard"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/dashboard') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/dashboard') ? 'page' : undefined}
              >
                Dashboard
              </Link>
              
              <Link
                to="/book/service"
                className="block px-6 py-3 text-base font-semibold bg-blue-600 text-master-text-primary-dark hover:bg-blue-700 transition-colors mx-4 my-2 rounded-lg text-center shadow-md"
              >
                Book Appointment
              </Link>
              
              <Link
                to="/dashboard?tab=upcoming"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  location.pathname === '/dashboard' 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
              >
                My Bookings
              </Link>
              
              <Link
                to="/gallery"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/gallery') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/gallery') ? 'page' : undefined}
              >
                Gallery
              </Link>
              
              <Link
                to="/profile"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/profile') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/profile') ? 'page' : undefined}
              >
                Profile Settings
              </Link>
              
              <div className="border-t border-gray-200 my-4" role="separator"></div>
              
              <button
                onClick={handleLogout}
                className="block w-full text-left px-6 py-3 text-base font-medium text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Logout
              </button>
            </>
          )}
          
          {/* ============================================================ */}
          {/* ADMIN NAVIGATION */}
          {/* ============================================================ */}
          {isAuthenticated && userType === 'admin' && (
            <>
              <Link
                to="/admin"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/admin') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/admin') ? 'page' : undefined}
              >
                Dashboard
              </Link>
              
              {/* Expandable Bookings Section */}
              <div>
                <button
                  onClick={() => toggleSection('bookings')}
                  className="flex items-center justify-between w-full px-6 py-3 text-base font-medium text-master-text-secondary-dark hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-expanded={expandedSections.has('bookings')}
                  aria-controls="bookings-submenu"
                >
                  <span>Bookings</span>
                  {expandedSections.has('bookings') ? (
                    <ChevronDown className="h-5 w-5 text-master-text-muted-dark" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-master-text-muted-dark" aria-hidden="true" />
                  )}
                </button>
                
                {expandedSections.has('bookings') && (
                  <div id="bookings-submenu" className="bg-gray-50">
                    <Link
                      to="/admin/bookings/calendar"
                      className={`block pl-12 pr-6 py-3 text-sm font-medium transition-colors ${
                        isCurrentPage('/admin/bookings/calendar') 
                          ? 'text-blue-600 bg-blue-50' 
                          : 'text-master-text-muted-dark hover:bg-gray-100'
                      }`}
                      aria-current={isCurrentPage('/admin/bookings/calendar') ? 'page' : undefined}
                    >
                      Calendar View
                    </Link>
                    
                    <Link
                      to="/admin/bookings"
                      className={`block pl-12 pr-6 py-3 text-sm font-medium transition-colors ${
                        isCurrentPage('/admin/bookings') 
                          ? 'text-blue-600 bg-blue-50' 
                          : 'text-master-text-muted-dark hover:bg-gray-100'
                      }`}
                      aria-current={isCurrentPage('/admin/bookings') ? 'page' : undefined}
                    >
                      List View
                    </Link>
                  </div>
                )}
              </div>
              
              <Link
                to="/admin/customers"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/admin/customers') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/admin/customers') ? 'page' : undefined}
              >
                Customers
              </Link>
              
              <Link
                to="/admin/gallery"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/admin/gallery') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/admin/gallery') ? 'page' : undefined}
              >
                Gallery
              </Link>
              
              <Link
                to="/admin/reports"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/admin/reports') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/admin/reports') ? 'page' : undefined}
              >
                Reports
              </Link>
              
              <Link
                to="/admin/settings"
                className={`block px-6 py-3 text-base font-medium transition-colors ${
                  isCurrentPage('/admin/settings') 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-master-text-secondary-dark hover:bg-gray-50'
                }`}
                aria-current={isCurrentPage('/admin/settings') ? 'page' : undefined}
              >
                Settings
              </Link>
              
              <div className="border-t border-gray-200 my-4" role="separator"></div>
              
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-6 py-3 text-base font-medium text-master-text-secondary-dark hover:bg-gray-50 transition-colors"
              >
                View Public Site
              </a>
              
              <button
                onClick={handleLogout}
                className="block w-full text-left px-6 py-3 text-base font-medium text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  );
};

/**
 * Export function to toggle mobile nav from GV_TopNav
 * Usage: import { toggleMobileNav } from '@/components/views/GV_MobileNav';
 *        toggleMobileNav(); // Call from hamburger button click handler
 */
export const toggleMobileNav = () => {
  window.dispatchEvent(new CustomEvent('toggleMobileNav'));
};

export default GV_MobileNav;