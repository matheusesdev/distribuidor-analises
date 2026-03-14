import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckSquare,
  Edit3,
  Hash,
  Mail,
  PieChart,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const formatDateTime = (value) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (name) => {
  if (!name) return 'AN';
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const AnalystDetailModal = ({ analyst, currentTasks, recentCompletions, onClose }) => {
  if (!analyst) return null;

  const situationEntries = Object.entries(analyst.mesa_por_situacao || {});

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-250 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-275 max-h-[92vh] bg-white border border-slate-100 rounded-3xl md:rounded-4xl shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_45%,#f8fafc_100%)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-600">Analista</p>
            <h3 className="mt-2 text-lg sm:text-2xl font-black tracking-tight text-slate-900 uppercase">{analyst.nome}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                <Mail size={12} />
                {analyst.email || 'Sem e-mail'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${analyst.is_online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                <ShieldCheck size={12} />
                {analyst.is_online ? 'Fila ativa' : 'Offline'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${analyst.status === 'ativo' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                {analyst.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:text-slate-700 hover:border-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 overflow-y-auto max-h-[calc(92vh-86px)]">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Recebidas Hoje</p>
              <div className="mt-2 text-3xl font-black text-slate-900">{analyst.recebidas_hoje}</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Feitas Hoje</p>
              <div className="mt-2 text-3xl font-black text-emerald-700">{analyst.feitas_hoje}</div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Na Mesa</p>
              <div className="mt-2 text-3xl font-black text-blue-700">{analyst.na_mesa}</div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Situações designadas</p>
                  <h4 className="mt-1 text-sm font-black uppercase tracking-wide text-slate-800">Responsabilidades do analista</h4>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">{analyst.situacoes_nomes?.length || 0} situações</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(analyst.situacoes_nomes || []).map((situacao) => (
                  <span key={situacao} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                    {situacao}
                  </span>
                ))}
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] font-bold text-slate-500">
                Última atribuição: {formatDateTime(analyst.ultima_atribuicao)}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mesa Atual por Situação</p>
              <div className="mt-4 space-y-2">
                {situationEntries.length > 0 ? (
                  situationEntries.map(([label, total]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">{label}</span>
                      <span className="text-sm font-black text-blue-600">{total}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-[11px] font-bold text-slate-400">
                    Nenhuma pasta na mesa neste momento.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Pastas em andamento</p>
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                {currentTasks.length > 0 ? (
                  currentTasks.map((task) => (
                    <div key={task.reserva_id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Reserva {task.reserva_id}</p>
                          <p className="mt-1 truncate text-[12px] font-black uppercase text-slate-800">{task.cliente || 'Cliente não informado'}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{task.situacao_nome || 'Não informado'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-[11px] font-bold text-slate-400">
                    Nenhuma pasta em andamento.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Concluídas recentemente</p>
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                {recentCompletions.length > 0 ? (
                  recentCompletions.map((task, index) => (
                    <div key={`${task.reserva_id}-${task.data_fim || index}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600">{task.data_fim ? formatDateTime(task.data_fim) : 'Hoje'}</p>
                      <p className="mt-1 text-[12px] font-black uppercase text-emerald-900">{task.cliente || `Reserva ${task.reserva_id}`}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{task.situacao_nome || task.resultado || 'Concluída'}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-[11px] font-bold text-slate-400">
                    Nenhuma conclusão recente no histórico carregado.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const ManagerDashboardTab = ({
  SITUACOES_MAP,
  SIT_COLORS,
  isSyncing,
  managerSyncStatus,
  calculatedBreakdown,
  dashData,
  analistasMapa,
  setEditForm,
  setShowEditModal,
  togglingQueueIds,
  handleAdminQueueToggle,
  handleDeleteAnalyst,
}) => {
  const [selectedAnalystId, setSelectedAnalystId] = useState(null);
  const syncScope = managerSyncStatus?.limpeza_escopo;
  const hasSyncFailures = Array.isArray(managerSyncStatus?.situacoes_falharam) && managerSyncStatus.situacoes_falharam.length > 0;

  const monitorStyle =
    syncScope === 'parcial' || syncScope === 'ignorada'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const monitorLabelByScope = {
    total: 'Limpeza total',
    parcial: 'Limpeza parcial',
    ignorada: 'Limpeza ignorada',
    nenhuma: 'Sem limpeza',
  };

  const teamProcessData = useMemo(() => {
    if (Array.isArray(dashData?.resumo_equipe) && dashData.resumo_equipe.length > 0) {
      return dashData.resumo_equipe;
    }

    return (dashData?.equipe || []).map((analyst) => {
      const stats = analistasMapa?.[analyst.id] || { naMesa: 0, feitosHoje: 0 };
      const situationIds = (analyst.permissoes || []).map((item) => Number(item));
      return {
        analista_id: analyst.id,
        nome: analyst.nome || `Analista ${analyst.id}`,
        email: analyst.email || '',
        status: analyst.status || 'ativo',
        is_online: Boolean(analyst.is_online),
        recebidas_hoje: Number(analyst.total_hoje || 0),
        feitas_hoje: Number(stats.feitosHoje || 0),
        na_mesa: Number(stats.naMesa || 0),
        ultima_atribuicao: analyst.ultima_atribuicao || null,
        situacoes_ids: situationIds,
        situacoes_nomes: situationIds.map((id) => SITUACOES_MAP[String(id)] || String(id)),
        mesa_por_situacao: {},
      };
    });
  }, [dashData?.resumo_equipe, dashData?.equipe, analistasMapa, SITUACOES_MAP]);

  const currentTasksByAnalyst = useMemo(() => {
    const grouped = {};
    (dashData?.distribuicao_atual || []).forEach((task) => {
      const analystId = task?.analista_id;
      if (!analystId) return;
      if (!grouped[analystId]) grouped[analystId] = [];
      grouped[analystId].push(task);
    });
    return grouped;
  }, [dashData?.distribuicao_atual]);

  const recentCompletionsByAnalyst = useMemo(() => {
    const grouped = {};
    (dashData?.historico_recente || []).forEach((task) => {
      const analystId = task?.analista_id;
      if (!analystId) return;
      if (!grouped[analystId]) grouped[analystId] = [];
      grouped[analystId].push(task);
    });
    return grouped;
  }, [dashData?.historico_recente]);

  const selectedAnalyst = teamProcessData.find((item) => String(item.analista_id) === String(selectedAnalystId)) || null;
  const totalOnline = teamProcessData.filter((item) => item.is_online).length;

  return (
    <>
      <AnalystDetailModal
        analyst={selectedAnalyst}
        currentTasks={selectedAnalyst ? (currentTasksByAnalyst[selectedAnalyst.analista_id] || []) : []}
        recentCompletions={selectedAnalyst ? (recentCompletionsByAnalyst[selectedAnalyst.analista_id] || []).slice(0, 6) : []}
        onClose={() => setSelectedAnalystId(null)}
      />

      <section className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-2.5"><BarChart3 size={16} className="text-blue-600" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Fluxo por Situacao</h3></div>
          <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border transition-all ${isSyncing ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' : 'bg-green-50 text-green-600 border-green-100'}`}><RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''}/> {isSyncing ? 'Sincronizando' : 'Sincronizado'}</div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase border ${monitorStyle}`}>
            <CheckSquare size={11} />
            {monitorLabelByScope[syncScope] || 'Monitoramento indisponível'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase border ${hasSyncFailures ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            <AlertTriangle size={11} />
            Falhas: {managerSyncStatus?.situacoes_falharam?.length || 0}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase border bg-slate-50 text-slate-600 border-slate-200">
            <Hash size={11} />
            Removidas: {managerSyncStatus?.removidas_na_limpeza || 0}
          </span>
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
          <button onClick={() => { setEditForm({id: null, nome: '', email: '', senha: '', permissoes: [62, 66, 30], status: 'ativo'}); setShowEditModal(true); }} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500 shadow-lg active:scale-95 flex items-center gap-2"><UserPlus size={14}/> Novo Analista</button>
        </div>

        <div className="px-5 md:px-6 py-3 border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)]">
          <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">Analistas: {teamProcessData.length}</span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Fila ativa: {totalOnline}</span>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">Clique no nome para detalhes</span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-[11px] min-w-160">
            <thead className="text-[9px] text-slate-400 uppercase font-black border-b border-slate-100 bg-slate-50/70 text-center">
              <tr>
                <th className="p-4 md:p-5 text-left">Analista</th>
                <th className="p-4 md:p-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamProcessData.length > 0 ? teamProcessData.map((analyst) => {
                return (
                  <tr key={analyst.analista_id} className="hover:bg-slate-50/60 transition-colors group text-[11px] text-center">
                    <td className="p-4 md:p-5 text-left">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                          {getInitials(analyst.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button onClick={() => setSelectedAnalystId(analyst.analista_id)} className="flex flex-col text-left w-full max-w-72">
                            <span className="font-black text-slate-800 uppercase truncate hover:text-blue-600 transition">{analyst.nome}</span>
                            <span className="text-[9px] font-medium text-slate-400 truncate mt-0.5">{analyst.email || 'Sem e-mail'}</span>
                          </button>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-[8px] font-black uppercase border ${analyst.is_online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                              {analyst.is_online ? 'Fila ativa' : 'Offline'}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-[8px] font-black uppercase border border-slate-200 bg-white text-slate-600">
                              Recebidas: {analyst.recebidas_hoje || 0}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-[8px] font-black uppercase border border-emerald-200 bg-emerald-50 text-emerald-700">
                              Feitas: {analyst.feitas_hoje || 0}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-[8px] font-black uppercase border border-blue-200 bg-blue-50 text-blue-700">
                              Mesa: {analyst.na_mesa || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 md:p-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                      <button
                        disabled={togglingQueueIds.includes(analyst.analista_id)}
                        onClick={() => handleAdminQueueToggle({ ...analyst, id: analyst.analista_id })}
                        className={`p-2 rounded-xl border transition-all inline-flex items-center justify-center ${togglingQueueIds.includes(analyst.analista_id) ? 'animate-pulse opacity-80 cursor-wait' : ''} ${analyst.is_online ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-green-600 text-white border-green-600 hover:bg-green-500'}`}
                        title={analyst.is_online ? 'Desligar fila' : 'Ligar fila'}
                      >
                        {togglingQueueIds.includes(analyst.analista_id) ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14}/>} 
                      </button>
                      <button
                        onClick={() => {
                          setEditForm({
                            id: analyst.analista_id,
                            nome: analyst.nome || '',
                            email: analyst.email || '',
                            senha: '',
                            permissoes: analyst.situacoes_ids || [],
                            status: analyst.status || 'ativo',
                          });
                          setShowEditModal(true);
                        }}
                        className="text-slate-300 hover:text-blue-500 p-2 transition-all inline-block"
                        title="Editar analista"
                      >
                        <Edit3 size={14}/>
                      </button>
                      <button onClick={() => handleDeleteAnalyst(analyst.analista_id)} className="text-slate-300 hover:text-red-500 p-2 transition-all inline-block" title="Excluir analista">
                        <Trash2 size={14}/>
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={2} className="p-10 text-center text-[12px] font-bold text-slate-400">
                    Nenhum analista encontrado para exibir o processo analítico da equipa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default ManagerDashboardTab;
