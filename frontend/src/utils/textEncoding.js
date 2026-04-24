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

  return result;
};
