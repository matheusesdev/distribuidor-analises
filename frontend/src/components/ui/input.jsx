import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className = '', icon: Icon, rightSlot = null, ...props }, ref) => (
  <div className="group relative">
    {Icon && <Icon size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-blue-600" />}
    <input
      ref={ref}
      className={cn(
        'w-full rounded-[0.95rem] border border-slate-200/90 bg-white/95 py-3 text-[14px] font-semibold text-slate-900 outline-none shadow-[0_12px_28px_-25px_rgba(15,23,42,0.5)] transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:bg-white focus:ring-[3px] focus:ring-blue-100/80',
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
