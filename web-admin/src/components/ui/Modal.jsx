import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Accessible modal built on top of Radix Dialog. Handles focus trapping,
 * ESC to close, and prevents body scroll while open. Supports controlled
 * usage via `open` + `onOpenChange`.
 */
export function Modal({ open, onOpenChange, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-overlay-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(96vw,42rem)]',
            '-translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-surface shadow-floating',
            'animate-modal-in focus:outline-none'
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ModalHeader({ title, description, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3">
      <div className="space-y-0.5">
        {title ? (
          <DialogPrimitive.Title className="text-base font-semibold text-fg">
            {title}
          </DialogPrimitive.Title>
        ) : null}
        {description ? (
          <DialogPrimitive.Description className="text-xs text-muted-fg">
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-fg hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function ModalBody({ className, children }) {
  return <div className={cn('px-5 py-4 space-y-4', className)}>{children}</div>;
}

export function ModalFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3 rounded-b-xl',
        className
      )}
    >
      {children}
    </div>
  );
}
