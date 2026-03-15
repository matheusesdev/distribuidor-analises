import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Save, ShieldCheck, ArrowLeft, Circle, CheckCircle2 } from 'lucide-react';
import { getPasswordStrength } from '../../utils/passwordStrength';

const initialFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const AnalystSettingsTab = ({ isSubmitting, onSubmit, onClose }) => {
  const [form, setForm] = useState(initialFormState);
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const passwordStrength = getPasswordStrength(form.newPassword);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const hasCurrentPassword = form.currentPassword.trim().length > 0;
  const hasNewPassword = form.newPassword.trim().length > 0;
  const hasConfirmPassword = form.confirmPassword.trim().length > 0;
  const hasPasswordMatch = hasConfirmPassword && form.confirmPassword === form.newPassword;
  const canSubmit = Boolean(
    !isSubmitting
    && hasCurrentPassword
    && hasNewPassword
    && hasConfirmPassword
    && hasPasswordMatch
    && passwordStrength?.isAcceptable
  );

  const passwordHints = [
    {
      label: 'Possui pelo menos 8 caracteres',
      ok: form.newPassword.trim().length >= 8,
    },
    {
      label: 'Combina letras maiúsculas e minúsculas',
      ok: /[A-Z]/.test(form.newPassword) && /[a-z]/.test(form.newPassword),
    },
    {
      label: 'Inclui número e símbolo',
      ok: /\d/.test(form.newPassword) && /[^A-Za-z0-9]/.test(form.newPassword),
    },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.currentPassword.trim() || !form.newPassword.trim() || !form.confirmPassword.trim()) return;
    if (form.newPassword !== form.confirmPassword) return;
    if (!passwordStrength?.isAcceptable) return;

    const updated = await onSubmit({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });

    if (updated) {
      setForm(initialFormState);
      setShowPasswords({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
    }
  };

  return (
    <section className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-xl border border-slate-200 bg-white/85 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-white transition-all active:scale-95 inline-flex items-center justify-center shadow-[0_10px_24px_-20px_rgba(15,23,42,0.7)]"
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-slate-900">Configurações de Segurança</h1>
          <p className="text-slate-500 text-[12px] font-medium mt-1">Atualize sua senha com validação inteligente e feedback em tempo real.</p>
        </div>
      </div>

      <div className="rounded-4xl border border-slate-200/80 bg-white/90 backdrop-blur-sm shadow-[0_26px_55px_-34px_rgba(15,23,42,0.5)] overflow-hidden">
        <div className="px-6 md:px-8 py-7 md:py-8 bg-[radial-gradient(circle_at_top_right,#dbeafe_0%,#f1f7ff_38%,#ffffff_100%)] border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/90 flex items-center justify-center border border-blue-100 text-[#0071e3] shadow-[0_16px_28px_-20px_rgba(0,113,227,0.85)] shrink-0">
              <ShieldCheck size={20} className="stroke-2" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[18px] md:text-[21px] font-semibold tracking-[-0.02em] text-slate-900">Alterar senha de acesso</h2>
              <p className="text-[12px] font-medium text-slate-600 mt-1 leading-relaxed">Uma senha forte reduz risco de acesso indevido e protege sua sessão no painel.</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-semibold text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Recomendado: usar senha única para este sistema
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 space-y-2.5">
            <label className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-[#0071e3]" />
              Senha Atual
            </label>
            <div className="relative group">
              <input
                type={showPasswords.currentPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(event) => updateField('currentPassword', event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70 transition-all group-hover:border-slate-300"
                placeholder="Digite sua senha atual"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('currentPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showPasswords.currentPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPasswords.currentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_62%)] p-4 md:p-5 space-y-3">
            <label className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-[#0071e3]" />
              Nova Senha
            </label>
            <div className="relative group">
              <input
                type={showPasswords.newPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(event) => updateField('newPassword', event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70 transition-all group-hover:border-slate-300"
                placeholder="Digite a nova senha"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('newPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showPasswords.newPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPasswords.newPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {passwordStrength && (
              <div className="space-y-2.5 mt-1 p-4 bg-white border border-slate-200 rounded-xl">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Força da senha</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full ${
                      passwordStrength.level === 'weak'
                        ? 'bg-red-100 text-red-700'
                        : passwordStrength.level === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : passwordStrength.level === 'strong'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${Math.max(20, Math.min((form.newPassword.trim().length / 16) * 100, 100))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {passwordHints.map((hint) => (
                    <div
                      key={hint.label}
                      className={`rounded-lg border px-2.5 py-2 text-[10px] font-medium flex items-center gap-2 ${hint.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                    >
                      {hint.ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                      <span>{hint.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 space-y-2.5">
            <label className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-[#0071e3]" />
              Confirmar Nova Senha
            </label>
            <div className="relative group">
              <input
                type={showPasswords.confirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70 transition-all group-hover:border-slate-300"
                placeholder="Confirme a nova senha"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showPasswords.confirmPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPasswords.confirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {hasPasswordMatch && (
              <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 size={14} />
                Confirmação correta.
              </p>
            )}

            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                ✕ A confirmação de senha não confere
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 px-4 rounded-xl text-[11px] font-semibold uppercase tracking-[0.08em] border border-slate-200 text-slate-600 hover:bg-slate-100/80 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 py-3.5 px-4 rounded-xl text-[11px] font-semibold uppercase tracking-[0.08em] transition-all flex items-center justify-center gap-2 active:scale-95 ${
                isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[linear-gradient(140deg,#0071e3_0%,#005bb7_100%)] text-white hover:brightness-110 shadow-[0_16px_28px_-16px_rgba(0,113,227,0.9)] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Alterar Senha
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default AnalystSettingsTab;