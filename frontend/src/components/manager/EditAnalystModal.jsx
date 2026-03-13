import React from 'react';
import { CheckSquare, Save, Square } from 'lucide-react';

const EditAnalystModal = ({ showEditModal, setShowEditModal, editForm, setEditForm, SITUACOES_MAP, handleSaveAnalyst }) => {
  if (!showEditModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[1.5rem] max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 text-slate-800 overflow-hidden">
        <h3 className="text-xl font-black text-center mb-6 uppercase tracking-tighter flex-shrink-0">Configurar Analista</h3>
        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
          <div className="space-y-3 px-1">
            <input type="text" value={editForm.nome} onChange={(e) => setEditForm({...editForm, nome: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="Nome Completo" />
            <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="E-mail de acesso" />
            <select value={editForm.status || 'ativo'} onChange={(e) => setEditForm({...editForm, status: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <input type="password" value={editForm.senha} onChange={(e) => setEditForm({...editForm, senha: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder={editForm.id ? "Nova senha (opcional)" : "Senha inicial"} />
          </div>
          <div className="pt-1 px-1">
            <p className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-3 tracking-widest">Responsabilidades</p>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(SITUACOES_MAP).map(([id, nome]) => {
                const pid = parseInt(id, 10);
                const isSelected = editForm.permissoes.includes(pid);
                return (
                  <button key={id} onClick={() => {
                    setEditForm(p => ({...p, permissoes: isSelected ? p.permissoes.filter(x => x !== pid) : [...p.permissoes, pid]}));
                  }} className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] text-left transition-all active:scale-95 ${isSelected ? 'bg-blue-600 border-blue-600 text-white font-black' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                    {isSelected ? <CheckSquare size={14} className="shrink-0"/> : <Square size={14} className="shrink-0"/>}
                    <span className="leading-tight uppercase truncate font-bold">{nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-6 mt-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={() => setShowEditModal(false)} className="py-3 bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest hover:bg-slate-100 rounded-xl border border-slate-100">Cancelar</button>
          <button onClick={handleSaveAnalyst} className="py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-blue-500"><Save size={14}/> Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default EditAnalystModal;
