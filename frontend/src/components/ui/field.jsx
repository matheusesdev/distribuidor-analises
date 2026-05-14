import React from 'react';
import { cn } from '../../lib/utils';

export const Field = ({ className = '', children }) => (
  <div className={cn('flex flex-col gap-2', className)}>
    {children}
  </div>
);

export const FieldHeader = ({ className = '', children }) => (
  <div className={cn('flex items-center justify-between gap-3', className)}>
    {children}
  </div>
);

export const Label = React.forwardRef(({ className = '', ...props }, ref) => (
  <label ref={ref} className={cn('text-[11px] font-semibold tracking-[0.015em] text-slate-600', className)} {...props} />
));

Label.displayName = 'Label';
