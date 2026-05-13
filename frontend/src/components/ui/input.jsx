import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className = '', icon: Icon, rightSlot = null, ...props }, ref) => (
  <div className="relative">
    {Icon && <Icon size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />}
    <input
      ref={ref}
      className={cn(
        'w-full rounded-2xl border border-slate-200 bg-white py-3 text-[14px] font-semibold text-slate-900 outline-none shadow-[0_12px_28px_-24px_rgba(15,23,42,0.5)] transition-all duration-200 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100/80',
        Icon ? 'pl-10' : 'pl-3',
        rightSlot ? 'pr-10' : 'pr-3',
        className,
      )}
      {...props}
    />
    {rightSlot}
  </div>
));

Input.displayName = 'Input';
