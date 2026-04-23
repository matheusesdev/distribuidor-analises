import React, { useMemo } from 'react';
import { BarChart3, Building2, CalendarDays, Download, FileSpreadsheet, FileText, FolderKanban, Layers3, TrendingUp } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value || 0);
const formatPercent = (value) => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0)}%`;
const formatDecimal = (value) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0);
const formatDateTime = (value) => {
  if (!value) return '-';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toLocaleString('pt-BR');
};

const getSafeFilePart = (value) =>
  String(value || 'analista')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'analista';

const getMaxValue = (items) => Math.max(...items.map((item) => item.total || 0), 1);
const getShare = (total, base) => (base ? ((total || 0) / base) * 100 : 0);
const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const SITUATION_BADGE_STYLES = [
  { match: 'analise venda loteamento (lotear)', style: { color: '#0b7285', backgroundColor: '#e3f4f7' } },
  { match: 'analise venda loteamento', style: { color: '#355e3b', backgroundColor: '#e8f3eb' } },
  { match: 'analise venda parcelamento incorporadora', style: { color: '#2f6b2f', backgroundColor: '#e4f2e4' } },
  { match: 'analise venda caixa', style: { color: '#3b6b2f', backgroundColor: '#edf7e7' } },
  { match: 'aprovacao expansao (lotear)', style: { color: '#5f3dc4', backgroundColor: '#ede9fe' } },
  { match: 'aprovacao expansao', style: { color: '#1f6b5f', backgroundColor: '#e2f3ef' } },
  { match: 'confeccao de contrato (lotear)', style: { color: '#9c36b5', backgroundColor: '#f8ecfc' } },
  { match: 'confeccao de contrato', style: { color: '#7a6632', backgroundColor: '#faf5e2' } },
  { match: 'assinado (lotear)', style: { color: '#9a3412', backgroundColor: '#fff1e6' } },
  { match: 'assinado', style: { color: '#8a5a2b', backgroundColor: '#fbeee3' } },
];

const getSituationBadgeStyle = (situationName) => {
  const normalized = normalizeText(situationName);
  const match = SITUATION_BADGE_STYLES.find((item) => normalized.includes(item.match));
  return match?.style || { color: '#475569', backgroundColor: '#f1f5f9' };
};

const isCompletedResult = (result) => normalizeText(result).includes('conclu');

const EXCEL_DAILY_COLUMNS = [
  { header: 'DATA', key: 'DATA', width: 18 },
  { header: 'RESERVAS (ID)', key: 'RESERVAS (ID)', width: 18 },
  { header: 'NOME DO CLIENTE', key: 'NOME DO CLIENTE', width: 34 },
  { header: 'EMPREENDIMENTO', key: 'EMPREENDIMENTO', width: 40 },
  { header: 'UNIDADE', key: 'UNIDADE', width: 20 },
  { header: 'TIPO', key: 'TIPO', width: 42 },
  { header: 'RESULTADO', key: 'RESULTADO', width: 16 },
];

const downloadWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([
    buffer,
  ], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildDailyZebraWorksheet = (workbook, rows) => {
  const worksheet = workbook.addWorksheet('Por Dia', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  worksheet.properties.defaultRowHeight = 20;

  worksheet.columns = EXCEL_DAILY_COLUMNS;
  worksheet.autoFilter = {
    from: 'A1',
    to: 'G1',
  };

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  rows.forEach((row, index) => {
    const rowRef = worksheet.addRow(row);
    const zebraColor = index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    rowRef.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };
      cell.font = { color: { argb: 'FF0F172A' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber === 2 || colNumber === 7 ? 'center' : 'left',
        wrapText: false,
        shrinkToFit: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });
};

const getTopItem = (items) => items.find((item) => (item.total || 0) > 0) || null;

const ensurePdfSpace = (doc, requiredHeight = 120) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentY = doc.lastAutoTable?.finalY || 0;
  if (currentY + requiredHeight > pageHeight - 36) {
    doc.addPage();
    return 36;
  }
  return currentY + 18;
};

const RankingCard = ({ title, icon: Icon, items, accentClass, barClass, emptyMessage = 'Sem dados suficientes' }) => {
  const maxValue = getMaxValue(items);

  return (
    <section className="bg-white border border-slate-200/80 rounded-3xl p-4 md:p-5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.55)] space-y-4">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accentClass}`}>
          <Icon size={15} />
        </div>
        <div>
          <h3 className="text-[11px] font-semibold tracking-[0.01em] text-slate-700">{title}</h3>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">Distribuição consolidada do histórico concluído</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.length > 0 ? items.map((item) => (
          <div key={`${title}-${item.label}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-semibold text-slate-700 truncate">{item.label}</span>
              <span className="font-semibold text-slate-500 shrink-0">{formatNumber(item.total)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${barClass}`}
                style={{ width: `${Math.max(10, Math.round(((item.total || 0) / maxValue) * 100))}%` }}
              />
            </div>
          </div>
        )) : (
          <div className="py-8 text-center text-[10px] font-semibold text-slate-300 border border-dashed border-slate-200 rounded-2xl">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
};

