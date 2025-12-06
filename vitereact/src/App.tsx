import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// ============================================================================
// IMPORT ALL VIEWS
// ============================================================================

// Global Shared Views
import GV_TopNav from '@/components/views/GV_TopNav';
import GV_Footer from '@/components/views/GV_Footer';
import GV_MobileNav from '@/components/views/GV_MobileNav';
import GV_NotificationToast from '@/components/views/GV_NotificationToast';
import GV_LoadingOverlay from '@/components/views/GV_LoadingOverlay';
import GV_ErrorModal from '@/components/views/GV_ErrorModal';

// Public Views
import UV_Landing from '@/components/views/UV_Landing';
import UV_BookingFlow_ServiceSelect from '@/components/views/UV_BookingFlow_ServiceSelect';
import UV_BookingFlow_DateSelect from '@/components/views/UV_BookingFlow_DateSelect';
import UV_BookingFlow_TimeSelect from '@/components/views/UV_BookingFlow_TimeSelect';
import UV_BookingFlow_Details from '@/components/views/UV_BookingFlow_Details';
import UV_BookingFlow_Review from '@/components/views/UV_BookingFlow_Review';
import UV_BookingConfirmation from '@/components/views/UV_BookingConfirmation';
import UV_BookingSearch from '@/components/views/UV_BookingSearch';
import UV_BookingDetails from '@/components/views/UV_BookingDetails';
import UV_CallOutBooking from '@/components/views/UV_CallOutBooking';
import UV_CallOutConfirmation from '@/components/views/UV_CallOutConfirmation';
import UV_JoinQueue from '@/components/views/UV_JoinQueue';
import UV_QueueStatus from '@/components/views/UV_QueueStatus';
import UV_Gallery from '@/components/views/UV_Gallery';
import UV_Registration from '@/components/views/UV_Registration';
import UV_Login from '@/components/views/UV_Login';
import UV_EmailVerificationPending from '@/components/views/UV_EmailVerificationPending';
import UV_EmailVerificationSuccess from '@/components/views/UV_EmailVerificationSuccess';
import UV_PasswordResetRequest from '@/components/views/UV_PasswordResetRequest';
import UV_PasswordResetForm from '@/components/views/UV_PasswordResetForm';
import UV_PasswordResetSuccess from '@/components/views/UV_PasswordResetSuccess';

// User Protected Views
import UV_UserDashboard from '@/components/views/UV_UserDashboard';
import UV_UserProfile from '@/components/views/UV_UserProfile';

// Admin Views
import UV_AdminLogin from '@/components/views/UV_AdminLogin';
import UV_AdminDashboardHome from '@/components/views/UV_AdminDashboardHome';
import UV_AdminQueueDashboard from '@/components/views/UV_AdminQueueDashboard';
import UV_AdminBookingsCalendar from '@/components/views/UV_AdminBookingsCalendar';
import UV_AdminBookingsList from '@/components/views/UV_AdminBookingsList';
import UV_AdminBookingDetail from '@/components/views/UV_AdminBookingDetail';
import UV_AdminAddBooking from '@/components/views/UV_AdminAddBooking';
import UV_AdminCapacitySettings from '@/components/views/UV_AdminCapacitySettings';
import UV_AdminBlockingSettings from '@/components/views/UV_AdminBlockingSettings';
import UV_AdminGalleryManage from '@/components/views/UV_AdminGalleryManage';
import UV_AdminGalleryUpload from '@/components/views/UV_AdminGalleryUpload';
import UV_AdminCustomerList from '@/components/views/UV_AdminCustomerList';
import UV_AdminCustomerDetail from '@/components/views/UV_AdminCustomerDetail';
import UV_AdminBarbersList from '@/components/views/UV_AdminBarbersList';
import UV_AdminSettings from '@/components/views/UV_AdminSettings';
import UV_AdminReports from '@/components/views/UV_AdminReports';

// Transition Components
import { PageTransitionProvider, usePageTransition } from '@/hooks/usePageTransition';
import ScissorsTransition from '@/components/transitions/ScissorsTransition';

// ============================================================================
// REACT QUERY CLIENT CONFIGURATION
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ============================================================================
// LOADING SPINNER COMPONENT
// ============================================================================

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600 text-lg">Loading...</p>
    </div>
  </div>
);

// ============================================================================
// ROUTE PROTECTION COMPONENTS
// ============================================================================

/**
 * ProtectedRoute - Wrapper for user-authenticated routes
 * Checks if user is authenticated and type is 'user'
 * Redirects to /login if not authenticated
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL: Use individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );
  const isLoading = useAppStore(
    state => state.authentication_state.authentication_status.is_loading
  );
  const userType = useAppStore(
    state => state.authentication_state.authentication_status.user_type
  );

  // Show loading spinner during auth check
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated or not a user
  if (!isAuthenticated || userType !== 'user') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * AdminProtectedRoute - Wrapper for admin-authenticated routes
 * Checks if user is authenticated and type is 'admin'
 * Redirects to /admin/login if not authenticated
 */
const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL: Use individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );
  const isLoading = useAppStore(
    state => state.authentication_state.authentication_status.is_loading
  );
  const userType = useAppStore(
    state => state.authentication_state.authentication_status.user_type
  );

  // Show loading spinner during auth check
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to admin login if not authenticated or not an admin
  if (!isAuthenticated || userType !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  // CRITICAL: Individual selectors, no object destructuring
  const isLoading = useAppStore(
    state => state.authentication_state.authentication_status.is_loading
  );
  const initializeAuth = useAppStore(state => state.initialize_auth);
  const fetchAppSettings = useAppStore(state => state.fetch_app_settings);

  // Initialize authentication and app settings on mount
  useEffect(() => {
    const initializeApp = async () => {
      await initializeAuth();
      await fetchAppSettings();
    };
    initializeApp();
  }, [initializeAuth, fetchAppSettings]);

  // Show loading spinner during initial auth check
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <PageTransitionProvider>
          <AppContent />
        </PageTransitionProvider>
      </QueryClientProvider>
    </Router>
  );
};

