import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageTransitionContextType {
  isTransitioning: boolean;
  transitionTo: (path: string, callback?: () => void) => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

/**
 * PageTransitionProvider
 * 
 * Provides global state management for page transitions with scissors animation
 * Handles navigation and transition lifecycle
 */
export const PageTransitionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();
  const [pendingNavigation, setPendingNavigation] = useState<{
    path: string;
    callback?: () => void;
  } | null>(null);

  /**
   * Initiates a page transition with scissors animation
   * @param path - The route to navigate to
   * @param callback - Optional callback to execute after navigation
   */
  const transitionTo = useCallback((path: string, callback?: () => void) => {
    // Prevent multiple simultaneous transitions
    if (isTransitioning) return;

    setIsTransitioning(true);
    setPendingNavigation({ path, callback });

    // Complete transition after animation duration (0.8s)
    setTimeout(() => {
      // Navigate to new page
      navigate(path);
      
      // Execute callback if provided
      if (callback) {
        callback();
      }

      // Reset transition state after navigation
      setTimeout(() => {
        setIsTransitioning(false);
        setPendingNavigation(null);
      }, 100);
    }, 800); // Match animation duration
  }, [isTransitioning, navigate]);

  const value = {
    isTransitioning,
    transitionTo,
  };

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
    </PageTransitionContext.Provider>
  );
};

/**
 * usePageTransition Hook
 * 
 * Hook to access page transition functionality
 * @returns {PageTransitionContextType} Transition state and methods
 * 
 * @example
 * const { transitionTo, isTransitioning } = usePageTransition();
 * 
 * const handleClick = () => {
 *   transitionTo('/book/service');
 * };
 */
export const usePageTransition = (): PageTransitionContextType => {
  const context = useContext(PageTransitionContext);
  
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider');
  }
  
  return context;
};
