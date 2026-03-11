import React from 'react';
import { ArrowRightLeft, RotateCcw } from 'lucide-react';

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
  <section className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
    <div className="p-5 md:p-6 border-b border-slate-50 flex items-center gap-2 bg-slate-50/20">
      <ArrowRightLeft size={18} className="text-blue-600" />
      <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Log de Transferencias (por dia)</h2>
    </div>

    <div className="p-4 md:p-6 border-b border-slate-100 bg-white/60 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto">
          <select value={transferMonthFilter} onChange={(e) => setTransferMonthFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 outline-none">
            <option value="all">Todos os meses</option>
            {transferMonthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select value={transferOriginFilter} onChange={(e) => setTransferOriginFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 outline-none">
            <option value="all">Origem: todos</option>
            {transferOriginOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select value={transferDestinationFilter} onChange={(e) => setTransferDestinationFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 outline-none">
            <option value="all">Destino: todos</option>
            {transferDestinationOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={resetTransferFilters}
            className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-amber-700 hover:bg-amber-100 transition-all inline-flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={12} />
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Quem mais enviou</p>
          <p className="text-[11px] font-black text-slate-700 uppercase truncate">{transferInsights.topSender ? transferInsights.topSender[0] : '-'}</p>
          <p className="text-[9px] font-black text-blue-600 mt-1">{transferInsights.topSender ? `${transferInsights.topSender[1]} transferencias` : 'Sem dados'}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Quem mais recebeu</p>
          <p className="text-[11px] font-black text-slate-700 uppercase truncate">{transferInsights.topReceiver ? transferInsights.topReceiver[0] : '-'}</p>
          <p className="text-[9px] font-black text-green-600 mt-1">{transferInsights.topReceiver ? `${transferInsights.topReceiver[1]} recebidas` : 'Sem dados'}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Recebeu mais de quem</p>
          <p className="text-[11px] font-black text-slate-700 uppercase truncate">{transferInsights.topPair ? transferInsights.topPair[0].split('|||')[0] : '-'}</p>
          <p className="text-[9px] font-black text-amber-600 mt-1 truncate">{transferInsights.topPair ? `${transferInsights.topPair[1]} de ${transferInsights.topPair[0].split('|||')[1]}` : 'Sem dados'}</p>
        </div>
      </div>
    </div>

    <div className="p-4 md:p-6 space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar">
      {groupedTransferLogs.length > 0 ? groupedTransferLogs.map(([dia, logs]) => (
        <div key={dia} className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600">{dia}</div>
          <div className="divide-y divide-slate-50">
            {logs.map((log, idx) => {
              const hora = new Date(log.data_transferencia || log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={`${log.id || log.reserva_id}-${idx}`} className="px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                    Pasta {log.reserva_id} • {log.analista_origem_nome} <span className="text-slate-300">{'->'}</span> {log.analista_destino_nome}
                    {log.motivo ? <span className="text-slate-400 normal-case font-bold"> • Motivo: {log.motivo}</span> : null}
                  </div>
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">{hora}</div>
                </div>
              );
            })}
          </div>
        </div>
      )) : (
        <div className="py-8 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.2em]">Sem transferencias registradas.</div>
      )}
    </div>
  </section>
);

export default ManagerTransfersTab;
