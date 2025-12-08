import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Users, Star, Clock, MapPin, Sparkles } from 'lucide-react';
import { usePageTransition } from '@/hooks/usePageTransition';
import { useAppStore } from '@/store/main';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface WaitTimeData {
  currentWaitMinutes: number;
  queueLength: number;
  activeBarbers: number;
  nextAvailableSlot?: string;
  timestamp: string;
}

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  const { transitionTo } = usePageTransition();
  const [isUpdating, setIsUpdating] = useState(false);

  // Get API base URL
  const getApiBaseUrl = (): string => {
    if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.API_BASE_URL) {
      return (window as any).__RUNTIME_CONFIG__.API_BASE_URL;
    }
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  // Fetch wait time with auto-refresh every 20 seconds
  const { data: waitTimeData, isLoading: waitTimeLoading } = useQuery<WaitTimeData>({
    queryKey: ['waitTime'],
    queryFn: async () => {
      setIsUpdating(true);
      try {
        const response = await axios.get(`${getApiBaseUrl()}/api/wait-time`);
        return response.data;
      } finally {
        setTimeout(() => setIsUpdating(false), 500);
      }
    },
    refetchInterval: 20000, // Refresh every 20 seconds
    refetchOnWindowFocus: true,
  });

  const currentWaitTime = waitTimeData?.currentWaitMinutes ?? 15;

  // Get services setting from store
  const servicesEnabled = useAppStore(state => state.app_settings.services_enabled);

  const handleBookAppointment = () => {
    // Standard in-shop appointment booking
    if (servicesEnabled) {
      transitionTo('/book/service');
    } else {
      transitionTo('/book/date');
    }
  };

  const handleBookCallOut = () => {
    // Dedicated call-out service booking
    transitionTo('/callout/book');
  };

  const handleJoinQueue = () => {
    // Dedicated walk-in queue flow
    transitionTo('/queue/join');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] relative overflow-hidden">
      {/* Gradient Mesh Background Wave */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"></div>
      
      {/* Subtle Pattern Overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}></div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        
        {/* Hero Section - Centered Content */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 min-h-[80vh] lg:min-h-[75vh]">
          
          {/* Left Side - Hero Content */}
          <motion.div 
            className="flex-1 text-center lg:text-left max-w-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {/* Headline - Staggered Animation */}
            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-master-text-primary-dark mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Skip the Wait.<br />Look Sharp.
            </motion.h1>

            {/* Subheadline - Staggered Animation */}
            <motion.p 
              className="text-xl sm:text-2xl text-master-text-secondary-dark mb-10 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Premium cuts, zero hassle. Book in 60 seconds or join our virtual queue.
            </motion.p>

            {/* CTA Buttons - Staggered Animation */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {/* Primary Button with Heartbeat Animation */}
              <motion.button
                onClick={handleBookAppointment}
                className="px-8 py-4 bg-white text-master-text-primary-light rounded-lg font-bold text-lg shadow-2xl relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  scale: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut"
                  }
                }}
              >
                Book Appointment
              </motion.button>

              {/* Secondary Button */}
              <motion.button
                onClick={handleJoinQueue}
                className="px-8 py-4 bg-transparent text-master-text-primary-dark border-2 border-white rounded-lg font-bold text-lg"
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
              >
                Join Walk-In Queue
              </motion.button>
            </motion.div>

            {/* Trust Signal */}
            <motion.p 
              className="text-master-text-muted-dark text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              ✓ Instant confirmation • ✓ Free cancellation • ✓ 500+ happy clients
            </motion.p>
          </motion.div>

          {/* Right Side - Trust Stats Card (Glass Effect) */}
          <motion.div
            className="w-full lg:w-auto"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl max-w-sm mx-auto lg:mx-0">
              {/* Stats Grid */}
              <div className="space-y-6">
                {/* Happy Clients */}
                <motion.div 
                  className="flex items-center gap-4"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <Users className="w-6 h-6 text-master-text-primary-dark" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-master-text-primary-dark">500+</p>
                    <p className="text-master-text-secondary-dark text-sm">Happy Clients</p>
                  </div>
                </motion.div>

                {/* Star Rating */}
                <motion.div 
                  className="flex items-center gap-4"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-master-text-primary-dark">4.9</p>
                    <p className="text-master-text-secondary-dark text-sm">Star Rating</p>
                  </div>
                </motion.div>

                {/* Current Wait Time */}
                <motion.div 
                  className="flex items-center gap-4 relative"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm transition-opacity ${isUpdating ? 'opacity-50' : 'opacity-100'}`}>
                    <Clock className="w-6 h-6 text-master-text-primary-dark" />
                  </div>
                  <div>
                    {waitTimeLoading && !waitTimeData ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400"></div>
                        <p className="text-xl font-bold text-master-text-secondary-dark">Loading...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-3xl font-bold text-green-400">
                          {currentWaitTime === 0 ? (
                            <span className="text-2xl">No Wait</span>
                          ) : (
                            <>{currentWaitTime} Mins</>
                          )}
                        </p>
                        <p className="text-master-text-secondary-dark text-sm flex items-center gap-1">
                          Current Wait
                          {waitTimeData && waitTimeData.queueLength > 0 && (
                            <span className="text-xs text-master-text-muted-dark">({waitTimeData.queueLength} in queue)</span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                  {isUpdating && (
                    <motion.div 
                      className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full"
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Call-Out Service Feature - Premium Highlight */}
        <motion.section
          className="mt-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 p-1 shadow-2xl">
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-black/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Left Content */}
                <div className="flex-1 text-center lg:text-left">
                  <motion.div 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-master-text-primary-dark font-bold text-sm mb-4 shadow-lg"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Sparkles className="w-4 h-4" />
                    NEW PREMIUM SERVICE
                  </motion.div>
                  
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-master-text-primary-dark mb-4 leading-tight">
                    Call-Out Service
                    <span className="block text-amber-400">We Come To You</span>
                  </h2>
                  
                  <p className="text-lg sm:text-xl text-master-text-secondary-dark mb-6 leading-relaxed">
                    Premium barbering at your doorstep. Perfect for home appointments, special occasions, or when you simply can't make it to the shop.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center lg:justify-start mb-6">
                    <div className="flex items-center gap-2 text-master-text-primary-dark">
                      <MapPin className="w-5 h-5 text-amber-400" />
                      <span className="font-medium">Your Location</span>
                    </div>
                    <div className="flex items-center gap-2 text-master-text-primary-dark">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span className="font-medium">Flexible Timing</span>
                    </div>
                    <div className="flex items-center gap-2 text-master-text-primary-dark">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      <span className="font-medium">Master Barbers</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 justify-center lg:justify-start mb-6">
                    <span className="text-5xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                      €150
                    </span>
                    <span className="text-master-text-muted-dark text-sm">
                      All-inclusive<br />flat rate
                    </span>
                  </div>
                  
                  <motion.button
                    onClick={handleBookCallOut}
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-master-text-primary-dark rounded-lg font-bold text-lg shadow-2xl hover:shadow-amber-500/50 transition-all duration-300"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Book Call-Out Service
                  </motion.button>
                </div>
                
                {/* Right Visual Element */}
                <div className="flex-shrink-0 w-full lg:w-80">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-2xl blur-2xl"></div>
                    <div className="relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                          <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-master-text-primary-dark" />
                          </div>
                          <div>
                            <p className="text-master-text-primary-dark font-semibold text-sm">Home Service</p>
                            <p className="text-master-text-secondary-dark text-xs">We travel to you</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                          <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-master-text-primary-dark" />
                          </div>
                          <div>
                            <p className="text-master-text-primary-dark font-semibold text-sm">Book Anytime</p>
                            <p className="text-master-text-secondary-dark text-xs">Flexible scheduling</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                          <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-master-text-primary-dark" />
                          </div>
                          <div>
                            <p className="text-master-text-primary-dark font-semibold text-sm">Premium Quality</p>
                            <p className="text-master-text-secondary-dark text-xs">Same expert service</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Services Preview Section */}
        <motion.section 
          className="mt-20 pt-20 border-t border-white/10"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-master-text-primary-dark mb-4">
              Premium Services
            </h2>
            <p className="text-xl text-master-text-secondary-dark">
              Expert cuts crafted by master barbers
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Signature Fade',
                description: 'Precision fade with clean lines',
                icon: '✂️'
              },
              {
                title: 'Beard Sculpting',
                description: 'Shape and style perfection',
                icon: '🪒'
              },
              {
                title: 'Hot Towel Shave',
                description: 'Traditional luxury experience',
                icon: '🔥'
              }
            ].map((service, index) => (
              <motion.div
                key={index}
                className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="text-5xl mb-4">{service.icon}</div>
                <h3 className="text-2xl font-bold text-master-text-primary-dark mb-2">{service.title}</h3>
                <p className="text-master-text-secondary-dark">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Gallery Preview Section */}
        <motion.section 
          className="mt-20 pt-20 border-t border-white/10"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-master-text-primary-dark mb-4">
              Our Work Speaks
            </h2>
            <p className="text-xl text-master-text-secondary-dark">
              Real cuts, real confidence
            </p>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((item) => (
              <motion.div
                key={item}
                className="aspect-square rounded-xl overflow-hidden backdrop-blur-xl bg-white/10 border border-white/20"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: item * 0.05 }}
              >
                <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
                  <p className="text-master-text-primary-dark/50 text-sm">Gallery Image {item}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <motion.button
              onClick={() => navigate('/gallery')}
              className="px-8 py-3 bg-white/10 text-master-text-primary-dark border border-white/30 rounded-lg font-semibold backdrop-blur-sm"
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
              whileTap={{ scale: 0.98 }}
            >
              View Full Gallery
            </motion.button>
          </motion.div>
        </motion.section>

        {/* Final CTA Section */}
        <motion.section 
          className="mt-20 pt-20 border-t border-white/10 text-center"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-master-text-primary-dark mb-6">
            Ready to Look Sharp?
          </h2>
          <p className="text-xl text-master-text-secondary-dark mb-10 max-w-2xl mx-auto">
            Join hundreds of satisfied clients. Book your appointment in seconds.
          </p>
          
          <motion.button
            onClick={handleBookAppointment}
            className="px-10 py-5 bg-white text-master-text-primary-light rounded-lg font-bold text-xl shadow-2xl inline-flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              scale: {
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }
            }}
          >
            <Calendar className="w-6 h-6" />
            Book Your Appointment Now
          </motion.button>
        </motion.section>
      </div>
    </div>
  );
};

export default UV_Landing;
