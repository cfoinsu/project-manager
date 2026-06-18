import type { HTMLAttributes } from 'react';

type ProgressTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  value: number;
  tone?: ProgressTone;
  showValue?: boolean;
}

export const Progress = ({ label, value, tone = 'primary', showValue = true, className = '', ...props }: ProgressProps) => {
  const safeValue = Math.max(0, Math.min(100, value));
  const toneClass = tone === 'primary' ? '' : `pm-progress__fill--${tone}`;

  return (
    <div className={`pm-progress ${className}`} {...props}>
      {(label || showValue) && (
        <div className="pm-progress__header">
          {label && <span className="pm-progress__label">{label}</span>}
          {showValue && <span className="pm-progress__value">{safeValue}%</span>}
        </div>
      )}
      <div className="pm-progress__track">
        <div className={`pm-progress__fill ${toneClass}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
};
