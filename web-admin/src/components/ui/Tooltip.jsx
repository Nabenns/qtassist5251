import {
  Tooltip as TooltipPrimitive,
  TooltipContent,
  TooltipProvider as TooltipProviderPrimitive,
  TooltipTrigger
} from '@radix-ui/react-tooltip';
import { cn } from '../../lib/cn.js';

export function TooltipProvider({ children, delayDuration = 250 }) {
  return (
    <TooltipProviderPrimitive delayDuration={delayDuration}>
      {children}
    </TooltipProviderPrimitive>
  );
}

export function Tooltip({ content, children, side = 'top', align = 'center', className }) {
  if (!content) return children;
  return (
    <TooltipPrimitive>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn(
          'z-[70] border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg shadow-step',
          'animate-in',
          className
        )}
      >
        {content}
      </TooltipContent>
    </TooltipPrimitive>
  );
}
