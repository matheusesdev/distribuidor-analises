import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  Layers3,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';

const REFRESH_LABEL_SECONDS = 10;

const formatRelativeTime = (value) => {
  if (!value) return { label: 'Sem registro', title: 'Nenhuma atribuição registrada' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { label: 'Sem registro', title: String(value) };
  }

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSeconds < 60) {
    return { label: diffSeconds <= 5 ? 'Agora' : `Há ${diffSeconds}s`, title: date.toLocaleString('pt-BR') };
  }
  if (diffSeconds < 3600) {
    return { label: `Há ${Math.floor(diffSeconds / 60)} min`, title: date.toLocaleString('pt-BR') };
  }
  if (diffSeconds < 86400) {
    return { label: `Há ${Math.floor(diffSeconds / 3600)} h`, title: date.toLocaleString('pt-BR') };
  }

  return {
    label: date.toLocaleDateString('pt-BR'),
    title: date.toLocaleString('pt-BR'),
  };
};

const getInitials = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'AN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getPriorityTone = (position) => {
  if (position === 1) {
    return {
      ring: 'ring-1 ring-[#0071e3]/18 border-[#bfdbfe]',
      badge: 'bg-[#0071e3] text-white',
      surface: 'bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]',
    };
  }

  if (position <= 3) {
    return {
      ring: 'ring-1 ring-slate-200 border-slate-200',
      badge: 'bg-slate-900 text-white',
      surface: 'bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)]',
    };
  }

  return {
    ring: 'border-slate-200',
    badge: 'bg-slate-200 text-slate-700',
    surface: 'bg-white',
  };
};

