import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from './Badge';

export type ToneBadgeTone = BadgeTone;

interface ToneBadgeProps {
  tone?: ToneBadgeTone;
  children: ReactNode;
  className?: string;
}

export const ToneBadge = ({ tone = 'neutral', children, className = '' }: ToneBadgeProps) => {
  return (
    <Badge tone={tone} className={className}>
      {children}
    </Badge>
  );
};
