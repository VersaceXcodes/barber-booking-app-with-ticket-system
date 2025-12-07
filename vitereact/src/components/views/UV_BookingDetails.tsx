import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Calendar, 
  Clock, 
  Mail, 
  Phone, 
  MapPin, 
  Copy, 
  X, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  Printer,
  Send,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Booking {
  booking_id: string;
  ticket_number: string;
  user_id: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  appointment_date: string;
  appointment_time: string;
  slot_duration: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_for_name: string | null;
  service_id: string | null;
  special_request: string | null;
  inspiration_photos: string[] | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
}

interface ServiceDetails {
  service_id: string;
  name: string;
  price: number | null;
  duration: number;
}

interface TimelineEvent {
  type: 'created' | 'confirmed' | 'reminder' | 'completed' | 'cancelled';
  timestamp: string;
  label: string;
  description?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_BookingDetails: React.FC = () => {
  const { ticket_number } = useParams<{ ticket_number: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ============================================================================
  // GLOBAL STATE ACCESS (Individual selectors - CRITICAL)
  // ============================================================================

  const shopName = useAppStore(state => state.app_settings.shop_name);
  const shopAddress = useAppStore(state => state.app_settings.shop_address);
  const shopPhone = useAppStore(state => state.app_settings.shop_phone);
  const shopEmail = useAppStore(state => state.app_settings.shop_email);
  const operatingHours = useAppStore(state => state.app_settings.operating_hours);
  const sameDayCutoffHours = useAppStore(state => state.app_settings.same_day_cutoff_hours);
  const updateBookingContext = useAppStore(state => state.update_booking_context);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  // ============================================================================
  // HELPER FUNCTIONS (Must be defined before useMemo)
  // ============================================================================

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string): string => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timestamp;
    }
  };

  const calculateEndTime = (startTime: string, duration: number): string => {
    try {
      const [hours, minutes] = startTime.split(':');
      const startMinutes = parseInt(hours, 10) * 60 + parseInt(minutes, 10);
      const endMinutes = startMinutes + duration;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      return formatTime(`${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`);
    } catch {
      return '';
    }
  };

  const copyTicketNumber = async () => {
    if (!ticket_number) return;

    try {
      await navigator.clipboard.writeText(ticket_number);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadCalendar = () => {
    if (!booking) return;

    const startDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
    const endDateTime = new Date(startDateTime.getTime() + (booking.slot_duration * 60000));

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BarberSlot//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${ticket_number}@barberslot.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDateTime)}`,
      `DTEND:${formatICSDate(endDateTime)}`,
      `SUMMARY:${serviceDetails?.name || 'Haircut'} at ${shopName}`,
      `LOCATION:${shopAddress}`,
      `DESCRIPTION:Service: ${serviceDetails?.name || 'Haircut'}\\nTicket: ${ticket_number}${booking.special_request ? `\\nSpecial Request: ${booking.special_request}` : ''}`,
      shopEmail ? `ORGANIZER:mailto:${shopEmail}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticket_number}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTicket = () => {
    window.print();
  };

  const handleCancelBooking = () => {
    if (!cancellationReason.trim()) return;
    cancelMutation.mutate(cancellationReason);
  };

  const handleBookAgain = () => {
    if (!booking) return;

    updateBookingContext({
      service_id: booking.service_id,
      service_name: serviceDetails?.name || null,
      customer_name: booking.customer_name,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      special_request: booking.special_request,
      booking_for_name: booking.booking_for_name
    });

    navigate('/book/service');
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-900/30 text-blue-400 border-blue-200';
      case 'completed':
        return 'bg-gray-100 text-gray-200 border-white/10';
      case 'cancelled':
        return 'bg-red-900/30 text-red-400 border-red-200';
      case 'pending':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-200 border-white/10';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'Upcoming';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return <Calendar className="w-5 h-5 text-amber-400" />;
      case 'confirmed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-300" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-300" />;
    }
  };

  // ============================================================================
  // FETCH BOOKING DETAILS
  // ============================================================================

  const { 
    data: bookingData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['booking', ticket_number],
    queryFn: async () => {
      if (!ticket_number || !/^TKT-\d{4,8}-\d{3}$/.test(ticket_number)) {
        throw new Error('Invalid ticket number format');
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}`
      );

      return response.data;
    },
    enabled: !!ticket_number,
    staleTime: 60000,
    retry: 1,
    select: (data) => {
      const booking = data.booking || data;
      
      return {
        booking: booking as Booking,
        service_details: booking.service_id ? {
          service_id: booking.service_id,
          name: data.service_name || 'Haircut',
          price: data.service_price ? Number(data.service_price) : null,
          duration: data.service_duration || booking.slot_duration || 40
        } as ServiceDetails : null
      };
    }
  });

  const booking = bookingData?.booking;
  const serviceDetails = bookingData?.service_details;

  // ============================================================================
  // CANCEL BOOKING MUTATION
  // ============================================================================

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}/cancel`,
        {
          cancellation_reason: reason,
          cancelled_by: 'customer'
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['booking', ticket_number], {
        booking: data.booking || data,
        service_details: serviceDetails
      });
      setShowCancellationModal(false);
      setCancellationReason('');
    }
  });

  // ============================================================================
  // RESEND CONFIRMATION MUTATION
  // ============================================================================

  const resendMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}/resend-confirmation`
      );
      return response.data;
    }
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const canCancel = useMemo(() => {
    if (!booking || booking.status !== 'confirmed') return false;

    try {
      const appointmentDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
      const now = new Date();
      const cutoffTime = new Date(appointmentDateTime.getTime() - (sameDayCutoffHours * 60 * 60 * 1000));

      return now < cutoffTime;
    } catch {
      return false;
    }
  }, [booking, sameDayCutoffHours]);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    if (!booking) return [];

    const events: TimelineEvent[] = [];

    if (booking.created_at) {
      events.push({
        type: 'created',
        timestamp: booking.created_at,
        label: 'Booking Created',
        description: `Created on ${formatTimestamp(booking.created_at)}`
      });
    }

    if (booking.confirmed_at) {
      events.push({
        type: 'confirmed',
        timestamp: booking.confirmed_at,
        label: 'Confirmation Sent',
        description: `Sent on ${formatTimestamp(booking.confirmed_at)}`
      });
    }

    if (booking.reminder_sent_at) {
      events.push({
        type: 'reminder',
        timestamp: booking.reminder_sent_at,
        label: 'Reminder Sent',
        description: `Sent on ${formatTimestamp(booking.reminder_sent_at)}`
      });
    }

    if (booking.completed_at) {
      events.push({
        type: 'completed',
        timestamp: booking.completed_at,
        label: 'Completed',
        description: `Completed on ${formatTimestamp(booking.completed_at)}`
      });
    }

    if (booking.cancelled_at) {
      events.push({
        type: 'cancelled',
        timestamp: booking.cancelled_at,
        label: 'Cancelled',
        description: booking.cancellation_reason 
          ? `Cancelled on ${formatTimestamp(booking.cancelled_at)}: ${booking.cancellation_reason}`
          : `Cancelled on ${formatTimestamp(booking.cancelled_at)}`
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [booking]);

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] flex items-center justify-center py-12 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
            <p className="mt-4 text-gray-300 text-lg">Loading booking details...</p>
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (error || !booking) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] flex items-center justify-center py-12 px-4">
          <div className="max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Booking Not Found</h2>
            <p className="text-gray-300 mb-6">
              We couldn't find a booking with ticket number: <strong>{ticket_number}</strong>
            </p>
            <div className="space-y-3">
              <Link
                to="/search"
                className="block w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-colors"
              >
                Search for Your Booking
              </Link>
              <Link
                to="/"
                className="block w-full bg-gray-100 text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">Booking Details</h1>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono text-amber-400">{ticket_number}</span>
                  <button
                    onClick={copyTicketNumber}
                    className="p-2 text-gray-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-[#2D0808]"
                    title="Copy ticket number"
                  >
                    {copySuccess ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadgeClass(booking.status)}`}>
                  {getStatusLabel(booking.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Booking Information Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg p-6 mb-6">
            {/* Appointment Details */}
            <div className="mb-6 pb-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Appointment Details</h2>
              <div className="space-y-3">
                {serviceDetails && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Service</p>
                      <p className="text-base font-medium text-white">{serviceDetails.name}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Date</p>
                    <p className="text-base font-medium text-white">{formatDate(booking.appointment_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Time</p>
                    <p className="text-base font-medium text-white">
                      {formatTime(booking.appointment_time)} - {calculateEndTime(booking.appointment_time, booking.slot_duration)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-base font-medium text-white">{booking.slot_duration} minutes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="mb-6 pb-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Contact Information</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Name</p>
                    <p className="text-base font-medium text-white">{booking.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <a href={`mailto:${booking.customer_email}`} className="text-base font-medium text-amber-400 hover:text-blue-700">
                      {booking.customer_email}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Phone</p>
                    <a href={`tel:${booking.customer_phone}`} className="text-base font-medium text-amber-400 hover:text-blue-700">
                      {booking.customer_phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            {(booking.special_request || booking.booking_for_name || (booking.inspiration_photos && booking.inspiration_photos.length > 0)) && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Special Requests</h2>
                <div className="space-y-4">
                  {booking.special_request && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Notes</p>
                      <p className="text-base text-white">{booking.special_request}</p>
                    </div>
                  )}
                  {booking.booking_for_name && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Booking for</p>
                      <p className="text-base font-medium text-white">{booking.booking_for_name}</p>
                    </div>
                  )}
                  {booking.inspiration_photos && booking.inspiration_photos.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Inspiration Photos</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {booking.inspiration_photos.map((photo, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedPhotoIndex(index)}
                            className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-red-500 transition-all"
                          >
                            <img
                              src={photo}
                              alt={`Inspiration ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timeline Section */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg p-6 mb-6">
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-xl font-semibold text-white">Booking Timeline</h2>
              {timelineExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {timelineExpanded && (
              <div className="mt-6 space-y-4">
                {timelineEvents.map((event, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{event.label}</p>
                      {event.description && (
                        <p className="text-sm text-gray-300 mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shop Information Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Shop Information</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Address</p>
                  <p className="text-base text-white">{shopAddress}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-400 hover:text-blue-700 inline-flex items-center gap-1 mt-1"
                  >
                    Get Directions
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-400">Phone</p>
                  <a href={`tel:${shopPhone}`} className="text-base font-medium text-amber-400 hover:text-blue-700">
                    {shopPhone}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-400">Operating Hours</p>
                  <p className="text-base text-white">{operatingHours}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg p-6">
            {/* Upcoming - More than 2 hours away */}
            {booking.status === 'confirmed' && canCancel && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowCancellationModal(true)}
                  className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Cancel Booking
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {resendMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Resend
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadCalendar}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Calendar
                  </button>
                  <button
                    onClick={printTicket}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
            )}

            {/* Upcoming - Less than 2 hours away */}
            {booking.status === 'confirmed' && !canCancel && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm">
                    <strong>Cannot cancel within {sameDayCutoffHours} hours.</strong> Please call us: {' '}
                    <a href={`tel:${shopPhone}`} className="font-semibold underline">
                      {shopPhone}
                    </a>
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {resendMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Resend
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadCalendar}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Calendar
                  </button>
                  <button
                    onClick={printTicket}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
            )}

            {/* Completed */}
            {booking.status === 'completed' && (
              <div className="space-y-3">
                <button
                  onClick={handleBookAgain}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-colors"
                >
                  Book Again
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={printTicket}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {resendMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Resend
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Cancelled */}
            {booking.status === 'cancelled' && (
              <div className="space-y-3">
                {booking.cancelled_at && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                    <p className="text-red-400 text-sm">
                      <strong>Cancelled on {formatTimestamp(booking.cancelled_at)}</strong>
                      {booking.cancellation_reason && (
                        <span className="block mt-1">{booking.cancellation_reason}</span>
                      )}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleBookAgain}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-colors"
                >
                  Book Again
                </button>
              </div>
            )}
          </div>

          {/* Success Messages */}
          {resendMutation.isSuccess && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom">
              <p className="font-medium">Confirmation resent successfully!</p>
            </div>
          )}

          {cancelMutation.isSuccess && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom">
              <p className="font-medium">Booking cancelled successfully</p>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancellationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Cancel Booking?</h3>
              <button
                onClick={() => setShowCancellationModal(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-400 text-sm">
                  <strong>Are you sure you want to cancel this booking?</strong>
                </p>
                <p className="text-yellow-300 text-sm mt-2">
                  {serviceDetails?.name || 'Haircut'} on {formatDate(booking.appointment_date)} at {formatTime(booking.appointment_time)}
                </p>
              </div>

              <div>
                <label htmlFor="cancellation-reason" className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for cancellation (optional)
                </label>
                <textarea
                  id="cancellation-reason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., schedule changed, emergency"
                  rows={3}
                  maxLength={200}
                  className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">{cancellationReason.length}/200</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancellationModal(false)}
                className="flex-1 bg-gray-100 text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                No, Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelling...
                  </span>
                ) : (
                  'Yes, Cancel Booking'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhotoIndex !== null && booking.inspiration_photos && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <button
            onClick={() => setSelectedPhotoIndex(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl max-h-full">
            <img
              src={booking.inspiration_photos[selectedPhotoIndex]}
              alt={`Inspiration ${selectedPhotoIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-white text-center mt-4">
              Photo {selectedPhotoIndex + 1} of {booking.inspiration_photos.length}
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-ticket, .print-ticket * {
            visibility: visible;
          }
          .print-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default UV_BookingDetails;