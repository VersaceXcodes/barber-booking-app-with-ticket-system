import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/main';

// ============================================================================
// TYPES
// ============================================================================

interface LoadingOverlayContextType {
  isLoading: boolean;
  message: string;
  type: 'fullscreen' | 'partial';
  showLoading: (message?: string, type?: 'fullscreen' | 'partial') => void;
  hideLoading: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const LoadingOverlayContext = createContext<LoadingOverlayContextType | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export const LoadingOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Loading...');
  const [type, setType] = useState<'fullscreen' | 'partial'>('fullscreen');
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showLoading = useCallback((msg = 'Loading...', overlayType: 'fullscreen' | 'partial' = 'fullscreen') => {
    setMessage(msg);
    setType(overlayType);
    setIsLoading(true);

    // Set timeout fallback (30 seconds)
    const id = setTimeout(() => {
      console.warn('Loading overlay timeout reached (30 seconds). Consider implementing error handling.');
      setIsLoading(false);
    }, 30000);

    setTimeoutId(id);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (
    <LoadingOverlayContext.Provider value={{ isLoading, message, type, showLoading, hideLoading }}>
      {children}
    </LoadingOverlayContext.Provider>
  );
};

// ============================================================================
// CUSTOM HOOK
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export const useLoadingOverlay = () => {
  const context = useContext(LoadingOverlayContext);
  if (!context) {
    // Fallback to no-op functions if provider not found
    return {
      isLoading: false,
      message: '',
      type: 'fullscreen' as const,
      showLoading: () => {},
      hideLoading: () => {},
    };
  }
  return context;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GV_LoadingOverlay: React.FC = () => {
  // CRITICAL: Individual selectors to avoid infinite loops
  const authIsLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  // Get context loading state (if provider exists)
  const contextState = useContext(LoadingOverlayContext);
  
  // Determine if loading from either source
  const isAuthLoading = authIsLoading;
  const isContextLoading = contextState?.isLoading || false;
  const isLoading = isAuthLoading || isContextLoading;
  
  // Get message and type from context, or use defaults
  const message = contextState?.message || 'Loading...';
  const type = contextState?.type || 'fullscreen';

  // Prevent body scroll when full-screen overlay is active
  useEffect(() => {
    if (isLoading && type === 'fullscreen') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isLoading, type]);

  // Handle ESC key to potentially dismiss (for cancellable operations)
  useEffect(() => {
    if (!isLoading) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only dismiss context-controlled loading, not auth loading
        if (contextState && !isAuthLoading) {
          contextState.hideLoading();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isLoading, contextState, isAuthLoading]);

  // Don't render if not loading
  if (!isLoading) return null;

  return (
    <>
      {type === 'fullscreen' ? (
        // ===================================================================
        // FULL-SCREEN OVERLAY
        // ===================================================================
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={message}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center space-y-4 px-6">
            {/* Large Spinner - 64px */}
            <div 
              className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"
              style={{
                animation: 'spin 1.5s linear infinite',
              }}
            ></div>
            
            {/* Loading Message */}
            {message && (
              <p className="text-white text-lg font-medium text-center max-w-md leading-relaxed">
                {message}
              </p>
            )}
            
            {/* Subtle hint for cancellable operations */}
            {contextState && !isAuthLoading && (
              <p className="text-gray-300 text-xs text-center mt-2">
                Press ESC to cancel
              </p>
            )}
          </div>
        </div>
      ) : (
        // ===================================================================
        // PARTIAL OVERLAY (for component-level loading)
        // ===================================================================
        <div
          className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50 rounded-lg"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={message}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center space-y-3 px-4">
            {/* Medium Spinner - 40px */}
            <div 
              className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-600"
              style={{
                animation: 'spin 1.5s linear infinite',
              }}
            ></div>
            
            {/* Loading Message */}
            {message && (
              <p className="text-gray-700 text-sm font-medium text-center max-w-sm">
                {message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* CSS Animation Definition */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export default GV_LoadingOverlay;