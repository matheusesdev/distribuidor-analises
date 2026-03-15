import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Edit3,
  Hash,
  Layers3,
  LineChart,
  Mail,
  PieChart,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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

const AnalystDetailModal = ({ analyst, currentTasks, recentCompletions, onClose, asInline = false }) => {
  const [isCompact, setIsCompact] = useState(false);

  if (!analyst) return null;

  const situationEntries = Object.entries(analyst.mesa_por_situacao || {});
  const analytics = analyst.analytics || { total_periodo: 0, por_dia: [], por_mes: [], por_situacao: [] };
  const dailySeries = analytics.por_dia || [];
  const monthlySeries = analytics.por_mes || [];
  const situationSeries = analytics.por_situacao || [];
  const situationDailySeries = analytics.por_situacao_por_dia || [];
  const situationMonthlySeries = analytics.por_situacao_por_mes || [];
  const maxDaily = Math.max(...dailySeries.map((item) => Number(item.total || 0)), 1);
  const maxMonthly = Math.max(...monthlySeries.map((item) => Number(item.total || 0)), 1);
  const maxSituation = Math.max(...situationSeries.map((item) => Number(item.total || 0)), 1);
  const analystInitials = getInitials(analyst.nome);

  const barWidth = (value, maxValue) => `${Math.max(8, Math.round((Number(value || 0) / Math.max(maxValue, 1)) * 100))}%`;
  const sectionRevealStyle = (index) => ({ animationDelay: `${index * 70}ms` });

  return (
    <div className={asInline ? 'w-full animate-in fade-in duration-300' : 'fixed inset-0 bg-slate-950/55 backdrop-blur-md z-250 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200'} onClick={asInline ? undefined : onClose}>
      <div className={asInline ? 'w-full bg-white/92 border border-white/75 rounded-3xl md:rounded-[2.2rem] shadow-[0_42px_90px_-34px_rgba(15,23,42,0.72)] overflow-hidden backdrop-blur-xl' : 'w-full max-w-[1120px] max-h-[92vh] bg-white/92 border border-white/75 rounded-3xl md:rounded-[2.2rem] shadow-[0_42px_90px_-34px_rgba(15,23,42,0.72)] overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-200'} onClick={(event) => event.stopPropagation()}>
        <div className={`${isCompact ? 'px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4' : 'px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6'} border-b border-slate-100/90 flex items-start justify-between gap-4 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fbff_40%,#ffffff_100%)]`}>
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-white/90 border border-slate-200 text-[#0071e3] shadow-[0_14px_28px_-22px_rgba(0,113,227,0.9)] flex items-center justify-center text-[13px] font-semibold shrink-0">
              {analystInitials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0071e3]">Analista</p>
              <h3 className={`${isCompact ? 'mt-0.5 text-base sm:text-[1.35rem]' : 'mt-1 text-lg sm:text-[1.65rem]'} font-semibold tracking-[-0.015em] text-slate-900 truncate`}>{analyst.nome}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 border border-slate-200 px-2.5 py-1">
                <Mail size={12} />
                {analyst.email || 'Sem e-mail'}
              </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 border ${analyst.is_online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <ShieldCheck size={12} />
                {analyst.is_online ? 'Fila ativa' : 'Offline'}
              </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 border ${analyst.status === 'ativo' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {analyst.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsCompact((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition-all hover:bg-white hover:-translate-y-0.5"
            >
              {isCompact ? 'Padrão' : 'Compacto'}
            </button>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-slate-500 transition-all hover:text-slate-700 hover:border-slate-300 hover:bg-white inline-flex items-center gap-1.5">
              {asInline ? <ArrowLeft size={16} /> : <X size={18} />}
              {asInline ? <span className="text-[11px] font-semibold">Voltar</span> : null}
            </button>
          </div>
        </div>

        <div className={`${isCompact ? 'p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-4' : 'p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6'} ${asInline ? '' : 'overflow-y-auto max-h-[calc(92vh-86px)]'}`}>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in duration-500" style={sectionRevealStyle(1)}>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_26px_-22px_rgba(15,23,42,0.65)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_30px_-22px_rgba(15,23,42,0.75)]">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 mb-3">
                <ClipboardList size={14} />
              </div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">Recebidas Hoje</p>
              <div className="mt-1.5 text-3xl font-semibold tracking-[-0.02em] text-slate-900">{analyst.recebidas_hoje}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 shadow-[0_16px_26px_-22px_rgba(6,95,70,0.55)] transition-all hover:-translate-y-0.5">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-3">
                <Sparkles size={14} />
              </div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-700">Feitas Hoje</p>
              <div className="mt-1.5 text-3xl font-semibold tracking-[-0.02em] text-emerald-700">{analyst.feitas_hoje}</div>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4 shadow-[0_16px_26px_-22px_rgba(0,113,227,0.58)] transition-all hover:-translate-y-0.5">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 mb-3">
                <Layers3 size={14} />
              </div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-blue-700">Na Mesa</p>
              <div className="mt-1.5 text-3xl font-semibold tracking-[-0.02em] text-blue-700">{analyst.na_mesa}</div>
            </div>
          </section>

          <section className={`${isCompact ? 'grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4' : 'grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6'} animate-in fade-in duration-500`} style={sectionRevealStyle(2)}>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.7)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">Situações designadas</p>
                  <h4 className="mt-1 text-sm font-semibold tracking-[0.01em] text-slate-800 inline-flex items-center gap-1.5"><Activity size={13} className="text-[#0071e3]" /> Responsabilidades do analista</h4>
                </div>
                <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{analyst.situacoes_nomes?.length || 0} situações</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(analyst.situacoes_nomes || []).map((situacao) => (
                  <span key={situacao} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-medium tracking-[0.01em] text-slate-700 transition-all hover:bg-white hover:-translate-y-0.5">
                    {situacao}
                  </span>
                ))}
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] font-medium text-slate-500 inline-flex items-center gap-1.5">
                <CalendarClock size={13} className="text-slate-400" />
                Última atribuição: {formatDateTime(analyst.ultima_atribuicao)}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.7)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 inline-flex items-center gap-1.5"><Layers3 size={12} className="text-sky-600" /> Mesa Atual por Situação</p>
              <div className="mt-4 space-y-2">
                {situationEntries.length > 0 ? (
                  situationEntries.map(([label, total]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200 transition-all hover:bg-white hover:-translate-y-0.5">
                      <span className="text-[11px] font-semibold tracking-[0.01em] text-slate-700">{label}</span>
                      <span className="text-sm font-semibold text-blue-700">{total}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                    Nenhuma pasta na mesa neste momento.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`${isCompact ? 'rounded-3xl border border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fbff_48%,#f8fafc_100%)] p-4 sm:p-4 shadow-[0_20px_38px_-30px_rgba(0,113,227,0.6)]' : 'rounded-3xl border border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fbff_48%,#f8fafc_100%)] p-5 sm:p-6 shadow-[0_20px_38px_-30px_rgba(0,113,227,0.6)]'} animate-in fade-in duration-500`} style={sectionRevealStyle(3)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.12em] text-blue-700 inline-flex items-center gap-1.5"><LineChart size={12} /> Painel Analítico</p>
                <h4 className="mt-1 text-sm font-semibold tracking-[0.01em] text-slate-900">Produção detalhada do analista</h4>
              </div>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-[10px] font-semibold text-blue-700 shadow-[0_12px_22px_-18px_rgba(0,113,227,0.75)]">
                Total no período: {analytics.total_periodo || 0}
              </span>
            </div>

            <div className={`${isCompact ? 'mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3' : 'mt-5 grid grid-cols-1 xl:grid-cols-3 gap-4'}`}>
              <div className="rounded-2xl border border-blue-100 bg-white p-4 transition-all hover:-translate-y-0.5">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-600">Realizadas por Dia</p>
                <div className={`${isCompact ? 'mt-2.5 space-y-1.5 max-h-60 overflow-y-auto pr-1' : 'mt-3 space-y-2 max-h-72 overflow-y-auto pr-1'}`}>
                  {dailySeries.length > 0 ? dailySeries.map((item) => (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-600">
                        <span>{item.label}</span>
                        <span>{item.total}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-blue-50 overflow-hidden border border-blue-100">
                        <div className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out" style={{ width: barWidth(item.total, maxDaily) }} />
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                      Sem dados diários no período analisado.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4 transition-all hover:-translate-y-0.5">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-600">Realizadas por Mês</p>
                <div className={`${isCompact ? 'mt-2.5 space-y-1.5 max-h-60 overflow-y-auto pr-1' : 'mt-3 space-y-2 max-h-72 overflow-y-auto pr-1'}`}>
                  {monthlySeries.length > 0 ? monthlySeries.map((item) => (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-600">
                        <span>{item.label}</span>
                        <span>{item.total}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-emerald-50 overflow-hidden border border-emerald-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: barWidth(item.total, maxMonthly) }} />
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                      Sem dados mensais no período analisado.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white p-4 transition-all hover:-translate-y-0.5">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-600">Realizadas por Situação</p>
                <div className={`${isCompact ? 'mt-2.5 space-y-1.5 max-h-60 overflow-y-auto pr-1' : 'mt-3 space-y-2 max-h-72 overflow-y-auto pr-1'}`}>
                  {situationSeries.length > 0 ? situationSeries.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-600 gap-2">
                        <span className="truncate">{item.label}</span>
                        <span>{item.total}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-indigo-50 overflow-hidden border border-indigo-100">
                        <div className="h-full rounded-full bg-indigo-500 transition-all duration-700 ease-out" style={{ width: barWidth(item.total, maxSituation) }} />
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                      Sem dados de situação no período analisado.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`${isCompact ? 'mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3' : 'mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4'}`}>
              <div className="rounded-2xl border border-sky-100 bg-white p-4 transition-all hover:-translate-y-0.5">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-600">Situação por Dia</p>
                <div className={`${isCompact ? 'mt-2.5 space-y-2.5 max-h-72 overflow-y-auto pr-1' : 'mt-3 space-y-3 max-h-80 overflow-y-auto pr-1'}`}>
                  {situationDailySeries.length > 0 ? situationDailySeries.map((situation) => {
                    const series = situation.serie || [];
                    const localMax = Math.max(...series.map((item) => Number(item.total || 0)), 1);
                    return (
                      <div key={`daily-${situation.label}`} className="rounded-2xl border border-sky-100 bg-sky-50/40 p-3 transition-all hover:bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-slate-700 truncate">{situation.label}</p>
                          <span className="text-[10px] font-semibold text-sky-700">{situation.total}</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {series.length > 0 ? series.map((item) => (
                            <div key={`${situation.label}-${item.key}`} className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-medium text-slate-600">
                                <span>{item.label}</span>
                                <span>{item.total}</span>
                              </div>
                              <div className="h-2 rounded-full bg-sky-50 overflow-hidden border border-sky-100">
                                <div className="h-full rounded-full bg-sky-500 transition-all duration-700 ease-out" style={{ width: barWidth(item.total, localMax) }} />
                              </div>
                            </div>
                          )) : (
                            <p className="text-[10px] font-medium text-slate-500">Sem registros diários.</p>
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                      Sem série diária por situação no período analisado.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-white p-4 transition-all hover:-translate-y-0.5">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-600">Situação por Mês</p>
                <div className={`${isCompact ? 'mt-2.5 space-y-2.5 max-h-72 overflow-y-auto pr-1' : 'mt-3 space-y-3 max-h-80 overflow-y-auto pr-1'}`}>
                  {situationMonthlySeries.length > 0 ? situationMonthlySeries.map((situation) => {
                    const series = situation.serie || [];
                    const localMax = Math.max(...series.map((item) => Number(item.total || 0)), 1);
                    return (
                      <div key={`monthly-${situation.label}`} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3 transition-all hover:bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-slate-700 truncate">{situation.label}</p>
                          <span className="text-[10px] font-semibold text-violet-700">{situation.total}</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {series.length > 0 ? series.map((item) => (
                            <div key={`${situation.label}-${item.key}`} className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-medium text-slate-600">
                                <span>{item.label}</span>
                                <span>{item.total}</span>
                              </div>
                              <div className="h-2 rounded-full bg-violet-50 overflow-hidden border border-violet-100">
                                <div className="h-full rounded-full bg-violet-500 transition-all duration-700 ease-out" style={{ width: barWidth(item.total, localMax) }} />
                              </div>
                            </div>
                          )) : (
                            <p className="text-[10px] font-medium text-slate-500">Sem registros mensais.</p>
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                      Sem série mensal por situação no período analisado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={`${isCompact ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : 'grid grid-cols-1 xl:grid-cols-2 gap-6'} animate-in fade-in duration-500`} style={sectionRevealStyle(4)}>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.7)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-600 inline-flex items-center gap-1.5"><Layers3 size={12} className="text-slate-500" /> Pastas em andamento</p>
              <div className={`${isCompact ? 'mt-3 space-y-1.5 max-h-60 overflow-y-auto pr-1' : 'mt-4 space-y-2 max-h-72 overflow-y-auto pr-1'}`}>
                {currentTasks.length > 0 ? (
                  currentTasks.map((task) => (
                    <div key={task.reserva_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all hover:bg-white hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold tracking-[0.06em] text-slate-500">Reserva {task.reserva_id}</p>
                          <p className="mt-1 truncate text-[12px] font-semibold text-slate-800">{task.cliente || 'Cliente não informado'}</p>
                          <p className="mt-1 text-[10px] font-medium tracking-[0.01em] text-slate-600">{task.situacao_nome || 'Não informado'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
                    Nenhuma pasta em andamento.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.7)]">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-600 inline-flex items-center gap-1.5"><Sparkles size={12} className="text-emerald-600" /> Concluídas recentemente</p>
              <div className={`${isCompact ? 'mt-3 space-y-1.5 max-h-60 overflow-y-auto pr-1' : 'mt-4 space-y-2 max-h-72 overflow-y-auto pr-1'}`}>
                {recentCompletions.length > 0 ? (
                  recentCompletions.map((task, index) => (
                    <div key={`${task.reserva_id}-${task.data_fim || index}`} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 transition-all hover:bg-white hover:-translate-y-0.5">
                      <p className="text-[10px] font-semibold tracking-[0.04em] text-emerald-700">{task.data_fim ? formatDateTime(task.data_fim) : 'Hoje'}</p>
                      <p className="mt-1 text-[12px] font-semibold text-emerald-900">{task.cliente || `Reserva ${task.reserva_id}`}</p>
                      <p className="mt-1 text-[10px] font-medium tracking-[0.01em] text-emerald-700">{task.situacao_nome || task.resultado || 'Concluída'}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] font-medium text-slate-500">
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
  const [detailViewDirection, setDetailViewDirection] = useState('forward');
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
        analytics: {
          total_periodo: 0,
          por_dia: [],
          por_mes: [],
          por_situacao: [],
          por_situacao_por_dia: [],
          por_situacao_por_mes: [],
        },
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

  const openAnalystDetail = (analystId) => {
    setDetailViewDirection('forward');
    setSelectedAnalystId(analystId);
  };

  const closeAnalystDetail = () => {
    setDetailViewDirection('backward');
    setSelectedAnalystId(null);
  };

  return (
    <>
      <div
        key={selectedAnalyst ? `detail-${selectedAnalyst.analista_id}` : 'list-view'}
        className={`analyst-detail-transition ${detailViewDirection === 'forward' ? 'is-forward' : 'is-backward'}`}
      >
      {selectedAnalyst ? (
        <div className="space-y-4 md:space-y-5 animate-in fade-in duration-300">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-[11px] font-medium text-slate-600 inline-flex items-center gap-2 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.5)]">
            <span className="text-slate-400">Processo Analítico da Equipe</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#0071e3] font-semibold truncate max-w-[220px]">{selectedAnalyst.nome}</span>
          </div>
          <AnalystDetailModal
            analyst={selectedAnalyst}
            currentTasks={currentTasksByAnalyst[selectedAnalyst.analista_id] || []}
            recentCompletions={(recentCompletionsByAnalyst[selectedAnalyst.analista_id] || []).slice(0, 6)}
            onClose={closeAnalystDetail}
            asInline
          />
        </div>
      ) : (
      <div className="space-y-5 md:space-y-6">

      <section className="rounded-[1.6rem] border border-slate-200/80 bg-white/85 p-5 md:p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm">
        <div className="mb-7 flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5"><BarChart3 size={16} className="text-[#0071e3]" /><h3 className="text-[11px] font-semibold tracking-[0.06em] text-slate-700">Fluxo por Situação</h3></div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${isSyncing ? 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}><RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''}/> {isSyncing ? 'Sincronizando' : 'Sincronizado'}</div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${monitorStyle}`}>
            <CheckSquare size={11} />
            {monitorLabelByScope[syncScope] || 'Monitoramento indisponível'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${hasSyncFailures ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            <AlertTriangle size={11} />
            Falhas: {managerSyncStatus?.situacoes_falharam?.length || 0}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-slate-50 text-slate-600 border-slate-200">
            <Hash size={11} />
            Removidas: {managerSyncStatus?.removidas_na_limpeza || 0}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(SITUACOES_MAP).map(([id, nome]) => {
            const sitStyle = SIT_COLORS[id] || { text: '#0f172a', bg: '#f8fafc' };
            return (
              <div key={id} className="p-3 rounded-xl border text-center transition-all hover:-translate-y-0.5 hover:shadow-sm" style={{ backgroundColor: sitStyle.bg, borderColor: sitStyle.bg }}>
                <p className="text-[7px] font-bold uppercase leading-tight mb-1 h-5 overflow-hidden line-clamp-2" style={{ color: sitStyle.text, opacity: 0.8 }}>{nome}</p>
                <div className="text-lg md:text-xl font-black leading-none" style={{ color: sitStyle.text }}>{calculatedBreakdown[id] || 0}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/90 p-5 md:p-6 rounded-[1.35rem] border border-slate-200/80 flex items-center justify-between group hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgba(15,23,42,0.55)] transition-all">
          <div><p className="text-[10px] font-semibold text-slate-500 mb-1 tracking-[0.04em]">Pendente CRM</p><div className="text-4xl md:text-5xl font-semibold text-[#0071e3] leading-none">{dashData.total_pendente_cvcrm}</div></div>
          <Hash className="text-blue-50 opacity-20 shrink-0" size={48}/>
        </div>
        <div className="bg-rose-50/90 p-5 md:p-6 rounded-[1.35rem] border border-rose-200 flex items-center justify-between group hover:-translate-y-0.5 transition-all">
          <div><p className="text-[10px] font-semibold text-rose-500 mb-1 tracking-[0.04em]">Sem Destino</p><div className="text-4xl md:text-5xl font-semibold text-rose-600 leading-none">{dashData.pastas_sem_destino || 0}</div></div>
          <AlertTriangle className="text-red-200 opacity-70 shrink-0" size={48}/>
        </div>
        <div className="bg-[linear-gradient(140deg,#0071e3_0%,#005bb7_100%)] p-5 md:p-6 rounded-[1.35rem] shadow-[0_22px_36px_-22px_rgba(0,113,227,0.85)] flex items-center justify-between text-white group hover:-translate-y-0.5 transition-all">
          <div><p className="text-[10px] font-semibold text-blue-100 mb-1 tracking-[0.04em]">Equipe Online</p><div className="text-4xl md:text-5xl font-semibold leading-none">{dashData.equipe?.filter(a => a.is_online).length || 0}</div></div>
          <Users className="text-white opacity-20 shrink-0" size={48}/>
        </div>
      </section>

      <section className="bg-white/90 rounded-3xl md:rounded-4xl border border-slate-200/80 overflow-hidden shadow-[0_24px_45px_-30px_rgba(15,23,42,0.5)] backdrop-blur-sm">
        <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-[linear-gradient(140deg,#f8fafc_0%,#ffffff_100%)]">
          <div className="flex items-center gap-2"><PieChart size={18} className="text-[#0071e3]" /><h2 className="text-[11px] font-semibold tracking-[0.06em] text-slate-800">Processo Analítico da Equipe</h2></div>
          <button onClick={() => { setEditForm({id: null, nome: '', email: '', senha: '', permissoes: [62, 66, 30], status: 'ativo'}); setShowEditModal(true); }} className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#0077ed] hover:-translate-y-0.5 active:translate-y-0 shadow-[0_14px_24px_-16px_rgba(0,113,227,0.88)]"><UserPlus size={14}/> Novo Analista</button>
        </div>

        <div className="px-5 md:px-6 py-3 border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)]">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.03em] text-slate-600">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">Analistas: {teamProcessData.length}</span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">Fila ativa: {totalOnline}</span>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">Clique no nome para detalhes</span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-[12px] min-w-160">
            <thead className="text-[10px] text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/70 text-center tracking-[0.04em]">
              <tr>
                <th className="p-4 md:p-5 text-left">Analista</th>
                <th className="p-4 md:p-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamProcessData.length > 0 ? teamProcessData.map((analyst) => {
                return (
                  <tr key={analyst.analista_id} className="hover:bg-slate-50/80 transition-all group text-[12px] text-center">
                    <td className="p-4 md:p-5 text-left">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-600 shrink-0">
                          {getInitials(analyst.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button onClick={() => openAnalystDetail(analyst.analista_id)} className="flex flex-col text-left w-full max-w-72">
                            <span className="font-semibold text-slate-800 truncate hover:text-[#0071e3] transition">{analyst.nome}</span>
                            <span className="text-[10px] font-medium text-slate-500 truncate mt-0.5">{analyst.email || 'Sem e-mail'}</span>
                          </button>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold border ${analyst.is_online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                              {analyst.is_online ? 'Fila ativa' : 'Offline'}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold border border-slate-200 bg-white text-slate-600">
                              Recebidas: {analyst.recebidas_hoje || 0}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700">
                              Feitas: {analyst.feitas_hoje || 0}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                              Mesa: {analyst.na_mesa || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 md:p-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.6)]">
                      <button
                        disabled={togglingQueueIds.includes(analyst.analista_id)}
                        onClick={() => handleAdminQueueToggle({ ...analyst, id: analyst.analista_id })}
                        className={`p-2 rounded-xl border transition-all inline-flex items-center justify-center ${togglingQueueIds.includes(analyst.analista_id) ? 'animate-pulse opacity-80 cursor-wait' : ''} ${analyst.is_online ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100 hover:-translate-y-0.5 active:translate-y-0' : 'bg-green-600 text-white border-green-600 hover:bg-green-500 hover:-translate-y-0.5 active:translate-y-0'}`}
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
                        className="text-slate-400 hover:text-[#0071e3] p-2 transition-all inline-block hover:-translate-y-0.5 active:translate-y-0"
                        title="Editar analista"
                      >
                        <Edit3 size={14}/>
                      </button>
                      <button onClick={() => handleDeleteAnalyst({ id: analyst.analista_id, nome: analyst.nome })} className="text-slate-400 hover:text-red-500 p-2 transition-all inline-block hover:-translate-y-0.5 active:translate-y-0" title="Excluir analista">
                        <Trash2 size={14}/>
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={2} className="p-10 text-center text-[12px] font-bold text-slate-400">
                    Nenhum analista encontrado para exibir o processo analítico da equipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
      )}
      </div>
    </>
  );
};

export default ManagerDashboardTab;
