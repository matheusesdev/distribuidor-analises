import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BarChart4, Lock, Mail, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { ConfirmActionModal, LoadingOverlay, StatusToast } from './FeedbackOverlays';
import {
  AuthPasswordField,
  AuthTextField,
  KeepLoggedToggle,
  ModalBackdrop,
  PrimaryAuthButton,
  SecondaryAuthButton,
  SessionNotice,
} from './ui/AuthPrimitives';
import { api } from '../services/api';

const HERO_TEXT = 'Um sistema de distribuição de pastas que organiza e direciona demandas para a equipe de analistas em tempo real.';
const TYPING_SPEED_MS = 45;
const CURSOR_BLINK_MS = 220;
const FULL_TEXT_HOLD_TICKS = 70;
const subtleEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
};

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
  keepManagerLoggedIn,
  setKeepManagerLoggedIn,
  loginNotice,
  hasReturnedAfterLogout,
  loginSuccessSplash,
  handleLogin,
  keepAnalystLoggedIn,
  setKeepAnalystLoggedIn,
  handleManagerLogin,
  onOpenPrivacyPolicy,
}) => {
  // --- HERO ANIMATION ---
  const [typedHeroText, setTypedHeroText] = useState('');
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const welcomeTitle = hasReturnedAfterLogout ? 'Bem-vindo de volta' : 'Bem-vindo';

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
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

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

  useEffect(() => {
    if (!loginSuccessSplash?.visible) {
      setShowSuccessCheck(false);
      setShowSuccessMessage(false);
      return;
    }

    const checkTimer = window.setTimeout(() => setShowSuccessCheck(true), 70);
    const textTimer = window.setTimeout(() => setShowSuccessMessage(true), 520);

    return () => {
      window.clearTimeout(checkTimer);
      window.clearTimeout(textTimer);
    };
  }, [loginSuccessSplash?.visible]);

  const handleSubmitLogin = (e) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim() || isGlobalLoading) return;
    handleLogin(loginEmail.trim().toLowerCase(), loginPassword, keepAnalystLoggedIn);
  };

  const isManagerLoginDisabled = isGlobalLoading || !managerUsername.trim() || !managerPassword.trim();

  const handleSubmitManagerLogin = (e) => {
    if (e) e.preventDefault();
    if (isManagerLoginDisabled) return;
    handleManagerLogin();
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
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row font-sans overflow-x-hidden overflow-y-visible bg-slate-950 lg:h-[100dvh] lg:overflow-hidden">
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      {isGlobalLoading && <LoadingOverlay />}
      <AnimatePresence>
        {loginSuccessSplash?.visible && (
          <motion.div
            className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-white px-6 text-slate-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <motion.div
              className="flex size-24 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-[0_18px_44px_-34px_rgba(5,150,105,0.65)]"
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <svg viewBox="0 0 48 48" className="size-11" fill="none" aria-hidden="true">
                <motion.path
                  d="M14 25.2 21 32l13.5-16"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: showSuccessCheck ? 1 : 0, opacity: 1 }}
                  transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                />
              </svg>
            </motion.div>

            <motion.p
              className="mt-6 text-center text-sm font-semibold tracking-[0.02em] text-slate-700"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: showSuccessMessage ? 1 : 0, y: showSuccessMessage ? 0 : 8 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              Login realizado com sucesso
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PAINEL ESQUERDO AZUL (desktop) ===== */}
      <motion.div
        className="hidden lg:flex h-full flex-col justify-between w-[36%] bg-[#08111f] p-8 xl:p-10 relative overflow-hidden shrink-0"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
        <div className="relative z-10">
          <img src="/vcacloud.svg" alt="VCACloud Logo" className="h-12 xl:h-14 w-auto object-contain" />
        </div>
        <div className="relative z-10 space-y-5">
          <div className="relative max-w-lg">
            <h1 className="text-3xl xl:text-[2.35rem] font-semibold text-white leading-tight tracking-tight opacity-0 select-none" aria-hidden="true">
              {HERO_TEXT}
            </h1>
            <h1 className="absolute inset-0 text-3xl xl:text-[2.35rem] font-semibold text-white leading-tight tracking-tight">
              {typedHeroText}
              <span className={`inline-block ml-1 text-white/80 transition-opacity ${isCursorVisible ? 'opacity-100' : 'opacity-0'}`}>|</span>
            </h1>
          </div>
          <p className="max-w-sm text-[13px] font-medium leading-relaxed text-slate-300">
            Acesso interno para analistas e gestores acompanharem a distribuição de reservas.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-blue-100 text-[10px] font-semibold tracking-[0.04em]">Sincronização em tempo real</span>
          <img src="/cvlogo.svg" alt="CV Logo" className="h-6 sm:h-7 w-auto object-contain max-w-42.5 brightness-0 invert sm:ml-4" />
        </div>
      </motion.div>

      {/* ===== PAINEL DIREITO BRANCO ===== */}
      <div className="flex-1 min-h-[100dvh] flex flex-col items-center justify-start px-3 py-4 sm:px-6 md:px-8 md:py-6 bg-slate-50 overflow-visible relative lg:h-full lg:justify-center lg:overflow-hidden">
        {/* Logo mobile */}
        <div className="relative z-10 lg:hidden mb-3 sm:mb-5 md:mb-6 flex flex-col items-center gap-1.5 pt-0.5">
          <img src="/vcacloud.svg" alt="VCACloud Logo" className="h-8 sm:h-11 w-auto object-contain" />
          <img src="/cvlogo.svg" alt="CV Logo" className="h-5.5 sm:h-7 w-auto object-contain max-w-42.5 brightness-0 invert" />
        </div>

        <motion.div
          className="relative z-10 w-full max-w-[min(44rem,100%)] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.55)] sm:p-5 md:p-6"
          {...subtleEnter}
        >
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:gap-8">
            <div className="flex h-full flex-col items-center text-center lg:items-start lg:justify-between lg:text-left">
              <div>
              <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
                <svg viewBox="0 0 24 24" className="size-4 sm:size-5" fill="none" aria-hidden="true">
                  <path
                    d="M7.75 10V7.8C7.75 5.45 9.63 3.5 12 3.5s4.25 1.95 4.25 4.3V10"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6.75 10h10.5c1.1 0 2 .9 2 2v6.25c0 1.1-.9 2-2 2H6.75c-1.1 0-2-.9-2-2V12c0-1.1.9-2 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="M12 14.25v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mt-2.5 min-w-0 max-w-md lg:max-w-none">
                <h2 className="text-[1.25rem] sm:text-2xl font-semibold text-slate-900 tracking-tight">
                  {welcomeTitle}
                </h2>
                <p className="mt-1 text-[11px] sm:text-[13px] font-medium text-slate-500">
                  Entre com seus dados de acesso.
                </p>
              </div>

              {loginNotice && (
                <div className="mt-3 w-full max-w-md lg:max-w-none">
                  <SessionNotice icon={AlertTriangle}>{loginNotice}</SessionNotice>
                </div>
              )}

              <div className="mt-5 grid w-full max-w-md gap-3 lg:max-w-none">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.35)]">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900">Acesso seguro</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      Login protegido para manter os dados da operação em ambiente controlado.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.35)]">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900">Fluxo em tempo real</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      A equipe acompanha a distribuição sem perder contexto entre as etapas.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.35)]">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
                    <BarChart4 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900">Gestão centralizada</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      Acesso rápido para analistas e gestores que precisam agir sem fricção.
                    </p>
                  </div>
                </div>
              </div>
              </div>

              <div className="mt-5 w-full max-w-md lg:max-w-none lg:mt-0 lg:pt-6">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.3)]">
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Lock size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Ambiente interno</p>
                      <p className="text-[12px] font-semibold text-slate-900">Acesso rápido para operação e gestão</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Analistas</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-700">Fila e mesa de trabalho</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Gestores</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-700">Auditoria e controle</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col">
              {/* ===== FORMULARIO DE LOGIN ===== */}
              <motion.form
                onSubmit={handleSubmitLogin}
                className="flex flex-col gap-3.5 sm:gap-4"
                noValidate
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
                }}
              >
                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.24 }}>
                  <AuthTextField
                    label="E-mail"
                    icon={Mail}
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu@vcaconstrutora.com.br"
                    autoComplete="email"
                    autoFocus
                  />
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.24 }}>
                  <AuthPasswordField
                    label="Senha"
                    icon={Lock}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    visible={showLoginPassword}
                    onToggleVisible={() => setShowLoginPassword(p => !p)}
                    labelAction={(
                      <button
                        type="button"
                        onClick={openForgotModal}
                        className="text-[11px] font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  />
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.24 }}>
                  <KeepLoggedToggle
                    checked={keepAnalystLoggedIn}
                    onToggle={() => setKeepAnalystLoggedIn((prev) => !prev)}
                    helpText="Com esta opção ligada, você continua logado mesmo fechando a aba. Desligada, será necessário fazer login novamente ao reabrir."
                  />
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.24 }}>
                  <PrimaryAuthButton
                    disabled={isGlobalLoading || !loginEmail.trim() || !loginPassword.trim()}
                    loading={isGlobalLoading}
                  >
                    Entrar
                  </PrimaryAuthButton>
                </motion.div>
              </motion.form>

              {/* Botão de acesso administrativo */}
              <SecondaryAuthButton className="mt-3 py-2.5 text-[11px]" onClick={() => setShowManagerLoginModal(true)}>
                <BarChart4 size={13} /> Acesso de administrador
              </SecondaryAuthButton>
            </div>
          </div>

          {/* Rodape */}
          <div className="mt-3 space-y-0.5 pb-1 md:mt-4 md:space-y-1 md:pb-2">
            <p className="text-center text-[9px] sm:text-[10px] font-medium text-slate-500">Feito por Matheus Santos</p>
            <p className="text-center text-[9px] sm:text-[10px] font-medium text-slate-500">© {new Date().getFullYear()} - Todos os direitos reservados.</p>
            <div className="pt-1 md:pt-2 flex justify-center">
              <img src="/logo.png" alt="VCA Logo" className="h-4.5 sm:h-5 w-auto object-contain" />
            </div>
            <p className="pt-1.5 sm:pt-2 text-center text-[9px] sm:text-[10px] font-medium leading-relaxed text-slate-500">
              Ao se logar, você concorda com os nossos{' '}
              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="font-semibold text-blue-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                termos de privacidade
              </button>
              .
            </p>
          </div>
        </motion.div>
      </div>

      {/* ===== MODAL: ESQUECEU A SENHA ===== */}
      <AnimatePresence>
      {showForgotModal && (
        <ModalBackdrop key="forgot-password" className="bg-slate-950/45 backdrop-blur-sm" onClose={closeForgotModal}>
          <motion.div
            className="bg-white rounded-2xl w-full max-w-sm shadow-[0_28px_70px_-42px_rgba(2,6,23,0.75)] border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-b border-slate-100 px-7 pt-7 pb-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-slate-900 font-black text-sm tracking-tight">Redefinir senha</p>
                <p className="text-slate-500 text-[11px] font-bold mt-0.5">Envio de link por e-mail</p>
              </div>
            </div>

            <div className="px-8 py-8">
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
                    className="w-full py-3 rounded-xl bg-[#0071e3] text-white font-black uppercase text-[10px] tracking-widest hover:bg-[#0077ed] transition-colors duration-200"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="flex flex-col gap-5" noValidate>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">
                    Informe seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
                  </p>
                  <AuthTextField
                    icon={Mail}
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotSubmit()}
                    inputClassName="bg-slate-50 border-slate-100 py-3.5 pr-4 text-sm font-bold focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="seu@vcaconstrutora.com.br"
                    autoFocus
                    autoComplete="email"
                  />

                  {forgotError && (
                    <div className="rounded-xl border border-rose-200/80 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)] px-3 py-2 shadow-[0_10px_20px_-18px_rgba(225,29,72,0.55)]">
                      <p className="text-rose-700 text-[10px] font-semibold leading-relaxed">{forgotError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all duration-200 flex items-center justify-center gap-2 ${
                      forgotLoading || !forgotEmail.trim()
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-[#0071e3] text-white hover:bg-[#0077ed] active:scale-95 shadow-lg shadow-blue-500/30'
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
          </motion.div>
        </ModalBackdrop>
      )}
      </AnimatePresence>

      {/* ===== MODAL: ACESSO ADMIN ===== */}
      <AnimatePresence>
      {showManagerLoginModal && (
        <ModalBackdrop key="manager-login" className="bg-slate-950/45 backdrop-blur-sm" onClose={() => setShowManagerLoginModal(false)}>
          <motion.div
            className="relative w-full max-w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_70px_-42px_rgba(2,6,23,0.75)]"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={() => setShowManagerLoginModal(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              aria-label="Fechar acesso administrativo"
            >
              <X size={16} />
            </button>

            <div className="relative overflow-hidden border-b border-slate-100 bg-white px-7 pt-7 pb-6 text-slate-900">
              <div className="relative flex items-start gap-4 pr-10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                  <ShieldCheck size={24} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[1.05rem] font-semibold leading-tight tracking-[-0.01em]">Painel administrativo</p>
                  <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-slate-500">
                    Acesso restrito para gestão da fila, equipe e auditoria.
                  </p>
                </div>
              </div>

              <div className="relative mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
                <Lock size={13} className="shrink-0 text-blue-600" />
                <span>Sessão protegida por credenciais de administrador.</span>
              </div>
            </div>

            <form onSubmit={handleSubmitManagerLogin} className="px-7 py-7 space-y-5" noValidate>
              <div className="flex flex-col gap-4">
                <AuthTextField
                  id="manager-email"
                  label="E-mail ou usuário"
                  icon={Mail}
                  type="email"
                  value={managerUsername}
                  onChange={(e) => setManagerUsername(e.target.value)}
                  inputClassName="rounded-2xl bg-slate-50/80 py-3.5 pl-11 pr-4 hover:border-slate-300 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-100/80"
                  placeholder="gestor@vcaconstrutora.com.br"
                  autoFocus
                  autoComplete="username"
                />

                <AuthPasswordField
                  id="manager-password"
                  label="Senha"
                  icon={Lock}
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  visible={showManagerPassword}
                  onToggleVisible={() => setShowManagerPassword(p => !p)}
                  placeholder="Digite sua senha"
                  inputClassName="rounded-2xl bg-slate-50/80 py-3.5 pl-11 pr-11 hover:border-slate-300 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-100/80"
                />
              </div>

              <KeepLoggedToggle
                checked={keepManagerLoggedIn}
                onToggle={() => setKeepManagerLoggedIn((prev) => !prev)}
                helpLabel="Explicação sobre manter logado como administrador"
                helpText="Com esta opção ligada, o painel administrativo permanece conectado ao reabrir o navegador neste dispositivo."
                className="rounded-2xl bg-slate-50/70 py-2.5"
              />

              <PrimaryAuthButton
                disabled={isManagerLoginDisabled}
                loading={isGlobalLoading}
                loadingText="Entrando..."
                className="rounded-2xl py-3.5 text-[14px]"
              >
                {isGlobalLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar como administrador'
                )}
              </PrimaryAuthButton>

              <button
                type="button"
                onClick={() => setShowManagerLoginModal(false)}
                className="w-full rounded-xl py-2.5 text-[13px] font-medium text-slate-500 transition-all duration-200 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                Cancelar
              </button>
            </form>
          </motion.div>
        </ModalBackdrop>
      )}
      </AnimatePresence>
    </div>
  );
};

export default LoginView;
