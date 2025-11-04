import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, WifiOff, Lock, AlertTriangle, FileQuestion, ShieldOff } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ErrorType = 'network' | 'auth' | 'validation' | 'server' | 'not_found' | 'permission' | 'generic';

interface ErrorDetails {
  type: ErrorType;
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showContactSupport?: boolean;
  criticalError?: boolean; // If true, requires explicit button click (not dismissible by backdrop/ESC)
}

// ============================================================================
// MODULE-LEVEL STATE (Singleton Pattern)
// ============================================================================

let globalShowError: ((error: ErrorDetails) => void) | null = null;
let globalHideError: (() => void) | null = null;

/**
 * Global function to show error modal from anywhere in the app
 * @param error Error details to display
 * 
 * @example
 * import { showErrorModal } from '@/components/views/GV_ErrorModal';
 * 
 * showErrorModal({
 *   type: 'network',
 *   message: 'Connection lost. Please check your internet and try again.',
 *   onRetry: () => refetch()
 * });
 */
export const showErrorModal = (error: ErrorDetails) => {
  if (globalShowError) {
    globalShowError(error);
  }
};

/**
 * Global function to hide error modal
 */
export const hideErrorModal = () => {
  if (globalHideError) {
    globalHideError();
  }
};

  // ============================================================================
  // MAIN COMPONENT
  // ============================================================================

  const GV_ErrorModal: React.FC = () => {
    const navigate = useNavigate();
    const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const primaryActionRef = useRef<HTMLButtonElement>(null);
    const dismissButtonRef = useRef<HTMLButtonElement>(null);

    // Register global show/hide functions
    useEffect(() => {
      globalShowError = (error: ErrorDetails) => {
        setErrorDetails(error);
        setIsVisible(true);
      };

      globalHideError = () => {
        setIsVisible(false);
        // Clear error details after animation
        setTimeout(() => setErrorDetails(null), 200);
      };

      return () => {
        globalShowError = null;
        globalHideError = null;
      };
    }, []);

  // ========================================================================
  // ERROR ICON RENDERING
  // ========================================================================

  const renderErrorIcon = () => {
    const iconClasses = "w-16 h-16";
    switch (type) {
      case 'network':
        return <WifiOff className={`${iconClasses} text-red-500`} aria-hidden="true" />;
      case 'auth':
        return <Lock className={`${iconClasses} text-red-500`} aria-hidden="true" />;
      case 'validation':
        return <AlertCircle className={`${iconClasses} text-amber-500`} aria-hidden="true" />;
      case 'server':
        return <AlertTriangle className={`${iconClasses} text-red-500`} aria-hidden="true" />;
      case 'not_found':
        return <FileQuestion className={`${iconClasses} text-red-500`} aria-hidden="true" />;
      case 'permission':
        return <ShieldOff className={`${iconClasses} text-red-500`} aria-hidden="true" />;
      default:
        return <AlertCircle className={`${iconClasses} text-red-500`} aria-hidden="true" />;
    }
  };

  // ========================================================================
  // DEFAULT TITLE BY ERROR TYPE
  // ========================================================================

  const getDefaultTitle = React.useCallback(() => {
    if (!errorDetails) return 'Error';
    const { type } = errorDetails;
    switch (type) {
      case 'network':
        return 'Connection Error';
      case 'auth':
        return 'Authentication Required';
      case 'validation':
        return 'Validation Error';
      case 'server':
        return 'Server Error';
      case 'not_found':
        return 'Page Not Found';
      case 'permission':
        return 'Access Denied';
      default:
        return 'Error';
    }
  }, [errorDetails]);

  // ========================================================================
  // PRIMARY ACTION BUTTON TEXT
  // ========================================================================

  const getPrimaryActionText = React.useCallback(() => {
    if (!errorDetails) return 'OK';
    const { type, onRetry } = errorDetails;
    switch (type) {
      case 'network':
        return 'Try Again';
      case 'auth':
        return 'Log In';
      case 'validation':
        return 'OK';
      case 'server':
        return onRetry ? 'Try Again' : 'Dismiss';
      case 'not_found':
        return 'Go Home';
      case 'permission':
        return 'Go Back';
      default:
        return 'OK';
    }
  }, [errorDetails]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handlePrimaryAction = React.useCallback(() => {
    if (!errorDetails) {
      hideErrorModal();
      return;
    }
    const { type, onRetry } = errorDetails;
    if (type === 'auth') {
      navigate('/login');
      hideErrorModal();
    } else if (type === 'not_found') {
      navigate('/');
      hideErrorModal();
    } else if (type === 'permission') {
      navigate(-1);
      hideErrorModal();
    } else if (onRetry) {
      onRetry();
      hideErrorModal();
    } else {
      hideErrorModal();
    }
  }, [errorDetails, navigate]);

  const handleDismiss = React.useCallback(() => {
    if (errorDetails?.onDismiss) {
      errorDetails.onDismiss();
    }
    hideErrorModal();
  }, [errorDetails]);

  const handleBackdropClick = React.useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !errorDetails?.criticalError) {
      handleDismiss();
    }
  }, [errorDetails, handleDismiss]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // ESC key handler
  useEffect(() => {
    if (!isVisible || !errorDetails) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !errorDetails.criticalError) {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, errorDetails, handleDismiss]);

  // Focus trap and auto-focus
  useEffect(() => {
    if (!isVisible || !errorDetails) return;
    
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);

    // Auto-focus primary action button
    if (primaryActionRef.current) {
      primaryActionRef.current.focus();
    }

    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isVisible, errorDetails]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (!isVisible || !errorDetails) return;
    
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isVisible, errorDetails]);

  // Screen reader announcement
  useEffect(() => {
    if (!isVisible || !errorDetails) return;
    
    const modalTitle = errorDetails.title || getDefaultTitle();
    const announcement = `${modalTitle}: ${errorDetails.message}`;
    
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'alert');
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);

    return () => {
      if (document.body.contains(liveRegion)) {
        document.body.removeChild(liveRegion);
      }
    };
  }, [isVisible, errorDetails, getDefaultTitle]);

  // If no error, render nothing
  if (!errorDetails || !isVisible) {
    return null;
  }

  const { type, title, message, details, showContactSupport, criticalError } = errorDetails;
  const modalTitle = title || getDefaultTitle();

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-[10000]"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 flex items-center justify-center z-[10000] px-4 py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
        aria-describedby="error-modal-description"
      >
        {/* Modal Card */}
        <div
          ref={modalRef}
          className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-[90vw] sm:max-w-md mx-auto transform transition-all"
        >
          {/* Modal Content */}
          <div className="p-6 sm:p-8 text-center">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              {renderErrorIcon()}
            </div>

            {/* Heading */}
            <h2
              id="error-modal-title"
              className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight"
            >
              {modalTitle}
            </h2>

            {/* Error Message */}
            <p
              id="error-modal-description"
              className="text-base sm:text-lg text-gray-700 leading-relaxed"
            >
              {message}
            </p>

            {/* Optional Details */}
            {details && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-left">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {details}
                </p>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col sm:flex-row gap-3 sm:justify-center">
            {/* Primary Action Button */}
            <button
              ref={primaryActionRef}
              onClick={handlePrimaryAction}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 shadow-lg hover:shadow-xl text-base order-1"
            >
              {getPrimaryActionText()}
            </button>

            {/* Dismiss Button (only if not critical) */}
            {!criticalError && (
              <button
                ref={dismissButtonRef}
                onClick={handleDismiss}
                className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 border border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100 transition-all duration-200 text-base order-2"
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Optional Contact Support Link */}
          {showContactSupport && (
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 text-center border-t border-gray-200 mt-0">
              <p className="text-sm text-gray-600 mb-2 mt-4">
                If this problem persists, please contact support:
              </p>
              <a
                href={`mailto:support@barberslot.com?subject=Error Report: ${encodeURIComponent(modalTitle)}&body=${encodeURIComponent(message + (details ? '\n\nDetails: ' + details : ''))}`}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 rounded-lg px-4 py-2 transition-all duration-200 text-sm"
              >
                Contact Support
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GV_ErrorModal;