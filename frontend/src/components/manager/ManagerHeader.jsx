import React from 'react';
import { BarChart4, RotateCcw, Trash2 } from 'lucide-react';

const ManagerHeader = ({ handleRedistribute, handleResetData, onExit }) => (
  <nav className="bg-white border-b border-slate-100 p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-100 shadow-sm">
    <div className="flex items-center gap-3 truncate">
      <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-500/20 shrink-0"><BarChart4 size={16} className="text-white"/></div>
      <h1 className="text-xs md:text-sm font-black tracking-tighter uppercase truncate leading-none">VCA GESTAO <span className="text-blue-500 text-[8px] md:text-[9px] tracking-widest ml-1.5 font-black uppercase hidden sm:inline">Admin</span></h1>
    </div>
    <div className="flex items-center gap-3">
      <button onClick={handleRedistribute} className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-amber-100 active:scale-95 flex items-center gap-2 shadow-sm"><RotateCcw size={12}/> Redistribuir</button>
      <button onClick={handleResetData} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-red-100 active:scale-95 flex items-center gap-2 shadow-sm"><Trash2 size={12}/> Zerar Dados</button>
      <button onClick={onExit} className="bg-white text-slate-400 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-slate-100 active:scale-95 shadow-sm">Sair</button>
    </div>
  </nav>
);

export default ManagerHeader;
