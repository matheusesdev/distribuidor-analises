const REPLACEMENTS = [
  [`Sess${'\uFFFD'}o`, 'Sessão'],
  [`sess${'\uFFFD'}o`, 'sessão'],
  [`Sess${'\uFFFD'}es`, 'Sessões'],
  [`sess${'\uFFFD'}es`, 'sessões'],
  [`expira${'\uFFFD'}${'\uFFFD'}o`, 'expiração'],
  [`revoga${'\uFFFD'}${'\uFFFD'}o`, 'revogação'],
  [`A${'\uFFFD'}${'\uFFFD'}o`, 'Ação'],
  [`a${'\uFFFD'}${'\uFFFD'}o`, 'ação'],
  [`conex${'\uFFFD'}o`, 'conexão'],
  [`gest${'\uFFFD'}o`, 'gestão'],
  [`informa${'\uFFFD'}${'\uFFFD'}o`, 'informação'],
  [`distribui${'\uFFFD'}${'\uFFFD'}o`, 'distribuição'],
  [`confirma${'\uFFFD'}${'\uFFFD'}o`, 'confirmação'],
  [`produ${'\uFFFD'}${'\uFFFD'}o`, 'produção'],
  [`hist${'\uFFFD'}rico`, 'histórico'],
  [`per${'\uFFFD'}odo`, 'período'],
  [`di${'\uFFFD'}rio`, 'diário'],
  [`n${'\uFFFD'}o`, 'não'],
  [`N${'\uFFFD'}o`, 'Não'],
  [`est${'\uFFFD'}`, 'está'],
  [`Est${'\uFFFD'}`, 'Está'],
  [`CONFEC${'\uFFFD'}${'\uFFFD'}O`, 'CONFECÇÃO'],
  [`CONFEC${'\uFFFD'}${'\uFFFD'}O DE CONTRATO`, 'CONFECÇÃO DE CONTRATO'],
  [`CONFEC${'\uFFFD'}${'\uFFFD'}O DE CONTRATO (LOTEAR)`, 'CONFECÇÃO DE CONTRATO (LOTEAR)'],
  [`APROVA${'\uFFFD'}${'\uFFFD'}O EXPANS${'\uFFFD'}${'\uFFFD'}O`, 'APROVAÇÃO EXPANSÃO'],
  [`APROVA${'\uFFFD'}${'\uFFFD'}O EXPANS${'\uFFFD'}${'\uFFFD'}O (LOTEAR)`, 'APROVAÇÃO EXPANSÃO (LOTEAR)'],
  // Padrão com diamante ◆
  ['APROVA◆◆O EXPANS◆O', 'APROVAÇÃO EXPANSÃO'],
  ['APROVA◆◆O EXPANS◆O (LOTEAR)', 'APROVAÇÃO EXPANSÃO (LOTEAR)'],
  ['CONFEC◆◆O', 'CONFECÇÃO'],
  ['CONFEC◆◆O DE CONTRATO', 'CONFECÇÃO DE CONTRATO'],
  ['CONFEC◆◆O DE CONTRATO (LOTEAR)', 'CONFECÇÃO DE CONTRATO (LOTEAR)'],
  ['AN◆LISE', 'ANÁLISE'],
  ['an◆lise', 'análise'],
  ['ASSINADO (LOTEAR)', 'ASSINADO (LOTEAR)'],
];

const tryDecodeLatin1AsUtf8 = (value) => {
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return value;
  }
};

export const normalizeUiText = (value) => {
  if (typeof value !== 'string' || !value) return value;

  let result = value;

  if (/[\u00C3\u00C2]/.test(result)) {
    const decoded = tryDecodeLatin1AsUtf8(result);
    if (decoded && decoded !== result) {
      result = decoded;
    }
  }

  for (const [broken, fixed] of REPLACEMENTS) {
    result = result.replaceAll(broken, fixed);
  }

  // Padrões com regex para capturar variações de ◆ (U+25C6) e outros caracteres corrompidos
  result = result.replace(/APROVA[\u25c6\uFFFD]+O\s+EXPANS[\u25c6\uFFFD]+O\s*\(LOTEAR\)/gi, 'APROVAÇÃO EXPANSÃO (LOTEAR)');
  result = result.replace(/APROVA[\u25c6\uFFFD]+O\s+EXPANS[\u25c6\uFFFD]+O/gi, 'APROVAÇÃO EXPANSÃO');
  result = result.replace(/CONFEC[\u25c6\uFFFD]+O\s+DE\s+CONTRATO\s*\(LOTEAR\)/gi, 'CONFECÇÃO DE CONTRATO (LOTEAR)');
  result = result.replace(/CONFEC[\u25c6\uFFFD]+O\s+DE\s+CONTRATO/gi, 'CONFECÇÃO DE CONTRATO');
  result = result.replace(/CONFEC[\u25c6\uFFFD]+O/gi, 'CONFECÇÃO');
  result = result.replace(/AN[\u25c6\uFFFD]+LISE\s*\(LOTEAR\)/gi, 'ANÁLISE (LOTEAR)');
  result = result.replace(/AN[\u25c6\uFFFD]+LISE/gi, 'ANÁLISE');
  result = result.replace(/Sess[\u25c6\uFFFD]+es/g, 'Sessões');
  result = result.replace(/sess[\u25c6\uFFFD]+es/g, 'sessões');
  result = result.replace(/Sess[\u25c6\uFFFD]+o/g, 'Sessão');
  result = result.replace(/sess[\u25c6\uFFFD]+o/g, 'sessão');

  return result;
};
