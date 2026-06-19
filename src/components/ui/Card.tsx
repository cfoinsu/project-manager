import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
}

const CardRoot = ({ padded = false, interactive = false, className = '', children, ...props }: CardProps) => {
  const classes = [
    'pm-card',
    padded ? 'pm-card--padded' : '',
    interactive ? 'pm-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

const CardHeader = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`pm-card__header ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`pm-card__title ${className}`} {...props}>
    {children}
  </h3>
);

const CardBody = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`pm-card__body ${className}`} {...props}>
    {children}
  </div>
);

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
});
