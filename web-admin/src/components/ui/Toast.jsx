import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Lightweight toast/notification system.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Approved');
 *   toast.error('Failed', { description: 'Network error' });
 *   toast.info('Heads up', { duration: 8000, actionLabel: 'Undo', onAction: () => ... });
 */

const ToastContext = createContext(null);

const variantConfig = {
  default: {
    icon: Info,
    accent: 'text-info',
    tile: 'bg-info text-info-fg'
  },
  success: {
    icon: CheckCircle2,
    accent: 'text-success',
    tile: 'bg-success text-success-fg'
  },
  error: {
    icon: XCircle,
    accent: 'text-danger',
    tile: 'bg-danger text-danger-fg'
  },
  warning: {
    icon: AlertTriangle,
    accent: 'text-warning',
    tile: 'bg-warning text-warning-fg'
  },
  info: {
    icon: Info,
    accent: 'text-info',
    tile: 'bg-info text-info-fg'
  }
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeouts = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, title, options = {}) => {
      const id = nextId++;
      const duration = options.duration ?? 4500;
      const toast = {
        id,
        variant,
        title,
        description: options.description,
        actionLabel: options.actionLabel,
        onAction: options.onAction
      };
      setToasts((current) => [...current, toast]);
      if (duration > 0) {
        const handle = setTimeout(() => dismiss(id), duration);
        timeouts.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timeouts.current.forEach((handle) => clearTimeout(handle));
      timeouts.current.clear();
    };
  }, []);

  const toast = useMemo(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      warning: (title, options) => push('warning', title, options),
      info: (title, options) => push('info', title, options),
      show: (title, options) => push('default', title, options)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div
      className="pointer-events-none fixed top-16 right-4 z-[60] flex w-[min(95vw,22rem)] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const cfg = variantConfig[t.variant] || variantConfig.default;
        const Icon = cfg.icon;
        const toneLabel = t.variant === 'default' ? 'INFO' : t.variant.toUpperCase();
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-stretch gap-0 border border-border bg-surface shadow-step',
              'animate-in'
            )}
          >
            <div
              className={cn(
                'flex w-10 shrink-0 items-center justify-center',
                cfg.tile
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0 px-3 py-2.5">
              <div className={cn('font-mono text-[9px] font-bold uppercase tracking-[0.15em]', cfg.accent)}>
                {toneLabel}
              </div>
              <div className="text-sm font-semibold text-fg leading-tight mt-0.5">{t.title}</div>
              {t.description ? (
                <div className="mt-0.5 text-xs text-muted-fg break-words">{t.description}</div>
              ) : null}
              {t.actionLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      t.onAction?.();
                    } finally {
                      dismiss(t.id);
                    }
                  }}
                  className={cn(
                    'mt-2 inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-wider hover:underline',
                    cfg.accent
                  )}
                >
                  {t.actionLabel}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex w-8 shrink-0 items-center justify-center text-muted-fg hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
