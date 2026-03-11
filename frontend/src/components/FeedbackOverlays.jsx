import React from 'react';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px]">
    <div className="bg-white p-5 rounded-2xl shadow-2xl flex flex-col items-center gap-3 border border-slate-100 animate-in zoom-in-95">
      <RefreshCw className="text-blue-600 animate-spin" size={24} />
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Processando...</p>
    </div>
  </div>
);

export const StatusToast = ({ toast }) => (
  <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'} ${toast.type === 'success' ? 'bg-blue-600 shadow-blue-200' : 'bg-red-500 shadow-red-200'} text-white`}>
    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
    <span className="font-bold text-[11px] uppercase tracking-tight">{toast.message}</span>
  </div>
);

export const ConfirmActionModal = ({ confirmAction, onClose }) => {
  if (!confirmAction.open) return null;
  const isDanger = confirmAction.tone === 'danger';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[450] flex items-center justify-center p-4" onClick={() => onClose(false)}>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDanger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">{confirmAction.title}</h3>
            <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">{confirmAction.message}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={() => onClose(false)} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase border border-slate-100">Cancelar</button>
          <button onClick={() => onClose(true)} className={`py-2.5 rounded-xl text-[10px] font-black uppercase text-white ${isDanger ? 'bg-red-600' : 'bg-amber-600'}`}>
            {confirmAction.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
