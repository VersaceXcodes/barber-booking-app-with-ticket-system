import React, { ButtonHTMLAttributes } from 'react';
import { usePageTransition } from '@/hooks/usePageTransition';

interface TransitionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  to: string;
  children: React.ReactNode;
  onTransitionStart?: () => void;
  onTransitionComplete?: () => void;
}

/**
 * TransitionButton Component
 * 
 * A button wrapper that triggers the scissors page transition animation
 * when clicked, then navigates to the specified route.
 * 
 * @example
 * <TransitionButton 
 *   to="/book/service"
 *   className="px-4 py-2 bg-red-600 text-master-text-primary-dark"
 * >
 *   Book Now
 * </TransitionButton>
 */
const TransitionButton: React.FC<TransitionButtonProps> = ({
  to,
  children,
  onTransitionStart,
  onTransitionComplete,
  onClick,
  ...buttonProps
}) => {
  const { transitionTo } = usePageTransition();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }

    // Call transition start callback
    if (onTransitionStart) {
      onTransitionStart();
    }

    // Trigger page transition with scissors animation
    transitionTo(to, onTransitionComplete);
  };

  return (
    <button onClick={handleClick} {...buttonProps}>
      {children}
    </button>
  );
};

export default TransitionButton;
