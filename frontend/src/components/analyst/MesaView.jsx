import React from 'react';
import { ArrowRightLeft, Building2, CheckCircle2, CheckSquare, Search, Square, Tag, UserCheck } from 'lucide-react';

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
}) => (
  <div className="space-y-4 md:space-y-5 min-w-0">
    <section className="space-y-4 md:space-y-5 min-w-0">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 md:p-5 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.65)] backdrop-blur-sm">
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
            <select
              value={filterSit}
              onChange={(e) => setFilterSit(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100/70"
            >
              <option value="all">Todas situações</option>
              {Object.entries(SITUACOES_MAP).map(([id, nome]) => (<option key={id} value={id}>{nome}</option>))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length > 0 ? filteredTasks.map((task) => {
          const sitStyle = SIT_COLORS[task.situacao_id] || { text: '#2563eb', bg: '#eff6ff' };
          const isSelected = selectedTaskIds.has(task.reserva_id);
          const displayReservaId = getReservaDisplayId ? getReservaDisplayId(task.reserva_id) : task.reserva_id;

          return (
            <article
              key={task.reserva_id}
              className={`rounded-3xl border bg-white/90 p-3.5 md:p-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-30px_rgba(15,23,42,0.95)] ${isSelected ? 'border-blue-300 ring-4 ring-blue-100/70' : 'border-slate-200/70'}`}
            >
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr_auto] gap-3 md:gap-4 items-start xl:items-center">
                <button
                  onClick={() => openReservaInCRM(task.reserva_id)}
                  className="text-left min-w-0 flex items-start gap-3"
                  title="Abrir no CRM"
                >
                  <span
                    className="shrink-0 h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 inline-flex items-center justify-center text-[10px] font-semibold text-slate-500"
                  >
                    {String(displayReservaId).slice(-2)}
                  </span>
                  <span className="min-w-0 block">
                    <span className="block text-[10px] font-semibold tracking-[0.08em] text-slate-400">Reserva {displayReservaId}</span>
                    <span className="mt-1 block truncate text-[13px] md:text-[14px] font-semibold text-slate-900" title={task.cliente}>{task.cliente}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 max-w-full">
                      <Building2 size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{task.empreendimento || 'Empreendimento não informado'}</span>
                    </span>
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-2 xl:justify-center xl:px-2">
                  <button
                    onClick={() => toggleTaskSelection(task.reserva_id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${isSelected ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                    title={isSelected ? 'Desmarcar seleção' : 'Selecionar para transferência em massa'}
                  >
                    {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                    {isSelected ? 'Selecionada' : 'Selecionar'}
                  </button>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold max-w-full"
                    style={{ backgroundColor: sitStyle.bg, color: sitStyle.text, borderColor: sitStyle.bg }}
                  >
                    <Tag size={11} className="shrink-0" />
                    <span className="truncate">{task.situacao_nome || 'Geral'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-2 min-w-0 xl:min-w-70">
                  <button
                    onClick={() => openTransferModal(task)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 transition-all hover:-translate-y-0.5 hover:bg-blue-100 active:translate-y-0"
                    title="Transferir pasta"
                  >
                    <ArrowRightLeft size={13} />
                    Transferir
                  </button>
                  <button
                    onClick={() => handleFinish(task.reserva_id, 'Concluido')}
                    className="rounded-2xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white shadow-[0_12px_20px_-16px_rgba(5,150,105,0.8)] transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0"
                  >
                    Concluir
                  </button>
                  <button
                    onClick={() => handleFinish(task.reserva_id, 'Discussao')}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 transition-all hover:-translate-y-0.5 hover:bg-amber-100 active:translate-y-0"
                  >
                    Discussão
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

export default MesaView;
