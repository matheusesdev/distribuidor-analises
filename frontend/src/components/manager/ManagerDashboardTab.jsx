import React from 'react';
import { AlertTriangle, BarChart3, CheckSquare, Edit3, Hash, PieChart, Power, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';

const ManagerDashboardTab = ({
  SITUACOES_MAP,
  SIT_COLORS,
  isSyncing,
  calculatedBreakdown,
  dashData,
  analistasMapa,
  setEditForm,
  setShowEditModal,
  togglingQueueIds,
  handleAdminQueueToggle,
  handleDeleteAnalyst,
}) => (
  <>
    <section className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-8 px-1">
        <div className="flex items-center gap-2.5"><BarChart3 size={16} className="text-blue-600" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Fluxo por Situacao</h3></div>
        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border transition-all ${isSyncing ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' : 'bg-green-50 text-green-600 border-green-100'}`}><RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''}/> {isSyncing ? 'Sincronizando' : 'Sincronizado'}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(SITUACOES_MAP).map(([id, nome]) => {
          const sitStyle = SIT_COLORS[id] || { text: '#0f172a', bg: '#f8fafc' };
          return (
            <div key={id} className="p-3 rounded-xl border text-center transition-all" style={{ backgroundColor: sitStyle.bg, borderColor: sitStyle.bg }}>
              <p className="text-[7px] font-bold uppercase leading-tight mb-1 h-5 overflow-hidden line-clamp-2" style={{ color: sitStyle.text, opacity: 0.8 }}>{nome}</p>
              <div className="text-lg md:text-xl font-black leading-none" style={{ color: sitStyle.text }}>{calculatedBreakdown[id] || 0}</div>
            </div>
          );
        })}
      </div>
    </section>

    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
        <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Pendente CRM</p><div className="text-4xl md:text-5xl font-black text-blue-600 leading-none">{dashData.total_pendente_cvcrm}</div></div>
        <Hash className="text-blue-50 opacity-20 shrink-0" size={48}/>
      </div>
      <div className="bg-red-50 p-5 md:p-6 rounded-2xl border border-red-100 flex items-center justify-between group">
        <div><p className="text-[9px] font-black text-red-400 uppercase mb-1 tracking-widest">Sem Destino</p><div className="text-4xl md:text-5xl font-black text-red-600 leading-none">{dashData.pastas_sem_destino || 0}</div></div>
        <AlertTriangle className="text-red-200 opacity-70 shrink-0" size={48}/>
      </div>
      <div className="bg-blue-600 p-5 md:p-6 rounded-2xl shadow-xl shadow-blue-500/10 flex items-center justify-between text-white group">
        <div><p className="text-[9px] font-black text-blue-100 uppercase mb-1 tracking-widest">Equipa Online</p><div className="text-4xl md:text-5xl font-black leading-none">{dashData.equipe?.filter(a => a.is_online).length || 0}</div></div>
        <Users className="text-white opacity-20 shrink-0" size={48}/>
      </div>
    </section>

    <section className="bg-white rounded-3xl md:rounded-4xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="p-5 md:p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
        <div className="flex items-center gap-2"><PieChart size={18} className="text-blue-600" /><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Processo Analitico da Equipa</h2></div>
        <button onClick={() => { setEditForm({id: null, nome: '', senha: '', permissoes: [62, 66, 30]}); setShowEditModal(true); }} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500 shadow-lg active:scale-95 flex items-center gap-2"><UserPlus size={14}/> Novo Analista</button>
      </div>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-[11px] min-w-212.5">
          <thead className="text-[9px] text-slate-400 uppercase font-black border-b border-slate-50 bg-slate-50/30 text-center">
            <tr><th className="p-4 text-left">Analista</th><th className="p-4">Situacoes</th><th className="p-4">Recebidas (Hoje)</th><th className="p-4">Feitas (Hoje)</th><th className="p-4">Na Mesa (Atual)</th><th className="p-4 text-right">Acoes</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dashData.equipe?.map(a => {
              const stats = analistasMapa[a.id] || { naMesa: 0, feitosHoje: 0 };
              return (
                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group text-[11px] text-center">
                  <td className="p-4 text-left"><div className="flex flex-col"><span className="font-bold text-slate-700 uppercase truncate max-w-37.5">{a.nome}</span><span className={`text-[7px] font-black uppercase ${a.is_online ? 'text-green-500' : 'text-slate-300'}`}>{a.is_online ? 'FILA ATIVA' : 'OFFLINE'}</span></div></td>
                  <td className="p-4"><div className="flex flex-wrap gap-1 justify-center max-w-37.5 mx-auto">{(a.permissoes || []).slice(0, 3).map(p => <span key={p} className="bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded text-[7px] border border-slate-200 font-bold">{p}</span>)}</div></td>
                  <td className="p-4 font-black text-slate-900 text-sm">{a.total_hoje || 0}</td>
                  <td className="p-4 font-black text-green-600 text-sm">{stats.feitosHoje}</td>
                  <td className="p-4 font-black text-blue-600 text-sm">{stats.naMesa}</td>
                  <td className="p-4 text-right space-x-1 whitespace-nowrap">
                    <button disabled={togglingQueueIds.includes(a.id)} onClick={() => handleAdminQueueToggle(a)} className={`p-2 rounded-lg border transition-all inline-flex items-center justify-center ${togglingQueueIds.includes(a.id) ? 'animate-pulse opacity-80 cursor-wait' : ''} ${a.is_online ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-green-600 text-white border-green-600 hover:bg-green-500'}`} title={a.is_online ? 'Desligar fila' : 'Ligar fila'}>{togglingQueueIds.includes(a.id) ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14}/>}</button>
                    <button onClick={() => { setEditForm({id: a.id, nome: a.nome, senha: a.senha, permissoes: a.permissoes || []}); setShowEditModal(true); }} className="text-slate-300 hover:text-blue-500 p-2 transition-all inline-block"><Edit3 size={14}/></button>
                    <button onClick={() => handleDeleteAnalyst(a.id)} className="text-slate-300 hover:text-red-500 p-2 transition-all inline-block"><Trash2 size={14}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  </>
);

export default ManagerDashboardTab;
