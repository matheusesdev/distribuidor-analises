import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, CheckSquare, ChevronDown, HelpCircle, Search, Square, Tag, UserCheck } from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { normalizeUiText } from '../../utils/textEncoding';

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
  const [taskContextMenu, setTaskContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    task: null,
  });
  const [contextClickFx, setContextClickFx] = useState({
    visible: false,
    x: 0,
    y: 0,
  });
  const situacaoMenuRef = useRef(null);
  const concludedFxTimersRef = useRef(new Map());
  const taskContextMenuRef = useRef(null);
  const contextClickFxTimerRef = useRef(null);
  const tourDriverRef = useRef(null);

  const situacaoOptions = useMemo(() => {
    return [
      { id: 'all', nome: 'Todas situações' },
      ...Object.entries(SITUACOES_MAP).map(([id, nome]) => ({ id, nome: normalizeUiText(nome) })),
    ];
  }, [SITUACOES_MAP]);

  const selectedSituacaoLabel = useMemo(() => {
    if (filterSit === 'all') return 'Todas situações';
    return normalizeUiText(SITUACOES_MAP[filterSit] || 'Todas situações');
  }, [filterSit, SITUACOES_MAP]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!situacaoMenuRef.current) return;
      if (!situacaoMenuRef.current.contains(event.target)) {
        setIsSituacaoMenuOpen(false);
      }

      if (taskContextMenuRef.current && !taskContextMenuRef.current.contains(event.target)) {
        setTaskContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const closeContextMenu = () => setTaskContextMenu((prev) => ({ ...prev, visible: false }));
    const handleEsc = (event) => {
      if (event.key === 'Escape') closeContextMenu();
    };

    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', closeContextMenu);
    document.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('resize', closeContextMenu);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tourDriverRef.current) {
        tourDriverRef.current.destroy();
        tourDriverRef.current = null;
      }
      concludedFxTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      concludedFxTimersRef.current.clear();
      if (contextClickFxTimerRef.current) {
        clearTimeout(contextClickFxTimerRef.current);
      }
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

  const openTaskContextMenu = (event, task) => {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 196;
    const menuHeight = 104;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const x = Math.min(event.clientX, Math.max(8, viewportWidth - menuWidth - 8));
    const y = Math.min(event.clientY, Math.max(8, viewportHeight - menuHeight - 8));

    setContextClickFx({
      visible: true,
      x: event.clientX,
      y: event.clientY,
    });
    if (contextClickFxTimerRef.current) {
      clearTimeout(contextClickFxTimerRef.current);
    }
    contextClickFxTimerRef.current = setTimeout(() => {
      setContextClickFx((prev) => ({ ...prev, visible: false }));
      contextClickFxTimerRef.current = null;
    }, 420);

    setTaskContextMenu({
      visible: true,
      x,
      y,
      task,
    });
  };

  const formatQuadraUnidade = (task) => {
    const quadra = task.quadra || task.quadra_nome || task.bloco || '';
    const unidade = task.unidade || task.unidade_nome || task.lote || '';

    if (quadra && unidade) return `QUADRA ${quadra} / ${unidade}`;
    if (quadra) return `QUADRA ${quadra}`;
    if (unidade) return String(unidade);
    return 'QUADRA / UNIDADE NÃO INFORMADA';
  };

  const openAnimatedTour = () => {
    if (tourDriverRef.current) {
      tourDriverRef.current.destroy();
      tourDriverRef.current = null;
    }

    const has = (selector) => Boolean(document.querySelector(selector));
    const steps = [];

    if (has('[data-tour="mesa-header"]')) {
      steps.push({
        element: '[data-tour="mesa-header"]',
        popover: {
          title: 'Visão geral da sua mesa',
          description: 'Aqui você acompanha todas as pastas ativas e as ações principais da análise.',
          side: 'bottom',
          align: 'start',
        },
      });
    }

    if (has('[data-tour="mesa-search"]')) {
      steps.push({
        element: '[data-tour="mesa-search"]',
        popover: {
          title: 'Busca rápida',
          description: 'Use a busca para localizar cliente, reserva ou empreendimento em segundos.',
          side: 'bottom',
          align: 'start',
        },
      });
    }

    if (has('[data-tour="mesa-filter"]')) {
      steps.push({
        element: '[data-tour="mesa-filter"]',
        popover: {
          title: 'Filtro por situação',
          description: 'Refine a fila exibindo somente o status que deseja analisar no momento.',
          side: 'left',
          align: 'center',
        },
      });
    }

    if (has('[data-tour="analyst-auto-update"]')) {
      steps.push({
        element: '[data-tour="analyst-auto-update"]',
        popover: {
          title: 'Atualização automática',
          description: 'Este indicador mostra o tempo da próxima sincronização. Com a fila ativa, os dados atualizam automaticamente.',
          side: 'bottom',
          align: 'end',
        },
      });
    }

    if (has('[data-tour="analyst-pause-toggle"]')) {
      steps.push({
        element: '[data-tour="analyst-pause-toggle"]',
        popover: {
          title: 'Pausar ou ligar fila',
          description: 'Use este botão para pausar o recebimento de novas pastas ou religar sua fila quando estiver disponível.',
          side: 'bottom',
          align: 'center',
        },
      });
    }

    if (has('[data-tour="analyst-tab-mesa"]')) {
      steps.push({
        element: '[data-tour="analyst-tab-mesa"]',
        popover: {
          title: 'Aba Mesa',
          description: 'Aqui você executa o fluxo operacional diário: buscar, filtrar, concluir e transferir pastas.',
          side: 'bottom',
          align: 'center',
        },
      });
    }

    if (has('[data-tour="analyst-tab-analytics"]')) {
      steps.push({
        element: '[data-tour="analyst-tab-analytics"]',
        popover: {
          title: 'Aba Analítico',
          description: 'Nessa aba você acompanha sua produção com indicadores e pode exportar relatórios em Excel e PDF.',
          side: 'bottom',
          align: 'center',
        },
      });
    }

    if (has('[data-tour="analyst-tab-settings"]')) {
      steps.push({
        element: '[data-tour="analyst-tab-settings"]',
        popover: {
          title: 'Aba Config',
          description: 'Use Config para manter sua conta segura, especialmente para atualizar sua senha quando necessário.',
          side: 'bottom',
          align: 'center',
        },
      });
    }

    if (has('[data-tour="mesa-select-all"]')) {
      steps.push({
        element: '[data-tour="mesa-select-all"]',
        popover: {
          title: 'Seleção em massa',
          description: 'Selecione todas as pastas visíveis para executar ações em lote com mais agilidade.',
          side: 'bottom',
          align: 'start',
        },
      });
    }

    if (has('[data-tour="mesa-bulk-transfer"]')) {
      steps.push({
        element: '[data-tour="mesa-bulk-transfer"]',
        popover: {
          title: 'Transferência em lote',
          description: 'Quando houver seleção, transfira várias pastas para outro analista com um único clique.',
          side: 'bottom',
          align: 'start',
        },
      });
    }

    if (has('[data-tour="mesa-card"]')) {
      steps.push({
        element: '[data-tour="mesa-card"]',
        popover: {
          title: 'Cartão de pasta',
          description: 'Cada cartão traz os dados da reserva, situação atual e atalhos para suas ações.',
          side: 'top',
          align: 'start',
        },
      });
    }

    if (has('[data-tour="mesa-conclude"]')) {
      steps.push({
        element: '[data-tour="mesa-conclude"]',
        popover: {
          title: 'Concluir análise',
          description: 'Finalize uma pasta quando a validação estiver encerrada. O status será atualizado na fila.',
          side: 'left',
          align: 'center',
        },
      });
    }

    if (has('[data-tour="mesa-transfer"]')) {
      steps.push({
        element: '[data-tour="mesa-transfer"]',
        popover: {
          title: 'Transferir pasta',
          description: 'Use este botão para encaminhar uma pasta específica para outro responsável.',
          side: 'left',
          align: 'center',
        },
      });
    }

    steps.push({
      popover: {
        title: 'Pronto para analisar',
        description: 'Sempre que quiser, clique na interrogação para revisar este guia.',
        side: 'top',
        align: 'center',
      },
    });

    const instance = driver({
      animate: true,
      smoothScroll: true,
      allowClose: true,
      showProgress: true,
      nextBtnText: 'Próximo',
      prevBtnText: 'Voltar',
      doneBtnText: 'Finalizar',
      popoverClass: 'mesa-driver-popover',
      stagePadding: 8,
      stageRadius: 14,
      steps,
    });

    tourDriverRef.current = instance;
    instance.drive();
  };

  return (
    <div className="space-y-3 min-w-0">
      <section className="space-y-3 min-w-0">
        <div
          className="relative z-40 overflow-visible rounded-2xl border border-slate-200 bg-white p-3 md:p-4"
          data-tour="mesa-header"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0071e3] border border-blue-100">
                <UserCheck size={15} />
              </span>
              <h2 className="text-[13px] font-semibold text-slate-700">Minha mesa</h2>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                {filteredTasks.length} ativas
              </span>
              {filteredTasks.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  data-tour="mesa-select-all"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-blue-200 hover:text-[#0071e3]"
                >
                  {selectedTaskIds.size === filteredTasks.length ? <CheckSquare size={12} className="text-[#0071e3]" /> : <Square size={12} />}
                  {selectedTaskIds.size === filteredTasks.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
              )}
              {selectedTaskIds.size > 0 && (
                <button
                  onClick={openBulkTransferModal}
                  data-tour="mesa-bulk-transfer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3] px-3 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-[#0077ed] active:translate-y-0"
                >
                  <ArrowRightLeft size={12} />
                  Transferir {selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''}
                </button>
              )}
              <button
                type="button"
                onClick={openAnimatedTour}
                data-tour="mesa-help"
                className="mesa-help-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-200 hover:text-[#0071e3] focus:border-blue-300 focus:text-[#0071e3] focus:outline-none focus:ring-3 focus:ring-blue-100"
                title="Abrir guia da mesa"
                aria-label="Abrir guia da mesa"
              >
                <HelpCircle size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 min-w-0" data-tour="mesa-search">
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
                  data-tour="mesa-filter"
                  className="inline-flex min-w-55 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 outline-none transition-all hover:border-sky-300 focus:border-sky-300 focus:ring-3 focus:ring-sky-100/70"
                  aria-haspopup="listbox"
                  aria-expanded={isSituacaoMenuOpen}
                >
                  <span className="truncate text-left">{selectedSituacaoLabel}</span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${isSituacaoMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSituacaoMenuOpen && (
                  <div className="absolute right-0 z-60 mt-1.5 max-h-72 min-w-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
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

          {filteredTasks.length > 0 ? filteredTasks.map((task, index) => {
            const sitStyle = SIT_COLORS[task.situacao_id] || { text: '#2563eb', bg: '#eff6ff' };
            const isSelected = selectedTaskIds.has(task.reserva_id);
            const isFinishing = finishingTaskIds.has(task.reserva_id);
            const isConcludedFx = concludedFxTaskIds.has(task.reserva_id);
            const displayReservaId = getReservaDisplayId ? getReservaDisplayId(task.reserva_id) : task.reserva_id;

            return (
              <article
                key={task.reserva_id}
                className={`relative overflow-hidden rounded-xl border bg-white p-2.5 md:p-3 transition-colors hover:bg-slate-50/70 cursor-pointer ${isConcludedFx ? 'border-emerald-300 ring-2 ring-emerald-100/80' : isSelected ? 'border-blue-300 ring-2 ring-blue-100/70' : 'border-slate-200'}`}
                onClick={() => openReservaInCRM(task.reserva_id)}
                onContextMenu={(event) => openTaskContextMenu(event, task)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openReservaInCRM(task.reserva_id);
                  }
                }}
                data-tour={index === 0 ? 'mesa-card' : undefined}
                title="Abrir pasta no CRM"
              >
                {isConcludedFx && (
                  <div className="pointer-events-none absolute inset-0 bg-emerald-100/65 animate-pulse" />
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[88px_110px_minmax(180px,1.35fr)_minmax(220px,1.45fr)_minmax(210px,1.3fr)_96px_112px] gap-2 md:gap-3 items-start xl:items-center xl:justify-items-center">
                  <div className="min-w-0 xl:text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskSelection(task.reserva_id);
                      }}
                      className={`inline-flex items-center justify-center rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-all ${isSelected ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                      title={isSelected ? 'Desmarcar seleção' : 'Selecionar para transferência em massa'}
                    >
                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">#ID</p>
                    <p className="text-[12px] font-semibold text-slate-900 xl:text-center">#{displayReservaId}</p>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Nome do cliente</p>
                    <p className="truncate text-[12px] font-semibold text-slate-900 xl:text-center" title={task.cliente}>{task.cliente || 'Cliente não informado'}</p>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Empreendimento</p>
                    <p className="truncate text-[12px] font-semibold text-slate-900 xl:text-center">{task.empreendimento || 'Empreendimento não informado'}</p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 xl:text-center">{formatQuadraUnidade(task)}</p>
                  </div>

                  <div className="min-w-0 xl:w-full xl:flex xl:flex-col xl:items-center xl:text-center">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 xl:hidden uppercase">Situação</p>
                    <span
                      className="inline-flex max-w-55 items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium xl:mx-auto"
                      style={{ backgroundColor: sitStyle.bg, color: sitStyle.text, borderColor: sitStyle.bg }}
                      title={normalizeUiText(task.situacao_nome || 'Geral')}
                    >
                      <Tag size={13} className="shrink-0" />
                      <span className="block min-w-0 truncate">{normalizeUiText(task.situacao_nome || 'Geral')}</span>
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
                      data-tour={index === 0 ? 'mesa-conclude' : undefined}
                      className={`inline-flex min-w-18 items-center justify-center whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${isFinishing ? 'cursor-not-allowed border-emerald-200 bg-emerald-100 text-emerald-700/80' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
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
                      data-tour={index === 0 ? 'mesa-transfer' : undefined}
                      className="inline-flex min-w-18 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 transition-all hover:bg-blue-100"
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

      {taskContextMenu.visible && taskContextMenu.task && (
        <div
          ref={taskContextMenuRef}
          className="context-menu-apple fixed z-[160] min-w-[188px] rounded-2xl border border-slate-200/90 bg-white/92 p-1.5 shadow-[0_22px_44px_-24px_rgba(15,23,42,0.85)] backdrop-blur-xl"
          style={{ left: taskContextMenu.x, top: taskContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={async () => {
              setTaskContextMenu((prev) => ({ ...prev, visible: false }));
              await handleConcludeTask(taskContextMenu.task.reserva_id);
            }}
            disabled={finishingTaskIds.has(taskContextMenu.task.reserva_id)}
            className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold transition-all ${
              finishingTaskIds.has(taskContextMenu.task.reserva_id)
                ? 'bg-emerald-50 text-emerald-600 cursor-not-allowed'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 size={14} />
            {finishingTaskIds.has(taskContextMenu.task.reserva_id) ? 'Concluindo...' : 'Concluir'}
          </button>

          <button
            type="button"
            onClick={() => {
              setTaskContextMenu((prev) => ({ ...prev, visible: false }));
              openTransferModal(taskContextMenu.task);
            }}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold text-blue-700 transition-all hover:bg-blue-50"
          >
            <ArrowRightLeft size={14} />
            Transferir
          </button>
        </div>
      )}

      {contextClickFx.visible && (
        <span
          className="context-click-fx fixed z-[159] pointer-events-none"
          style={{ left: contextClickFx.x, top: contextClickFx.y }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default MesaView;

