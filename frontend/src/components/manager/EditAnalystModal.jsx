import React from 'react';
import { CheckSquare, Save, Square } from 'lucide-react';

const EditAnalystModal = ({ showEditModal, setShowEditModal, editForm, setEditForm, SITUACOES_MAP, handleSaveAnalyst }) => {
  if (!showEditModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 border border-white/70 p-6 md:p-8 rounded-[1.7rem] max-w-md w-full shadow-[0_32px_70px_-28px_rgba(15,23,42,0.7)] flex flex-col max-h-[90vh] animate-in zoom-in-95 text-slate-800 overflow-hidden backdrop-blur-xl">
        <h3 className="text-[1.35rem] font-semibold text-center mb-6 tracking-[-0.01em] shrink-0">Configurar Analista</h3>
        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
          <div className="space-y-3 px-1">
            <input type="text" value={editForm.nome} onChange={(e) => setEditForm({...editForm, nome: e.target.value})} className="w-full bg-slate-50/90 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400" placeholder="Nome Completo" />
            <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full bg-slate-50/90 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400" placeholder="E-mail de acesso" />
            <select value={editForm.status || 'ativo'} onChange={(e) => setEditForm({...editForm, status: e.target.value})} className="w-full bg-slate-50/90 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <input type="password" value={editForm.senha} onChange={(e) => setEditForm({...editForm, senha: e.target.value})} className="w-full bg-slate-50/90 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400" placeholder={editForm.id ? "Nova senha (opcional)" : "Senha inicial"} />
          </div>
          <div className="pt-1 px-1">
            <p className="text-[11px] font-semibold text-slate-500 ml-2 mb-3 tracking-[0.03em]">Responsabilidades</p>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(SITUACOES_MAP).map(([id, nome]) => {
                const pid = parseInt(id, 10);
                const isSelected = editForm.permissoes.includes(pid);
                return (
                  <button key={id} onClick={() => {
                    setEditForm(p => ({...p, permissoes: isSelected ? p.permissoes.filter(x => x !== pid) : [...p.permissoes, pid]}));
                  }} className={`flex items-center gap-3 p-3 rounded-2xl border text-[11px] text-left transition-all active:scale-95 ${isSelected ? 'bg-[#0071e3] border-[#0071e3] text-white font-semibold shadow-[0_12px_24px_-16px_rgba(0,113,227,0.9)]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-sky-300 hover:-translate-y-0.5'}`}>
                    {isSelected ? <CheckSquare size={14} className="shrink-0"/> : <Square size={14} className="shrink-0"/>}
                    <span className="leading-tight truncate font-medium">{nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-6 mt-4 border-t border-slate-100 shrink-0">
          <button onClick={() => setShowEditModal(false)} className="py-3 bg-slate-50 text-slate-600 font-semibold text-[13px] hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0">Cancelar</button>
          <button onClick={handleSaveAnalyst} className="py-3 bg-[#0071e3] text-white rounded-2xl font-semibold text-[13px] shadow-[0_16px_28px_-18px_rgba(0,113,227,0.9)] flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-[#0077ed] hover:-translate-y-0.5"><Save size={14}/> Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default EditAnalystModal;
