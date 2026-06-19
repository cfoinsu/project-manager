interface EmptyStateProps {
  text: string;
  variant?: 'plain' | 'dashed';
  className?: string;
}

export const EmptyState = ({ text, variant = 'plain', className = '' }: EmptyStateProps) => {
  const variantClass = variant === 'dashed' ? 'pm-empty-state--dashed' : '';

  return (
    <div className={`pm-empty-state ${variantClass} ${className}`}>
      {text}
    </div>
  );
};
