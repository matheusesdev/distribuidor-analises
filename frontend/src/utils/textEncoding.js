const REPLACEMENTS = [
  ['Sess�o', 'Sessão'],
  ['sess�o', 'sessão'],
  ['Sess�es', 'Sessões'],
  ['sess�es', 'sessões'],
  ['expira��o', 'expiração'],
  ['revoga��o', 'revogação'],
  ['A��o', 'Ação'],
  ['a��o', 'ação'],
  ['conex�o', 'conexão'],
  ['gest�o', 'gestão'],
  ['informa��o', 'informação'],
  ['distribui��o', 'distribuição'],
  ['n�o', 'não'],
  ['N�o', 'Não'],
  ['est�', 'está'],
  ['Est�', 'Está'],
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

  if (/[ÃÂ]/.test(result)) {
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
