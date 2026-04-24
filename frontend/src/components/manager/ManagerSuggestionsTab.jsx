import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, MessageSquare, Search, SlidersHorizontal, X } from 'lucide-react';
import { SUGGESTION_STATUS_FLOW, getSuggestionStatusColor } from '../../utils/suggestions';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const truncate = (value, maxLength = 120) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
};

const ManagerSuggestionsTab = ({ suggestions, onUpdateStatus, onRespondSuggestion, isSubmitting }) => {
  const [savingById, setSavingById] = useState({});
  const [savingResponseById, setSavingResponseById] = useState({});
  const [selectedStatusById, setSelectedStatusById] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [responseModal, setResponseModal] = useState({
    open: false,
    suggestionId: null,
    title: '',
    draft: '',
    existingResponse: '',
  });

  const orderedSuggestions = useMemo(
    () => [...(suggestions || [])].sort((a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0)),
    [suggestions],
  );

  const summaryByStatus = useMemo(() => (
    orderedSuggestions.reduce((acc, item) => {
      const status = item?.status || 'Em análise';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  ), [orderedSuggestions]);

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return orderedSuggestions.filter((item) => {
      const status = item?.status || 'Em análise';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const title = String(item?.titulo || '').toLowerCase();
      const details = String(item?.detalhes || '').toLowerCase();
      const author = String(item?.autor_nome || '').toLowerCase();
      const response = String(item?.resposta_admin || '').toLowerCase();
      return (
        title.includes(normalizedSearch)
        || details.includes(normalizedSearch)
        || author.includes(normalizedSearch)
        || response.includes(normalizedSearch)
      );
    });
  }, [orderedSuggestions, searchTerm, statusFilter]);

  const handleStatusChange = (id, status) => {
    setSelectedStatusById((prev) => ({ ...prev, [id]: status }));
  };

  const handleSaveStatus = async (item) => {
    const id = item?.id;
    if (!id) return;
    const selected = selectedStatusById[id] || item?.status;
    if (!selected || selected === item?.status) return;

    setSavingById((prev) => ({ ...prev, [id]: true }));
    try {
      await onUpdateStatus(id, selected);
    } finally {
      setSavingById((prev) => ({ ...prev, [id]: false }));
    }
  };

  const openResponseModal = (item) => {
    setResponseModal({
      open: true,
      suggestionId: item?.id || null,
      title: String(item?.titulo || ''),
      draft: String(item?.resposta_admin || ''),
      existingResponse: String(item?.resposta_admin || ''),
    });
  };

  const closeResponseModal = () => {
    setResponseModal({
      open: false,
      suggestionId: null,
      title: '',
      draft: '',
      existingResponse: '',
    });
  };

  const handleSaveResponse = async () => {
    const suggestionId = responseModal.suggestionId;
    const draft = responseModal.draft.trim();
    if (!suggestionId || !draft) return;

    setSavingResponseById((prev) => ({ ...prev, [suggestionId]: true }));
    try {
      const result = await onRespondSuggestion(suggestionId, draft);
      if (result?.success) {
        closeResponseModal();
      }
    } finally {
      setSavingResponseById((prev) => ({ ...prev, [suggestionId]: false }));
    }
  };

  const isSavingModalResponse = Boolean(savingResponseById[responseModal.suggestionId]);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,#f8fbff_0%,#ffffff_46%,#f8fafc_100%)] p-5 md:p-7 shadow-[0_30px_60px_-42px_rgba(15,23,42,0.55)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-100/60 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/85 px-3 py-1 text-[10px] font-semibold tracking-[0.05em] text-slate-600">
            <ClipboardList size={12} className="text-blue-500" />
            Gestão de sugestões
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-900">Painel de priorização e andamento</h2>
          <p className="mt-2 max-w-3xl text-[13px] font-medium leading-relaxed text-slate-500">
            Atualize o status e responda as sugestões em modal para manter a listagem compacta.
          </p>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {SUGGESTION_STATUS_FLOW.map((status) => (
            <div key={status} className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{status}</p>
              <p className="mt-1 text-[18px] font-semibold leading-none text-slate-900">{summaryByStatus[status] || 0}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 lg:w-[360px]">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por título, detalhes, autor ou resposta"
              className="w-full border-none bg-transparent text-[12px] font-medium text-slate-700 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500">
              <SlidersHorizontal size={12} />
              Filtro
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-all ${statusFilter === 'all' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              Todos
            </button>
            {SUGGESTION_STATUS_FLOW.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-all ${statusFilter === status ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredSuggestions.length > 0 ? filteredSuggestions.map((item, index) => {
          const currentStatus = item?.status || 'Em análise';
          const selectedStatus = selectedStatusById[item?.id] || currentStatus;
          const isSavingStatus = Boolean(savingById[item?.id]);
          const canSaveStatus = selectedStatus !== currentStatus && !isSavingStatus && !isSubmitting && !item?.cancelada;
          const responsePreview = truncate(item?.resposta_admin, 140);

          return (
            <article
              key={item?.id || `${item?.titulo}-${index}`}
              className="group relative overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-28px_rgba(15,23,42,0.65)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#60a5fa_0%,#22d3ee_45%,#93c5fd_100%)] opacity-70" />

              <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <div className="min-w-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">Ordem de envio #{index + 1}</p>
                      <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-slate-900 break-words">{item?.titulo || 'Sem título'}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[10px] font-semibold ${getSuggestionStatusColor(currentStatus)}`}>
                        {currentStatus}
                      </span>
                      {item?.cancelada && (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-700">
                          Cancelada pelo analista
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">{item?.detalhes || '-'}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Autor: {item?.autor_nome || 'Analista'}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Enviado: {formatDateTime(item?.created_at)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Atualizado: {formatDateTime(item?.updated_at)}</span>
                  </div>

                  {responsePreview && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-600">Última resposta do admin</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{responsePreview}</p>
                      <p className="mt-1 text-[10px] font-medium text-slate-500">
                        {item?.resposta_admin_por_admin_nome || 'Admin'} - {formatDateTime(item?.resposta_admin_at)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Atualizar andamento</p>
                    <select
                      value={selectedStatus}
                      onChange={(event) => handleStatusChange(item?.id, event.target.value)}
                      disabled={item?.cancelada}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-700 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {SUGGESTION_STATUS_FLOW.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleSaveStatus(item)}
                      disabled={!canSaveStatus}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0071e3_0%,#0a84ff_100%)] px-3 py-2 text-[11px] font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <CheckCircle2 size={13} />
                      {isSavingStatus ? 'Salvando...' : 'Salvar status'}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      <MessageSquare size={12} />
                      Resposta do admin
                    </p>
                    <button
                      type="button"
                      onClick={() => openResponseModal(item)}
                      disabled={item?.cancelada || isSubmitting}
                      className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 transition-all hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {item?.resposta_admin ? 'Responder novamente' : 'Responder'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[1.7rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">Nenhuma sugestão para este filtro</p>
          </div>
        )}
      </section>

      {responseModal.open && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_28px_52px_-28px_rgba(15,23,42,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">Responder sugestão</h3>
                <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{responseModal.title || 'Sugestão sem título'}</p>
              </div>
              <button
                type="button"
                onClick={closeResponseModal}
                disabled={isSavingModalResponse}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:text-slate-700"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {responseModal.existingResponse && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Resposta atual</p>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">{responseModal.existingResponse}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">Nova resposta</label>
                <textarea
                  value={responseModal.draft}
                  onChange={(event) => setResponseModal((prev) => ({ ...prev, draft: event.target.value }))}
                  maxLength={3000}
                  rows={7}
                  placeholder="Escreva uma devolutiva clara para o analista..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[12px] font-medium text-slate-700 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70"
                />
                <p className="text-right text-[10px] font-medium text-slate-400">{responseModal.draft.length}/3000</p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeResponseModal}
                  disabled={isSavingModalResponse}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 transition-all hover:bg-slate-50"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSaveResponse}
                  disabled={isSavingModalResponse || isSubmitting || !responseModal.draft.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0071e3] px-4 py-2 text-[11px] font-semibold text-white transition-all hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSavingModalResponse ? 'Salvando...' : 'Salvar resposta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerSuggestionsTab;
