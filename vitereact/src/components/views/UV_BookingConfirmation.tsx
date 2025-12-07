import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Check, Copy, Calendar, Printer, RefreshCw, ChevronRight, MapPin, Phone, Mail, Clock, Info } from 'lucide-react';
import { toast } from '@/components/views/GV_NotificationToast';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Booking {
  booking_id: string;
  ticket_number: string;
  user_id: string | null;
  status: string;
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
}

interface ServiceDetails {
  service_id: string;
  name: string;
  duration: number;
  price: number | null;
}

interface BookingAPIResponse {
  booking: Booking;
  service_name?: string;
  service_duration?: number;
  service_price?: number | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getAPIBaseURL = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
};

const formatTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const calculateEndTime = (startTime: string, duration: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  const endTimeString = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  return formatTime(endTimeString);
};

const canCancelBooking = (appointmentDate: string, appointmentTime: string): boolean => {
  const appointment = new Date(`${appointmentDate}T${appointmentTime}`);
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return appointment > twoHoursFromNow;
};

const generateQRCode = (text: string, size: number = 200): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Simple QR code placeholder (white background with centered text)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, size - 20, size - 20);
  
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);
  
  return canvas.toDataURL('image/png');
};

const generateCalendarFile = (booking: Booking, serviceName: string | null, shopName: string, shopAddress: string): string => {
  const startDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
  const endDateTime = new Date(startDateTime.getTime() + booking.slot_duration * 60000);
  
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BarberSlot//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.ticket_number}@barberslot.com`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(startDateTime)}`,
    `DTEND:${formatICSDate(endDateTime)}`,
    `SUMMARY:Haircut at ${shopName}${serviceName ? ` - ${serviceName}` : ''}`,
    `DESCRIPTION:Booking confirmation for ${booking.customer_name}\\nTicket: ${booking.ticket_number}${booking.special_request ? `\\nNotes: ${booking.special_request}` : ''}`,
    `LOCATION:${shopAddress}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'DESCRIPTION:Appointment reminder',
    'ACTION:DISPLAY',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_BookingConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const shopInfo = useAppStore(state => state.app_settings);
  const clearBookingContext = useAppStore(state => state.clear_booking_context);
  
  // Local state
  const [booking, setBooking] = useState<Booking | null>(null);
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails | null>(null);
  const [qrCodeURL, setQrCodeURL] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  
  const ticketNumberFromURL = searchParams.get('ticket_number');
  
  // ========================================================================
  // DATA FETCHING
  // ========================================================================
  
  const { data: apiBooking, isLoading: isFetchingBooking, isError: isQueryError } = useQuery({
    queryKey: ['booking', ticketNumberFromURL],
    queryFn: async () => {
      if (!ticketNumberFromURL) return null;
      
      const response = await axios.get<BookingAPIResponse>(
        `${getAPIBaseURL()}/api/bookings/${ticketNumberFromURL}`
      );
      return response.data;
    },
    enabled: !!ticketNumberFromURL,
    staleTime: 60000,
    retry: 2
  });
  
  // Resend confirmation mutation
  const resendMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      const response = await axios.post(
        `${getAPIBaseURL()}/api/bookings/${ticketNumber}/resend-confirmation`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Confirmation email sent successfully!');
      setResendSuccess(data.message || 'Confirmation sent successfully!');
      setTimeout(() => setResendSuccess(null), 5000);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to send confirmation. Please try again.';
      toast.error(errorMessage);
      setResendSuccess(errorMessage);
      setTimeout(() => setResendSuccess(null), 5000);
    }
  });
  
  // ========================================================================
  // EFFECTS
  // ========================================================================
  
  // Initialize booking from API
  useEffect(() => {
    if (apiBooking) {
      setBooking(apiBooking.booking);
      if (apiBooking.service_name && apiBooking.booking.service_id) {
        setServiceDetails({
          service_id: apiBooking.booking.service_id,
          name: apiBooking.service_name,
          duration: apiBooking.service_duration || 40,
          price: apiBooking.service_price || null
        });
      }
    }
  }, [apiBooking]);
  
  // Generate QR code when booking is set
  useEffect(() => {
    if (booking?.ticket_number && !qrCodeURL) {
      const qrURL = generateQRCode(booking.ticket_number);
      setQrCodeURL(qrURL);
    }
  }, [booking, qrCodeURL]);
  
  // ========================================================================
  // ACTIONS
  // ========================================================================
  
  const handleCopyTicketNumber = async () => {
    if (!booking) return;
    
    try {
      await navigator.clipboard.writeText(booking.ticket_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      alert(`Your ticket number: ${booking.ticket_number}`);
    }
  };
  
  const handleAddToCalendar = () => {
    if (!booking) return;
    
    const blobURL = generateCalendarFile(
      booking,
      serviceDetails?.name || null,
      shopInfo.shop_name,
      shopInfo.shop_address
    );
    
    // Trigger download
    const link = document.createElement('a');
    link.href = blobURL;
    link.download = `barberslot-${booking.ticket_number}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleResendConfirmation = () => {
    if (!booking) return;
    resendMutation.mutate(booking.ticket_number);
  };
  
  const handlePrintTicket = () => {
    window.print();
  };
  
  const handleBookAnother = () => {
    clearBookingContext();
    navigate('/book/service');
  };
  
  // ========================================================================
  // LOADING STATE
  // ========================================================================
  
  if (!ticketNumberFromURL) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-4">
          <div className="text-center max-w-md">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No Ticket Number</h2>
            <p className="text-gray-300 mb-6">Please provide a valid ticket number.</p>
            <Link 
              to="/search"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-800 transition-colors"
            >
              Search Your Bookings
            </Link>
          </div>
        </div>
      </>
    );
  }
  
  if (isFetchingBooking) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
            <p className="mt-4 text-gray-300 text-lg">Loading confirmation...</p>
          </div>
        </div>
      </>
    );
  }
  
  if (isQueryError || !booking) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-4">
          <div className="text-center max-w-md">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Booking Not Found</h2>
            <p className="text-gray-300 mb-6">We couldn't find your booking confirmation.</p>
            <Link 
              to="/search"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-800 transition-colors"
            >
              Search Your Bookings
            </Link>
          </div>
        </div>
      </>
    );
  }
  
  const canCancel = canCancelBooking(booking.appointment_date, booking.appointment_time);
  
  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 animate-scale-in ${serviceDetails?.name.toLowerCase().includes('call') ? 'bg-gradient-to-r from-amber-100 to-orange-100' : 'bg-green-100'}`}>
              {serviceDetails?.name.toLowerCase().includes('call') ? (
                <MapPin className="w-12 h-12 text-orange-600" strokeWidth={3} />
              ) : (
                <Check className="w-12 h-12 text-green-600" strokeWidth={3} />
              )}
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {serviceDetails?.name.toLowerCase().includes('call') ? 'Call-Out Confirmed!' : 'Booking Confirmed!'}
            </h1>
            <p className="text-xl text-gray-300">
              {serviceDetails?.name.toLowerCase().includes('call') 
                ? 'A Master Fade barber will arrive at your location' 
                : 'Your appointment is all set'}
            </p>
          </div>
          
          {/* Ticket Information Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
            <div className={`px-6 lg:px-8 py-4 ${serviceDetails?.name.toLowerCase().includes('call') ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`text-sm font-medium mb-1 ${serviceDetails?.name.toLowerCase().includes('call') ? 'text-orange-100' : 'text-blue-100'}`}>
                    {serviceDetails?.name.toLowerCase().includes('call') ? 'Call-Out Booking Number' : 'Ticket Number'}
                  </p>
                  <p className="text-white text-3xl font-bold tracking-wide">{booking.ticket_number}</p>
                </div>
                <button
                  onClick={handleCopyTicketNumber}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
                  aria-label="Copy ticket number to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span className="font-medium">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* QR Code */}
                <div className="flex justify-center md:justify-start">
                  <div className="bg-[#2D0808] p-4 rounded-lg border-2 border-white/10">
                    {qrCodeURL ? (
                      <img 
                        src={qrCodeURL} 
                        alt="Booking QR Code" 
                        className="w-32 h-32"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 animate-pulse rounded"></div>
                    )}
                  </div>
                </div>
                
                {/* Status and Info */}
                <div className="flex-1">
                  <div className="inline-flex items-center px-4 py-2 bg-green-900/30 text-green-400 rounded-full text-sm font-semibold mb-4">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    Upcoming
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Save this ticket number or scan the QR code when you arrive for your appointment.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Booking Summary */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Booking Summary</h2>
            
            <div className="space-y-6">
              {/* Appointment Details */}
              <div className="border-l-4 border-red-600 pl-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Appointment Details</h3>
                {serviceDetails && (
                  <p className="text-lg font-semibold text-white mb-1">{serviceDetails.name}</p>
                )}
                <p className="text-white font-medium mb-1">
                  {formatDate(booking.appointment_date)} at {formatTime(booking.appointment_time)}
                </p>
                <p className="text-gray-300 text-sm">
                  Duration: {booking.slot_duration} minutes (ending at {calculateEndTime(booking.appointment_time, booking.slot_duration)})
                </p>
              </div>
              
              {/* Contact Information */}
              <div className="border-l-4 border-indigo-600 pl-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact Information</h3>
                <p className="text-white font-medium mb-1">{booking.customer_name}</p>
                <p className="text-gray-300 text-sm mb-1">
                  <a href={`tel:${booking.customer_phone}`} className="hover:text-amber-400 transition-colors">
                    {booking.customer_phone}
                  </a>
                </p>
                <p className="text-gray-300 text-sm">
                  <a href={`mailto:${booking.customer_email}`} className="hover:text-amber-400 transition-colors">
                    {booking.customer_email}
                  </a>
                </p>
                {booking.booking_for_name && (
                  <p className="text-gray-300 text-sm mt-2">
                    Booking for: <span className="font-medium text-white">{booking.booking_for_name}</span>
                  </p>
                )}
              </div>
              
              {/* Service Location (Call-Out Only) */}
              {serviceDetails?.name.toLowerCase().includes('call') && (
                <div className="border-l-4 border-orange-600 pl-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center">
                    <MapPin className="w-4 h-4 mr-1 text-orange-600" />
                    Service Location
                  </h3>
                  <p className="text-white font-medium mb-1">Address provided in booking details</p>
                  <div className="mt-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                    <p className="text-orange-900 text-sm font-medium mb-2 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Estimated Arrival Window
                    </p>
                    <p className="text-orange-800 text-sm">
                      Our barber will arrive within 15 minutes of your appointment time: <strong>{formatTime(booking.appointment_time)}</strong>
                    </p>
                    <p className="text-orange-700 text-xs mt-2">
                      You'll receive a notification when our barber is en route to your location.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Special Requests */}
              {booking.special_request && (
                <div className="border-l-4 border-purple-600 pl-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Special Request</h3>
                  <p className="text-white">{booking.special_request}</p>
                </div>
              )}
              
              {/* Inspiration Photos */}
              {booking.inspiration_photos && booking.inspiration_photos.length > 0 && (
                <div className="border-l-4 border-pink-600 pl-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Inspiration Photos</h3>
                  <div className="flex gap-2 flex-wrap">
                    {booking.inspiration_photos.map((photo, index) => (
                      <img 
                        key={index}
                        src={photo} 
                        alt={`Inspiration ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border-2 border-white/10"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* What Happens Next */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">What happens next?</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${serviceDetails?.name.toLowerCase().includes('call') ? 'bg-orange-100' : 'bg-green-100'}`}>
                    <Check className={`w-5 h-5 ${serviceDetails?.name.toLowerCase().includes('call') ? 'text-orange-600' : 'text-green-600'}`} />
                  </div>
                </div>
                <div>
                  <p className="text-white font-medium">Confirmation sent to your email and phone</p>
                  <p className="text-gray-300 text-sm">Check your inbox and messages</p>
                </div>
              </div>
              
              {serviceDetails?.name.toLowerCase().includes('call') && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-medium">Barber assigned and en route notification</p>
                    <p className="text-gray-300 text-sm">You'll be notified when your barber is on the way</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-medium">Reminder will be sent {shopInfo.reminder_hours_before} hours before appointment</p>
                  <p className="text-gray-300 text-sm">So you don't forget!</p>
                </div>
              </div>
              
              {serviceDetails?.name.toLowerCase().includes('call') && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Info className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-medium">Arrival within 15-minute window</p>
                    <p className="text-gray-300 text-sm">Our barber will arrive close to your scheduled time</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Info className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-medium">You can cancel up to {shopInfo.same_day_cutoff_hours} hours before</p>
                  <p className="text-gray-300 text-sm">Free cancellation policy</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
            
            {resendSuccess && (
              <div className={`mb-4 p-4 rounded-lg ${resendSuccess.includes('Failed') ? 'bg-red-50 text-red-300' : 'bg-green-50 text-green-300'}`}>
                <p className="text-sm font-medium">{resendSuccess}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleAddToCalendar}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-800 hover:shadow-lg transition-all duration-200"
              >
                <Calendar className="w-5 h-5" />
                Add to Calendar
              </button>
              
              <button
                onClick={handleResendConfirmation}
                disabled={resendMutation.isPending}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-white font-medium rounded-lg hover:bg-gray-200 transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                {resendMutation.isPending ? 'Sending...' : 'Resend Confirmation'}
              </button>
              
              <button
                onClick={handlePrintTicket}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-white font-medium rounded-lg hover:bg-gray-200 transition-colors border border-white/20"
              >
                <Printer className="w-5 h-5" />
                Print Ticket
              </button>
              
              <button
                onClick={handleBookAnother}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 hover:shadow-lg transition-all duration-200"
              >
                <ChevronRight className="w-5 h-5" />
                Book Another Appointment
              </button>
              
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 hover:shadow-lg transition-all duration-200 sm:col-span-2"
                >
                  Go to My Dashboard
                  <ChevronRight className="w-5 h-5" />
                </Link>
              ) : (
                <Link
                  to="/search"
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-white font-medium rounded-lg hover:bg-gray-200 transition-colors border border-white/20 sm:col-span-2"
                >
                  Search Your Bookings
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
          
          {/* Shop Information */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Shop Information</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{shopInfo.shop_name}</h3>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-white">{shopInfo.shop_address}</p>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopInfo.shop_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1 mt-1"
                  >
                    Get Directions
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <a href={`tel:${shopInfo.shop_phone}`} className="text-white hover:text-amber-400 transition-colors">
                  {shopInfo.shop_phone}
                </a>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <a href={`mailto:${shopInfo.shop_email}`} className="text-white hover:text-amber-400 transition-colors">
                  {shopInfo.shop_email}
                </a>
              </div>
              
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                <p className="text-white">{shopInfo.operating_hours}</p>
              </div>
            </div>
          </div>
          
          {/* Helpful Links */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {canCancel && (
                <Link
                  to={`/booking/${booking.ticket_number}`}
                  className="text-red-600 hover:text-red-300 font-medium transition-colors"
                >
                  Cancel This Booking
                </Link>
              )}
              <div className="flex items-center gap-2 text-gray-300">
                <span className="text-sm">Need help?</span>
                <a href={`tel:${shopInfo.shop_phone}`} className="text-amber-400 hover:text-blue-700 font-medium">
                  Contact Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-scale-in {
              animation: none;
            }
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default UV_BookingConfirmation;