import React from 'react';
import { createPortal } from 'react-dom';

interface ModalOverlayProps {
  children: React.ReactNode;
  onClose?: () => void;
  zIndex?: number;
  className?: string;
}

const renderPortal = (node: React.ReactNode) => {
  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};

export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  children,
  onClose,
  zIndex = 100,
  className = '',
}) => {
  return renderPortal(
    <div
      className={`fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in ${className}`}
      style={{ zIndex }}
      onClick={onClose}
    >
      {children}
    </div>
  );
};

interface FullscreenLoadingOverlayProps {
  message: string;
  subMessage?: string;
  zIndex?: number;
}

export const FullscreenLoadingOverlay: React.FC<FullscreenLoadingOverlayProps> = ({
  message,
  subMessage,
  zIndex = 11000,
}) => {
  return (
    <ModalOverlay zIndex={zIndex} className="flex-col">
      <div className="w-14 h-14 border-4 border-toss-blue border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-bold text-white">{message}</p>
      {subMessage && (
        <span className="text-xs text-slate-300 dark:text-slate-550 mt-2">{subMessage}</span>
      )}
    </ModalOverlay>
  );
};