const ManagerQueueTab = ({
  SITUACOES_MAP = {},
  dashData = {},
  handleAdminQueueToggle = () => {},
  togglingQueueIds = [],
}) => {
  const teamData = useMemo(() => {
    const source = Array.isArray(dashData?.resumo_equipe) && dashData.resumo_equipe.length > 0
      ? dashData.resumo_equipe
      : dashData?.equipe || [];

    return source
      .map((analyst) => {
        const analystId = Number(analyst.id ?? analyst.analista_id);
        const situacoesIds = Array.isArray(analyst.situacoes_ids)
          ? analyst.situacoes_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
          : Array.isArray(analyst.permissoes)
            ? analyst.permissoes.map((id) => Number(id)).filter((id) => Number.isFinite(id))
            : [];

        return {
          ...analyst,
          id: analystId,
          analista_id: analystId,
          status: String(analyst.status || 'ativo').trim().toLowerCase(),
          is_online: Boolean(analyst.is_online),
          recebidas_hoje: Number(analyst.recebidas_hoje ?? analyst.total_hoje ?? 0),
          feitas_hoje: Number(analyst.feitas_hoje ?? 0),
          na_mesa: Number(analyst.na_mesa ?? 0),
          situacoes_ids: situacoesIds,
          situacoes_nomes: Array.isArray(analyst.situacoes_nomes)
            ? analyst.situacoes_nomes
            : situacoesIds.map((id) => SITUACOES_MAP[String(id)] || SITUACOES_MAP[id] || `ID ${id}`),
        };
      })
      .filter((analyst) => Number.isFinite(analyst.id));
  }, [dashData?.equipe, dashData?.resumo_equipe, SITUACOES_MAP]);

  const [queueOrder, setQueueOrder] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [positionPulseById, setPositionPulseById] = useState({});
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_LABEL_SECONDS);
  const pulseTimeoutRef = useRef(null);

  const getSystemSortedIds = useCallback(() => {
    return teamData
      .filter((analyst) => analyst.is_online && analyst.status !== 'inativo')
      .sort((a, b) => {
        const totalDiff = (a.recebidas_hoje || 0) - (b.recebidas_hoje || 0);
        if (totalDiff !== 0) return totalDiff;

        const dateA = new Date(a.ultima_atribuicao || 0).getTime();
        const dateB = new Date(b.ultima_atribuicao || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;

        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      })
      .map((analyst) => analyst.id);
  }, [teamData]);

  useEffect(() => {
    const systemSortedIds = getSystemSortedIds();

    setQueueOrder((prevOrder) => {
      if (!prevOrder.length) return systemSortedIds;

      const systemIdSet = new Set(systemSortedIds);
      const prevIdSet = new Set(prevOrder);
      const preservedOrder = prevOrder.filter((id) => systemIdSet.has(id));
      const newIds = systemSortedIds.filter((id) => !prevIdSet.has(id));

      return [...preservedOrder, ...newIds];
    });
  }, [getSystemSortedIds]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? REFRESH_LABEL_SECONDS : prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  const teamById = useMemo(() => {
    const map = new Map();
    teamData.forEach((analyst) => {
      map.set(analyst.id, analyst);
    });
    return map;
  }, [teamData]);

  const onlineQueue = useMemo(() => {
    return queueOrder
      .map((id, index) => {
        const analyst = teamById.get(id);
        if (!analyst || !analyst.is_online || analyst.status === 'inativo') return null;
        return { ...analyst, queuePosition: index + 1 };
      })
      .filter(Boolean);
  }, [queueOrder, teamById]);

  const groupedQueue = useMemo(() => {
    const groups = {};

    onlineQueue.forEach((analyst) => {
      const key = [...(analyst.situacoes_ids || [])].sort((a, b) => a - b).join('|') || 'sem-permissoes';
      if (!groups[key]) groups[key] = [];
      groups[key].push(analyst);
    });

    return Object.entries(groups);
  }, [onlineQueue]);

  const summary = useMemo(() => {
    const totalOnline = onlineQueue.length;
    const totalNaMesa = teamData.reduce((sum, analyst) => sum + (analyst.na_mesa || 0), 0);
    const totalFeitas = teamData.reduce((sum, analyst) => sum + (analyst.feitas_hoje || 0), 0);
    const averageLoad = totalOnline > 0 ? (totalNaMesa / totalOnline).toFixed(1) : '0.0';

    return { totalOnline, totalNaMesa, totalFeitas, averageLoad };
  }, [onlineQueue.length, teamData]);

  const priorityQueue = onlineQueue.slice(0, 3);

  const getSituacoesLabel = useCallback((ids) => {
    if (!ids || !ids.length) return 'Sem permissões definidas';
    return ids
      .map((id) => SITUACOES_MAP[id] || SITUACOES_MAP[String(id)] || `ID ${id}`)
      .join(' · ');
  }, [SITUACOES_MAP]);

  const moveAnalyst = (analystId, direction) => {
    const currentIndex = queueOrder.indexOf(analystId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up'
      ? Math.max(0, currentIndex - 1)
      : Math.min(queueOrder.length - 1, currentIndex + 1);

    if (currentIndex === targetIndex) return;

    const nextOrder = [...queueOrder];
    const swappedId = nextOrder[targetIndex];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    setQueueOrder(nextOrder);

    if (pulseTimeoutRef.current) {
      window.clearTimeout(pulseTimeoutRef.current);
    }

    setPositionPulseById({ [analystId]: true, [swappedId]: true });
    pulseTimeoutRef.current = window.setTimeout(() => {
      setPositionPulseById({});
      pulseTimeoutRef.current = null;
    }, 260);
  };

  const resetOrder = () => {
    const systemSortedIds = getSystemSortedIds();
    setQueueOrder(systemSortedIds);

    const pulseMap = {};
    systemSortedIds.forEach((id) => {
      pulseMap[id] = true;
    });
    setPositionPulseById(pulseMap);

    if (pulseTimeoutRef.current) {
      window.clearTimeout(pulseTimeoutRef.current);
    }
    pulseTimeoutRef.current = window.setTimeout(() => {
      setPositionPulseById({});
      pulseTimeoutRef.current = null;
    }, 320);
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  return (
    <section className="space-y-5 md:space-y-6">
      <section className="rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,#fbfdff_0%,#ffffff_72%)] p-6 md:p-7 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.42)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#0071e3]">
              <Sparkles size={12} />
              Distribuição automática
            </div>
            <h1 className="mt-4 text-[1.75rem] font-semibold tracking-[-0.03em] text-slate-900 md:text-[2.2rem]">
              Fila de atendimento com leitura mais clara e operação mais direta.
            </h1>
            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-500 md:text-[14px]">
              A visualização abaixo mostra a ordem atual de distribuição, a carga da equipe online e os grupos de permissões que orientam o roteamento das novas pastas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex min-h-[108px] flex-col justify-between rounded-2xl border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5faff_100%)] px-4 py-4 shadow-[0_14px_30px_-26px_rgba(0,113,227,0.28)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-blue-700/75">Online</p>
              <p className="text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-blue-950">{summary.totalOnline}</p>
            </div>
            <div className="flex min-h-[108px] flex-col justify-between rounded-2xl border border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf2_100%)] px-4 py-4 shadow-[0_14px_30px_-26px_rgba(180,83,9,0.18)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-amber-700/75">Na mesa</p>
              <p className="text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-amber-950">{summary.totalNaMesa}</p>
            </div>
            <div className="flex min-h-[108px] flex-col justify-between rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4fcf7_100%)] px-4 py-4 shadow-[0_14px_30px_-26px_rgba(5,150,105,0.2)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-700/75">Feitas hoje</p>
              <p className="text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-emerald-950">{summary.totalFeitas}</p>
            </div>
            <div className="flex min-h-[108px] flex-col justify-between rounded-2xl border border-violet-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8f7ff_100%)] px-4 py-4 shadow-[0_14px_30px_-26px_rgba(91,33,182,0.16)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-violet-700/75">Carga média</p>
              <p className="text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-violet-950">{summary.averageLoad}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.8rem] border border-slate-200/80 bg-white p-5 md:p-6 shadow-[0_24px_55px_-38px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">Prioridade atual</p>
              <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">Próximos da fila</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
              <RefreshCw size={12} className="text-slate-400" />
              Atualização visual em {refreshCountdown}s
            </div>
          </div>

          {priorityQueue.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-[13px] font-medium text-slate-500">
              Nenhum analista com fila ativa no momento.
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {priorityQueue.map((analyst) => {
                const tone = getPriorityTone(analyst.queuePosition);
                const lastAssigned = formatRelativeTime(analyst.ultima_atribuicao);

                return (
                  <article
                    key={analyst.id}
                    className={`rounded-[1.55rem] border px-4 py-4 md:px-5 md:py-5 transition-all ${tone.ring} ${tone.surface}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[13px] font-semibold ${tone.badge}`}>
                          {analyst.queuePosition}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-900">
                              {analyst.nome}
                            </h3>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              {getInitials(analyst.nome)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[12px] text-slate-500">{analyst.email || 'Sem e-mail'}</p>
                          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500" title={lastAssigned.title}>
                            <Clock3 size={12} />
                            Última atribuição: {lastAssigned.label}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:min-w-[240px]">
                        <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-center">
                          <p className="text-[10px] font-medium text-slate-500">Recebidas</p>
                          <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{analyst.recebidas_hoje}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-center">
                          <p className="text-[10px] font-medium text-slate-500">Mesa</p>
                          <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{analyst.na_mesa}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-center">
                          <p className="text-[10px] font-medium text-slate-500">Feitas</p>
                          <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{analyst.feitas_hoje}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[1.8rem] border border-slate-200/80 bg-white p-5 md:p-6 shadow-[0_24px_55px_-38px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">Operação</p>
              <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">Regras da visualização</h2>
            </div>
            <button
              type="button"
              onClick={resetOrder}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 transition-all hover:border-slate-400 hover:-translate-y-0.5"
            >
              <RefreshCw size={12} />
              Restaurar ordem
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                <Layers3 size={13} className="text-[#0071e3]" />
                Critérios de ordenação
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                Menor volume recebido no dia, atribuição mais antiga e, por fim, nome em ordem alfabética.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                <Users size={13} className="text-[#0071e3]" />
                Agrupamento
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                Os blocos são separados por conjunto de permissões, facilitando a leitura de quem disputa o mesmo tipo de pasta.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                <ArrowUp size={13} className="text-[#0071e3]" />
                Ajuste manual
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                A ordem pode ser refinada manualmente para testes ou contingência, sem perder a possibilidade de restaurar o padrão do sistema.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200/80 bg-white shadow-[0_24px_55px_-38px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">Fila detalhada</p>
            <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">Equipe online por grupo de permissão</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
              Grupos: {groupedQueue.length}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
              Analistas online: {summary.totalOnline}
            </span>
          </div>
        </div>

        {groupedQueue.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] font-medium text-slate-500">
            Nenhum analista com fila ativa para exibir nesta aba.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedQueue.map(([groupKey, analysts]) => {
              const isExpanded = expandedGroups[groupKey] !== false;
              const groupIds = groupKey === 'sem-permissoes' ? [] : groupKey.split('|').filter(Boolean).map(Number);

              return (
                <div key={groupKey}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/70 md:px-6"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold tracking-[0.01em] text-slate-900">
                        {getSituacoesLabel(groupIds)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {analysts.length} analista{analysts.length !== 1 ? 's' : ''} · {analysts.reduce((sum, analyst) => sum + analyst.na_mesa, 0)} pasta{analysts.reduce((sum, analyst) => sum + analyst.na_mesa, 0) !== 1 ? 's' : ''} na mesa
                      </p>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 md:px-4 md:pb-4">
                      <div className="space-y-2 rounded-[1.45rem] bg-slate-50/70 p-2 md:p-3">
                        {analysts.map((analyst) => {
                          const isToggling = togglingQueueIds.includes(analyst.id);
                          const isFirst = analyst.queuePosition === 1;
                          const isLast = analyst.queuePosition === onlineQueue.length;
                          const pulse = positionPulseById[analyst.id];
                          const lastAssigned = formatRelativeTime(analyst.ultima_atribuicao);

                          return (
                            <article
                              key={analyst.id}
                              className={`rounded-[1.3rem] border bg-white px-4 py-4 transition-all md:px-5 ${pulse ? 'border-[#93c5fd] shadow-[0_18px_32px_-26px_rgba(0,113,227,0.75)]' : 'border-slate-200'} ${isFirst ? 'ring-1 ring-[#0071e3]/12' : ''}`}
                            >
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[13px] font-semibold ${isFirst ? 'bg-[#0071e3] text-white' : isLast ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white'}`}>
                                    {analyst.queuePosition}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-900">
                                        {analyst.nome}
                                      </h3>
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${analyst.is_online ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                        {analyst.is_online ? <Eye size={11} /> : <EyeOff size={11} />}
                                        {analyst.is_online ? 'Fila ativa' : 'Offline'}
                                      </span>
                                    </div>
                                    <p className="mt-1 truncate text-[12px] text-slate-500">{analyst.email || 'Sem e-mail'}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1" title={lastAssigned.title}>
                                        <Clock3 size={11} />
                                        {lastAssigned.label}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                        {analyst.situacoes_nomes?.length || 0} permissões
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 sm:w-auto sm:min-w-[260px]">
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                                    <p className="text-[10px] font-medium text-slate-500">Recebidas</p>
                                    <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{analyst.recebidas_hoje}</p>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                                    <p className="text-[10px] font-medium text-slate-500">Mesa</p>
                                    <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{analyst.na_mesa}</p>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                                    <p className="text-[10px] font-medium text-slate-500">Feitas</p>
                                    <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{analyst.feitas_hoje}</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                  <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                      type="button"
                                      onClick={() => moveAnalyst(analyst.id, 'up')}
                                      disabled={analyst.queuePosition === 1}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed"
                                      title="Mover para cima"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveAnalyst(analyst.id, 'down')}
                                      disabled={analyst.queuePosition === onlineQueue.length}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed"
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleAdminQueueToggle(analyst)}
                                    disabled={isToggling}
                                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold transition-all ${
                                      isToggling
                                        ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                                        : analyst.is_online
                                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:-translate-y-0.5'
                                          : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:-translate-y-0.5'
                                    }`}
                                  >
                                    {isToggling ? <RefreshCw size={12} className="animate-spin" /> : analyst.is_online ? <Eye size={12} /> : <EyeOff size={12} />}
                                    {analyst.is_online ? 'Online' : 'Offline'}
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
};

export default ManagerQueueTab;
