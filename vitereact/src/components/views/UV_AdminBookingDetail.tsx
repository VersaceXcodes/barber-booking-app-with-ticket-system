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
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  FileText,
  ArrowLeft,
  ExternalLink,
  Edit,
  Save
} from 'lucide-react';

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
  admin_notes: string | null;
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

const UV_AdminBookingDetail: React.FC = () => {
  const { ticket_number } = useParams<{ ticket_number: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [copySuccess, setCopySuccess] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

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

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const { 
    data: bookingData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['admin-booking', ticket_number],
    queryFn: async () => {
      if (!ticket_number || !/^TKT-\d{4,8}-\d{3}$/.test(ticket_number)) {
        throw new Error('Invalid ticket number format');
      }

      const token = localStorage.getItem('admin_token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    },
    enabled: !!ticket_number,
    staleTime: 30000,
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

  useMemo(() => {
    if (booking?.admin_notes) {
      setAdminNotes(booking.admin_notes);
    }
  }, [booking]);

  const markAsCompletedMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('admin_token');
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}/complete`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-booking', ticket_number] });
    }
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (reason: string) => {
      const token = localStorage.getItem('admin_token');
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}/cancel`,
        {
          cancellation_reason: reason,
          cancelled_by: 'admin'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-booking', ticket_number] });
      setShowCancelModal(false);
      setCancellationReason('');
    }
  });

  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const token = localStorage.getItem('admin_token');
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${ticket_number}`,
        {
          admin_notes: notes
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-booking', ticket_number] });
      setIsEditingNotes(false);
    }
  });

  const handleSaveNotes = () => {
    saveNotesMutation.mutate(adminNotes);
  };

  const handleCancelBooking = () => {
    if (!cancellationReason.trim()) return;
    cancelBookingMutation.mutate(cancellationReason);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-6">
            We couldn't find a booking with ticket number: <strong>{ticket_number}</strong>
          </p>
          <div className="space-y-3">
            <Link
              to="/admin/bookings"
              className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Link
              to="/admin/bookings"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Bookings
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Details</h1>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono text-blue-600">{ticket_number}</span>
                  <button
                    onClick={copyTicketNumber}
                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Appointment Details</h2>
                <div className="space-y-3">
                  {serviceDetails && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Service</p>
                        <p className="text-base font-medium text-gray-900">{serviceDetails.name}</p>
                        {serviceDetails.price && (
                          <p className="text-sm text-gray-600">${serviceDetails.price}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="text-base font-medium text-gray-900">{formatDate(booking.appointment_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Time</p>
                      <p className="text-base font-medium text-gray-900">
                        {formatTime(booking.appointment_time)} - {calculateEndTime(booking.appointment_time, booking.slot_duration)}
                      </p>
                      <p className="text-sm text-gray-600">{booking.slot_duration} minutes</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-base font-medium text-gray-900">{booking.customer_name}</p>
                      {booking.booking_for_name && (
                        <p className="text-sm text-gray-600">Booking for: {booking.booking_for_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <a href={`mailto:${booking.customer_email}`} className="text-base font-medium text-blue-600 hover:text-blue-700">
                        {booking.customer_email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <a href={`tel:${booking.customer_phone}`} className="text-base font-medium text-blue-600 hover:text-blue-700">
                        {booking.customer_phone}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {(booking.special_request || (booking.inspiration_photos && booking.inspiration_photos.length > 0)) && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Special Requests</h2>
                  <div className="space-y-4">
                    {booking.special_request && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Customer Notes</p>
                        <p className="text-base text-gray-900 bg-gray-50 p-3 rounded-lg">{booking.special_request}</p>
                      </div>
                    )}
                    {booking.inspiration_photos && booking.inspiration_photos.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Inspiration Photos</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {booking.inspiration_photos.map((photo, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedPhotoIndex(index)}
                              className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
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

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Admin Notes</h2>
                  {!isEditingNotes ? (
                    <button
                      onClick={() => setIsEditingNotes(true)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveNotes}
                      disabled={saveNotesMutation.isPending}
                      className="text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {isEditingNotes ? (
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add internal notes about this booking..."
                  />
                ) : (
                  <div className="text-base text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg min-h-[100px]">
                    {booking.admin_notes || 'No notes added yet'}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Actions</h2>
                <div className="space-y-3">
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={() => markAsCompletedMutation.mutate()}
                      disabled={markAsCompletedMutation.isPending}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {markAsCompletedMutation.isPending ? 'Marking...' : 'Mark as Completed'}
                    </button>
                  )}
                  {(booking.status === 'confirmed' || booking.status === 'pending') && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Timeline</h2>
                <div className="space-y-3 text-sm">
                  {booking.created_at && (
                    <div>
                      <p className="text-gray-500">Created</p>
                      <p className="text-gray-900">{formatTimestamp(booking.created_at)}</p>
                    </div>
                  )}
                  {booking.confirmed_at && (
                    <div>
                      <p className="text-gray-500">Confirmed</p>
                      <p className="text-gray-900">{formatTimestamp(booking.confirmed_at)}</p>
                    </div>
                  )}
                  {booking.completed_at && (
                    <div>
                      <p className="text-gray-500">Completed</p>
                      <p className="text-gray-900">{formatTimestamp(booking.completed_at)}</p>
                    </div>
                  )}
                  {booking.cancelled_at && (
                    <div>
                      <p className="text-gray-500">Cancelled</p>
                      <p className="text-gray-900">{formatTimestamp(booking.cancelled_at)}</p>
                      {booking.cancellation_reason && (
                        <p className="text-gray-600 mt-1">Reason: {booking.cancellation_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Cancel Booking</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter reason for cancellation..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelBookingMutation.isPending || !cancellationReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelBookingMutation.isPending ? 'Cancelling...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPhotoIndex !== null && booking.inspiration_photos && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={booking.inspiration_photos[selectedPhotoIndex]}
              alt={`Inspiration ${selectedPhotoIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminBookingDetail;
