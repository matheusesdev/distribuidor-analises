import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  primary: 'bg-[linear-gradient(135deg,#0b6fd3_0%,#075aa9_100%)] text-white shadow-[0_18px_36px_-22px_rgba(7,90,169,0.95)] hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(7,90,169,0.95)] active:translate-y-0 active:scale-[0.98] disabled:bg-none disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none disabled:hover:translate-y-0',
  outline: 'border border-slate-200/90 bg-white/90 text-slate-600 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.42)] hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:translate-y-0',
  ghost: 'border border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98]',
};

const sizes = {
  sm: 'h-9 px-3 text-[12px]',
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-11 px-4 text-[14px]',
};

export const Button = React.forwardRef(
  ({ className = '', variant = 'primary', size = 'md', as: Component = 'button', ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[0.9rem] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-200 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
