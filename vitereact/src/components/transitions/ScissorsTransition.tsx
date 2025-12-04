import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScissorsTransitionProps {
  isActive: boolean;
  onComplete?: () => void;
}

/**
 * ScissorsTransition Component
 * 
 * Premium scissors animation for page transitions
 * - Scissors close in center screen with cutting motion
 * - Flash/slice effect across screen
 * - Screen splits/wipes to next page
 * - Duration: 0.8s (fast, clean, premium)
 */
const ScissorsTransition: React.FC<ScissorsTransitionProps> = ({ isActive, onComplete }) => {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Dark overlay that fades in */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-red-950 via-red-900 to-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Scissors Animation Container */}
          <div className="relative z-10">
            {/* Left Scissor Blade */}
            <motion.svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              className="absolute top-1/2 left-1/2"
              style={{ originX: '100%', originY: '50%' }}
              initial={{ x: '-50%', y: '-50%', rotate: -45 }}
              animate={{ 
                x: '-50%', 
                y: '-50%', 
                rotate: -15,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 0.5, 
                ease: 'easeInOut',
                times: [0, 0.5, 1]
              }}
            >
              {/* Left blade glow effect */}
              <defs>
                <filter id="glow-left">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="metallic-left" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0f0f0" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#d0d0d0" />
                </linearGradient>
              </defs>
              
              {/* Handle circle */}
              <circle 
                cx="25" 
                cy="25" 
                r="10" 
                fill="url(#metallic-left)" 
                stroke="#c0c0c0" 
                strokeWidth="2"
                filter="url(#glow-left)"
                opacity="0.95"
              />
              
              {/* Blade */}
              <motion.path
                d="M 30 25 L 90 60 L 95 55 L 35 20 Z"
                fill="url(#metallic-left)"
                stroke="#a0a0a0"
                strokeWidth="1.5"
                filter="url(#glow-left)"
                initial={{ opacity: 0.9 }}
                animate={{ opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 0.5, repeat: 0 }}
              />
              
              {/* Cutting edge highlight */}
              <motion.line
                x1="30" y1="25"
                x2="90" y2="60"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4 }}
              />
            </motion.svg>

            {/* Right Scissor Blade */}
            <motion.svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              className="absolute top-1/2 left-1/2"
              style={{ originX: '0%', originY: '50%' }}
              initial={{ x: '-50%', y: '-50%', rotate: 45, scaleX: -1 }}
              animate={{ 
                x: '-50%', 
                y: '-50%', 
                rotate: 15,
                scaleX: -1,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 0.5, 
                ease: 'easeInOut',
                times: [0, 0.5, 1]
              }}
            >
              {/* Right blade glow effect */}
              <defs>
                <filter id="glow-right">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="metallic-right" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0f0f0" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#d0d0d0" />
                </linearGradient>
              </defs>
              
              {/* Handle circle */}
              <circle 
                cx="25" 
                cy="25" 
                r="10" 
                fill="url(#metallic-right)" 
                stroke="#c0c0c0" 
                strokeWidth="2"
                filter="url(#glow-right)"
                opacity="0.95"
              />
              
              {/* Blade */}
              <motion.path
                d="M 30 25 L 90 60 L 95 55 L 35 20 Z"
                fill="url(#metallic-right)"
                stroke="#a0a0a0"
                strokeWidth="1.5"
                filter="url(#glow-right)"
                initial={{ opacity: 0.9 }}
                animate={{ opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 0.5, repeat: 0 }}
              />
              
              {/* Cutting edge highlight */}
              <motion.line
                x1="30" y1="25"
                x2="90" y2="60"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4 }}
              />
            </motion.svg>

            {/* Flash/Slice Effect */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 0.6,
                delay: 0.3,
                times: [0, 0.5, 1],
                ease: 'easeOut'
              }}
            >
              <div className="w-[200vw] h-1 bg-gradient-to-r from-transparent via-white to-transparent blur-sm" />
            </motion.div>

            {/* Sparkle effects when scissors close */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50"
                initial={{ 
                  x: '-50%', 
                  y: '-50%',
                  scale: 0,
                  opacity: 0
                }}
                animate={{ 
                  x: `calc(-50% + ${Math.cos(i * 45 * Math.PI / 180) * 60}px)`,
                  y: `calc(-50% + ${Math.sin(i * 45 * Math.PI / 180) * 60}px)`,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0]
                }}
                transition={{ 
                  duration: 0.6,
                  delay: 0.35 + (i * 0.02),
                  ease: 'easeOut'
                }}
              />
            ))}
          </div>

          {/* Split/Wipe Effect - Top half slides up */}
          <motion.div
            className="absolute inset-0 top-0 h-1/2 bg-gradient-to-b from-red-950 to-red-900 shadow-2xl"
            initial={{ y: 0 }}
            animate={{ y: '-100%' }}
            transition={{ 
              duration: 0.4,
              delay: 0.5,
              ease: 'easeInOut'
            }}
            onAnimationComplete={() => {
              if (onComplete) {
                setTimeout(onComplete, 100);
              }
            }}
          />

          {/* Split/Wipe Effect - Bottom half slides down */}
          <motion.div
            className="absolute inset-0 bottom-0 h-1/2 bg-gradient-to-t from-red-950 to-red-900 shadow-2xl"
            initial={{ y: 0 }}
            animate={{ y: '100%' }}
            transition={{ 
              duration: 0.4,
              delay: 0.5,
              ease: 'easeInOut'
            }}
          />

          {/* Loading shimmer (shown if page load is slow) */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-red-300 rounded-full"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 0.8,
                    delay: i * 0.1,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScissorsTransition;
