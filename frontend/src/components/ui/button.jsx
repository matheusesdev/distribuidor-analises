import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  primary: 'bg-[#0071e3] text-white shadow-[0_18px_36px_-20px_rgba(0,113,227,0.9)] hover:bg-[#0077ed] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none disabled:hover:translate-y-0',
  outline: 'border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
  ghost: 'border border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
