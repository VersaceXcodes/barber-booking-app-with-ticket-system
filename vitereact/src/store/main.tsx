import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface User {
  id: string; // Maps to user_id from backend
  email: string;
  name: string;
  phone: string;
  is_verified: boolean;
  created_at: string;
}

interface AuthenticationState {
  current_user: User | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
    user_type: 'guest' | 'user' | 'admin' | null;
  };
  error_message: string | null;
}

interface BookingContext {
  service_id: string | null;
  service_name: string | null;
  selected_date: string | null;
  selected_time: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  booking_for_name: string | null;
  special_request: string | null;
  inspiration_photos: string[] | null;
  step_completed: number;
}

interface AppSettings {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_email: string;
  operating_hours: string;
  capacity_mon_wed: number;
  capacity_thu_sun: number;
  booking_window_days: number;
  same_day_cutoff_hours: number;
  reminder_hours_before: number;
  services_enabled: boolean;
  gallery_enabled: boolean;
}

interface AppState {
  // State
  authentication_state: AuthenticationState;
  booking_context: BookingContext;
  app_settings: AppSettings;

  // Auth Actions
  login_user: (email: string, password: string) => Promise<void>;
  login_admin: (email: string, password: string, two_factor_code?: string) => Promise<{ requires_2fa: boolean }>;
  register_user: (email: string, password: string, name: string, phone: string) => Promise<void>;
  logout: () => void;
  initialize_auth: () => Promise<void>;
  clear_auth_error: () => void;
  update_current_user: (user: Partial<User>) => void;

  // Booking Context Actions
  update_booking_context: (updates: Partial<BookingContext>) => void;
  clear_booking_context: () => void;
  set_booking_step: (step: number) => void;
  populate_booking_from_user: () => void;

