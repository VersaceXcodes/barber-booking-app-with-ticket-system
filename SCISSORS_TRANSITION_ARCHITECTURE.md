# Scissors Transition - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         PageTransitionProvider (Global Context)            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              AppContent Component                    │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │           Navigation Views                     │  │  │  │
│  │  │  │  • GV_TopNav                                  │  │  │  │
│  │  │  │  • GV_MobileNav                               │  │  │  │
│  │  │  │  • UV_Landing                                 │  │  │  │
│  │  │  │  • UV_UserDashboard                           │  │  │  │
│  │  │  │                                               │  │  │  │
│  │  │  │  Each uses: usePageTransition()              │  │  │  │
│  │  │  │      ↓                                        │  │  │  │
│  │  │  │  transitionTo('/path')                       │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │      ScissorsTransition Overlay (z-index: 9999)    │  │  │
│  │  │  • Renders when isTransitioning === true           │  │  │
│  │  │  • Covers entire viewport                          │  │  │
│  │  │  • Plays scissors animation                        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Animation Flow

```
User Click
    ↓
Button onClick
    ↓
transitionTo('/path')
    ↓
┌─────────────────────────────────────────────────────────────┐
│  PageTransitionContext                                       │
│  • Set isTransitioning = true                               │
│  • Store destination path                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  ScissorsTransition Component Renders                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  0-300ms: Dark overlay fades in                       │  │
│  │  0-500ms: Scissors close from open position           │  │
│  │  300-600ms: Flash/slice effect across screen          │  │
│  │  350-600ms: Sparkle effects radiate outward           │  │
│  │  500-900ms: Screen splits (top up, bottom down)       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    ↓
800ms: Navigation Occurs
    ↓
React Router navigates to new page
    ↓
900ms: Transition Complete
    ↓
┌─────────────────────────────────────────────────────────────┐
│  PageTransitionContext                                       │
│  • Set isTransitioning = false                              │
│  • Clear destination path                                   │
│  • ScissorsTransition unmounts                              │
└─────────────────────────────────────────────────────────────┘
    ↓
New page fully visible
```

## Component Hierarchy

```
App.tsx
├── PageTransitionProvider
│   └── AppContent
│       ├── Navigation Components
│       │   ├── GV_TopNav
│       │   │   └── usePageTransition() → transitionTo()
│       │   ├── GV_MobileNav
│       │   │   └── usePageTransition() → transitionTo()
│       │   └── GV_Footer
│       │
│       ├── Page Components
│       │   ├── UV_Landing
│       │   │   └── usePageTransition() → transitionTo()
│       │   ├── UV_UserDashboard
│       │   │   └── usePageTransition() → transitionTo()
│       │   └── [Other Pages]
│       │
│       └── ScissorsTransition (Overlay)
│           ├── Dark Overlay (gradient)
│           ├── Left Scissor Blade (SVG + animations)
│           ├── Right Scissor Blade (SVG + animations)
│           ├── Flash/Slice Effect
│           ├── Sparkle Effects (8 particles)
│           ├── Split Wipe (top half)
│           ├── Split Wipe (bottom half)
│           └── Loading Shimmer
```

## State Management

```
┌───────────────────────────────────────────────────────────┐
│  PageTransitionContext State                               │
├───────────────────────────────────────────────────────────┤
│  isTransitioning: boolean                                  │
│  - Controls when ScissorsTransition renders               │
│  - Prevents multiple simultaneous transitions             │
│                                                            │
│  pendingNavigation: { path, callback } | null             │
│  - Stores destination path during animation               │
│  - Optional callback to execute after navigation          │
├───────────────────────────────────────────────────────────┤
│  Methods:                                                  │
│  • transitionTo(path, callback?)                          │
│    - Sets isTransitioning to true                         │
│    - Waits 800ms for animation                            │
│    - Calls navigate(path)                                 │
│    - Executes callback if provided                        │
│    - Resets state after 100ms delay                       │
└───────────────────────────────────────────────────────────┘
```

## File Dependencies

```
ScissorsTransition.tsx
├── Depends on:
│   └── framer-motion (AnimatePresence, motion)
└── Used by:
    └── App.tsx (AppContent)

usePageTransition.tsx
├── Provides:
│   ├── PageTransitionProvider
│   └── usePageTransition hook
├── Depends on:
│   └── react-router-dom (useNavigate)
└── Used by:
    ├── App.tsx
    ├── UV_Landing.tsx
    ├── GV_TopNav.tsx
    └── UV_UserDashboard.tsx

TransitionButton.tsx
├── Depends on:
│   └── usePageTransition hook
└── Can be used by:
    └── Any component needing transition (optional)

index.css
├── Provides:
│   ├── Hardware acceleration classes
│   ├── Animation keyframes
│   └── Mobile optimizations
└── Used by:
    └── Global application styling
```

