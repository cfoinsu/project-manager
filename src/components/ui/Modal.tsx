import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  closeOnDimClick?: boolean;
  className?: string;
}

const renderPortal = (node: ReactNode) => {
  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};

export const Modal = ({
  open,
  title,
  children,
  footer,
  onClose,
  closeOnDimClick = true,
  className = '',
}: ModalProps) => {
  if (!open) return null;

  return renderPortal(
    <div
      className="pm-modal-dim"
      role="presentation"
      onClick={closeOnDimClick ? onClose : undefined}
    >
      <section
        className={`pm-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {title && (
          <header className="pm-modal__header">
            <h2 className="pm-modal__title">{title}</h2>
            {onClose && (
              <IconButton
                label="닫기"
                icon={<span aria-hidden="true">×</span>}
                onClick={onClose}
              />
            )}
          </header>
        )}
        <div className="pm-modal__body">{children}</div>
        {footer && <footer className="pm-modal__footer">{footer}</footer>}
      </section>
    </div>
  );
};
