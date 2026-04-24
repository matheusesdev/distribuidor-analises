import React, { useMemo, useState } from 'react';
import { Ban, Lightbulb, MessageSquarePlus, PencilLine, Search, Send, Trash2, X } from 'lucide-react';
import { getSuggestionStatusColor } from '../../utils/suggestions';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const AnalystSuggestionsTab = ({
  suggestions,
  onCreateSuggestion,
  onUpdateSuggestion,
  onCancelSuggestion,
  onDeleteSuggestion,
  isSubmitting,
  currentUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [isSavingModal, setIsSavingModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isActingById, setIsActingById] = useState({});

  const orderedSuggestions = useMemo(
    () => [...(suggestions || [])].sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0)),
    [suggestions],
  );

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return orderedSuggestions;
    return orderedSuggestions.filter((item) => {
      const title = String(item?.titulo || '').toLowerCase();
      const details = String(item?.detalhes || '').toLowerCase();
      const response = String(item?.resposta_admin || '').toLowerCase();
      return title.includes(normalizedSearch) || details.includes(normalizedSearch) || response.includes(normalizedSearch);
    });
  }, [orderedSuggestions, searchTerm]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingSuggestion(null);
    setTitulo('');
    setDetalhes('');
    setIsModalOpen(true);
  };

  const openEditModal = (suggestion) => {
    setModalMode('edit');
    setEditingSuggestion(suggestion);
    setTitulo(String(suggestion?.titulo || ''));
    setDetalhes(String(suggestion?.detalhes || ''));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSavingModal) return;
    setIsModalOpen(false);
    setEditingSuggestion(null);
    setTitulo('');
    setDetalhes('');
  };

  const markAction = (id, value) => {
    setIsActingById((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const tituloLimpo = titulo.trim();
    const detalhesLimpo = detalhes.trim();
    if (!tituloLimpo || !detalhesLimpo) return;

    setIsSavingModal(true);
    try {
      if (modalMode === 'edit' && editingSuggestion?.id) {
        const result = await onUpdateSuggestion(editingSuggestion.id, { titulo: tituloLimpo, detalhes: detalhesLimpo });
        if (result?.success) closeModal();
        return;
      }

      const result = await onCreateSuggestion({ titulo: tituloLimpo, detalhes: detalhesLimpo });
      if (result?.success) closeModal();
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleCancel = async (item) => {
    if (!item?.id || item?.cancelada) return;
    const confirmed = window.confirm('Deseja realmente cancelar esta sugestão?');
    if (!confirmed) return;

    markAction(item.id, true);
    try {
      await onCancelSuggestion(item.id);
    } finally {
      markAction(item.id, false);
    }
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const confirmed = window.confirm('Deseja realmente excluir esta sugestão? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    markAction(item.id, true);
    try {
      await onDeleteSuggestion(item.id);
    } finally {
      markAction(item.id, false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,#f8fbff_0%,#ffffff_52%,#f8fafc_100%)] p-5 md:p-7 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.6)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold tracking-[0.05em] text-slate-600">
              <Lightbulb size={12} className="text-blue-500" />
              Minhas Sugestões
            </div>
            <h2 className="mt-3 text-xl md:text-2xl font-semibold tracking-[-0.015em] text-slate-900">Envie e acompanhe suas melhorias</h2>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500">
              Abra uma sugestão com título e detalhes. Você pode editar, cancelar ou excluir suas próprias sugestões.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0071e3] px-4 py-2.5 text-[11px] font-semibold text-white shadow-[0_14px_26px_-18px_rgba(0,113,227,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[#0077ed]"
          >
            <MessageSquarePlus size={14} />
            Enviar sugestão
          </button>
        </div>
      </section>

      <section className="rounded-[1.7rem] border border-slate-200/80 bg-white p-4 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.5)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 md:w-[380px]">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por título, detalhes ou resposta"
              className="w-full border-none bg-transparent text-[12px] font-medium text-slate-700 outline-none"
            />
          </div>
          <div className="text-[11px] font-semibold text-slate-500">
            {filteredSuggestions.length} sugestão{filteredSuggestions.length !== 1 ? 'ões' : ''} encontrada{filteredSuggestions.length !== 1 ? 's' : ''}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredSuggestions.length > 0 ? filteredSuggestions.map((item, index) => {
          const isCanceled = Boolean(item?.cancelada);
          const isBusy = Boolean(isActingById[item?.id]) || isSubmitting;
          return (
            <article
              key={item?.id || `${item?.titulo}-${index}`}
              className="rounded-[1.7rem] border border-slate-200/80 bg-white p-4 md:p-5 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.52)]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Sugestão #{filteredSuggestions.length - index}</p>
                  <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-slate-900 break-words">{item?.titulo || 'Sem título'}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold ${getSuggestionStatusColor(item?.status)}`}>
                    {item?.status || 'Em análise'}
                  </span>
                  {isCanceled && (
                    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-700">
                      Cancelada
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">{item?.detalhes || '-'}</p>

              {item?.resposta_admin && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-600">Resposta do Admin</p>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">{item?.resposta_admin}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">
                    {item?.resposta_admin_por_admin_nome || 'Admin'} • {formatDateTime(item?.resposta_admin_at)}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Autor: {item?.autor_nome || currentUser?.nome || 'Analista'}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Enviado: {formatDateTime(item?.created_at)}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Atualizado: {formatDateTime(item?.updated_at)}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  disabled={isCanceled || isBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <PencilLine size={13} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(item)}
                  disabled={isCanceled || isBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Ban size={13} />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Trash2 size={13} />
                  Excluir
                </button>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[1.7rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">Nenhuma sugestão enviada ainda</p>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_28px_52px_-28px_rgba(15,23,42,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {modalMode === 'edit' ? 'Editar sugestão' : 'Enviar sugestão de melhoria'}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  {modalMode === 'edit'
                    ? 'Atualize título e detalhes para refinar sua sugestão.'
                    : 'Descreva a ideia de forma objetiva para facilitar a análise.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSavingModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:text-slate-700"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(event) => setTitulo(event.target.value)}
                  maxLength={180}
                  placeholder="Ex.: Melhorar filtro por empreendimento"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[12px] font-medium text-slate-700 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70"
                  required
                />
                <p className="text-right text-[10px] font-medium text-slate-400">{titulo.length}/180</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">Detalhes</label>
                <textarea
                  value={detalhes}
                  onChange={(event) => setDetalhes(event.target.value)}
                  maxLength={3000}
                  rows={7}
                  placeholder="Descreva o cenário atual, o que deve melhorar e o impacto esperado."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[12px] font-medium text-slate-700 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70"
                  required
                />
                <p className="text-right text-[10px] font-medium text-slate-400">{detalhes.length}/3000</p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSavingModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 transition-all hover:bg-slate-50"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={isSavingModal || isSubmitting || !titulo.trim() || !detalhes.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0071e3] px-4 py-2 text-[11px] font-semibold text-white transition-all hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  <Send size={13} />
                  {isSavingModal ? 'Salvando...' : modalMode === 'edit' ? 'Salvar alterações' : 'Criar sugestão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalystSuggestionsTab;
