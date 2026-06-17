import type { HTMLAttributes, ReactNode } from 'react';

interface PageProps extends HTMLAttributes<HTMLDivElement> {
  scroll?: boolean;
}

export const Page = ({ scroll = false, className = '', children, ...props }: PageProps) => {
  const classes = ['pm-page-shell', scroll ? 'pm-page-shell--scroll' : '', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions, className = '', children, ...props }: PageHeaderProps) => (
  <header className={`pm-page-header ${className}`} {...props}>
    <div className="pm-page-header__main">
      {title && <h1 className="pm-page-header__title">{title}</h1>}
      {description && <p className="pm-page-header__description">{description}</p>}
      {children}
    </div>
    {actions && <div className="pm-page-header__actions">{actions}</div>}
  </header>
);

export const PageBody = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`pm-page-body ${className}`} {...props}>
    {children}
  </div>
);

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  left?: ReactNode;
  right?: ReactNode;
}

export const Toolbar = ({ left, right, className = '', children, ...props }: ToolbarProps) => (
  <div className={`pm-toolbar ${className}`} {...props}>
    {children || (
      <>
        <div className="pm-toolbar__group">{left}</div>
        <div className="pm-toolbar__group">{right}</div>
      </>
    )}
  </div>
);

interface PanelProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  actions?: ReactNode;
  flush?: boolean;
}

export const Panel = ({ title, actions, flush = false, className = '', children, ...props }: PanelProps) => {
  const classes = ['pm-panel', flush ? 'pm-panel--flush' : '', className].filter(Boolean).join(' ');

  return (
    <section className={classes} {...props}>
      {(title || actions) && (
        <header className="pm-panel__header">
          {title && <h2 className="pm-panel__title">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="pm-panel__body">{children}</div>
    </section>
  );
};

interface SplitLayoutProps extends HTMLAttributes<HTMLDivElement> {
  main: ReactNode;
  aside: ReactNode;
  reverse?: boolean;
}

export const SplitLayout = ({ main, aside, reverse = false, className = '', ...props }: SplitLayoutProps) => {
  const classes = ['pm-split-layout', reverse ? 'pm-split-layout--reverse' : '', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {reverse ? (
        <>
          <aside className="pm-split-layout__aside">{aside}</aside>
          <main className="pm-split-layout__main">{main}</main>
        </>
      ) : (
        <>
          <main className="pm-split-layout__main">{main}</main>
          <aside className="pm-split-layout__aside">{aside}</aside>
        </>
      )}
    </div>
  );
};

interface DashboardGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DashboardGrid = ({ className = '', children, ...props }: DashboardGridProps) => (
  <div className={`pm-dashboard-grid ${className}`} {...props}>
    {children}
  </div>
);

interface DashboardGridItemProps extends HTMLAttributes<HTMLDivElement> {
  span?: 2 | 3 | 4 | 6 | 8 | 12;
}

export const DashboardGridItem = ({ span = 12, className = '', children, ...props }: DashboardGridItemProps) => {
  const spanClass = span === 12 ? '' : `pm-dashboard-grid__item--span-${span}`;

  return (
    <div className={`pm-dashboard-grid__item ${spanClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
