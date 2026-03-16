import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Zap, AlertTriangle, ChevronDown, ChevronUp, 
  Eye, EyeOff, Clock, CheckCircle2, RefreshCw
} from 'lucide-react';

/**
 * ManagerQueueTab - Exibe a fila ordenada de analistas com atualização automática
 * 
 * Funcionalidades:
 * - Mostra analistas com fila ativa (is_online = true)
 * - Ordena pela lógica do backend: total_hoje → ultima_atribuicao → nome
 * - Destaca usuários com permissões diferentes (situações distintas)
 * - Agrupa por "perfil de situações" para visualizar separações claras
 * - AUTO-ATUALIZA a cada 10 segundos com animações suaves
 * - Visualiza "próximos da fila" em destaque com carrossel animado
 * - Interativo: reordenação manual, toggle online/offline
 */
const ManagerQueueTab = ({
  SITUACOES_MAP = {},
  dashData = {},
  SIT_COLORS = {},
  handleAdminQueueToggle = () => {},
  togglingQueueIds = [],
}) => {
  const equipe = dashData.equipe || [];
  
  // Estado local para reordenação da fila
  const [queueOrder, setQueueOrder] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  
  // Estado para auto-refresh
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState(10);

  // Inicializa a fila quando os dados chegam
  useEffect(() => {
    const onlineAnalysts = equipe
      .filter(a => a.is_online && a.status === 'ativo')
      .sort((a, b) => {
        // Replica a ordenação do backend
        const totalDiff = (a.total_hoje || 0) - (b.total_hoje || 0);
        if (totalDiff !== 0) return totalDiff;

        const dateA = new Date(a.ultima_atribuicao || 0).getTime();
        const dateB = new Date(b.ultima_atribuicao || 0).getTime();
        const dateDiff = dateA - dateB;
        if (dateDiff !== 0) return dateDiff;

        return ((a.nome || '') < (b.nome || '') ? -1 : 1);
      });

    setQueueOrder(onlineAnalysts.map(a => a.id));
  }, [equipe]);

  // Auto-refresh com countdown visual
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const countdownInterval = setInterval(() => {
      setNextUpdateCountdown(prev => {
        if (prev <= 1) {
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isAutoRefreshEnabled]);

  // Agrupa analistas por seu "perfil de situações"
  const groupedByProfile = useCallback(() => {
    const groups = {};
    const analystMap = {};
    
    equipe.forEach(a => {
      analystMap[a.id] = a;
    });

    // Cria grupos baseados no conjunto de situações
    queueOrder.forEach(analystId => {
      const analyst = analystMap[analystId];
      if (!analyst || !analyst.is_online || analyst.status !== 'ativo') return;

      const situacoes = (analyst.situacoes_ids || []).sort().join('|');
      if (!groups[situacoes]) {
        groups[situacoes] = [];
      }
      groups[situacoes].push(analyst);
    });

    return groups;
  }, [queueOrder, equipe]);

  const groups = groupedByProfile();

  // Detecta usuários especiais (Carolaine e Naiara)
  const specialUsers = new Set();
  equipe.forEach(a => {
    const name = (a.nome || '').toLowerCase();
    if (name.includes('carolaine') || name.includes('naiara')) {
      specialUsers.add(a.id);
    }
  });

  // Handler para toggle de fila online/offline
  const handleToggle = (analystId) => {
    handleAdminQueueToggle(analystId);
  };

  // Handler para reordenação
  const moveAnalyst = (analystId, direction) => {
    const currentIndex = queueOrder.indexOf(analystId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(queueOrder.length - 1, currentIndex + 1);

    if (currentIndex === newIndex) return;

    const newOrder = [...queueOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setQueueOrder(newOrder);
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Converte situações IDs para nomes
  const getSituacoesLabel = (situacaoIds) => {
    if (!situacaoIds || situacaoIds.length === 0) {
      return 'Sem permissões';
    }
    return situacaoIds
      .map(id => SITUACOES_MAP[id] || `ID ${id}`)
      .join(' + ');
  };

  // Calcula estatísticas da fila
  const totalOnline = queueOrder.length;
  const totalPending = equipe.reduce((sum, a) => sum + (a.na_mesa || 0), 0);
  const totalCompleted = equipe.reduce((sum, a) => sum + (a.feitas_hoje || 0), 0);

  // Pega os próximos N da fila para visualizar em carrossel
  const getUpcomingAnalysts = (count = 5) => {
    const analystMap = {};
    equipe.forEach(a => {
      analystMap[a.id] = a;
    });

    return queueOrder
      .slice(0, count)
      .map(id => analystMap[id])
      .filter(Boolean);
  };

  const upcomingAnalysts = getUpcomingAnalysts(5);

  return (
    <section className="space-y-6">
      {/* SEÇÃO PRINCIPAL: PRÓXIMOS DA FILA (CARROSSEL ANIMADO) */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-50/50 shadow-[0_16px_36px_-20px_rgba(16,185,129,0.3)] p-6 md:p-8 overflow-hidden">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-emerald-900">🚀 Próximos da Fila</h2>
            <p className="text-emerald-700 text-sm font-semibold mt-1">Ordem atual de recebimento (quem recebe as próximas pastas)</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-600">Atualização automática</p>
            <div className="flex items-center gap-2 mt-2">
              <RefreshCw 
                size={14} 
                className={`text-emerald-600 ${isAutoRefreshEnabled ? 'animate-spin' : ''}`}
              />
              <span className="text-[13px] font-bold text-emerald-700">{nextUpdateCountdown}s</span>
            </div>
          </div>
        </div>

        {/* CARROSSEL ANIMADO DOS PRÓXIMOS 5 */}
        {upcomingAnalysts.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
            <p className="text-emerald-700 font-semibold">Nenhum analista na fila agora</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAnalysts.map((analyst, idx) => {
              const isSpecial = specialUsers.has(analyst.id);
              const isFirst = idx === 0;
              
              return (
                <div
                  key={analyst.id}
                  className={`
                    rounded-xl p-4 transition-all duration-500 transform
                    ${isFirst 
                      ? 'ring-2 ring-emerald-500 bg-white shadow-[0_12px_24px_-12px_rgba(16,185,129,0.5)] scale-100 translate-y-0'
                      : 'bg-white/60 hover:bg-white/80'
                    }
                    ${isSpecial ? 'border-l-4 border-blue-500' : 'border-l-4 border-emerald-300'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    {/* POSIÇÃO */}
                    <div className={`
                      w-12 h-12 rounded-lg font-black text-white flex items-center justify-center text-lg shrink-0
                      transition-all duration-500
                      ${isFirst 
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_8px_16px_-8px_rgba(16,185,129,0.6)] scale-110' 
                        : `bg-emerald-300 opacity-70`
                      }
                    `}>
                      {idx + 1}
                    </div>

                    {/* INFO */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-800 text-[15px] truncate">
                        {analyst.nome}
                        {isSpecial && <Zap size={13} className="inline ml-2 text-blue-600" />}
                      </h4>
                      <p className="text-[12px] text-slate-500 mt-1">{analyst.email}</p>
                      {analyst.situacoes_nomes && analyst.situacoes_nomes.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {analyst.situacoes_nomes.slice(0, 2).map(sit => (
                            <span 
                              key={sit}
                              className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold truncate"
                            >
                              {sit.substring(0, 18)}
                            </span>
                          ))}
                          {analyst.situacoes_nomes.length > 2 && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100/60 text-emerald-600 font-bold">
                              +{analyst.situacoes_nomes.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MÉTRICAS */}
                    <div className="flex gap-3 shrink-0 hidden sm:flex">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Recebidas</p>
                        <p className="text-[16px] font-black text-emerald-700 mt-1">{analyst.recebidas_hoje || 0}</p>
                      </div>
                      <div className="text-center border-l border-slate-200 pl-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Na Mesa</p>
                        <p className="text-[16px] font-black text-emerald-700 mt-1">{analyst.na_mesa || 0}</p>
                      </div>
                    </div>

                    {/* STATUS */}
                    <div className="text-center shrink-0">
                      <span className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase
                        ${analyst.is_online 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        <span className={`w-2 h-2 rounded-full ${analyst.is_online ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                        {analyst.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-emerald-200/50">
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoRefreshEnabled}
              onChange={(e) => setIsAutoRefreshEnabled(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-sm font-semibold text-emerald-700">Atualizar automaticamente a cada 10 segundos</span>
          </label>
        </div>
      </div>

      {/* HEADER COM STATS */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_26px_-18px_rgba(15,23,42,0.4)] p-5 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-[#0071e3] flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Fila Detalhada</h2>
              <p className="text-slate-500 text-sm font-semibold mt-0.5">Visualização completa e agrupada por situações</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-center px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-600">Online</p>
              <p className="text-2xl font-black text-blue-700 mt-1">{totalOnline}</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-600">Na Mesa</p>
              <p className="text-2xl font-black text-amber-700 mt-1">{totalPending}</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-green-50 border border-green-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-green-600">Feitas</p>
              <p className="text-2xl font-black text-green-700 mt-1">{totalCompleted}</p>
            </div>
          </div>
        </div>

        {/* INFO SOBRE A FILA */}
        <div className="bg-slate-50/80 rounded-xl p-3.5 text-sm text-slate-600 border border-slate-100/50">
          <p className="font-semibold text-slate-700 mb-1">Como funciona a fila:</p>
          <ul className="space-y-1 text-[13px]">
            <li>✓ Ordenação por: <strong>Menor total_hoje</strong> → Atribuição mais antiga → Nome (A-Z)</li>
            <li>✓ Usuários separados por <strong>situações permitidas</strong> para clareza visual</li>
            <li>✓ <strong className="text-blue-600">Especial</strong>: Carolaine e Naiara possuem situações exclusivas</li>
            <li>✓ Atualização Automática: A ordem muda conforme pastas são distribuídas (próximo desce, anteriores sobem)</li>
            <li>✓ Reordenação manual: Botões ↑↓ permitem ajustes de teste</li>
          </ul>
        </div>
      </div>

      {/* GRUPOS DE ANALISTAS */}
      <div className="space-y-4">
        {Object.entries(groups).length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
            <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold">Nenhum analista com fila ativa no momento</p>
            <p className="text-slate-400 text-sm mt-2">Ative a fila de pelo menos um analista para visualizar a distribuição</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupKey, analysts]) => {
            const isExpanded = expandedGroups[groupKey] !== false;
            const situacaoIds = groupKey.split('|').filter(Boolean).map(Number);
            const situacaoLabel = getSituacoesLabel(situacaoIds);
            const hasSpecial = analysts.some(a => specialUsers.has(a.id));

            return (
              <div
                key={groupKey}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_26px_-18px_rgba(15,23,42,0.4)] overflow-hidden"
              >
                {/* HEADER DO GRUPO */}
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full px-5 md:px-6 py-4 flex items-center gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} className="text-slate-400" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{situacaoLabel}</h3>
                      {hasSpecial && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-[9px] font-bold uppercase tracking-[0.06em] text-blue-700">
                          <Zap size={10} /> Casos Especiais
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[13px] font-bold text-slate-600">{analysts.length} analista{analysts.length !== 1 ? 's' : ''}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {analysts.reduce((sum, a) => sum + (a.na_mesa || 0), 0)} na mesa
                    </p>
                  </div>
                </button>

                {/* CONTEÚDO DO GRUPO */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/30">
                    <div className="divide-y divide-slate-100">
                      {analysts.map((analyst, idx) => {
                        const isSpecial = specialUsers.has(analyst.id);
                        const isToggling = togglingQueueIds.includes(analyst.id);
                        const position = queueOrder.indexOf(analyst.id) + 1;

                        return (
                          <div
                            key={analyst.id}
                            className={`px-5 md:px-6 py-4 flex items-center gap-4 hover:bg-white/60 transition-all duration-300 ${
                              isSpecial ? 'bg-blue-50/40 hover:bg-blue-50/70' : ''
                            }`}
                          >
                            {/* POSIÇÃO NA FILA */}
                            <div className="flex items-center gap-2 w-12 shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-200/60 flex items-center justify-center font-bold text-slate-700 text-[13px]">
                                {position}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => moveAnalyst(analyst.id, 'up')}
                                  disabled={position === 1}
                                  className="p-0.5 hover:bg-slate-300/50 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                                  title="Mover para cima"
                                >
                                  <ChevronUp size={14} className="text-slate-600" />
                                </button>
                                <button
                                  onClick={() => moveAnalyst(analyst.id, 'down')}
                                  disabled={position === queueOrder.length}
                                  className="p-0.5 hover:bg-slate-300/50 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                                  title="Mover para baixo"
                                >
                                  <ChevronDown size={14} className="text-slate-600" />
                                </button>
                              </div>
                            </div>

                            {/* INFO DO ANALISTA */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-800 truncate">
                                  {analyst.nome}
                                </h4>
                                {isSpecial && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-200 text-[8px] font-bold uppercase tracking-[0.06em] text-blue-800 shrink-0">
                                    <Zap size={9} /> Especial
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">{analyst.email}</p>

                              {/* TAGS DE SITUAÇÕES */}
                              {analyst.situacoes_nomes && analyst.situacoes_nomes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {analyst.situacoes_nomes.slice(0, 3).map(sit => (
                                    <span
                                      key={sit}
                                      className="text-[9px] px-2 py-1 rounded-md bg-slate-200/60 text-slate-700 font-semibold truncate"
                                    >
                                      {sit.substring(0, 20)}
                                    </span>
                                  ))}
                                  {analyst.situacoes_nomes.length > 3 && (
                                    <span className="text-[9px] px-2 py-1 rounded-md bg-slate-200/40 text-slate-600 font-semibold">
                                      +{analyst.situacoes_nomes.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* MÉTRICAS */}
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <Clock size={13} className="text-slate-400" />
                                  <span className="text-[13px] font-bold text-slate-800">{analyst.recebidas_hoje || 0}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">recebidas hoje</p>
                              </div>

                              <div className="text-right hidden sm:block">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <CheckCircle2 size={13} className="text-slate-400" />
                                  <span className="text-[13px] font-bold text-slate-800">{analyst.na_mesa || 0}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">na mesa</p>
                              </div>

                              {/* BOTÃO TOGGLE ONLINE/OFFLINE */}
                              <button
                                onClick={() => handleToggle(analyst.id)}
                                disabled={isToggling}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-[0.08em] transition-all ${
                                  isToggling
                                    ? 'opacity-60 cursor-not-allowed'
                                    : analyst.is_online
                                    ? 'bg-green-100 text-green-700 hover:bg-green-150 hover:shadow-[0_8px_16px_-10px_rgba(34,197,94,0.5)]'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-150'
                                }`}
                              >
                                {analyst.is_online ? (
                                  <>
                                    <Eye size={12} /> Online
                                  </>
                                ) : (
                                  <>
                                    <EyeOff size={12} /> Offline
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* LEGENDA */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 md:p-6">
        <h3 className="font-bold text-slate-800 mb-3">Legenda de Posição</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-[13px]">🚀 Próximo</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Recebe as próximas pastas</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
              5
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-[13px]">⏳ Aguardando</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Sua vez está chegando</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
              N
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-[13px]">📋 Final</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Receberá por último</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ManagerQueueTab;
