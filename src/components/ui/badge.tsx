'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-elevated text-text-secondary border border-border',
        success: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
        warning: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
        error: 'bg-red-500/10 text-red-700 border border-red-500/20',
        info: 'bg-blue-500/10 text-blue-700 border border-blue-500/20',
        pink: 'bg-curi-pink/15 text-curi-pink border border-curi-pink/25',
        outline: 'bg-transparent text-text-secondary border border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        className={cn(badgeVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
