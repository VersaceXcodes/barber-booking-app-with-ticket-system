/**
 * Responsive Navigation Tests
 * 
 * These tests verify that the navigation component properly responds to
 * different viewport sizes and displays the correct navigation elements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GV_TopNav from '../components/views/GV_TopNav';

// Configure store for testing
vi.mock('@/store/main', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      authentication_state: {
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
          user_type: null,
        },
        current_user: null,
      },
      app_settings: {
        shop_name: '123 Barber Shop',
        services_enabled: true,
      },
      logout: vi.fn(),
    };
    return selector(state);
  }),
}));

// Helper to set viewport size
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('GV_TopNav - Responsive Behavior', () => {
  beforeEach(() => {
    // Reset viewport to desktop size
    setViewportSize(1280, 1024);
  });

  describe('Desktop Viewport (≥768px)', () => {
    it('should show desktop navigation links', () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      // Desktop nav links should be visible
      // Note: These are in hidden md:flex containers, so we check by text
      expect(screen.getByText('Book Now')).toBeInTheDocument();
      expect(screen.getByText('Our Work')).toBeInTheDocument();
      expect(screen.getByText('Find My Booking')).toBeInTheDocument();
    });

    it('should hide mobile menu button on desktop', () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      // Mobile menu button should not be visible on desktop
      const mobileMenuButton = screen.queryByTestId('mobile-menu-button');
      if (mobileMenuButton) {
        // Check if it has md:hidden class or is not displayed
        const classes = mobileMenuButton.className;
        expect(classes).toContain('md:hidden');
      }
    });
  });

  describe('Mobile Menu Interaction', () => {
    it('should toggle mobile menu when button is clicked', async () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      // Find mobile menu button
      const mobileMenuButton = screen.getByTestId('mobile-menu-button');
      
      // Initially, mobile menu panel should not be visible
      let mobilePanel = screen.queryByTestId('mobile-menu-panel');
      expect(mobilePanel).not.toBeInTheDocument();

      // Click to open
      fireEvent.click(mobileMenuButton);

      // Wait for panel to appear
      await waitFor(() => {
        mobilePanel = screen.queryByTestId('mobile-menu-panel');
        expect(mobilePanel).toBeInTheDocument();
      });

      // Click to close
      fireEvent.click(mobileMenuButton);

      // Panel should be hidden
      await waitFor(() => {
        mobilePanel = screen.queryByTestId('mobile-menu-panel');
        expect(mobilePanel).not.toBeInTheDocument();
      });
    });

    it('should close mobile menu on Escape key', async () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      const mobileMenuButton = screen.getByTestId('mobile-menu-button');
      
      // Open mobile menu
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-menu-panel')).toBeInTheDocument();
      });

      // Press Escape key
      fireEvent.keyDown(document, { key: 'Escape' });

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-menu-panel')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior on Resize', () => {
    it('should close mobile menu when resizing from mobile to desktop', async () => {
      // Start at mobile size
      setViewportSize(375, 667);

      const { rerender } = render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      const mobileMenuButton = screen.getByTestId('mobile-menu-button');
      
      // Open mobile menu
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-menu-panel')).toBeInTheDocument();
      });

      // Resize to desktop
      setViewportSize(1280, 1024);
      
      // Trigger re-render
      rerender(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      // Mobile menu should auto-close
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-menu-panel')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on mobile menu button', () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      const mobileMenuButton = screen.getByTestId('mobile-menu-button');
      
      // Should have aria-label
      expect(mobileMenuButton).toHaveAttribute('aria-label', 'Toggle mobile menu');
      
      // Should have aria-expanded
      expect(mobileMenuButton).toHaveAttribute('aria-expanded');
    });

    it('should update aria-expanded when menu opens/closes', async () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      const mobileMenuButton = screen.getByTestId('mobile-menu-button');
      
      // Initially closed
      expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'false');

      // Open menu
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'true');
      });

      // Close menu
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('Test Data Attributes', () => {
    it('should have data-testid attributes for test targeting', () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      // Mobile menu button should have data-testid
      expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();
    });

    it('should have data-testid on mobile menu panel when opened', async () => {
      render(
        <BrowserRouter>
          <GV_TopNav />
        </BrowserRouter>
      );

      const mobileMenuButton = screen.getByTestId('mobile-menu-button');
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu-panel')).toBeInTheDocument();
      });
    });
  });
});
