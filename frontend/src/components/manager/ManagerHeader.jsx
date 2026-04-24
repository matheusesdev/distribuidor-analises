import React from 'react';
import { LogOut, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react';

const ManagerHeader = ({ handleRedistribute, handleResetData, onExit, isDarkMode, onToggleDarkMode }) => (
  <nav className="sticky top-0 z-100 border-b border-slate-200/70 bg-white/92 backdrop-blur-xl px-3 py-2 md:px-6">
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
      <button onClick={handleRedistribute} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700 transition-all hover:bg-amber-100 active:translate-y-0">
        <RotateCcw size={13}/> Redistribuir
      </button>
      <button onClick={handleResetData} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-700 transition-all hover:bg-rose-100 active:translate-y-0">
        <Trash2 size={13}/> Zerar Dados
      </button>
      <button onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-slate-400 hover:text-slate-900 active:translate-y-0">
        <LogOut size={13}/> Sair
      </button>
      <button
        onClick={onToggleDarkMode}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-blue-200 hover:text-[#0071e3] active:translate-y-0"
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
