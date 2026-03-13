import React, { useState } from 'react';
import { Eye, EyeOff, Lock, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const checkStrength = (password) => {
  const p = (password || '').trim();
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  if (score <= 2) return { level: 'weak', label: 'Muito fraca', color: 'bg-red-500', acceptable: false };
  if (score === 3) return { level: 'medium', label: 'Média', color: 'bg-yellow-500', acceptable: true };
  if (score === 4) return { level: 'strong', label: 'Forte', color: 'bg-blue-500', acceptable: true };
  return { level: 'verystrong', label: 'Muito forte', color: 'bg-green-500', acceptable: true };
};

const ResetPasswordView = ({ token, onSuccess, onBackToLogin }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const strength = checkStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit = newPassword.trim() && confirmPassword.trim() && passwordsMatch && strength.acceptable && !isLoading;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await api.resetPassword(token, newPassword);
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => onSuccess(), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || 'Token inválido ou expirado. Solicite um novo link.');
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans overflow-hidden">
      {/* Painel esquerdo azul */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-blue-600 p-12 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10">
          <img src="/vcahub.svg" alt="VCAHub Logo" className="h-10 w-auto object-contain" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <Lock size={28} className="text-white" />
          </div>
          <h2 className="text-3xl font-black text-white leading-tight tracking-tight">Criar nova senha</h2>
          <p className="text-blue-200 text-sm font-bold leading-relaxed max-w-xs">
            Escolha uma senha segura com pelo menos 8 caracteres, combinando letras maiúsculas, minúsculas, números e símbolos.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">VCA Construtora</span>
        </div>
      </div>

      {/* Painel direito */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f8fafc]">
        <div className="lg:hidden mb-10">
          <img src="/vcahub.svg" alt="VCAHub Logo" className="h-9 w-auto object-contain" />
        </div>

        <div className="w-full max-w-sm space-y-8">
          {success ? (
            <div className="flex flex-col items-center gap-5 text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={40} className="text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Senha redefinida!</h2>
                <p className="text-slate-400 text-sm font-bold mt-2 leading-relaxed">
                  Sua senha foi atualizada com sucesso. Redirecionando para o login...
                </p>
              </div>
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Criar nova senha</h2>
                <p className="text-slate-400 text-sm font-bold mt-1.5">
                  Escolha uma senha segura para sua conta.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Nova senha */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nova senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-10 pr-10 text-slate-800 font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 text-sm transition-all duration-200 shadow-sm"
                      placeholder="Mínimo 8 caracteres"
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors duration-200 p-1"
                    >
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Indicador de força */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => {
                          const map = { weak: 1, medium: 2, strong: 3, verystrong: 5 };
                          const filled = i <= (map[strength.level] || 0);
                          return (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${filled ? strength.color : 'bg-slate-200'}`}
                            />
                          );
                        })}
                      </div>
                      <p className={`text-[10px] font-bold ${strength.acceptable ? 'text-slate-500' : 'text-red-500'}`}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Confirmar senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-white border-2 rounded-2xl py-3.5 pl-10 pr-10 text-slate-800 font-bold outline-none focus:ring-4 focus:ring-blue-50 text-sm transition-all duration-200 shadow-sm ${
                        confirmPassword && !passwordsMatch
                          ? 'border-red-300 focus:border-red-400'
                          : 'border-slate-100 focus:border-blue-500'
                      }`}
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors duration-200 p-1"
                    >
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-red-500 text-[10px] font-bold mt-1.5">As senhas não coincidem</p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-red-600 text-[11px] font-bold leading-relaxed">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all duration-200 flex items-center justify-center gap-2.5 ${
                    !canSubmit
                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-500/30 hover:shadow-blue-500/50 hover:shadow-xl'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar nova senha'
                  )}
                </button>

                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full py-2.5 text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={11} /> Voltar ao login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordView;
