import React, { useMemo } from 'react';
import { BarChart3, Building2, CalendarDays, Download, FileSpreadsheet, FileText, FolderKanban, Layers3, TrendingUp } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value || 0);

const getSafeFilePart = (value) =>
  String(value || 'analista')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'analista';

const getMaxValue = (items) => Math.max(...items.map((item) => item.total || 0), 1);

const RankingCard = ({ title, icon: Icon, items, accentClass }) => {
  const maxValue = getMaxValue(items);

  return (
    <section className="bg-white border border-slate-100 rounded-4xl p-5 md:p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accentClass}`}>
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</h3>
          <p className="text-[11px] font-bold text-slate-400 mt-1">Distribuição consolidada do histórico concluído</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div key={`${title}-${item.label}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-black uppercase tracking-wide text-slate-700 truncate">{item.label}</span>
              <span className="font-black text-slate-400 shrink-0">{formatNumber(item.total)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${accentClass.includes('emerald') ? 'bg-emerald-500' : accentClass.includes('amber') ? 'bg-amber-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(10, Math.round(((item.total || 0) / maxValue) * 100))}%` }}
              />
            </div>
          </div>
        )) : (
          <div className="py-10 text-center text-[10px] font-black uppercase tracking-[0.24em] text-slate-300 border border-dashed border-slate-100 rounded-3xl">
            Sem dados suficientes
          </div>
        )}
      </div>
    </section>
  );
};

