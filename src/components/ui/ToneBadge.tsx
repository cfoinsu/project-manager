import type { ReactNode } from 'react';

export type ToneBadgeTone = 'task' | 'meeting' | 'assignment' | 'risk' | 'neutral' | string;

interface ToneBadgeProps {
  tone?: ToneBadgeTone;
  children: ReactNode;
  className?: string;
}

const toneClassMap: Record<string, string> = {
  task: 'bg-blue-50 text-toss-blue dark:bg-blue-950/30',
  meeting: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300',
  assignment: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300',
  risk: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300',
  neutral: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
};

export const ToneBadge = ({ tone = 'neutral', children, className = '' }: ToneBadgeProps) => {
  const toneClass = toneClassMap[tone] ?? toneClassMap.neutral;

  return (
    <span className={`inline-flex items-center justify-center rounded-full font-black ${toneClass} ${className}`}>
      {children}
    </span>
  );
};
