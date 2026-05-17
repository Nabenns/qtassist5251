import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * StepIndicator — 3-step horizontal progress indicator for /daftar-ib wizard.
 *
 * Active step: bg-primary teal block.
 * Done steps:  bg-success-soft + check icon.
 * Pending:     bg-surface + border.
 *
 * Step labels rendered below in mono uppercase 10px.
 */
export function StepIndicator({ activeStep }) {
  const steps = [
    { n: 1, label: 'Daftar Valetax' },
    { n: 2, label: 'Setor Deposit' },
    { n: 3, label: 'Submit Akun' }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const isActive = step.n === activeStep;
          const isDone = step.n < activeStep;
          return (
            <div key={step.n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center font-display text-base font-black border-2 transition-colors duration-75',
                  isActive && 'bg-primary text-primary-fg border-primary',
                  isDone && 'bg-success-soft text-success border-success',
                  !isActive && !isDone && 'bg-surface text-fg-muted border-border'
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${step.n} ${isDone ? 'selesai' : isActive ? 'aktif' : 'belum'}`}
              >
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : step.n}
              </div>
              {idx < steps.length - 1 ? (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-colors duration-75',
                    step.n < activeStep ? 'bg-success' : 'bg-border'
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => (
          <div
            key={step.n}
            className={cn(
              'text-center font-mono text-[10px] font-bold uppercase tracking-[0.15em]',
              step.n === activeStep ? 'text-fg' : 'text-muted-fg'
            )}
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