const SeriesCard = ({ title, subtitle, items, accent }) => {
  const maxValue = getMaxValue(items);

  return (
    <section className="bg-white border border-slate-100 rounded-4xl p-5 md:p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</h3>
        <p className="text-[11px] font-bold text-slate-400 mt-1">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {items.length > 0 ? items.map((item) => (
          <div key={`${title}-${item.key}`} className="rounded-3xl border border-slate-100 bg-slate-50/80 px-3 py-4 text-center space-y-3">
            <div className="h-24 flex items-end justify-center">
              <div
                className={`w-10 rounded-t-2xl ${accent}`}
                style={{ height: `${Math.max(14, Math.round(((item.total || 0) / maxValue) * 100))}%` }}
              />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800 leading-none">{formatNumber(item.total)}</div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">{item.label}</div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-10 text-center text-[10px] font-black uppercase tracking-[0.24em] text-slate-300 border border-dashed border-slate-100 rounded-3xl">
            Sem dados suficientes
          </div>
        )}
      </div>
    </section>
  );
};

const AnalystAnalyticsTab = ({ analyticsData, currentUser, notify }) => {
  const summary = analyticsData?.resumo || {};
  const daySeries = analyticsData?.series?.por_dia || [];
  const monthSeries = analyticsData?.series?.por_mes || [];
  const byResult = analyticsData?.rankings?.por_resultado || [];
  const bySituation = analyticsData?.rankings?.por_situacao || [];
  const byEnterprise = analyticsData?.rankings?.por_empreendimento || [];
  const records = analyticsData?.registros || [];

  const recentRecords = useMemo(() => records.slice(0, 20), [records]);

  const exportBaseName = useMemo(() => {
    const analyst = getSafeFilePart(currentUser?.nome);
    const stamp = new Date().toISOString().slice(0, 10);
    return `dashboard-analitico-${analyst}-${stamp}`;
  }, [currentUser]);

  const handleExportExcel = () => {
    if (!records.length) {
      notify('Não há dados para exportar.', 'error');
      return;
    }

    const workbook = utils.book_new();

    const summarySheet = utils.json_to_sheet([
      { indicador: 'Total concluído', valor: summary.total || 0 },
      { indicador: 'Concluído hoje', valor: summary.hoje || 0 },
      { indicador: 'Concluído no mês', valor: summary.mes || 0 },
      { indicador: 'Concluído no ano', valor: summary.ano || 0 },
      { indicador: 'Média por dia produtivo', valor: summary.media_por_dia || 0 },
      { indicador: 'Dias com produção', valor: summary.dias_com_producao || 0 },
    ]);

    const recordsSheet = utils.json_to_sheet(records.map((row) => ({
      data_finalizacao: row.data_fim_label,
      reserva_id: row.reserva_id,
      cliente: row.cliente,
      empreendimento: row.empreendimento,
      unidade: row.unidade,
      tipo_pasta: row.situacao_nome,
      resultado: row.resultado,
    })));

    const situationSheet = utils.json_to_sheet(bySituation.map((item) => ({ tipo_pasta: item.label, total: item.total })));
    const enterpriseSheet = utils.json_to_sheet(byEnterprise.map((item) => ({ empreendimento: item.label, total: item.total })));
    const resultSheet = utils.json_to_sheet(byResult.map((item) => ({ resultado: item.label, total: item.total })));

    utils.book_append_sheet(workbook, summarySheet, 'Resumo');
    utils.book_append_sheet(workbook, recordsSheet, 'Registros');
    utils.book_append_sheet(workbook, situationSheet, 'Por Tipo');
    utils.book_append_sheet(workbook, enterpriseSheet, 'Por Empresa');
    utils.book_append_sheet(workbook, resultSheet, 'Por Resultado');

    writeFile(workbook, `${exportBaseName}.xlsx`);
    notify('Relatório em Excel exportado.');
  };

  const handleExportPdf = () => {
    if (!records.length) {
      notify('Não há dados para exportar.', 'error');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = analyticsData?.gerado_em
      ? new Date(analyticsData.gerado_em).toLocaleString('pt-BR')
      : new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('Dashboard analítico do analista', 40, 42);
    doc.setFontSize(10);
    doc.text(`Analista: ${currentUser?.nome || 'Não informado'}`, 40, 62);
    doc.text(`Gerado em: ${generatedAt}`, 40, 78);

    autoTable(doc, {
      startY: 96,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total concluído', formatNumber(summary.total || 0)],
        ['Concluído hoje', formatNumber(summary.hoje || 0)],
        ['Concluído no mês', formatNumber(summary.mes || 0)],
        ['Concluído no ano', formatNumber(summary.ano || 0)],
        ['Média por dia produtivo', String(summary.media_por_dia || 0)],
        ['Dias com produção', formatNumber(summary.dias_com_producao || 0)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [['Tipo de pasta', 'Total', 'Empreendimento', 'Total', 'Resultado', 'Total']],
      body: Array.from({ length: Math.max(bySituation.length, byEnterprise.length, byResult.length, 1) }).map((_, index) => [
        bySituation[index]?.label || '-',
        bySituation[index]?.total || '-',
        byEnterprise[index]?.label || '-',
        byEnterprise[index]?.total || '-',
        byResult[index]?.label || '-',
        byResult[index]?.total || '-',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { halign: 'right', cellWidth: 45 },
        2: { cellWidth: 180 },
        3: { halign: 'right', cellWidth: 45 },
        4: { cellWidth: 120 },
        5: { halign: 'right', cellWidth: 45 },
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [['Data', 'Reserva', 'Cliente', 'Empreendimento', 'Tipo', 'Resultado']],
      body: recentRecords.map((row) => [
        row.data_fim_label,
        row.reserva_id,
        row.cliente,
        row.empreendimento,
        row.situacao_nome,
        row.resultado,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 72 },
        1: { cellWidth: 55 },
        2: { cellWidth: 120 },
        3: { cellWidth: 120 },
        4: { cellWidth: 130 },
        5: { cellWidth: 70 },
      },
    });

    doc.save(`${exportBaseName}.pdf`);
    notify('Relatório em PDF exportado.');
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_32%),linear-gradient(135deg,rgba(241,245,249,0.9),rgba(255,255,255,0.96))]" />
        <div className="relative p-6 md:p-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-blue-700">
              <BarChart3 size={12} /> Painel analítico
            </div>
            <h2 className="mt-4 text-2xl md:text-4xl font-black text-slate-900 uppercase tracking-[-0.04em] leading-none">Leitura rápida da sua produção</h2>
            <p className="mt-3 text-sm md:text-[15px] font-bold text-slate-500 leading-relaxed">
              Veja volume concluído por dia, por mês, por tipo de pasta, por empreendimento e exporte os relatórios em Excel ou PDF.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!records.length}
              className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 disabled:bg-emerald-200 disabled:shadow-none flex items-center justify-center gap-2"
            >
              <FileSpreadsheet size={16} /> Exportar Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={!records.length}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-900/10 disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center gap-2"
            >
              <FileText size={16} /> Exportar PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-100 rounded-4xl p-5 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4"><TrendingUp size={18} /></div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Hoje</p>
          <div className="mt-2 text-3xl font-black text-slate-900 leading-none">{formatNumber(summary.hoje)}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-4xl p-5 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4"><CalendarDays size={18} /></div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Mês</p>
          <div className="mt-2 text-3xl font-black text-slate-900 leading-none">{formatNumber(summary.mes)}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-4xl p-5 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><Layers3 size={18} /></div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Ano</p>
          <div className="mt-2 text-3xl font-black text-slate-900 leading-none">{formatNumber(summary.ano)}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-4xl p-5 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4"><Download size={18} /></div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Total</p>
          <div className="mt-2 text-3xl font-black text-slate-900 leading-none">{formatNumber(summary.total)}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-4xl p-5 shadow-sm col-span-2 xl:col-span-1">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4"><FolderKanban size={18} /></div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Média por dia</p>
          <div className="mt-2 text-3xl font-black text-slate-900 leading-none">{summary.media_por_dia || 0}</div>
          <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{formatNumber(summary.dias_com_producao)} dias produtivos</div>
        </div>
      </section>

      <section className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <SeriesCard
          title="Fechamentos por dia"
          subtitle="Últimos 14 dias com produção registrada"
          items={daySeries}
          accent="bg-blue-600"
        />
        <SeriesCard
          title="Fechamentos por mês"
          subtitle="Últimos 12 meses do seu histórico"
          items={monthSeries}
          accent="bg-emerald-500"
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RankingCard title="Por tipo de pasta" icon={Layers3} items={bySituation} accentClass="bg-blue-50 text-blue-600" />
        <RankingCard title="Por empreendimento" icon={Building2} items={byEnterprise} accentClass="bg-emerald-50 text-emerald-600" />
        <RankingCard title="Por resultado" icon={TrendingUp} items={byResult} accentClass="bg-amber-50 text-amber-600" />
      </section>

      <section className="bg-white border border-slate-100 rounded-4xl shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Últimas finalizações</h3>
            <p className="text-[11px] font-bold text-slate-400 mt-1">Amostra operacional para conferência rápida e exportação</p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {formatNumber(records.length)} registro{records.length === 1 ? '' : 's'} disponível{records.length === 1 ? '' : 'eis'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-215 text-left">
            <thead className="bg-white">
              <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <th className="px-5 py-4">Data</th>
                <th className="px-5 py-4">Reserva</th>
                <th className="px-5 py-4">Cliente</th>
                <th className="px-5 py-4">Empreendimento</th>
                <th className="px-5 py-4">Tipo</th>
                <th className="px-5 py-4">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.length > 0 ? recentRecords.map((row) => (
                <tr key={`${row.reserva_id}-${row.data_fim}`} className="border-b border-slate-50 text-[11px] font-bold text-slate-600 hover:bg-slate-50/80">
                  <td className="px-5 py-4 whitespace-nowrap">{row.data_fim_label}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.reserva_id}</td>
                  <td className="px-5 py-4 max-w-45 truncate">{row.cliente}</td>
                  <td className="px-5 py-4 max-w-50 truncate">{row.empreendimento}</td>
                  <td className="px-5 py-4 max-w-50 truncate">{row.situacao_nome}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.resultado}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-5 py-16 text-center text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">
                    Nenhum histórico encontrado para este analista
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AnalystAnalyticsTab;