  // Settings Actions
  fetch_app_settings: () => Promise<void>;
  update_app_settings: (settings: Partial<AppSettings>) => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initial_authentication_state: AuthenticationState = {
  current_user: null,
  auth_token: null,
  authentication_status: {
    is_authenticated: false,
    is_loading: true, // Start as loading for initial auth check
    user_type: null,
  },
  error_message: null,
};

const initial_booking_context: BookingContext = {
  service_id: null,
  service_name: null,
  selected_date: null,
  selected_time: null,
  customer_name: null,
  customer_email: null,
  customer_phone: null,
  booking_for_name: null,
  special_request: null,
  inspiration_photos: null,
  step_completed: 0,
};

const initial_app_settings: AppSettings = {
  shop_name: 'BarberSlot',
  shop_address: '',
  shop_phone: '',
  shop_email: '',
  operating_hours: '10:00 AM - 3:00 PM',
  capacity_mon_wed: 2,
  capacity_thu_sun: 3,
  booking_window_days: 90,
  same_day_cutoff_hours: 2,
  reminder_hours_before: 2,
  services_enabled: true,
  gallery_enabled: true,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const get_api_base_url = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

// Map backend user object to frontend User type (user_id -> id)
const map_backend_user_to_frontend = (backend_user: any): User => {
  return {
    id: backend_user.user_id,
    email: backend_user.email,
    name: backend_user.name,
    phone: backend_user.phone,
    is_verified: backend_user.is_verified,
    created_at: backend_user.created_at,
  };
};

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ======================================================================
      // INITIAL STATE
      // ======================================================================
      authentication_state: initial_authentication_state,
      booking_context: initial_booking_context,
      app_settings: initial_app_settings,

      // ======================================================================
      // AUTH ACTIONS
      // ======================================================================

      login_user: async (email: string, password: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${get_api_base_url()}/api/auth/login`,
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token } = response.data;
          const mapped_user = map_backend_user_to_frontend(user);

          set(() => ({
            authentication_state: {
              current_user: mapped_user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
                user_type: 'user',
              },
              error_message: null,
            },
          }));
        } catch (error: any) {
          const error_message = error.response?.data?.error?.message || error.message || 'Login failed';

          set(() => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
                user_type: null,
              },
              error_message: error_message,
            },
          }));

          throw new Error(error_message);
        }
      },

      login_admin: async (email: string, password: string, two_factor_code?: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const request_body: any = { email, password };
          if (two_factor_code) {
            request_body.two_factor_code = two_factor_code;
          }

          const response = await axios.post(
            `${get_api_base_url()}/api/admin/login`,
            request_body,
            { headers: { 'Content-Type': 'application/json' } }
          );

          // Check if 2FA is required
          if (response.data.requires_2fa) {
            set((state) => ({
              authentication_state: {
                ...state.authentication_state,
                authentication_status: {
                  ...state.authentication_state.authentication_status,
                  is_loading: false,
                },
                error_message: 'Two-factor authentication required',
              },
            }));
            return { requires_2fa: true };
          }

          const { user, token } = response.data;
          const mapped_user = map_backend_user_to_frontend(user);

          set(() => ({
            authentication_state: {
              current_user: mapped_user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
                user_type: 'admin',
              },
              error_message: null,
            },
          }));

          return { requires_2fa: false };
        } catch (error: any) {
          const error_message = error.response?.data?.error?.message || error.message || 'Admin login failed';

          set(() => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
                user_type: null,
              },
              error_message: error_message,
            },
          }));

          throw new Error(error_message);
        }
      },

      register_user: async (email: string, password: string, name: string, phone: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          await axios.post(
            `${get_api_base_url()}/api/auth/register`,
            { email, password, name, phone },
            { headers: { 'Content-Type': 'application/json' } }
          );

          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
              error_message: null,
            },
          }));
        } catch (error: any) {
          const error_message = error.response?.data?.error?.message || error.message || 'Registration failed';

          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
              error_message: error_message,
            },
          }));

          throw new Error(error_message);
        }
      },

      logout: () => {
        // Call backend logout endpoint (optional - JWT is stateless)
        const { authentication_state } = get();
        const token = authentication_state.auth_token;
        
        if (token) {
          axios.post(
            `${get_api_base_url()}/api/auth/logout`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => {
            // Ignore logout errors - clear local state anyway
          });
        }

        set({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: {
              is_authenticated: false,
              is_loading: false,
              user_type: null,
            },
            error_message: null,
          },
        });
      },

      initialize_auth: async () => {
        const { authentication_state } = get();
        const token = authentication_state.auth_token;

        if (!token) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
                user_type: null,
              },
            },
          }));
          return;
        }

        try {
          // Verify token with backend
          const response = await axios.get(
            `${get_api_base_url()}/api/auth/me`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const { user } = response.data;
          const mapped_user = map_backend_user_to_frontend(user);

          const user_type = authentication_state.authentication_status.user_type || 'user';

          set(() => ({
            authentication_state: {
              current_user: mapped_user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
                user_type: user_type,
              },
              error_message: null,
            },
          }));
        } catch {
          set({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
                user_type: null,
              },
              error_message: null,
            },
          });
        }
      },

      clear_auth_error: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            error_message: null,
          },
        }));
      },

      update_current_user: (user_updates: Partial<User>) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: state.authentication_state.current_user
              ? { ...state.authentication_state.current_user, ...user_updates }
              : null,
          },
        }));
      },

      // ======================================================================
      // BOOKING CONTEXT ACTIONS
      // ======================================================================

      update_booking_context: (updates: Partial<BookingContext>) => {
        set((state) => ({
          booking_context: {
            ...state.booking_context,
            ...updates,
          },
        }));
      },

      clear_booking_context: () => {
        set({
          booking_context: initial_booking_context,
        });
      },

      set_booking_step: (step: number) => {
        set((state) => ({
          booking_context: {
            ...state.booking_context,
            step_completed: step,
          },
        }));
      },

      populate_booking_from_user: () => {
        const { authentication_state } = get();
        const user = authentication_state.current_user;

        if (user) {
          set((state) => ({
            booking_context: {
              ...state.booking_context,
              customer_name: user.name,
              customer_email: user.email,
              customer_phone: user.phone,
            },
          }));
        }
      },

      // ======================================================================
      // SETTINGS ACTIONS
      // ======================================================================

      fetch_app_settings: async () => {
        try {
          const { authentication_state } = get();
          const is_admin = authentication_state.authentication_status.user_type === 'admin';
          const token = authentication_state.auth_token;

          let response;
          if (is_admin && token) {
            // Fetch admin settings with auth
            response = await axios.get(
              `${get_api_base_url()}/api/admin/settings`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } else {
            // Fetch public settings
            response = await axios.get(
              `${get_api_base_url()}/api/settings`
            );
          }

          const settings = response.data;

          set({
            app_settings: {
              shop_name: settings.shop_name || initial_app_settings.shop_name,
              shop_address: settings.shop_address || initial_app_settings.shop_address,
              shop_phone: settings.shop_phone || initial_app_settings.shop_phone,
              shop_email: settings.shop_email || initial_app_settings.shop_email,
              operating_hours: settings.operating_hours || initial_app_settings.operating_hours,
              capacity_mon_wed: settings.capacity_mon_wed ?? initial_app_settings.capacity_mon_wed,
              capacity_thu_sun: settings.capacity_thu_sun ?? initial_app_settings.capacity_thu_sun,
              booking_window_days: settings.booking_window_days ?? initial_app_settings.booking_window_days,
              same_day_cutoff_hours: settings.same_day_cutoff_hours ?? initial_app_settings.same_day_cutoff_hours,
              reminder_hours_before: settings.reminder_hours_before ?? initial_app_settings.reminder_hours_before,
              services_enabled: settings.services_enabled ?? initial_app_settings.services_enabled,
              gallery_enabled: settings.gallery_enabled ?? initial_app_settings.gallery_enabled,
            },
          });
        } catch (error) {
          console.error('Failed to fetch app settings:', error);
          // Keep default settings on error
        }
      },

      update_app_settings: (settings: Partial<AppSettings>) => {
        set((state) => ({
          app_settings: {
            ...state.app_settings,
            ...settings,
          },
        }));
      },
    }),
    {
      name: 'barberslot-storage',
      partialize: (state) => ({
        // Persist authentication state (critical for page refresh)
        authentication_state: {
          current_user: state.authentication_state.current_user,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false, // Never persist loading state
            user_type: state.authentication_state.authentication_status.user_type,
          },
          error_message: null, // Never persist errors
        },
        // Optionally persist booking context for user convenience
        booking_context: state.booking_context,
        // Do not persist app_settings (fetched fresh on app start)
      }),
    }
  )
);

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type { User, AuthenticationState, BookingContext, AppSettings, AppState };