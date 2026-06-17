interface EmptyStateProps {
  text: string;
  variant?: 'plain' | 'dashed';
  className?: string;
}

export const EmptyState = ({ text, variant = 'plain', className = '' }: EmptyStateProps) => {
  const variantClass = variant === 'dashed'
    ? 'rounded-xl border border-dashed border-slate-200 p-5 dark:border-slate-800'
    : 'py-8';

  return (
    <div className={`${variantClass} text-center text-xs font-bold text-slate-400 ${className}`}>
      {text}
    </div>
  );
};
