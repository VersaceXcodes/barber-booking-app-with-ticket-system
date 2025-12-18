import React, { useState, useEffect, useRef } from 'react';
import { Clock, Scissors, RefreshCw } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface QueueData {
  currentQueueLength: number;
  estimatedWaitMinutes: number;
  currentTicket: string | null;
  nextSlotTime: string | null;
  averageWaitMinutes: number;
}

interface LiveQueueStatusProps {
  /** Optional className for additional styling */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const GV_LiveQueueStatus: React.FC<LiveQueueStatusProps> = ({ className = '' }) => {
  // ============================================================================
  // STATE
  // ============================================================================
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // ============================================================================
  // REFS
  // ============================================================================
  const dropdownRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // FETCH QUEUE DATA
  // ============================================================================
  const fetchQueueData = async (isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const response = await fetch('/api/queue/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch queue data');
      }
      
      const data: QueueData = await response.json();
      setQueueData(data);
      setError(false);
    } catch (err) {
      console.error('Error fetching queue data:', err);
      setError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Initial fetch and setup auto-refresh
  useEffect(() => {
    fetchQueueData();
    
    // Set up auto-refresh every 45 seconds (between 30-60s as requested)
    refreshIntervalRef.current = setInterval(() => {
      fetchQueueData(true);
    }, 45000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // ESC key handler for dropdown
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDropdown]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDropdown();
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const getStatusText = (): string => {
    if (isLoading && !queueData) {
      return 'Live Queue: updating…';
    }
    
    if (error && !queueData) {
      return 'Live Queue: updating…';
    }
    
    if (!queueData) {
      return 'Live Queue: updating…';
    }
    
    // Empty queue state
    if (queueData.currentQueueLength === 0) {
      return 'Live Queue: 0 • No wait – book now';
    }
    
    // Default state with queue
    const peopleText = queueData.currentQueueLength === 1 ? 'person' : 'in line';
    return `Live Queue: ${queueData.currentQueueLength} ${peopleText} • Est. wait ${queueData.estimatedWaitMinutes} min`;
  };

  const getStatusIcon = () => {
    if (isRefreshing) {
      return <RefreshCw size={16} className="animate-spin text-red-200" />;
    }
    
    if (!queueData || queueData.currentQueueLength === 0) {
      return <Scissors size={16} className="text-red-200" />;
    }
    
    return <Clock size={16} className="text-red-200" />;
  };

  const getMinWaitRange = () => {
    if (!queueData) return '0';
    return Math.max(0, queueData.averageWaitMinutes - 5).toString();
  };

  const getMaxWaitRange = () => {
    if (!queueData) return '0';
    return (queueData.averageWaitMinutes + 5).toString();
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Queue Status Button - Desktop & Mobile */}
      <button
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-800/90 to-red-900/90 backdrop-blur-sm border border-red-700/50 hover:from-red-700/90 hover:to-red-800/90 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-red-950"
        aria-label="Live queue status"
        aria-expanded={showDropdown}
        aria-haspopup="true"
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {getStatusIcon()}
        </div>
        
        {/* Text - Hidden on very small mobile, shown on larger screens */}
        <span className="hidden sm:inline text-xs md:text-sm font-medium text-master-text-primary-dark whitespace-nowrap">
          {getStatusText()}
        </span>
        
        {/* Mobile compact view - only shown on very small screens */}
        <span className="sm:hidden text-xs font-medium text-master-text-primary-dark">
          {queueData ? queueData.currentQueueLength : '—'}
        </span>
      </button>

      {/* Dropdown/Tooltip - Shows on hover (desktop) or tap (mobile) */}
      {showDropdown && queueData && (
        <div className="absolute right-0 mt-3 w-72 bg-white rounded-lg shadow-2xl py-3 px-4 z-50 border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center">
              <Clock size={16} className="text-master-text-primary-dark" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-master-text-primary-light">Queue Status</h3>
              <p className="text-xs text-master-text-muted-dark">Real-time updates</p>
            </div>
          </div>

          {/* Queue Details */}
          <div className="space-y-3">
            {/* Current serving */}
            {queueData.currentTicket && (
              <div className="flex items-start gap-2">
                <Scissors size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-master-text-secondary-dark">Currently serving</p>
                  <p className="text-sm font-bold text-red-600">Ticket #{queueData.currentTicket}</p>
                </div>
              </div>
            )}

            {/* Next available slot */}
            {queueData.nextSlotTime && (
              <div className="flex items-start gap-2">
                <Clock size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-master-text-secondary-dark">Next available slot</p>
                  <p className="text-sm font-bold text-master-text-primary-light">{queueData.nextSlotTime}</p>
                </div>
              </div>
            )}

            {/* Average wait */}
            <div className="flex items-start gap-2">
              <RefreshCw size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-master-text-secondary-dark">Average wait today</p>
                <p className="text-sm font-bold text-master-text-primary-light">
                  {getMinWaitRange()}–{getMaxWaitRange()} min
                </p>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          {queueData.currentQueueLength === 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-center font-medium text-green-700 bg-green-50 rounded-md py-2">
                No wait time! Book now for immediate service
              </p>
            </div>
          )}
          
          {queueData.currentQueueLength > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-center text-master-text-muted-dark">
                Auto-refreshes every 45 seconds
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Mobile compact dropdown - alternate layout for very small screens */}
      {showDropdown && queueData && (
        <div className="sm:hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl py-2 px-3 z-50 border border-gray-200">
          <div className="space-y-2 text-xs">
            <div>
              <span className="font-medium text-master-text-secondary-dark">Queue: </span>
              <span className="font-bold text-red-600">{queueData.currentQueueLength} in line</span>
            </div>
            <div>
              <span className="font-medium text-master-text-secondary-dark">Wait: </span>
              <span className="font-bold text-master-text-primary-light">~{queueData.estimatedWaitMinutes} min</span>
            </div>
            {queueData.currentTicket && (
              <div>
                <span className="font-medium text-master-text-secondary-dark">Serving: </span>
                <span className="font-bold text-master-text-primary-light">#{queueData.currentTicket}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GV_LiveQueueStatus;
