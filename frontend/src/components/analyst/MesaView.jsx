import React from 'react';
import { ArrowRightLeft, Building2, CheckCircle2, CheckSquare, ListOrdered, Search, Square, Tag, TrendingUp, UserCheck } from 'lucide-react';

const MesaView = ({
  myQueuePositions,
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
  openTransferModal,
  handleFinish,
  metrics,
}) => (
  <div className="flex flex-col lg:flex-row gap-6 md:gap-10 items-start relative">
    <div className="flex-1 w-full space-y-5">
      <div className="flex flex-wrap gap-2 px-2">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl shadow-sm">
          <ListOrdered size={14} className="text-blue-600"/>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Minha Posicao:</span>
          <div className="flex gap-2">
            {Object.entries(myQueuePositions).map(([sitId, pos]) => (
              <div key={sitId} className="flex items-center gap-1.5 bg-white border border-blue-200 px-2 py-0.5 rounded-lg shadow-sm">
                <span className="text-[8px] font-black text-blue-600">{sitId}</span>
                <span className="text-[10px] font-black text-slate-800">{pos}o</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <UserCheck className="text-blue-600" size={18} />
          <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Minha Mesa</h2>
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-lg shadow-blue-500/10">{filteredTasks.length} Ativas</span>
          {filteredTasks.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-[9px] font-black uppercase text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all bg-white"
            >
              {selectedTaskIds.size === filteredTasks.length ? <CheckSquare size={12} className="text-blue-600"/> : <Square size={12}/>}
              {selectedTaskIds.size === filteredTasks.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
            </button>
          )}
          {selectedTaskIds.size > 0 && (
            <button
              onClick={openBulkTransferModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase shadow-md hover:bg-blue-700 active:scale-95 transition-all"
            >
              <ArrowRightLeft size={12}/>
              Transferir {selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 flex-1 sm:w-44 border-r border-slate-100">
            <Search size={14} className="text-slate-300 shrink-0" />
            <input type="text" placeholder="Filtrar..." className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600 w-full" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}/>
          </div>
          <select value={filterSit} onChange={(e) => setFilterSit(e.target.value)} className="bg-transparent border-none outline-none text-[9px] font-black uppercase text-slate-500 px-2 cursor-pointer">
            <option value="all">Todas Situacoes</option>
            {Object.entries(SITUACOES_MAP).map(([id, nome]) => (<option key={id} value={id}>{nome}</option>))}
          </select>
        </div>
      </div>

      <div className="space-y-2.5">
        {filteredTasks.length > 0 ? filteredTasks.map(task => {
          const sitStyle = SIT_COLORS[task.situacao_id] || { text: '#2563eb', bg: '#eff6ff' };
          const isSelected = selectedTaskIds.has(task.reserva_id);
          return (
            <div
              key={task.reserva_id}
              className={`bg-white p-3 md:p-3.5 rounded-2xl border shadow-sm hover:border-blue-400 transition-all flex group relative items-center cursor-pointer ${isSelected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-100'}`}
              onClick={() => openReservaInCRM(task.reserva_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openReservaInCRM(task.reserva_id);
                }
              }}
            >
              <div className="grid grid-cols-12 items-center w-full gap-4">
                <div className="col-span-12 lg:col-span-5 flex items-center gap-3 min-w-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.reserva_id); }}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:border-blue-400 transition-all bg-white"
                    title={isSelected ? 'Desmarcar' : 'Selecionar para transferencia em massa'}
                  >
                    {isSelected ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-slate-300"/>}
                  </button>
                  <div className="w-8 h-8 md:w-9 md:h-9 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 flex-shrink-0 group-hover:text-blue-500 transition-all">{task.reserva_id.toString().slice(-2)}</div>
                  <div className="min-w-0 flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none block">ID: {task.reserva_id}</span><h4 className="text-[12px] md:text-[13px] font-black text-slate-800 uppercase tracking-tight truncate pr-2" title={task.cliente}>{task.cliente}</h4></div>
                </div>
                <div className="col-span-12 lg:col-span-4 space-y-1 min-w-0 lg:border-l border-slate-100 lg:pl-4">
                  <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase truncate"><Building2 size={12} className="text-blue-300 shrink-0"/><span className="truncate">{task.empreendimento}</span></div>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit transition-colors shadow-sm" style={{ backgroundColor: sitStyle.bg, color: sitStyle.text }}><Tag size={9} className="shrink-0"/><span className="truncate">{task.situacao_nome || 'Geral'}</span></div>
                </div>
                <div className="col-span-12 lg:col-span-3 flex items-center justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); openTransferModal(task); }}
                    className="bg-blue-50 text-blue-600 p-2 rounded-xl text-[9px] font-black uppercase active:scale-95 border border-blue-100 flex items-center justify-center"
                    title="Transferir pasta"
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleFinish(task.reserva_id, 'Concluido'); }} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-md active:scale-95 flex-1 lg:flex-initial">Concluir</button>
                  <button onClick={(e) => { e.stopPropagation(); handleFinish(task.reserva_id, 'Discussao'); }} className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 border border-slate-100 flex-1 lg:flex-initial">Pendente</button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center bg-white border-2 border-dashed border-slate-50 rounded-[2rem] shadow-sm px-6"><CheckCircle2 size={40} className="mx-auto mb-4 text-slate-100"/><p className="text-slate-300 font-black uppercase text-[10px] tracking-[0.3em] italic">Mesa livre.</p></div>
        )}
      </div>
    </div>

    <div className="w-full lg:w-[240px] space-y-5 flex-shrink-0">
      <h2 className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">Performance</h2>
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-center group hover:border-blue-200 transition-all h-[95px] shadow-sm"><p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest uppercase">Hoje</p><div className="text-2xl font-black text-blue-600 leading-none">{metrics.hoje}</div></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-center group hover:border-blue-200 transition-all h-[95px] shadow-sm"><p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest uppercase">Ano</p><div className="text-2xl font-black text-slate-700 leading-none">{metrics.ano}</div></div>
      </div>
      <div className="bg-blue-600 p-4 rounded-xl shadow-xl shadow-blue-500/10 flex items-center gap-3 text-white group overflow-hidden relative"><TrendingUp size={18} className="flex-shrink-0 opacity-80"/><div className="truncate"><p className="text-[7px] font-bold text-blue-100 uppercase tracking-widest mb-0.5 leading-none font-black uppercase">Fila VCA</p><div className="text-[10px] font-black uppercase tracking-tight truncate">Sync Real Time</div></div></div>
    </div>
  </div>
);

export default MesaView;
