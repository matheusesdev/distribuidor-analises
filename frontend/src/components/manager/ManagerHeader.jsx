import React from 'react';
import { LogOut, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react';

const ManagerHeader = ({ handleRedistribute, handleResetData, onExit, isDarkMode, onToggleDarkMode }) => (
  <nav className="sticky top-0 z-100 border-b border-slate-200/70 bg-white/90 px-3 py-2 backdrop-blur-xl md:px-6">
    <div className="mx-auto flex max-w-[min(1480px,96vw)] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="logo-shimmer shrink-0">
          <img
            src="/vcahub.svg"
            alt="VCAHub"
            className={`h-8 w-auto object-contain opacity-85 md:h-9 ${isDarkMode ? 'brightness-0 invert' : 'brightness-0'}`}
          />
        </div>
        <div className="hidden min-w-0 border-l border-slate-200 pl-3 sm:block">
          <p className="truncate text-[11px] font-semibold text-slate-800">Painel do gestor</p>
          <p className="truncate text-[10px] font-medium text-slate-500">Distribuição, fila e auditoria</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={handleRedistribute}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 transition-all hover:-translate-y-0.5 hover:bg-amber-100 active:translate-y-0 md:px-3"
          title="Redistribuir pastas"
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">Redistribuir</span>
        </button>
        <button
          onClick={handleResetData}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-all hover:-translate-y-0.5 hover:bg-rose-100 active:translate-y-0 md:px-3"
          title="Zerar dados"
        >
          <Trash2 size={13} />
          <span className="hidden sm:inline">Zerar dados</span>
        </button>
        <button
          onClick={onExit}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900 active:translate-y-0 md:px-3"
          title="Sair do painel"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Sair</span>
        </button>
        <button
          onClick={onToggleDarkMode}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:text-[#0b6fd3] active:translate-y-0 md:px-3"
          title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
          <span className="hidden lg:inline">{isDarkMode ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
      </div>
    </div>
  </nav>
);

export default ManagerHeader;
