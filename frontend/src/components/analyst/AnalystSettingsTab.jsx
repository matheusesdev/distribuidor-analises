import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Save, ShieldCheck, ArrowLeft } from 'lucide-react';
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
    <section className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header com botão de voltar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-all active:scale-95 border border-slate-200"
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">Alterar Senha</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Proteja sua conta com uma nova senha forte</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-[2rem] shadow-lg overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 md:px-8 py-8 text-white relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full -mr-20 -mt-20" />
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <ShieldCheck size={20} className="stroke-2" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">Configurações de Segurança</h2>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Altere sua senha com validação de segurança avançada</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6">
          {/* Campo Senha Atual */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-blue-600" />
              Senha Atual
            </label>
            <div className="relative group">
              <input
                type={showPasswords.currentPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(event) => updateField('currentPassword', event.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-xl py-3.5 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all group-hover:border-slate-300"
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

          {/* Divisor visual */}
          <div className="my-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          {/* Campo Nova Senha */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-blue-600" />
              Nova Senha
            </label>
            <div className="relative group">
              <input
                type={showPasswords.newPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(event) => updateField('newPassword', event.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-xl py-3.5 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all group-hover:border-slate-300"
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

            {/* Password Strength Indicator */}
            {passwordStrength && (
              <div className="space-y-2.5 mt-3 p-4 bg-white border border-slate-200 rounded-xl">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Força da Senha</span>
                    <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
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

                {!passwordStrength.isAcceptable && (
                  <p className="text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                    ✓ Use <strong>letras maiúsculas</strong>, <strong>minúsculas</strong>, <strong>números</strong> e <strong>símbolos</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Divisor visual */}
          <div className="my-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          {/* Campo Confirmar Senha */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <Lock size={13} className="text-blue-600" />
              Confirmar Nova Senha
            </label>
            <div className="relative group">
              <input
                type={showPasswords.confirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-xl py-3.5 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all group-hover:border-slate-300"
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
            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
              <p className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                ✕ A confirmação de senha não confere
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting
                || !form.currentPassword.trim()
                || !form.newPassword.trim()
                || !form.confirmPassword.trim()
                || form.newPassword !== form.confirmPassword
                || !passwordStrength?.isAcceptable
              }
              className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 ${
                isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none'
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