const SeriesCard = ({ title, subtitle, items, accent }) => {
  const maxValue = getMaxValue(items);

  return (
    <section className="bg-white border border-slate-200/80 rounded-3xl p-4 md:p-5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.55)] space-y-4">
      <div>
        <h3 className="text-[11px] font-semibold tracking-[0.01em] text-slate-700">{title}</h3>
        <p className="text-[10px] font-medium text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {items.length > 0 ? items.map((item) => (
          <div key={`${title}-${item.key}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-2.5 py-3 text-center space-y-2.5">
            <div className="h-20 flex items-end justify-center">
              <div
                className={`w-7 rounded-t-xl ${accent}`}
                style={{ height: `${Math.max(14, Math.round(((item.total || 0) / maxValue) * 100))}%` }}
              />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-800 leading-none">{formatNumber(item.total)}</div>
              <div className="text-[9px] font-medium text-slate-400 mt-1.5">{item.label}</div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-8 text-center text-[10px] font-semibold text-slate-300 border border-dashed border-slate-200 rounded-2xl">
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
  const hasSituationTracking = analyticsData?.schema?.historico_tem_situacao !== false;
  const records = analyticsData?.registros || [];
  const generatedAt = analyticsData?.gerado_em
    ? formatDateTime(analyticsData.gerado_em)
    : formatDateTime(new Date().toISOString());
  const totalRecords = summary.total || records.length || 0;

  const recentRecords = useMemo(() => records.slice(0, 20), [records]);
  const exportRecords = useMemo(() => records.slice(0, 100), [records]);
  const summaryRows = useMemo(() => ([
    { indicador: 'Total concluído', valor: summary.total || 0, descricao: 'Volume total registrado no histórico do analista' },
    { indicador: 'Concluído hoje', valor: summary.hoje || 0, descricao: 'Finalizações registradas na data atual' },
    { indicador: 'Concluído no mês', valor: summary.mes || 0, descricao: 'Volume consolidado no mês corrente' },
    { indicador: 'Concluído no ano', valor: summary.ano || 0, descricao: 'Volume consolidado no ano corrente' },
    { indicador: 'Média por dia produtivo', valor: summary.media_por_dia || 0, descricao: 'Média considerando apenas dias com produção' },
    { indicador: 'Dias com produção', valor: summary.dias_com_producao || 0, descricao: 'Dias do histórico com ao menos uma conclusão' },
  ]), [summary]);

  const insightRows = useMemo(() => {
    const bestDay = getTopItem(daySeries);
    const bestMonth = getTopItem(monthSeries);
    const topResult = getTopItem(byResult);
    const topEnterprise = getTopItem(byEnterprise);
    const topSituation = getTopItem(bySituation);

    return [
      { insight: 'Melhor dia recente', valor: bestDay ? `${bestDay.label} (${formatNumber(bestDay.total)})` : 'Sem dados' },
      { insight: 'Melhor mês', valor: bestMonth ? `${bestMonth.label} (${formatNumber(bestMonth.total)})` : 'Sem dados' },
      { insight: 'Resultado dominante', valor: topResult ? `${topResult.label} (${formatPercent(getShare(topResult.total, totalRecords))})` : 'Sem dados' },
      { insight: 'Empreendimento líder', valor: topEnterprise ? `${topEnterprise.label} (${formatPercent(getShare(topEnterprise.total, totalRecords))})` : 'Sem dados' },
      { insight: 'Tipo de pasta líder', valor: topSituation ? `${topSituation.label} (${formatPercent(getShare(topSituation.total, totalRecords))})` : (hasSituationTracking ? 'Sem dados' : 'Schema ainda sem rastreamento de tipo') },
    ];
  }, [daySeries, monthSeries, byResult, byEnterprise, bySituation, totalRecords, hasSituationTracking]);

  const dailyRows = useMemo(() => daySeries.map((item) => ({
    periodo: item.label,
    chave: item.key,
    total: item.total || 0,
    participacao: formatPercent(getShare(item.total, totalRecords)),
  })), [daySeries, totalRecords]);

  const monthlyRows = useMemo(() => monthSeries.map((item) => ({
    periodo: item.label,
    chave: item.key,
    total: item.total || 0,
    participacao: formatPercent(getShare(item.total, totalRecords)),
  })), [monthSeries, totalRecords]);

  const buildRankingRows = (items, labelKey) => items.map((item, index) => ({
    posicao: index + 1,
    [labelKey]: item.label,
    total: item.total || 0,
    participacao: formatPercent(getShare(item.total, totalRecords)),
  }));

  const situationRows = useMemo(() => buildRankingRows(bySituation, 'tipo_pasta'), [bySituation, totalRecords]);
  const enterpriseRows = useMemo(() => buildRankingRows(byEnterprise, 'empreendimento'), [byEnterprise, totalRecords]);
  const resultRows = useMemo(() => buildRankingRows(byResult, 'resultado'), [byResult, totalRecords]);

  const metadataRows = useMemo(() => ([
    { campo: 'Analista', valor: currentUser?.nome || 'Não informado' },
    { campo: 'Gerado em', valor: generatedAt },
    { campo: 'Registros exportados', valor: formatNumber(records.length) },
    { campo: 'Registros no dashboard', valor: formatNumber(totalRecords) },
    { campo: 'Período diário', valor: daySeries.length ? `${daySeries[0].label} até ${daySeries[daySeries.length - 1].label}` : 'Sem dados' },
    { campo: 'Período mensal', valor: monthSeries.length ? `${monthSeries[0].label} até ${monthSeries[monthSeries.length - 1].label}` : 'Sem dados' },
    { campo: 'Rastreamento de tipo', valor: hasSituationTracking ? 'Ativo' : 'Pendente de schema / backfill' },
  ]), [currentUser, generatedAt, records.length, totalRecords, daySeries, monthSeries, hasSituationTracking]);

  const dailyExcelRows = useMemo(() => records.map((row) => ({
    'DATA': row.data_fim_label || row.data_fim || '-',
    'RESERVAS (ID)': Number.isFinite(Number(row.reserva_id)) ? Number(row.reserva_id) : (row.reserva_id || '-'),
    'NOME DO CLIENTE': row.cliente || '-',
    'EMPREENDIMENTO': row.empreendimento || '-',
    'UNIDADE': row.unidade || '-',
    'TIPO': row.situacao_nome || '-',
    'RESULTADO': row.resultado || '-',
  })), [records]);

  const exportBaseName = useMemo(() => {
    const analyst = getSafeFilePart(currentUser?.nome);
    const stamp = new Date().toISOString().slice(0, 10);
    return `dashboard-analitico-${analyst}-${stamp}`;
  }, [currentUser]);

  const revealStyle = (index) => ({ animationDelay: `${index * 70}ms` });

  const handleExportExcel = async () => {
    if (!records.length) {
      notify('Não há dados para exportar.', 'error');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      buildDailyZebraWorksheet(workbook, dailyExcelRows);
      await downloadWorkbook(workbook, `${exportBaseName}.xlsx`);
      notify('Relatório analítico diário em Excel exportado.');
    } catch (error) {
      notify('Erro ao exportar Excel.', 'error');
    }
  };

  const handleExportPdf = () => {
    if (!records.length) {
      notify('Não há dados para exportar.', 'error');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(18);
    doc.text('Dashboard analítico do analista', 40, 42);
    doc.setFontSize(10);
    doc.text(`Analista: ${currentUser?.nome || 'Não informado'}`, 40, 62);
    doc.text(`Gerado em: ${generatedAt}`, 40, 78);

    autoTable(doc, {
      startY: 96,
      head: [['Campo', 'Valor']],
      body: metadataRows.map((item) => [item.campo, item.valor]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [['Indicador', 'Valor', 'Leitura']],
      body: summaryRows.map((item) => [
        item.indicador,
        typeof item.valor === 'number' ? formatDecimal(item.valor) : item.valor,
        item.descricao,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 70, halign: 'right' },
        2: { cellWidth: 420 },
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [['Insight', 'Valor']],
      body: insightRows.map((item) => [item.insight, item.valor]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 180 },
        1: { cellWidth: 460 },
      },
    });

    autoTable(doc, {
      startY: ensurePdfSpace(doc, 180),
      head: [['Dia', 'Chave', 'Total', 'Participação']],
      body: dailyRows.length
        ? dailyRows.map((item) => [item.periodo, item.chave, formatNumber(item.total), item.participacao])
        : [['-', '-', '0', '0,0%']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: ensurePdfSpace(doc, 180),
      head: [['Mês', 'Chave', 'Total', 'Participação']],
      body: monthlyRows.length
        ? monthlyRows.map((item) => [item.periodo, item.chave, formatNumber(item.total), item.participacao])
        : [['-', '-', '0', '0,0%']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: ensurePdfSpace(doc, 220),
      head: [['Posição', 'Tipo de pasta', 'Total', 'Participação']],
      body: situationRows.length
        ? situationRows.map((item) => [item.posicao, item.tipo_pasta, formatNumber(item.total), item.participacao])
        : [[1, hasSituationTracking ? 'Sem dados' : 'Schema ainda sem rastreamento de tipo', '0', '0,0%']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: ensurePdfSpace(doc, 220),
      head: [['Posição', 'Empreendimento', 'Total', 'Participação']],
      body: enterpriseRows.length
        ? enterpriseRows.map((item) => [item.posicao, item.empreendimento, formatNumber(item.total), item.participacao])
        : [[1, 'Sem dados', '0', '0,0%']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: ensurePdfSpace(doc, 220),
      head: [['Posição', 'Resultado', 'Total', 'Participação']],
      body: resultRows.length
        ? resultRows.map((item) => [item.posicao, item.resultado, formatNumber(item.total), item.participacao])
        : [[1, 'Sem dados', '0', '0,0%']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    autoTable(doc, {
      startY: ensurePdfSpace(doc, 320),
      head: [['Data', 'Reserva', 'Cliente', 'Empreendimento', 'Unidade', 'Tipo', 'Resultado']],
      body: exportRecords.map((row) => [
        row.data_fim_label,
        row.reserva_id,
        row.cliente,
        row.empreendimento,
        row.unidade,
        row.situacao_nome,
        row.resultado,
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 74 },
        1: { cellWidth: 54 },
        2: { cellWidth: 110 },
        3: { cellWidth: 122 },
        4: { cellWidth: 68 },
        5: { cellWidth: 130 },
        6: { cellWidth: 58 },
      },
      didDrawPage: () => {
        doc.setFontSize(9);
        doc.text(`Registros detalhados exportados: ${formatNumber(exportRecords.length)} de ${formatNumber(records.length)}`, 40, 24);
      },
    });

    doc.save(`${exportBaseName}.pdf`);
    notify('Relatório em PDF exportado.');
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="apple-section-reveal rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.55)]" style={revealStyle(1)}>
        <div className="p-5 md:p-6 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
              <BarChart3 size={12} /> Painel analítico
            </div>
            <h2 className="mt-3 text-xl md:text-2xl font-semibold text-slate-900 tracking-[-0.015em] leading-tight">Leitura rápida da sua produção</h2>
            <p className="mt-2 text-[13px] font-medium text-slate-500 leading-relaxed">
              Veja volume concluído por dia, por mês, por tipo de pasta, por empreendimento e exporte os relatórios em Excel ou PDF.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!records.length}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold disabled:bg-emerald-200 flex items-center justify-center gap-2 transition-colors hover:bg-emerald-500"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={!records.length}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-semibold disabled:bg-slate-200 flex items-center justify-center gap-2 transition-colors hover:bg-slate-800"
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>
      </section>

      <section className="apple-section-reveal grid grid-cols-2 xl:grid-cols-5 gap-3" style={revealStyle(2)}>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.55)]">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4"><TrendingUp size={14} /></div>
          <p className="text-[10px] font-medium text-slate-500">Hoje</p>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 leading-none">{formatNumber(summary.hoje)}</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.55)]">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4"><CalendarDays size={14} /></div>
          <p className="text-[10px] font-medium text-slate-500">Mês</p>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 leading-none">{formatNumber(summary.mes)}</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.55)]">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><Layers3 size={14} /></div>
          <p className="text-[10px] font-medium text-slate-500">Ano</p>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 leading-none">{formatNumber(summary.ano)}</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.55)]">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4"><Download size={14} /></div>
          <p className="text-[10px] font-medium text-slate-500">Total</p>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 leading-none">{formatNumber(summary.total)}</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.55)] col-span-2 xl:col-span-1">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4"><FolderKanban size={14} /></div>
          <p className="text-[10px] font-medium text-slate-500">Média por dia</p>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 leading-none">{summary.media_por_dia || 0}</div>
          <div className="mt-1.5 text-[10px] font-medium text-slate-500">{formatNumber(summary.dias_com_producao)} dias produtivos</div>
        </div>
      </section>

      <section className="apple-section-reveal grid grid-cols-1 2xl:grid-cols-2 gap-4" style={revealStyle(3)}>
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

      <section className="apple-section-reveal grid grid-cols-1 xl:grid-cols-3 gap-4" style={revealStyle(4)}>
        <RankingCard
          title="Por tipo de pasta"
          icon={Layers3}
          items={bySituation}
          accentClass="bg-blue-50 text-blue-600"
          barClass="bg-blue-500"
          emptyMessage={records.length > 0 && !hasSituationTracking ? 'Atualize a tabela historico para rastrear o tipo da pasta' : 'Sem dados suficientes'}
        />
        <RankingCard title="Por empreendimento" icon={Building2} items={byEnterprise} accentClass="bg-emerald-50 text-emerald-600" barClass="bg-emerald-500" />
        <RankingCard title="Por resultado" icon={TrendingUp} items={byResult} accentClass="bg-amber-50 text-amber-600" barClass="bg-amber-500" />
      </section>

      <section className="apple-section-reveal bg-white border border-slate-200/80 rounded-3xl shadow-[0_16px_30px_-24px_rgba(15,23,42,0.55)] overflow-hidden" style={revealStyle(5)}>
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 bg-slate-50/60">
          <div>
            <h3 className="text-[11px] font-semibold text-slate-700">Últimas finalizações</h3>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Amostra operacional para conferência rápida e exportação</p>
          </div>
          <div className="text-[10px] font-medium text-slate-500">
            {formatNumber(records.length)} registro{records.length === 1 ? '' : 's'} disponível{records.length === 1 ? '' : 'eis'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-215 text-left">
            <thead className="bg-white">
              <tr className="text-[9px] font-semibold tracking-[0.06em] text-slate-400 border-b border-slate-100">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Reserva</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Empreendimento</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.length > 0 ? recentRecords.map((row) => (
                <tr key={`${row.reserva_id}-${row.data_fim}`} className="border-b border-slate-100 text-[11px] font-medium text-slate-600 hover:bg-slate-50/70">
                  <td className="px-4 py-3 whitespace-nowrap">{row.data_fim_label}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.reserva_id}</td>
                  <td className="px-4 py-3 max-w-45 truncate">{row.cliente}</td>
                  <td className="px-4 py-3 max-w-50 truncate">{row.empreendimento}</td>
                  <td className="px-4 py-3 max-w-50">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold max-w-full truncate"
                      style={getSituationBadgeStyle(row.situacao_nome)}
                      title={row.situacao_nome || '-'}
                    >
                      {row.situacao_nome || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        isCompletedResult(row.resultado)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.resultado || '-'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-5 py-14 text-center text-[10px] font-semibold text-slate-300">
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
