import React, { useEffect, useState } from 'react';
import { BarChart4, Eye, EyeOff, Lock, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ConfirmActionModal, LoadingOverlay, StatusToast } from './FeedbackOverlays';
import { api } from '../services/api';

const HERO_TEXT = 'Um sistema de distribuição de pastas que organiza e direciona demandas para a equipe de analistas em tempo real.';
const TYPING_SPEED_MS = 45;
const CURSOR_BLINK_MS = 220;
const FULL_TEXT_HOLD_TICKS = 70;

const LoginView = ({
  toast,
  confirmAction,
  closeConfirmation,
  isGlobalLoading,
  showManagerLoginModal,
  setShowManagerLoginModal,
  managerUsername,
  setManagerUsername,
  managerPassword,
  setManagerPassword,
  showManagerPassword,
  setShowManagerPassword,
  handleLogin,
  handleManagerLogin,
}) => {
  // --- HERO ANIMATION ---
  const [typedHeroText, setTypedHeroText] = useState('');
  const [isCursorVisible, setIsCursorVisible] = useState(true);

  // --- FORM STATE ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- FORGOT PASSWORD STATE ---
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      currentIndex += 1;
      if (currentIndex > HERO_TEXT.length + FULL_TEXT_HOLD_TICKS) currentIndex = 0;
      setTypedHeroText(HERO_TEXT.slice(0, Math.min(currentIndex, HERO_TEXT.length)));
    }, TYPING_SPEED_MS);
    return () => clearInterval(typingInterval);
  }, []);

  useEffect(() => {
    const cursorInterval = setInterval(() => setIsCursorVisible(v => !v), CURSOR_BLINK_MS);
    return () => clearInterval(cursorInterval);
  }, []);

  const handleSubmitLogin = (e) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim() || isGlobalLoading) return;
    handleLogin(loginEmail.trim().toLowerCase(), loginPassword);
  };

  const handleForgotSubmit = async (e) => {
    if (e) e.preventDefault();
    const email = forgotEmail.trim().toLowerCase();
    if (!email) return;
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await api.forgotPassword(email);
      if (res.ok) {
        setForgotSent(true);
      } else {
        setForgotError('Não foi possível processar a solicitação. Tente novamente.');
      }
    } catch {
      setForgotError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail(loginEmail);
    setForgotSent(false);
    setForgotError('');
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotSent(false);
    setForgotError('');
  };

  return (
    <div className="min-h-screen flex font-sans overflow-hidden">
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      {isGlobalLoading && <LoadingOverlay />}

      {/* ===== PAINEL ESQUERDO AZUL (desktop) ===== */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-blue-600 p-12 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10">
          <img src="/vcahub.svg" alt="VCAHub Logo" className="h-10 w-auto object-contain" />
        </div>
        <div className="relative z-10 space-y-5">
          <div className="relative max-w-md">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight opacity-0 select-none" aria-hidden="true">
              {HERO_TEXT}
            </h1>
            <h1 className="absolute inset-0 text-4xl font-black text-white leading-tight tracking-tight">
              {typedHeroText}
              <span className={`inline-block ml-1 text-white/80 transition-opacity ${isCursorVisible ? 'opacity-100' : 'opacity-0'}`}>|</span>
            </h1>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Sincronização em tempo real</span>
          <img src="/cvlogo.svg" alt="CV Logo" className="h-7 w-auto object-contain max-w-42.5 brightness-0 invert ml-4" />
        </div>
      </div>

      {/* ===== PAINEL DIREITO BRANCO ===== */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f8fafc]">
        {/* Logo mobile */}
        <div className="lg:hidden mb-10 flex flex-col items-center gap-2.5">
          <img src="/vcahub.svg" alt="VCAHub Logo" className="h-9 w-auto object-contain" />
          <img src="/cvlogo.svg" alt="CV Logo" className="h-7 w-auto object-contain max-w-42.5 brightness-0 invert" />
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-slate-400 text-sm font-bold mt-1.5">Entre com seu e-mail e senha para continuar</p>
          </div>

          {/* ===== FORMULARIO DE LOGIN ===== */}
          <form onSubmit={handleSubmitLogin} className="space-y-4" noValidate>
            {/* Campo E-mail */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">E-mail</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-10 pr-4 text-slate-800 font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 text-sm transition-all duration-200 shadow-sm"
                  placeholder="seu@vcaconstrutora.com.br"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Senha</label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors duration-200"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-10 pr-10 text-slate-800 font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 text-sm transition-all duration-200 shadow-sm"
                  placeholder="********"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors duration-200 p-1"
                  title={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showLoginPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Botao Entrar */}
            <button
              type="submit"
              disabled={isGlobalLoading || !loginEmail.trim() || !loginPassword.trim()}
              className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all duration-200 flex items-center justify-center gap-2.5 ${
                isGlobalLoading || !loginEmail.trim() || !loginPassword.trim()
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-500/30 hover:shadow-blue-500/50 hover:shadow-xl'
              }`}
            >
              {isGlobalLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Botao Acesso Admin */}
          <button
            type="button"
            onClick={() => setShowManagerLoginModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-100 bg-white text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md"
          >
            <BarChart4 size={13} /> Acesso Admin
          </button>

          {/* Rodape */}
          <div className="space-y-1">
            <p className="text-center text-[9px] font-bold text-slate-800 uppercase tracking-widest">VCA Construtora (c) {new Date().getFullYear()}</p>
            <p className="text-center text-[10px] font-semibold text-slate-800">Feito por Matheus Santos (c) {new Date().getFullYear()}</p>
            <div className="pt-2 flex justify-center">
              <img src="/logo.png" alt="VCA Logo" className="h-5 w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODAL: ESQUECEU A SENHA ===== */}
      {showForgotModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-250 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={closeForgotModal}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-600 px-8 pt-8 pb-6 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Mail size={24} className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm uppercase tracking-tight">Redefinir senha</p>
                <p className="text-blue-200 text-[9px] font-bold uppercase tracking-widest mt-0.5">Envio de link por e-mail</p>
              </div>
            </div>

            <div className="px-8 py-8 space-y-6">
              {forgotSent ? (
                <div className="flex flex-col items-center gap-4 text-center py-2">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-black text-sm">E-mail enviado!</p>
                    <p className="text-slate-400 text-xs font-bold mt-1.5 leading-relaxed">
                      Se o endereço estiver cadastrado, você receberá as instruções de redefinição em breve.
                    </p>
                  </div>
                  <button
                    onClick={closeForgotModal}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-colors duration-200"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-5" noValidate>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">
                    Informe seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
                  </p>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotSubmit()}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-10 pr-4 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200"
                      placeholder="seu@vcaconstrutora.com.br"
                      autoFocus
                      autoComplete="email"
                    />
                  </div>

                  {forgotError && (
                    <p className="text-red-500 text-[10px] font-bold">{forgotError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all duration-200 flex items-center justify-center gap-2 ${
                      forgotLoading || !forgotEmail.trim()
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-500/30'
                    }`}
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="w-full py-2.5 text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft size={11} /> Voltar ao login
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: ACESSO ADMIN ===== */}
      {showManagerLoginModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-250 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowManagerLoginModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-slate-900 px-8 pt-8 pb-6 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                <BarChart4 size={22} />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm uppercase tracking-tight">Painel Admin</p>
                <p className="text-slate-300 text-[9px] font-bold uppercase tracking-widest mt-0.5">Acesso restrito ao gestor</p>
              </div>
            </div>
            <div className="px-8 py-8 space-y-6">
              <div className="space-y-3">
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  <input
                    type="text"
                    value={managerUsername}
                    onChange={(e) => setManagerUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManagerLogin()}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-10 pr-4 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200"
                    placeholder="Usuário admin"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  <input
                    type={showManagerPassword ? 'text' : 'password'}
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManagerLogin()}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-10 pr-10 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200"
                    placeholder="Senha"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowManagerPassword(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors duration-200 p-1"
                  >
                    {showManagerPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={isGlobalLoading || !managerUsername.trim() || !managerPassword.trim()}
                onClick={handleManagerLogin}
                className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all duration-200 flex items-center justify-center gap-2.5 ${
                  isGlobalLoading || !managerUsername.trim() || !managerPassword.trim()
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                }`}
              >
                {isGlobalLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar como Admin'
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowManagerLoginModal(false)}
                className="w-full py-2.5 text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginView;
