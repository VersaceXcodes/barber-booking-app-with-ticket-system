import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

import UV_Login from '../components/views/UV_Login';
import { useAppStore } from '@/store/main';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Auth E2E Flow (real API)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState((state) => ({
      authentication_state: {
        ...state.authentication_state,
        auth_token: null,
        current_user: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
          user_type: null,
        },
        error_message: null,
      },
    }));
  });

  it('registers a new user, logs out, and signs in', async () => {
    const user = userEvent.setup();
    const uniqueEmail = `user${Date.now()}@example.com`;
    const password = 'testpass123';
    const name = 'Test User';
    const phone = '+1-555-0199';

    render(<UV_Login />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /don't have an account/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/full name/i);
    const phoneInput = screen.getByPlaceholderText(/phone number/i);
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const registerButton = screen.getByRole('button', { name: /create account/i });

    await user.type(nameInput, name);
    await user.type(phoneInput, phone);
    await user.type(emailInput, uniqueEmail);
    await user.type(passwordInput, password);

    await user.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    });

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_loading).toBe(false);
        expect(state.authentication_state.error_message).toBeNull();
      },
      { timeout: 10000 }
    );

    const logoutButton = screen.getByRole('button', { name: /already have an account/i });
    await user.click(logoutButton);

    useAppStore.getState().logout();

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
      expect(state.authentication_state.auth_token).toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    const emailInputLogin = screen.getByPlaceholderText(/email address/i);
    const passwordInputLogin = screen.getByPlaceholderText(/^password$/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    await user.clear(emailInputLogin);
    await user.clear(passwordInputLogin);
    await user.type(emailInputLogin, uniqueEmail);
    await user.type(passwordInputLogin, password);

    await user.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user).toBeTruthy();
        expect(state.authentication_state.current_user?.email).toBe(uniqueEmail.toLowerCase());
      },
      { timeout: 10000 }
    );
  }, 30000);

  it('shows error on invalid login credentials', async () => {
    const user = userEvent.setup();

    render(<UV_Login />, { wrapper: Wrapper });

    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'nonexistent@example.com');
    await user.type(passwordInput, 'wrongpassword');

    await user.click(signInButton);

    await waitFor(
      () => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    const state = useAppStore.getState();
    expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
    expect(state.authentication_state.auth_token).toBeNull();
  }, 20000);

  it('prevents duplicate email registration', async () => {
    const user = userEvent.setup();
    const existingEmail = 'emily.chen@email.com';
    const password = 'testpass123';
    const name = 'Test User';
    const phone = '+1-555-0199';

    render(<UV_Login />, { wrapper: Wrapper });

    const toggleButton = screen.getByRole('button', { name: /don't have an account/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/full name/i);
    const phoneInput = screen.getByPlaceholderText(/phone number/i);
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const registerButton = screen.getByRole('button', { name: /create account/i });

    await user.type(nameInput, name);
    await user.type(phoneInput, phone);
    await user.type(emailInput, existingEmail);
    await user.type(passwordInput, password);

    await user.click(registerButton);

    await waitFor(
      () => {
        expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    const state = useAppStore.getState();
    expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
  }, 20000);

  it('successfully logs in with existing credentials', async () => {
    const user = userEvent.setup();
    const existingEmail = 'emily.chen@email.com';
    const existingPassword = 'password123';

    render(<UV_Login />, { wrapper: Wrapper });

    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, existingEmail);
    await user.type(passwordInput, existingPassword);

    await user.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user).toBeTruthy();
        expect(state.authentication_state.current_user?.email).toBe(existingEmail);
        expect(state.authentication_state.current_user?.name).toBe('Emily Chen');
      },
      { timeout: 10000 }
    );
  }, 30000);
});
