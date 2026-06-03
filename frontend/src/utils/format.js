export const getLogDateRef = (log) => log?.data_transferencia || log?.created_at;

export const getMonthKey = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getAnalystDisplayName = (id, name) => name || `Analista ${id}`;

export const createTransferOptions = (logs, idField, nameField) => {
  const map = new Map();
  (logs || []).forEach((log) => {
    const id = log?.[idField];
    if (!id) return;
    const key = String(id);
    if (!map.has(key)) {
      map.set(key, {
        value: key,
        label: getAnalystDisplayName(id, log?.[nameField])
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export const formatIdleCountdown = (secondsLeft) => {
  const safeSeconds = Math.max(0, Number(secondsLeft) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
