import React from 'react';
import { ArrowRightLeft, Filter, RotateCcw } from 'lucide-react';

const ManagerTransfersTab = ({
  transferMonthFilter,
  setTransferMonthFilter,
  transferMonthOptions,
  transferOriginFilter,
  setTransferOriginFilter,
  transferOriginOptions,
  transferDestinationFilter,
  setTransferDestinationFilter,
  transferDestinationOptions,
  resetTransferFilters,
  transferInsights,
  groupedTransferLogs,
}) => (
  <section className="rounded-3xl md:rounded-4xl border border-slate-200/80 bg-white/90 overflow-hidden shadow-[0_24px_45px_-30px_rgba(15,23,42,0.5)] backdrop-blur-sm">
    <div className="p-5 md:p-6 border-b border-slate-100 flex items-center gap-2 bg-[linear-gradient(140deg,#f8fafc_0%,#ffffff_100%)]">
      <ArrowRightLeft size={18} className="text-[#0071e3]" />
      <h2 className="text-[11px] font-semibold tracking-[0.06em] text-slate-800">Log de Transferências (por dia)</h2>
    </div>

    <div className="p-4 md:p-6 border-b border-slate-100 bg-white/70 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.01em] text-slate-600"><Filter size={14} /> Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto">
          <select value={transferMonthFilter} onChange={(e) => setTransferMonthFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-[12px] font-semibold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400">
            <option value="all">Todos os meses</option>
            {transferMonthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select value={transferOriginFilter} onChange={(e) => setTransferOriginFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-[12px] font-semibold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400">
            <option value="all">Origem: todos</option>
            {transferOriginOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select value={transferDestinationFilter} onChange={(e) => setTransferDestinationFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-[12px] font-semibold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400">
            <option value="all">Destino: todos</option>
            {transferDestinationOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={resetTransferFilters}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 transition-all inline-flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0"
          >
            <RotateCcw size={12} />
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-[10px] font-semibold tracking-[0.04em] text-slate-500 mb-1">Quem mais enviou</p>
          <p className="text-[13px] font-semibold text-slate-800 truncate">{transferInsights.topSender ? transferInsights.topSender[0] : '-'}</p>
          <p className="text-[11px] font-semibold text-[#0071e3] mt-1">{transferInsights.topSender ? `${transferInsights.topSender[1]} transferências` : 'Sem dados'}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-[10px] font-semibold tracking-[0.04em] text-slate-500 mb-1">Quem mais recebeu</p>
          <p className="text-[13px] font-semibold text-slate-800 truncate">{transferInsights.topReceiver ? transferInsights.topReceiver[0] : '-'}</p>
          <p className="text-[11px] font-semibold text-emerald-600 mt-1">{transferInsights.topReceiver ? `${transferInsights.topReceiver[1]} recebidas` : 'Sem dados'}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-[10px] font-semibold tracking-[0.04em] text-slate-500 mb-1">Recebeu mais de quem</p>
          <p className="text-[13px] font-semibold text-slate-800 truncate">{transferInsights.topPair ? transferInsights.topPair[0].split('|||')[0] : '-'}</p>
          <p className="text-[11px] font-semibold text-amber-600 mt-1 truncate">{transferInsights.topPair ? `${transferInsights.topPair[1]} de ${transferInsights.topPair[0].split('|||')[1]}` : 'Sem dados'}</p>
        </div>
      </div>
    </div>

    <div className="p-4 md:p-6 space-y-4 max-h-105 overflow-y-auto custom-scrollbar">
      {groupedTransferLogs.length > 0 ? groupedTransferLogs.map(([dia, logs]) => (
        <div key={dia} className="border border-slate-200 rounded-2xl overflow-hidden shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)]">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold tracking-[0.04em] text-slate-600">{dia}</div>
          <div className="divide-y divide-slate-50">
            {logs.map((log, idx) => {
              const hora = new Date(log.data_transferencia || log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={`${log.id || log.reserva_id}-${idx}`} className="px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 transition-colors hover:bg-sky-50/40">
                  <div className="text-[11px] font-semibold text-slate-700 tracking-[0.01em]">
                    Pasta {log.reserva_id} • {log.analista_origem_nome} <span className="text-slate-300">{'->'}</span> {log.analista_destino_nome}
                    {log.motivo ? <span className="text-slate-500 normal-case font-medium"> • Motivo: {log.motivo}</span> : null}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold tracking-[0.03em]">{hora}</div>
                </div>
              );
            })}
          </div>
        </div>
      )) : (
        <div className="py-8 text-center text-slate-400 font-semibold text-[12px] tracking-[0.03em]">Sem transferências registradas.</div>
      )}
    </div>
  </section>
);

export default ManagerTransfersTab;
