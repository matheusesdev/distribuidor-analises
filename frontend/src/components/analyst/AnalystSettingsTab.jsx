import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Save, ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { getPasswordStrength } from '../../utils/passwordStrength';

const initialFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const strengthTone = {
  weak: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  very_strong: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const AnalystSettingsTab = ({ isSubmitting, onSubmit, onClose }) => {
  const [form, setForm] = useState(initialFormState);
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const passwordStrength = getPasswordStrength(form.newPassword);

  const hasCurrentPassword = form.currentPassword.trim().length > 0;
  const hasNewPassword = form.newPassword.trim().length > 0;
  const hasConfirmPassword = form.confirmPassword.trim().length > 0;
  const passwordMatches = hasConfirmPassword && form.confirmPassword === form.newPassword;

  const passwordHints = useMemo(
    () => [
      {
        label: 'Pelo menos 8 caracteres',
        ok: form.newPassword.trim().length >= 8,
      },
      {
        label: 'Letras maiúsculas e minúsculas',
        ok: /[A-Z]/.test(form.newPassword) && /[a-z]/.test(form.newPassword),
      },
      {
        label: 'Número e símbolo',
        ok: /\d/.test(form.newPassword) && /[^A-Za-z0-9]/.test(form.newPassword),
      },
    ],
    [form.newPassword],
  );

  const completedChecks = passwordHints.filter((hint) => hint.ok).length;

  const canSubmit = Boolean(
    !isSubmitting &&
      hasCurrentPassword &&
      hasNewPassword &&
      hasConfirmPassword &&
      passwordMatches &&
      passwordStrength?.isAcceptable,
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) return;

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

  const strengthLevel = passwordStrength?.level || 'weak';
  const strengthClass = strengthTone[strengthLevel] || strengthTone.weak;

  return (
    <section className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start gap-3 mb-5">
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all active:scale-95 inline-flex items-center justify-center"
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-slate-900">Configurações de segurança</h1>
          <p className="text-slate-500 text-[12px] font-medium mt-1">
            Atualize sua senha com validação clara e feedback imediato.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-700">Alterar senha de acesso</p>
                <p className="text-[10px] text-slate-500">Use uma senha única para este sistema.</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium text-slate-600">
              <AlertCircle size={12} />
              Checklist: {completedChecks}/3
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-slate-500" />
              Senha atual
            </label>
            <div className="relative">
              <input
                type={showPasswords.currentPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(event) => updateField('currentPassword', event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-3.5 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70 transition-all"
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

          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-slate-500" />
              Nova senha
            </label>
            <div className="relative">
              <input
                type={showPasswords.newPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(event) => updateField('newPassword', event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-3.5 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70 transition-all"
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

            {hasNewPassword && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-500">Força da senha</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${strengthClass}`}>
                    {passwordStrength?.label || 'Fraca'}
                  </span>
                </div>

                <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength?.color || 'bg-rose-500'}`}
                    style={{ width: `${Math.max(20, Math.min((form.newPassword.trim().length / 16) * 100, 100))}%` }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {passwordHints.map((hint) => (
                    <div
                      key={hint.label}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-medium flex items-center gap-1.5 ${
                        hint.ok
                          ? 'text-emerald-700 bg-emerald-50/70'
                          : 'text-slate-500 bg-slate-50'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${hint.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {hint.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-slate-500" />
              Confirmar nova senha
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-3.5 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70 transition-all"
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

            {passwordMatches && (
              <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 inline-flex items-center gap-2">
                <CheckCircle2 size={14} /> Confirmação correta
              </p>
            )}

            {hasConfirmPassword && !passwordMatches && (
              <p className="text-[11px] font-medium text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 inline-flex items-center gap-2">
                <AlertCircle size={14} /> A confirmação não confere
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 active:scale-95 ${
                isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-sky-600 text-white hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400'
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
                  Atualizar senha
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
