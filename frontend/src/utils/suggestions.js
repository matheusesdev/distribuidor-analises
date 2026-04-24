export const SUGGESTION_STATUS_FLOW = [
  'Em desenvolvimento',
  'Em Planejamento',
  'Em an\u00e1lise',
  'Aprovado',
  'Aguardando Cliente',
  'Conclu\u00eddo',
];

export const SUGGESTION_STATUS_COLORS = {
  'Em desenvolvimento': 'border-blue-200 bg-blue-50 text-blue-700',
  'Em Planejamento': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'Em an\u00e1lise': 'border-amber-200 bg-amber-50 text-amber-700',
  Aprovado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Aguardando Cliente': 'border-slate-200 bg-slate-100 text-slate-700',
  'Conclu\u00eddo': 'border-green-200 bg-green-100 text-green-700',
};

export const getSuggestionStatusColor = (status) =>
  SUGGESTION_STATUS_COLORS[status] || 'border-slate-200 bg-slate-100 text-slate-700';
