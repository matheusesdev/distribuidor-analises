import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './button';
import { Field, FieldHeader, Label } from './field';
import { Input } from './input';
import { cn } from '../../lib/utils';

export const AuthTextField = ({
  id,
  label,
  icon: Icon,
  className = '',
  inputClassName = '',
  labelAction = null,
  ...inputProps
}) => (
  <Field className={className}>
    {(label || labelAction) && (
      <FieldHeader>
        {label && (
          <Label htmlFor={id}>
            {label}
          </Label>
        )}
        {labelAction}
      </FieldHeader>
    )}
    <Input id={id} icon={Icon} className={inputClassName} {...inputProps} />
  </Field>
);

export const AuthPasswordField = ({
  id,
  label = 'Senha',
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder = '********',
  autoComplete = 'current-password',
  icon: Icon,
  labelAction = null,
  inputClassName = '',
}) => (
  <Field>
    <FieldHeader>
      <Label htmlFor={id}>
        {label}
      </Label>
      {labelAction}
    </FieldHeader>
    <Input
      id={id}
      icon={Icon}
      rightSlot={(
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-200"
          title={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      className={inputClassName}
      placeholder={placeholder}
      autoComplete={autoComplete}
    />
  </Field>
);

export const KeepLoggedToggle = ({
  checked,
  onToggle,
  title = 'Manter logado',
  activeText = 'Ativado para este dispositivo',
  inactiveText = 'Desativado',
  helpLabel = 'Explicação sobre manter logado',
  helpText,
  className = 'rounded-[0.95rem]',
}) => (
  <div className={cn('flex flex-col gap-3 border border-slate-200/90 bg-white/90 px-3.5 py-3 shadow-[0_14px_30px_-27px_rgba(15,23,42,0.5)] backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between', className)}>
    <button type="button" onClick={onToggle} className="group flex w-full items-start gap-2.5 text-left sm:w-auto" aria-pressed={checked}>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200',
          checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-slate-200',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className="pt-0.5">
        <span className="block text-[11px] font-semibold tracking-[0.02em] text-slate-700">{title}</span>
        <span className="block text-[10px] font-medium text-slate-500">{checked ? activeText : inactiveText}</span>
      </span>
    </button>

    {helpText && (
      <div className="group/help relative shrink-0 self-end pt-0.5 sm:self-auto">
        <button
          type="button"
          aria-label={helpLabel}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-500 transition-colors duration-200 hover:border-blue-400 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-200"
        >
          ?
        </button>
        <div className="pointer-events-none absolute right-0 top-8 z-20 w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-medium leading-relaxed text-slate-600 opacity-0 shadow-xl transition-opacity duration-150 group-hover/help:opacity-100 group-focus-within/help:opacity-100">
          {helpText}
        </div>
      </div>
    )}
  </div>
);

export const PrimaryAuthButton = ({ loading, disabled, loadingText = 'Entrando...', children, className = '', ...props }) => (
  <Button
    type="submit"
    variant="primary"
    size="md"
    disabled={disabled}
    className={cn('w-full py-3 text-[13px]', className)}
    {...props}
  >
    {loading ? (
      <>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-white" />
        {loadingText}
      </>
    ) : (
      children
    )}
  </Button>
);

export const SecondaryAuthButton = ({ children, className = '', ...props }) => (
  <Button
    type="button"
    variant="outline"
    size="md"
    className={cn('w-full py-3 text-[12px]', className)}
    {...props}
  >
    {children}
  </Button>
);

export const SessionNotice = ({ icon: Icon, title = 'Aviso de sessão', children }) => (
  <div className="mt-3 rounded-xl border border-amber-200/80 bg-[linear-gradient(135deg,#fff8eb_0%,#fffdf7_60%,#ffffff_100%)] px-3.5 py-3 shadow-[0_12px_26px_-22px_rgba(180,83,9,0.48)] backdrop-blur-sm">
    <div className="flex items-start gap-2.5">
      {Icon && (
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-600">
          <Icon size={12} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">{title}</p>
        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-700">{children}</p>
      </div>
    </div>
  </div>
);

export const ModalBackdrop = ({ children, onClose, className = 'bg-slate-900/50 backdrop-blur-sm', ...motionProps }) => (
  <motion.div
    className={cn('fixed inset-0 z-250 flex items-center justify-center p-4', className)}
    onClick={onClose}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18, ease: 'easeOut' }}
    {...motionProps}
  >
    {children}
  </motion.div>
);
