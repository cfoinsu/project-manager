import type { HTMLAttributes } from 'react';

export type BadgeTone = 'task' | 'meeting' | 'assignment' | 'risk' | 'success' | 'warning' | 'danger' | 'neutral' | string;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const Badge = ({ tone = 'neutral', className = '', children, ...props }: BadgeProps) => {
  const knownTone = ['task', 'meeting', 'assignment', 'risk', 'success', 'warning', 'danger', 'neutral'].includes(tone)
    ? tone
    : 'neutral';

  return (
    <span className={`pm-badge pm-badge--${knownTone} ${className}`} {...props}>
      {children}
    </span>
  );
};
