import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { Menu, X, ChevronDown, User, LogOut, Settings, Home, Calendar, Scissors } from 'lucide-react';
import { usePageTransition } from '@/hooks/usePageTransition';

const GV_TopNav: React.FC = () => {
  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [bookingsDropdownOpen, setBookingsDropdownOpen] = useState(false);

  // ============================================================================
  // REFS FOR DROPDOWN CLICK OUTSIDE DETECTION
  // ============================================================================
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const bookingsDropdownRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // ROUTER & TRANSITIONS
  // ============================================================================
  const navigate = useNavigate();
  const location = useLocation();
  const { transitionTo } = usePageTransition();

  // ============================================================================
  // GLOBAL STATE (CRITICAL: Individual selectors to avoid infinite loops)
  // ============================================================================
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );
  const userType = useAppStore(
    state => state.authentication_state.authentication_status.user_type
  );
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const shopName = useAppStore(state => state.app_settings.shop_name);
  const servicesEnabled = useAppStore(state => state.app_settings.services_enabled);
  const logout = useAppStore(state => state.logout);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogout = () => {
    logout();
    
    // Redirect based on user type
    if (userType === 'admin') {
      navigate('/admin/login');
    } else {
      navigate('/');
    }

    // Close dropdowns
    setUserDropdownOpen(false);
    setAdminDropdownOpen(false);
  };

  const toggleUserDropdown = () => {
    setUserDropdownOpen(!userDropdownOpen);
    setAdminDropdownOpen(false);
    setBookingsDropdownOpen(false);
  };

  const toggleAdminDropdown = () => {
    setAdminDropdownOpen(!adminDropdownOpen);
    setUserDropdownOpen(false);
    setBookingsDropdownOpen(false);
  };

  const toggleBookingsDropdown = () => {
    setBookingsDropdownOpen(!bookingsDropdownOpen);
    setUserDropdownOpen(false);
    setAdminDropdownOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const getBookingStartPath = (): string => {
    return servicesEnabled ? '/book/service' : '/book/date';
  };

  const getLogoLink = (): string => {
    if (!isAuthenticated) return '/';
    if (userType === 'admin') return '/admin';
    return '/';
  };

  const isActiveLink = (path: string): boolean => {
    return location.pathname === path;
  };

  // ============================================================================
  // CLICK OUTSIDE HANDLER
  // ============================================================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(event.target as Node)
      ) {
        setAdminDropdownOpen(false);
      }
      if (
        bookingsDropdownRef.current &&
        !bookingsDropdownRef.current.contains(event.target as Node)
      ) {
        setBookingsDropdownOpen(false);
      }
    };

    if (userDropdownOpen || adminDropdownOpen || bookingsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userDropdownOpen, adminDropdownOpen, bookingsDropdownOpen]);

  // ============================================================================
  // ESC KEY HANDLER
  // ============================================================================
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
        setAdminDropdownOpen(false);
        setBookingsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // ============================================================================
  // WINDOW RESIZE HANDLER - Close mobile menu when resizing to desktop
  // ============================================================================
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);

  // ============================================================================
  // RENDER - GUEST NAVIGATION
  // ============================================================================
  const renderGuestNav = () => (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-8">
        <Link
          to="/"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Home
        </Link>
        <Link
          to={getBookingStartPath()}
          className={`relative text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink(getBookingStartPath()) ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Services
          <span className="absolute -top-1 -right-2 flex items-center">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
              CALL-OUTS
            </span>
          </span>
        </Link>
        <Link
          to="/gallery"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/gallery') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Gallery
        </Link>
        <Link
          to="/search"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/search') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Live Queue
        </Link>
      </div>

      {/* Auth Buttons */}
      <div className="hidden md:flex items-center space-x-4">
        <Link
          to="/login"
          className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-white/30"
        >
          Login
        </Link>
      </div>
    </>
  );

  // ============================================================================
  // RENDER - USER NAVIGATION
  // ============================================================================
  const renderUserNav = () => (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-8">
        <button
          onClick={() => transitionTo(getBookingStartPath())}
          className="bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20"
        >
          Book Appointment
        </button>
        <Link
          to="/dashboard"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/dashboard') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          My Bookings
        </Link>
        <Link
          to="/gallery"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/gallery') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Gallery
        </Link>
      </div>

      {/* User Profile Dropdown */}
      <div className="hidden md:block relative" ref={userDropdownRef}>
        <button
          onClick={toggleUserDropdown}
          onKeyDown={(e) => e.key === 'Enter' && toggleUserDropdown()}
          className="flex items-center space-x-2 text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
          aria-label="User menu"
          aria-expanded={userDropdownOpen}
          aria-haspopup="true"
        >
          <User size={20} />
          <span className="max-w-32 truncate">{currentUser?.name || currentUser?.email}</span>
          <ChevronDown size={16} className={`transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {userDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
            <Link
              to="/dashboard"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setUserDropdownOpen(false)}
            >
              <div className="flex items-center space-x-2">
                <Home size={16} />
                <span>Dashboard</span>
              </div>
            </Link>
            <Link
              to="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setUserDropdownOpen(false)}
            >
              <div className="flex items-center space-x-2">
                <Settings size={16} />
                <span>Profile Settings</span>
              </div>
            </Link>
            <hr className="my-1 border-gray-200" />
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <LogOut size={16} />
                <span>Logout</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );

  // ============================================================================
  // RENDER - ADMIN NAVIGATION
  // ============================================================================
  const renderAdminNav = () => (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-6">
        <Link
          to="/admin"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/admin') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Dashboard
        </Link>

        <Link
          to="/admin/queue"
          className={`relative text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/admin/queue') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Call-Outs
          <span className="absolute -top-1 -right-1 flex items-center">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </Link>

        {/* Bookings Dropdown */}
        <div className="relative" ref={bookingsDropdownRef}>
          <button
            onClick={toggleBookingsDropdown}
            onKeyDown={(e) => e.key === 'Enter' && toggleBookingsDropdown()}
            className={`flex items-center space-x-1 text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors ${
              location.pathname.startsWith('/admin/bookings') ? 'text-white font-semibold bg-red-800/30' : ''
            }`}
            aria-label="Bookings menu"
            aria-expanded={bookingsDropdownOpen}
            aria-haspopup="true"
          >
            <span>Bookings</span>
            <ChevronDown size={16} className={`transition-transform ${bookingsDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {bookingsDropdownOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
              <Link
                to="/admin/bookings/calendar"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setBookingsDropdownOpen(false)}
              >
                <div className="flex items-center space-x-2">
                  <Calendar size={16} />
                  <span>Calendar View</span>
                </div>
              </Link>
              <Link
                to="/admin/bookings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setBookingsDropdownOpen(false)}
              >
                <div className="flex items-center space-x-2">
                  <Calendar size={16} />
                  <span>List View</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        <Link
          to="/admin/customers"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/admin/customers') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Customers
        </Link>
        <Link
          to="/admin/gallery"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/admin/gallery') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Gallery
        </Link>
        <Link
          to="/admin/settings"
          className={`text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/admin/settings') ? 'text-white font-semibold bg-red-800/30' : ''
          }`}
        >
          Settings
        </Link>
      </div>

      {/* Admin Profile Dropdown */}
      <div className="hidden md:block relative" ref={adminDropdownRef}>
        <button
          onClick={toggleAdminDropdown}
          onKeyDown={(e) => e.key === 'Enter' && toggleAdminDropdown()}
          className="flex items-center space-x-2 text-gray-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
          aria-label="Admin menu"
          aria-expanded={adminDropdownOpen}
          aria-haspopup="true"
        >
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full p-1">
            <User size={16} />
          </div>
          <span className="max-w-32 truncate">{currentUser?.name || 'Admin'}</span>
          <ChevronDown size={16} className={`transition-transform ${adminDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {adminDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setAdminDropdownOpen(false)}
            >
              <div className="flex items-center space-x-2">
                <Home size={16} />
                <span>View Public Site</span>
              </div>
            </a>
            <hr className="my-1 border-gray-200" />
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <LogOut size={16} />
                <span>Logout</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>

      <nav className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 shadow-lg sticky top-0 z-40 border-b-2 border-red-800/30" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Shop Name */}
            <div className="flex items-center">
              <Link
                to={getLogoLink()}
                className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-red-400 rounded-md px-2 py-1 transition-all"
              >
                {/* Logo Icon */}
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-300 via-gray-200 to-gray-400 rounded-lg flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                    <Scissors className="w-6 h-6 text-red-900 transform rotate-45" strokeWidth={2.5} />
                  </div>
                  {/* Metallic shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-transparent rounded-lg pointer-events-none"></div>
                </div>
                {/* Logo Text */}
                <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tight bg-gradient-to-r from-gray-100 via-white to-gray-200 bg-clip-text text-transparent leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                    {shopName}
                  </span>
                  <span className="text-[10px] font-medium text-red-300 tracking-widest uppercase leading-none mt-0.5">
                    Premium Barbers
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation - Conditional based on auth state */}
            <div className="flex items-center space-x-8">
              {!isAuthenticated && renderGuestNav()}
              {isAuthenticated && userType === 'user' && renderUserNav()}
              {isAuthenticated && userType === 'admin' && renderAdminNav()}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-100 hover:text-white hover:bg-red-800/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-400 transition-colors"
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
                data-testid="mobile-menu-button"
              >
                {isMobileMenuOpen ? <X size={24} data-testid="close-icon" /> : <Menu size={24} data-testid="menu-icon" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-red-800/30 bg-gradient-to-br from-red-950 via-red-900 to-red-950" data-testid="mobile-menu-panel">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Guest Mobile Menu */}
              {!isAuthenticated && (
                <>
                  <Link
                    to="/"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    to={getBookingStartPath()}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Services
                  </Link>
                  <Link
                    to="/gallery"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Gallery
                  </Link>
                  <Link
                    to="/search"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Live Queue
                  </Link>
                  <div className="pt-4 border-t border-red-800/30 space-y-2">
                    <Link
                      to="/login"
                      className="block px-3 py-2 rounded-md text-base font-medium bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors text-center border border-white/30"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                  </div>
                </>
              )}

              {/* User Mobile Menu */}
              {isAuthenticated && userType === 'user' && (
                <>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      transitionTo(getBookingStartPath());
                    }}
                    className="block w-full px-3 py-2 rounded-md text-base font-medium bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 transition-colors text-center border border-white/20"
                  >
                    Book Appointment
                  </button>
                  <Link
                    to="/dashboard"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Bookings
                  </Link>
                  <Link
                    to="/gallery"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Gallery
                  </Link>
                  <div className="pt-4 border-t border-red-800/30 space-y-2">
                    <Link
                      to="/profile"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:text-white hover:bg-red-800/50 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}

              {/* Admin Mobile Menu */}
              {isAuthenticated && userType === 'admin' && (
                <>
                  <Link
                    to="/admin"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/bookings/calendar"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Calendar View
                  </Link>
                  <Link
                    to="/admin/bookings"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Bookings List
                  </Link>
                  <Link
                    to="/admin/customers"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Customers
                  </Link>
                  <Link
                    to="/admin/gallery"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Gallery
                  </Link>
                  <Link
                    to="/admin/settings"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <div className="pt-4 border-t border-red-800/30 space-y-2">
                    <a
                      href="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-100 hover:text-white hover:bg-red-800/30 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      View Public Site
                    </a>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:text-white hover:bg-red-800/50 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default GV_TopNav;