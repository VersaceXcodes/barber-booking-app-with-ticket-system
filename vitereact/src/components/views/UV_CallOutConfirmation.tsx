import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Calendar, MapPin, Sparkles, Home } from 'lucide-react';

const UV_CallOutConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ticketNumber = searchParams.get('ticket');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Icon */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: 'spring' }}
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full mb-6">
            <Check className="w-12 h-12 text-white" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white font-bold text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            BOOKING CONFIRMED
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Call-Out Service Booked!
          </h1>
          <p className="text-xl text-gray-300">
            Your call-out booking for €150 has been received
          </p>
        </motion.div>

        {/* Confirmation Card */}
        <motion.div
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="space-y-6">
            {/* Ticket Number */}
            {ticketNumber && (
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6 text-center">
                <p className="text-gray-300 mb-2">Your Booking Reference</p>
                <p className="text-3xl font-bold text-amber-400 tracking-wider">{ticketNumber}</p>
              </div>
            )}

            {/* Confirmation Message */}
            <div className="text-center">
              <MapPin className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-3">
                A Master Fade Barber Will Come To Your Address
              </h2>
              <p className="text-gray-300 leading-relaxed">
                We'll send you a confirmation email with all the details. Our barber will arrive at your scheduled time with all necessary equipment for a premium barbering experience.
              </p>
            </div>

            {/* What's Next */}
            <div className="border-t border-white/20 pt-6">
              <h3 className="text-xl font-bold text-white mb-4">What Happens Next?</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Confirmation Email</p>
                    <p className="text-gray-400 text-sm">You'll receive an email with your booking details</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Barber Assignment</p>
                    <p className="text-gray-400 text-sm">We'll assign an expert barber to your appointment</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Reminder</p>
                    <p className="text-gray-400 text-sm">You'll get a reminder before your appointment</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">4</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Service Day</p>
                    <p className="text-gray-400 text-sm">Your barber arrives at the scheduled time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="border-t border-white/20 pt-6">
              <h3 className="text-xl font-bold text-white mb-3">Important Notes</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Payment will be collected after the service is completed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Please have a suitable space prepared (chair, mirror, power outlet)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Need to reschedule? Contact us at least 24 hours in advance</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <button
            onClick={() => navigate('/')}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-amber-500/50 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>
          {ticketNumber && (
            <button
              onClick={() => navigate(`/booking/${ticketNumber}`)}
              className="flex-1 px-6 py-3 bg-white/10 text-white border border-white/30 rounded-lg font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              View Booking Details
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UV_CallOutConfirmation;
