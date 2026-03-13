import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

const ManagerHeader = ({ handleRedistribute, handleResetData, onExit }) => (
  <nav className="bg-white border-b border-slate-100 p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-100 shadow-sm">
    <div className="flex items-center truncate">
      <div className="logo-shimmer">
        <img src="/vcahub.svg" alt="VCAHub" className="h-8 md:h-9 w-auto object-contain brightness-0 opacity-80" />
      </div>
    </div>
    <div className="flex items-center gap-3">
      <button onClick={handleRedistribute} className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-amber-100 active:scale-95 flex items-center gap-2 shadow-sm"><RotateCcw size={12}/> Redistribuir</button>
      <button onClick={handleResetData} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-red-100 active:scale-95 flex items-center gap-2 shadow-sm"><Trash2 size={12}/> Zerar Dados</button>
      <button onClick={onExit} className="bg-white text-slate-400 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-slate-100 active:scale-95 shadow-sm">Sair</button>
    </div>
  </nav>
);

export default ManagerHeader;