/**
 * AppContent - Inner component with access to PageTransition context
 */
const AppContent: React.FC = () => {
  const { isTransitioning } = usePageTransition();

  return (
    <>
      <div className="App min-h-screen flex flex-col bg-gray-50">
        {/* Global Top Navigation - appears on all pages */}
        <GV_TopNav />

        {/* Mobile Navigation - triggered from TopNav hamburger */}
        <GV_MobileNav />

        {/* Main Content Area */}
        <main className="flex-1">
            <Routes>
              {/* ============================================================ */}
              {/* PUBLIC ROUTES - Accessible to all users */}
              {/* ============================================================ */}

              {/* Landing Page */}
              <Route path="/" element={<UV_Landing />} />

              {/* Standard Booking Flow - 5 Steps (In-Shop Appointments) */}
              <Route path="/book/service" element={<UV_BookingFlow_ServiceSelect />} />
              <Route path="/book/date" element={<UV_BookingFlow_DateSelect />} />
              <Route path="/book/time" element={<UV_BookingFlow_TimeSelect />} />
              <Route path="/book/details" element={<UV_BookingFlow_Details />} />
              <Route path="/book/review" element={<UV_BookingFlow_Review />} />

              {/* Call-Out Service Flow */}
              <Route path="/callout/book" element={<UV_CallOutBooking />} />
              <Route path="/callout/confirmation" element={<UV_CallOutConfirmation />} />

              {/* Walk-In Queue Flow */}
              <Route path="/queue/join" element={<UV_JoinQueue />} />
              <Route path="/queue/status" element={<UV_QueueStatus />} />

              {/* Booking Management */}
              <Route path="/booking/confirmation" element={<UV_BookingConfirmation />} />
              <Route path="/booking/:ticket_number" element={<UV_BookingDetails />} />
              <Route path="/search" element={<UV_BookingSearch />} />

              {/* Gallery */}
              <Route path="/gallery" element={<UV_Gallery />} />

              {/* Authentication - User */}
              <Route path="/register" element={<UV_Registration />} />
              <Route path="/login" element={<UV_Login />} />

              {/* Email Verification */}
              <Route path="/verify-email" element={<UV_EmailVerificationPending />} />
              <Route path="/verify-email/success" element={<UV_EmailVerificationSuccess />} />

              {/* Password Reset */}
              <Route path="/reset-password" element={<UV_PasswordResetRequest />} />
              <Route path="/reset-password/confirm" element={<UV_PasswordResetForm />} />
              <Route path="/reset-password/success" element={<UV_PasswordResetSuccess />} />

              {/* Admin Login */}
              <Route path="/admin/login" element={<UV_AdminLogin />} />

              {/* ============================================================ */}
              {/* USER PROTECTED ROUTES - Require user authentication */}
              {/* ============================================================ */}

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <UV_UserDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UV_UserProfile />
                  </ProtectedRoute>
                }
              />

              {/* ============================================================ */}
              {/* ADMIN PROTECTED ROUTES - Require admin authentication */}
              {/* ============================================================ */}

              {/* Admin Dashboard */}
              <Route
                path="/admin"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminDashboardHome />
                  </AdminProtectedRoute>
                }
              />

              {/* Queue & Call-Out Management */}
              <Route
                path="/admin/queue"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminQueueDashboard />
                  </AdminProtectedRoute>
                }
              />

              {/* Bookings Management */}
              <Route
                path="/admin/bookings/calendar"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminBookingsCalendar />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/bookings"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminBookingsList />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/bookings/new"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminAddBooking />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/bookings/:ticket_number"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminBookingDetail />
                  </AdminProtectedRoute>
                }
              />

              {/* Capacity & Blocking */}
              <Route
                path="/admin/capacity"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminCapacitySettings />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/blocking"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminBlockingSettings />
                  </AdminProtectedRoute>
                }
              />

              {/* Gallery Management */}
              <Route
                path="/admin/gallery"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminGalleryManage />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/gallery/upload"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminGalleryUpload />
                  </AdminProtectedRoute>
                }
              />

              {/* Customer Management */}
              <Route
                path="/admin/customers"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminCustomerList />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/customers/:customer_id"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminCustomerDetail />
                  </AdminProtectedRoute>
                }
              />

              {/* Barber Management */}
              <Route
                path="/admin/barbers"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminBarbersList />
                  </AdminProtectedRoute>
                }
              />

              {/* Settings & Reports */}
              <Route
                path="/admin/settings"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminSettings />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/reports"
                element={
                  <AdminProtectedRoute>
                    <UV_AdminReports />
                  </AdminProtectedRoute>
                }
              />

              {/* ============================================================ */}
              {/* FALLBACK ROUTE - Catch all unmatched routes */}
              {/* ============================================================ */}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Global Footer - appears on all pages */}
          <GV_Footer />

          {/* ============================================================ */}
          {/* GLOBAL OVERLAYS - Rendered based on internal state */}
          {/* ============================================================ */}

          {/* Toast notifications for user feedback */}
          <GV_NotificationToast />

          {/* Loading overlay during async operations */}
          <GV_LoadingOverlay />

          {/* Error modal for critical errors */}
          <GV_ErrorModal />
        </div>

        {/* ============================================================ */}
        {/* PAGE TRANSITION OVERLAY - Scissors animation */}
        {/* ============================================================ */}
        <ScissorsTransition isActive={isTransitioning} />
      </>
    );
};

export default App;