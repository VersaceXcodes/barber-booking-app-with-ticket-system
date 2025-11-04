import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
  isPaused?: boolean;
}

interface ToastEventDetail {
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
}

// ============================================================================
// TOAST UTILITY - EXPORT FOR GLOBAL USE
// ============================================================================

const TOAST_EVENT = 'show-toast-notification';

export const toast = {
  success: (message: string, duration?: number, action?: ToastAction) => {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type: 'success', message, duration, action } as ToastEventDetail,
      })
    );
  },
  error: (message: string, duration?: number, action?: ToastAction) => {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type: 'error', message, duration, action } as ToastEventDetail,
      })
    );
  },
  warning: (message: string, duration?: number, action?: ToastAction) => {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type: 'warning', message, duration, action } as ToastEventDetail,
      })
    );
  },
  info: (message: string, duration?: number, action?: ToastAction) => {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type: 'info', message, duration, action } as ToastEventDetail,
      })
    );
  },
};

// ============================================================================
// TOAST CONFIGURATION
// ============================================================================

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,  // 4 seconds
  error: 6000,    // 6 seconds
  warning: 6000,  // 6 seconds
  info: 4000,     // 4 seconds
};

const TOAST_STYLES: Record<
  ToastType,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    bg: 'bg-green-600',
    text: 'text-white',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-600',
    text: 'text-white',
    icon: XCircle,
  },
  warning: {
    bg: 'bg-amber-600',
    text: 'text-white',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-600',
    text: 'text-white',
    icon: Info,
  },
};

const ARIA_CONFIG: Record<ToastType, { live: 'polite' | 'assertive'; role: 'status' | 'alert' }> = {
  success: { live: 'polite', role: 'status' },
  error: { live: 'assertive', role: 'alert' },
  warning: { live: 'assertive', role: 'alert' },
  info: { live: 'polite', role: 'status' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GV_NotificationToast: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ======================================================================
  // TOAST MANAGEMENT FUNCTIONS
  // ======================================================================

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    
    // Cleanup timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pauseToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, isPaused: true } : toast
      )
    );

    // Clear timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const resumeToast = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, isPaused: false } : toast
        )
      );

      // Restart timer with remaining duration
      const toast = toasts.find((t) => t.id === id);
      if (toast) {
        const duration = toast.duration || DEFAULT_DURATIONS[toast.type];
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [toasts, removeToast]
  );

  const addToast = useCallback(
    (detail: ToastEventDetail) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = {
        id,
        type: detail.type,
        message: detail.message,
        duration: detail.duration,
        action: detail.action,
        isPaused: false,
      };

      setToasts((prev) => [newToast, ...prev]);

      // Set auto-dismiss timer
      const duration = detail.duration || DEFAULT_DURATIONS[detail.type];
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  // ======================================================================
  // EVENT LISTENER FOR TOAST TRIGGERS
  // ======================================================================

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      addToast(customEvent.detail);
    };

    window.addEventListener(TOAST_EVENT, handleToastEvent);

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent);
      // Cleanup all timers on unmount
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [addToast]);

  // ======================================================================
  // RENDER
  // ======================================================================

  if (toasts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop: Top-Right */}
      <div className="hidden md:block fixed top-4 right-4 z-[10000] space-y-3 pointer-events-none">
        {toasts.map((toast) => {
          const config = TOAST_STYLES[toast.type];
          const ariaConfig = ARIA_CONFIG[toast.type];
          const Icon = config.icon;

          return (
            <div
              key={toast.id}
              className="pointer-events-auto animate-slideInRight"
              role={ariaConfig.role}
              aria-live={ariaConfig.live}
              aria-atomic="true"
              onMouseEnter={() => pauseToast(toast.id)}
              onMouseLeave={() => resumeToast(toast.id)}
              onFocus={() => pauseToast(toast.id)}
              onBlur={() => resumeToast(toast.id)}
              tabIndex={0}
            >
              <div
                className={`
                  ${config.bg} ${config.text}
                  w-80 rounded-lg shadow-xl
                  flex items-start gap-3 p-4
                  transition-all duration-200
                  hover:shadow-2xl
                `}
              >
                {/* Icon */}
                <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" aria-hidden="true" />

                {/* Message */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed break-words">
                    {toast.message}
                  </p>

                  {/* Action Button */}
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="mt-2 text-xs font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent rounded"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 p-1 rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile/Tablet: Bottom-Center */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-[10000] flex flex-col items-center space-y-3 pointer-events-none">
        {toasts.map((toast) => {
          const config = TOAST_STYLES[toast.type];
          const ariaConfig = ARIA_CONFIG[toast.type];
          const Icon = config.icon;

          return (
            <div
              key={toast.id}
              className="pointer-events-auto w-full max-w-md animate-slideInUp"
              role={ariaConfig.role}
              aria-live={ariaConfig.live}
              aria-atomic="true"
              onTouchStart={() => pauseToast(toast.id)}
              onTouchEnd={() => resumeToast(toast.id)}
              onFocus={() => pauseToast(toast.id)}
              onBlur={() => resumeToast(toast.id)}
              tabIndex={0}
            >
              <div
                className={`
                  ${config.bg} ${config.text}
                  rounded-lg shadow-xl
                  flex items-start gap-3 p-4
                  transition-all duration-200
                `}
              >
                {/* Icon */}
                <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" aria-hidden="true" />

                {/* Message */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed break-words">
                    {toast.message}
                  </p>

                  {/* Action Button */}
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="mt-2 text-xs font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent rounded"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 p-2 rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close notification"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slideInRight {
          animation: slideInRight 300ms ease-out;
        }

        .animate-slideInUp {
          animation: slideInUp 300ms ease-out;
        }
      `}</style>
    </>
  );
};

export default GV_NotificationToast;