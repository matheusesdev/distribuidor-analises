import React from 'react';
import { ArrowRightLeft, X, Search } from 'lucide-react';

export default function BulkTransferModal({
  selectedTaskIds,
  bulkTransferToId,
  setBulkTransferToId,
  bulkTransferTargetSearch,
  setBulkTransferTargetSearch,
  bulkTransferReason,
  setBulkTransferReason,
  filteredBulkTransferTargetOptions,
  selectedBulkTransferTarget,
  handleBulkTransfer,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/55 backdrop-blur-md z-450 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="viewport-dialog w-full max-w-2xl border border-white/80 rounded-[1.25rem] bg-white/95 p-4 sm:p-6 shadow-[0_36px_70px_-30px_rgba(15,23,42,0.88)] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3.5 mb-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-blue-50 border border-blue-100 text-[#0071e3] shrink-0">
              <ArrowRightLeft size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-900">Transferência em massa</h3>
              <p className="text-[12px] font-medium text-slate-500 mt-1 leading-relaxed">{selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''} selecionada{selectedTaskIds.size !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 inline-flex items-center justify-center hover:bg-slate-50 hover:text-slate-700 transition-all"
            aria-label="Fechar modal"
          >
            <X size={15} />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 mb-4">
          <p className="text-[10px] font-medium tracking-[0.08em] text-slate-500 uppercase">Resumo rápido</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-700">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">{selectedTaskIds.size} itens</span>
            {selectedBulkTransferTarget && (
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[#0071e3]">
                <span>Destino: {selectedBulkTransferTarget.nome}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold border border-blue-100">
                  {Number(selectedBulkTransferTarget.na_mesa || 0)} pasta{Number(selectedBulkTransferTarget.na_mesa || 0) !== 1 ? 's' : ''} na fila
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold tracking-[0.06em] text-slate-600">Analista destino</label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={bulkTransferTargetSearch}
                onChange={(e) => setBulkTransferTargetSearch(e.target.value)}
                placeholder="Buscar analista por nome"
                className="w-full bg-transparent text-[12px] font-medium text-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-2.5 max-h-[min(14rem,34dvh)] overflow-y-auto custom-scrollbar space-y-2">
            {filteredBulkTransferTargetOptions.length > 0 ? filteredBulkTransferTargetOptions.map(a => {
              const isSelected = String(bulkTransferToId) === String(a.id);
              const queueCount = Number(a.na_mesa || 0);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setBulkTransferToId(String(a.id))}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${isSelected ? 'bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] text-white border-blue-600 shadow-[0_12px_20px_-16px_rgba(0,113,227,0.9)]' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200 hover:-translate-y-0.5'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                    {a.nome?.charAt(0) || 'A'}
                  </div>
                  <span className="text-[12px] font-semibold tracking-[0.01em] truncate flex-1">{a.nome}</span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-semibold ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                      {queueCount} pasta{queueCount !== 1 ? 's' : ''} na fila
                    </span>
                    {a.is_online && <span className={`text-[10px] font-semibold ${isSelected ? 'text-emerald-100' : 'text-emerald-600'}`}>Fila ativa</span>}
                  </div>
                </button>
              );
            }) : (
              <div className="px-2 py-4 text-center text-[11px] font-semibold tracking-[0.02em] text-slate-400">
                Nenhum analista encontrado para esse filtro
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold tracking-[0.06em] text-slate-600">Motivo da transferência *</label>
            <input
              type="text"
              value={bulkTransferReason}
              onChange={(e) => setBulkTransferReason(e.target.value)}
              placeholder="Ex.: redistribuição para acelerar atendimento"
              className="mt-2 w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-[12px] text-slate-700 font-medium outline-none focus:ring-4 focus:ring-blue-100/80 focus:border-blue-300"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
          <button onClick={onClose} className="py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-semibold border border-slate-200 transition-all hover:bg-slate-100">Cancelar</button>
          <button
            disabled={!bulkTransferToId || !bulkTransferReason.trim()}
            onClick={handleBulkTransfer}
            className="py-2.5 rounded-2xl text-[11px] font-semibold text-white bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] disabled:bg-blue-300 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            Transferir {selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
