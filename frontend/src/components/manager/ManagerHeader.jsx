import React from 'react';
import { LogOut, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react';

const ManagerHeader = ({ handleRedistribute, handleResetData, onExit, isDarkMode, onToggleDarkMode }) => (
  <nav className="sticky top-0 z-100 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl px-4 py-3 md:px-8 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)]">
    <div className="flex justify-between items-center gap-3">
    <div className="flex items-center truncate">
      <div className="logo-shimmer">
        <img
          src="/vcahub.svg"
          alt="VCAHub"
          className={`h-8 md:h-9 w-auto object-contain opacity-85 ${isDarkMode ? 'brightness-0 invert' : 'brightness-0'}`}
        />
      </div>
    </div>
    <div className="flex items-center gap-2.5">
      <button onClick={handleRedistribute} className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-700 transition-all hover:bg-amber-100 hover:-translate-y-0.5 active:translate-y-0">
        <RotateCcw size={13}/> Redistribuir
      </button>
      <button onClick={handleResetData} className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-semibold text-rose-700 transition-all hover:bg-rose-100 hover:-translate-y-0.5 active:translate-y-0">
        <Trash2 size={13}/> Zerar Dados
      </button>
      <button onClick={onExit} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 transition-all hover:border-slate-400 hover:text-slate-900 hover:-translate-y-0.5 active:translate-y-0">
        <LogOut size={13}/> Sair
      </button>
      <button
        onClick={onToggleDarkMode}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 transition-all hover:border-blue-200 hover:text-[#0071e3] hover:-translate-y-0.5 active:translate-y-0"
        title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
      >
        {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
        {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
      </button>
    </div>
    </div>
  </nav>
);

export default ManagerHeader;
