import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, CheckSquare, ChevronDown, Search, Square, Tag, UserCheck } from 'lucide-react';

const MesaView = ({
  filteredTasks,
  selectedTaskIds,
  toggleSelectAll,
  openBulkTransferModal,
  taskSearch,
  setTaskSearch,
  filterSit,
  setFilterSit,
  SITUACOES_MAP,
  SIT_COLORS,
  toggleTaskSelection,
  openReservaInCRM,
  getReservaDisplayId,
  openTransferModal,
  handleFinish,
}) => {
  const [isSituacaoMenuOpen, setIsSituacaoMenuOpen] = useState(false);
  const [finishingTaskIds, setFinishingTaskIds] = useState(() => new Set());
  const [concludedFxTaskIds, setConcludedFxTaskIds] = useState(() => new Set());
  const situacaoMenuRef = useRef(null);
  const concludedFxTimersRef = useRef(new Map());

  const situacaoOptions = useMemo(() => {
    return [
      { id: 'all', nome: 'Todas situações' },
      ...Object.entries(SITUACOES_MAP).map(([id, nome]) => ({ id, nome })),
    ];
  }, [SITUACOES_MAP]);

  const selectedSituacaoLabel = useMemo(() => {
    if (filterSit === 'all') return 'Todas situações';
    return SITUACOES_MAP[filterSit] || 'Todas situações';
  }, [filterSit, SITUACOES_MAP]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!situacaoMenuRef.current) return;
      if (!situacaoMenuRef.current.contains(event.target)) {
        setIsSituacaoMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      concludedFxTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      concludedFxTimersRef.current.clear();
    };
  }, []);

  const markTaskAsConcludedFx = (taskId) => {
    setConcludedFxTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    if (concludedFxTimersRef.current.has(taskId)) {
      clearTimeout(concludedFxTimersRef.current.get(taskId));
    }

    const timerId = setTimeout(() => {
      setConcludedFxTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      concludedFxTimersRef.current.delete(taskId);
    }, 1500);

    concludedFxTimersRef.current.set(taskId, timerId);
  };

  const handleConcludeTask = async (taskId) => {
    if (finishingTaskIds.has(taskId)) return;

    setFinishingTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    const result = await handleFinish(taskId, 'Concluido');

    if (result?.success) {
      // Dispara o feedback visual somente quando a conclusão realmente foi confirmada no backend.
      markTaskAsConcludedFx(taskId);
    }

    setFinishingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });

    return result;
  };

  const formatQuadraUnidade = (task) => {
    const quadra = task.quadra || task.quadra_nome || task.bloco || '';
    const unidade = task.unidade || task.unidade_nome || task.lote || '';

    if (quadra && unidade) return `QUADRA ${quadra} / ${unidade}`;
    if (quadra) return `QUADRA ${quadra}`;
    if (unidade) return String(unidade);
    return 'QUADRA / UNIDADE NÃO INFORMADA';
  };

  return (
    <div className="space-y-4 md:space-y-5 min-w-0">
      <section className="space-y-4 md:space-y-5 min-w-0">
        <div className="relative z-40 overflow-visible rounded-3xl border border-slate-200/80 bg-white/90 p-4 md:p-5 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.65)] backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-[#0071e3] border border-blue-100">
                <UserCheck size={15} />
              </span>
              <h2 className="text-[12px] font-semibold tracking-widest text-slate-700">Minha Mesa</h2>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                {filteredTasks.length} ativas
              </span>
              {filteredTasks.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-all hover:border-blue-200 hover:text-[#0071e3]"
                >
                  {selectedTaskIds.size === filteredTasks.length ? <CheckSquare size={12} className="text-[#0071e3]" /> : <Square size={12} />}
                  {selectedTaskIds.size === filteredTasks.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
              )}
              {selectedTaskIds.size > 0 && (
                <button
                  onClick={openBulkTransferModal}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] px-3 py-1.5 text-[10px] font-semibold text-white shadow-[0_14px_26px_-18px_rgba(0,113,227,0.85)] transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <ArrowRightLeft size={12} />
                  Transferir {selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-w-0">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, reserva ou empreendimento"
                  className="bg-transparent border-none outline-none text-[12px] font-medium text-slate-700 w-full"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                />
              </div>
              <div ref={situacaoMenuRef} className="relative z-50">
                <button
                  type="button"
                  onClick={() => setIsSituacaoMenuOpen((prev) => !prev)}
                  className="inline-flex min-w-55 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600 outline-none transition-all hover:border-sky-300 focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70"
                  aria-haspopup="listbox"
                  aria-expanded={isSituacaoMenuOpen}
                >
                  <span className="truncate text-left">{selectedSituacaoLabel}</span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${isSituacaoMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSituacaoMenuOpen && (
                  <div className="absolute right-0 z-60 mt-1.5 max-h-72 min-w-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_38px_-24px_rgba(15,23,42,0.65)]">
                    <ul className="space-y-1" role="listbox" aria-label="Filtrar por situação">
                      {situacaoOptions.map((option) => {
                        const isSelected = String(filterSit) === String(option.id);
                        return (
                          <li key={option.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setFilterSit(String(option.id));
                                setIsSituacaoMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold transition-all ${isSelected ? 'bg-blue-50 text-[#0071e3]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <span className="truncate">{option.nome}</span>
                              {isSelected && <CheckSquare size={13} className="shrink-0" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-0 space-y-3">
          {filteredTasks.length > 0 && (
            <div className="hidden xl:grid xl:grid-cols-[88px_110px_minmax(180px,1.35fr)_minmax(220px,1.45fr)_minmax(210px,1.3fr)_96px_112px] gap-3 px-4 py-2 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              <span className="text-center">Selecionar</span>
              <span className="text-center">#ID</span>
              <span className="text-center">Nome do cliente</span>
              <span className="text-center">Empreendimento</span>
              <span className="text-center">Situação</span>
              <span className="text-center" aria-hidden="true"></span>
              <span className="text-center" aria-hidden="true"></span>
            </div>
          )}

          {filteredTasks.length > 0 ? filteredTasks.map((task) => {
            const sitStyle = SIT_COLORS[task.situacao_id] || { text: '#2563eb', bg: '#eff6ff' };
            const isSelected = selectedTaskIds.has(task.reserva_id);
            const isFinishing = finishingTaskIds.has(task.reserva_id);
            const isConcludedFx = concludedFxTaskIds.has(task.reserva_id);
            const displayReservaId = getReservaDisplayId ? getReservaDisplayId(task.reserva_id) : task.reserva_id;

            return (
              <article
                key={task.reserva_id}
                className={`relative overflow-hidden rounded-3xl border bg-white/90 p-3.5 md:p-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-30px_rgba(15,23,42,0.95)] cursor-pointer ${isConcludedFx ? 'border-emerald-300 ring-4 ring-emerald-100/80' : isSelected ? 'border-blue-300 ring-4 ring-blue-100/70' : 'border-slate-200/70'}`}
                onClick={() => openReservaInCRM(task.reserva_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openReservaInCRM(task.reserva_id);
                  }
                }}
                title="Abrir pasta no CRM"
              >
                {isConcludedFx && (
                  <div className="pointer-events-none absolute inset-0 bg-emerald-100/65 animate-pulse" />
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[88px_110px_minmax(180px,1.35fr)_minmax(220px,1.45fr)_minmax(210px,1.3fr)_96px_112px] gap-3 md:gap-4 items-start xl:items-center xl:justify-items-center">
                  <div className="min-w-0 xl:text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskSelection(task.reserva_id);
                      }}
                      className={`inline-flex items-center justify-center rounded-xl border px-2.5 py-2 text-[13px] font-semibold transition-all ${isSelected ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                      title={isSelected ? 'Desmarcar seleção' : 'Selecionar para transferência em massa'}
                    >
                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">#ID</p>
                    <p className="text-[13px] font-semibold text-slate-900 xl:text-center">#{displayReservaId}</p>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Nome do cliente</p>
                    <p className="truncate text-[13px] font-semibold text-slate-900 xl:text-center" title={task.cliente}>{task.cliente || 'Cliente não informado'}</p>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Empreendimento</p>
                    <p className="truncate text-[13px] font-semibold text-slate-900 xl:text-center">{task.empreendimento || 'Empreendimento não informado'}</p>
                    <p className="mt-1 truncate text-[13px] font-medium text-slate-500 uppercase xl:text-center">{formatQuadraUnidade(task)}</p>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Situação</p>
                    <span
                      className="inline-flex max-w-55 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold xl:mx-auto"
                      style={{ backgroundColor: sitStyle.bg, color: sitStyle.text, borderColor: sitStyle.bg }}
                      title={task.situacao_nome || 'Geral'}
                    >
                      <Tag size={13} className="shrink-0" />
                      <span className="block min-w-0 truncate">{task.situacao_nome || 'Geral'}</span>
                    </span>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:justify-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Concluir</p>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleConcludeTask(task.reserva_id);
                      }}
                      disabled={isFinishing}
                      className={`inline-flex min-w-20 items-center justify-center whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${isFinishing ? 'cursor-not-allowed border-emerald-200 bg-emerald-100 text-emerald-700/80' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                      title="Concluir pasta"
                    >
                      {isFinishing ? 'Concluindo...' : 'Concluir'}
                    </button>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:justify-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Transferir</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openTransferModal(task);
                      }}
                      className="inline-flex min-w-20 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 transition-all hover:bg-blue-100"
                      title="Transferir pasta"
                    >
                      <ArrowRightLeft size={11} />
                      Transferir
                    </button>
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="rounded-4xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
              <CheckCircle2 size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">Mesa livre no momento</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MesaView;
