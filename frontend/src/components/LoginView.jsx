import React from 'react';
import { BarChart4, ChevronDown, Eye, EyeOff, Lock, Search, User as UserIcon } from 'lucide-react';
import { ConfirmActionModal, LoadingOverlay, StatusToast } from './FeedbackOverlays';

const LoginView = ({
  toast,
  confirmAction,
  closeConfirmation,
  isGlobalLoading,
  dropdownRef,
  isProfileDropdownOpen,
  setIsProfileDropdownOpen,
  selectedAnalyst,
  setSelectedAnalyst,
  filteredAnalystsList,
  setShowLoginModal,
  setProfileSearch,
  setPassword,
  setView,
  profileSearch,
  showLoginModal,
  password,
  showPassword,
  setShowPassword,
  handleLogin,
}) => (
  <div className="min-h-screen flex font-sans overflow-hidden">
    <StatusToast toast={toast} />
    <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
    {isGlobalLoading && <LoadingOverlay />}

    <div className="hidden lg:flex flex-col justify-between w-[45%] bg-blue-600 p-12 relative overflow-hidden shrink-0">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
      <div className="relative z-10">
        <img src="/logo.png" alt="VCA Logo" className="h-10 w-auto object-contain brightness-0 invert" />
      </div>
      <div className="relative z-10 space-y-5">
        <h1 className="text-4xl font-black text-white leading-tight tracking-tight">Um sistema de distribuicao de pastas que organiza e direciona demandas para a equipe de analistas em tempo real.</h1>
        <p className="text-blue-200 text-sm font-bold leading-relaxed max-w-xs">VCA Cloud</p>
      </div>
      <div className="relative z-10 flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Sincronizacao em tempo real</span>
      </div>
    </div>

    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f8fafc]">
      <div className="lg:hidden mb-10">
        <img src="/logo.png" alt="VCA Logo" className="h-9 w-auto object-contain" />
      </div>

      <div className="w-full max-w-sm space-y-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bem-vindo de volta</h2>
          <p className="text-slate-400 text-sm font-bold mt-1.5">Selecione seu perfil para continuar</p>
        </div>

        <div className="space-y-4">
          <div ref={dropdownRef} className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Perfil de acesso</label>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className={`w-full flex items-center justify-between p-4 bg-white border-2 transition-all rounded-2xl shadow-sm ${isProfileDropdownOpen ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              <div className="flex items-center gap-3 truncate">
                {selectedAnalyst ? (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-[11px] font-black shrink-0 uppercase">
                      {selectedAnalyst.nome?.charAt(0)}
                    </div>
                    <span className="text-sm font-black text-slate-700 uppercase tracking-tight truncate">{selectedAnalyst.nome}</span>
                  </>
                ) : (
                  <>
                    <UserIcon size={16} className="text-slate-300 shrink-0" />
                    <span className="text-sm font-bold text-slate-400">Selecionar perfil...</span>
                  </>
                )}
              </div>
              <ChevronDown size={16} className={`text-slate-300 transition-transform shrink-0 ${isProfileDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-500 overflow-hidden animate-in slide-in-from-top-1">
                <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                  <Search size={13} className="text-slate-300" />
                  <input autoFocus type="text" placeholder="Filtrar analista..." className="bg-transparent border-none outline-none text-xs font-bold w-full text-slate-600" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} />
                </div>
                <div className="max-h-52 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
                  {filteredAnalystsList.map(a => (
                    <button key={a.id} onClick={() => { setSelectedAnalyst(a); setShowLoginModal(true); setProfileSearch(''); setPassword(''); setIsProfileDropdownOpen(false); }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-600 group rounded-xl transition-all text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 uppercase transition-all">{a.nome?.charAt(0)}</div>
                        <span className="text-xs font-black text-slate-600 uppercase group-hover:text-white transition-colors">{a.nome}</span>
                      </div>
                      {a.is_online && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setView('manager')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-100 bg-white text-slate-400 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
          >
            <BarChart4 size={13} /> Acesso Admin
          </button>
        </div>

        <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">VCA Construtora © {new Date().getFullYear()}</p>
      </div>
    </div>

    {showLoginModal && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-250 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
        <div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
          <div className="bg-blue-600 px-8 pt-8 pb-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black uppercase">
              {selectedAnalyst?.nome?.charAt(0)}
            </div>
            <div className="text-center">
              <p className="text-white font-black text-sm uppercase tracking-tight">{selectedAnalyst?.nome}</p>
              <p className="text-blue-200 text-[9px] font-bold uppercase tracking-widest mt-0.5">Confirme sua identidade</p>
            </div>
          </div>
          <div className="px-8 py-6 space-y-4">
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-10 pr-10 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoFocus
                placeholder="Senha"
              />
              <button onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              disabled={isGlobalLoading || !password.trim()}
              onClick={handleLogin}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              Entrar
            </button>
            <button onClick={() => setShowLoginModal(false)} className="w-full py-2 text-slate-400 font-black uppercase text-[9px] tracking-widest hover:text-slate-600 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

export default LoginView;
