import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export const IconButton = ({
  icon,
  label,
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) => {
  return (
    <button
      type={type}
      className={`pm-icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
};
