import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { HazardStripe } from './brutalist/HazardStripe.jsx';

/**
 * Accessible modal built on top of Radix Dialog. Brutalist styling:
 * sharp corners, hard borders, optional hazard stripe header for
 * high-attention dialogs.
 *
 * Usage:
 *   <Modal open={open} onOpenChange={setOpen}>
 *     <ModalHeader title="Title" description="..." onClose={...} />
 *     <ModalBody>...</ModalBody>
 *     <ModalFooter>...</ModalFooter>
 *   </Modal>
 */
export function Modal({ open, onOpenChange, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 backdrop-blur-sm animate-overlay-in"
          style={{ backgroundColor: 'rgb(8 22 28 / 0.85)' }}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(96vw,42rem)]',
            '-translate-x-1/2 -translate-y-1/2',
            'border border-border bg-surface shadow-step-lg',
            'animate-modal-in focus:outline-none'
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * ModalHeader. Pass `tone="warning"` or `tone="danger"` to render a
 * hazard stripe at the top edge for high-attention dialogs.
 */
export function ModalHeader({ title, description, onClose, tone }) {
  const stripe = tone === 'warning' || tone === 'danger' ? tone : null;
  return (
    <>
      {stripe ? <HazardStripe color={stripe} height={4} density={10} /> : null}
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="space-y-0.5">
          {title ? (
            <DialogPrimitive.Title className="font-display text-base font-bold uppercase tracking-wider text-fg">
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
            className="p-1 text-muted-fg hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </>
  );
}

export function ModalBody({ className, children }) {
  return <div className={cn('px-4 py-4 space-y-4', className)}>{children}</div>;
}

export function ModalFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  );
}
