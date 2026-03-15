import React from 'react';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export const LoadingOverlay = () => (
  <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-slate-950/35 backdrop-blur-sm">
    <div className="bg-white/95 p-5 rounded-3xl shadow-[0_28px_55px_-24px_rgba(15,23,42,0.65)] flex flex-col items-center gap-3 border border-white/70 animate-in zoom-in-95">
      <RefreshCw className="text-blue-600 animate-spin" size={24} />
      <p className="text-slate-500 font-semibold text-[11px] tracking-[0.04em]">Processando...</p>
    </div>
  </div>
);

export const StatusToast = ({ toast }) => (
  <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-3 px-6 py-3 rounded-2xl shadow-[0_20px_36px_-22px_rgba(15,23,42,0.65)] border transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'} ${toast.type === 'success' ? 'bg-[#0071e3] border-blue-400/40' : 'bg-rose-500 border-rose-300/40'} text-white`}>
    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
    <span className="font-semibold text-[12px] tracking-[0.01em]">{toast.message}</span>
  </div>
);

export const ConfirmActionModal = ({ confirmAction, onClose }) => {
  if (!confirmAction.open) return null;
  const isDanger = confirmAction.tone === 'danger';

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-md z-450 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => onClose(false)}>
      <div className="relative bg-white/95 border border-white/70 rounded-3xl shadow-[0_34px_80px_-30px_rgba(15,23,42,0.7)] w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">{confirmAction.title}</h3>
            <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-relaxed">{confirmAction.message}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={() => onClose(false)} className="py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-[13px] font-semibold border border-slate-200 transition-all hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0">Cancelar</button>
          <button onClick={() => onClose(true)} className={`py-2.5 rounded-2xl text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 ${isDanger ? 'bg-rose-600 shadow-[0_14px_24px_-16px_rgba(225,29,72,0.9)]' : 'bg-amber-600 shadow-[0_14px_24px_-16px_rgba(217,119,6,0.9)]'}`}>
            {confirmAction.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