## CSS Animation Keyframes

```css
/* Slice Flash Effect */
@keyframes slice-flash {
  0%   { opacity: 0; transform: scaleX(0); }
  50%  { opacity: 1; transform: scaleX(1.5); }
  100% { opacity: 0; transform: scaleX(0); }
}

/* Screen Split - Top */
@keyframes split-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-100%); }
}

/* Screen Split - Bottom */
@keyframes split-down {
  0%   { transform: translateY(0); }
  100% { transform: translateY(100%); }
}

/* Loading Shimmer */
@keyframes shimmer-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.5); }
}
```

## Performance Optimizations

```
┌────────────────────────────────────────────────────────┐
│  GPU Acceleration                                       │
├────────────────────────────────────────────────────────┤
│  • transform: translateZ(0)                            │
│  • will-change: transform, opacity                     │
│  • backface-visibility: hidden                         │
│  • Only animate transform and opacity                  │
└────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────┐
│  Mobile Optimizations                                  │
├────────────────────────────────────────────────────────┤
│  • Reduced animation duration (0.7s vs 0.8s)          │
│  • Reduced blur effects (1px vs 2px)                  │
│  • Simplified effects on smaller screens              │
└────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────┐
│  Accessibility                                         │
├────────────────────────────────────────────────────────┤
│  • @media (prefers-reduced-motion: reduce)            │
│  • Instant transitions when motion is disabled        │
│  • No keyboard traps or focus issues                  │
└────────────────────────────────────────────────────────┘
```

## Integration Points

```
Button Click Points
├── Landing Page (UV_Landing.tsx)
│   ├── Hero CTA: "Book Your Appointment Now"
│   ├── Secondary CTA: "Get Your Appointment Now"
│   └── Final CTA: "Book Your Cut Now—It's Free!"
│
├── Top Navigation (GV_TopNav.tsx)
│   ├── Desktop: "Book Appointment"
│   └── Mobile: "Book Appointment"
│
├── User Dashboard (UV_UserDashboard.tsx)
│   └── Header: "Book Appointment"
│
└── [Future Integration Points]
    ├── Footer CTAs
    ├── Booking confirmation page
    └── Email verification success page
```

## Transition Timeline (Detailed)

```
Time (ms)  │  Animation Event
───────────┼────────────────────────────────────────────
0          │  User clicks button
           │  transitionTo() called
           │  isTransitioning = true
───────────┼────────────────────────────────────────────
0-200      │  Dark overlay fades in
           │  Opacity: 0 → 0.95
───────────┼────────────────────────────────────────────
0-500      │  Scissors close together
           │  Left blade: rotate -45° → -15°
           │  Right blade: rotate 45° → 15°
           │  Scale: 1 → 1.1 → 1
───────────┼────────────────────────────────────────────
300-600    │  Flash/slice effect
           │  White line: scaleX 0 → 1.5 → 0
           │  Opacity: 0 → 1 → 0
───────────┼────────────────────────────────────────────
350-600    │  Sparkle particles (8 particles)
           │  Radiate outward 60px
           │  Scale: 0 → 1 → 0
           │  Staggered delay: 20ms per particle
───────────┼────────────────────────────────────────────
500-900    │  Screen split wipe
           │  Top half: translateY 0 → -100%
           │  Bottom half: translateY 0 → 100%
───────────┼────────────────────────────────────────────
800        │  onAnimationComplete callback
           │  navigate(path) executes
           │  React Router navigation occurs
───────────┼────────────────────────────────────────────
800-900    │  Overlay continues fade out
           │  New page begins rendering
───────────┼────────────────────────────────────────────
900        │  isTransitioning = false
           │  ScissorsTransition unmounts
           │  Transition complete
───────────┴────────────────────────────────────────────
```

## Browser Rendering Pipeline

```
┌─────────────────────────────────────────────────────┐
│  Browser Rendering Optimization                     │
├─────────────────────────────────────────────────────┤
│  Composite Layer (GPU)                             │
│  ├── Dark overlay (transform + opacity)            │
│  ├── Scissors SVGs (transform + opacity)           │
│  ├── Flash effect (transform + opacity)            │
│  ├── Sparkle particles (transform + opacity)       │
│  └── Split wipe elements (transform)               │
│                                                      │
│  → No Layout or Paint on every frame              │
│  → Only Composite operations (fastest)             │
│  → 60fps performance maintained                    │
└─────────────────────────────────────────────────────┘
```

---

**Architecture Status**: ✅ Complete

The scissors transition system is fully integrated with a clean, maintainable architecture that follows React best practices and provides excellent performance across all devices.
