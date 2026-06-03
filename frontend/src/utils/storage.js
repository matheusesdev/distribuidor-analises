import {
  ANALYST_SESSION_KEY,
  MANAGER_SESSION_KEY,
  MESA_FREEZE_STORAGE_KEY,
  MANUAL_TRANSFER_NOTIFICATION_STORAGE_KEY,
  PRIVACY_POLICY_QUERY_KEY,
  LAST_LOGIN_DATE_KEY,
  RETURNED_AFTER_LOGOUT_KEY,
} from '../constants';
import { getLocalDateKey } from './format';

export const parseStoredSession = (rawSession) => {
  if (!rawSession) return null;
  try {
    return JSON.parse(rawSession);
  } catch {
    return null;
  }
};

export const readSessionFromStorage = (key) => {
  if (typeof window === 'undefined') return { session: null, source: null };

  const fromSessionStorage = parseStoredSession(window.sessionStorage.getItem(key));
  if (fromSessionStorage) {
    return { session: fromSessionStorage, source: 'sessionStorage' };
  }

  const fromLocalStorage = parseStoredSession(window.localStorage.getItem(key));
  if (fromLocalStorage) {
    return { session: fromLocalStorage, source: 'localStorage' };
  }

  return { session: null, source: null };
};

export const clearSessionFromStorage = (key) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
};

export const writeSessionToStorage = (key, session, persistInLocalStorage = false) => {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(session);

  if (persistInLocalStorage) {
    window.localStorage.setItem(key, payload);
    window.sessionStorage.removeItem(key);
    return;
  }

  window.sessionStorage.setItem(key, payload);
  window.localStorage.removeItem(key);
};

export const getStoredMesaFreeze = (analystId) => {
  if (typeof window === 'undefined' || !analystId) return { active: false, taskIds: [] };

  try {
    const stored = JSON.parse(window.localStorage.getItem(`${MESA_FREEZE_STORAGE_KEY}:${analystId}`) || 'null');
    if (!stored?.active || !Array.isArray(stored.taskIds)) return { active: false, taskIds: [] };

    return {
      active: true,
      taskIds: stored.taskIds.map((id) => String(id)).filter(Boolean),
    };
  } catch {
    return { active: false, taskIds: [] };
  }
};

export const writeStoredMesaFreeze = (analystId, freezeState) => {
  if (typeof window === 'undefined' || !analystId) return;
  const key = `${MESA_FREEZE_STORAGE_KEY}:${analystId}`;

  if (!freezeState?.active || !freezeState.taskIds?.length) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify({
    active: true,
    taskIds: freezeState.taskIds.map((id) => String(id)),
    frozenAt: new Date().toISOString(),
  }));
};

export const getManualTransferNotificationKey = (analystId) => `${MANUAL_TRANSFER_NOTIFICATION_STORAGE_KEY}:${analystId}`;

export const readManualTransferNotificationIds = (analystId) => {
  if (typeof window === 'undefined' || !analystId) return new Set();

  try {
    const rawValue = window.localStorage.getItem(getManualTransferNotificationKey(analystId));
    if (!rawValue) return new Set();

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.map((item) => String(item)).filter(Boolean));
  } catch {
    return new Set();
  }
};

export const writeManualTransferNotificationIds = (analystId, ids) => {
  if (typeof window === 'undefined' || !analystId) return;
  window.localStorage.setItem(getManualTransferNotificationKey(analystId), JSON.stringify(Array.from(ids)));
};

export const getInitialView = () => {
  if (typeof window === 'undefined') return 'login';
  const params = new URLSearchParams(window.location.search);
  return params.get(PRIVACY_POLICY_QUERY_KEY) === '1' ? 'privacy-policy' : 'login';
};

export const markSuccessfulLoginToday = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_LOGIN_DATE_KEY, getLocalDateKey());
  window.localStorage.removeItem(RETURNED_AFTER_LOGOUT_KEY);
};
