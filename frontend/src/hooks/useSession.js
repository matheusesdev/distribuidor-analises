import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { normalizeUiText } from '../utils/textEncoding';
import {
  ANALYST_SESSION_KEY,
  MANAGER_SESSION_KEY,
  ANALYST_REMEMBER_MARKER,
  MANAGER_REMEMBER_MARKER,
  RETURNED_AFTER_LOGOUT_KEY,
  LOGIN_SUCCESS_SPLASH_MS,
  DAILY_ANALYST_LOGOUT_MARKER,
} from '../constants';
import {
  readSessionFromStorage,
  writeSessionToStorage,
  clearSessionFromStorage,
  markSuccessfulLoginToday,
} from '../utils/storage';
import { getLocalDateKey } from '../utils/format';

export function useSession({ notify, view, setView, setAnalystTab, setManagerTab }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const { session } = readSessionFromStorage(ANALYST_SESSION_KEY);
    return session;
  });

  const [managerSession, setManagerSession] = useState(() => {
    const { session } = readSessionFromStorage(MANAGER_SESSION_KEY);
    return session;
  });

  const [keepAnalystLoggedIn, setKeepAnalystLoggedIn] = useState(() => {
    if (typeof window === 'undefined') return false;
    const { source } = readSessionFromStorage(ANALYST_SESSION_KEY);
    if (source === 'localStorage') return true;
    return window.localStorage.getItem(ANALYST_REMEMBER_MARKER) === '1';
  });

  const [keepManagerLoggedIn, setKeepManagerLoggedIn] = useState(() => {
    if (typeof window === 'undefined') return false;
    const { source } = readSessionFromStorage(MANAGER_SESSION_KEY);
    if (source === 'localStorage') return true;
    return window.localStorage.getItem(MANAGER_REMEMBER_MARKER) === '1';
  });

  const [hasReturnedAfterLogout, setHasReturnedAfterLogout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(RETURNED_AFTER_LOGOUT_KEY) === '1';
  });

  const [managerIdentifier, setManagerIdentifier] = useState(() => {
    const { session } = readSessionFromStorage(MANAGER_SESSION_KEY);
    return session?.email || session?.usuario || '';
  });

  const [managerPassword, setManagerPassword] = useState('');
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [showManagerLoginModal, setShowManagerLoginModal] = useState(false);
  const [loginNotice, setLoginNotice] = useState(null);
  const [loginSuccessSplash, setLoginSuccessSplash] = useState({ visible: false, role: null });
  const [idlePrompt, setIdlePrompt] = useState({ visible: false, role: null, secondsLeft: 0 });
  const [mobileIdleWarningDismissUntil, setMobileIdleWarningDismissUntil] = useState(0);

  const sessionActivityPersistRef = useRef({ manager: 0, analyst: 0 });
  const sessionExpiryGuardRef = useRef(false);
  const loginSuccessTimerRef = useRef(null);

  const setSafeLoginNotice = useCallback((message) => {
    setLoginNotice(typeof message === 'string' ? normalizeUiText(message) : message);
  }, []);

  const markReturnedAfterLogout = useCallback(() => {
    setHasReturnedAfterLogout(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RETURNED_AFTER_LOGOUT_KEY, '1');
    }
  }, []);

  const normalizeUiData = useCallback((value) => {
    if (typeof value === 'string') {
      return normalizeUiText(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeUiData(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [normalizeUiText(key), normalizeUiData(item)]),
      );
    }

    return value;
  }, []);

  const runLoginSuccessSplash = useCallback((role, onComplete) => {
    if (loginSuccessTimerRef.current) {
      window.clearTimeout(loginSuccessTimerRef.current);
      loginSuccessTimerRef.current = null;
    }

    setLoginSuccessSplash({ visible: true, role });
    loginSuccessTimerRef.current = window.setTimeout(() => {
      setLoginSuccessSplash({ visible: false, role: null });
      loginSuccessTimerRef.current = null;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }, LOGIN_SUCCESS_SPLASH_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (loginSuccessTimerRef.current) {
        window.clearTimeout(loginSuccessTimerRef.current);
      }
    };
  }, []);

  const persistAnalystSession = useCallback((session, options = {}) => {
    const keepLoggedIn = options.keepLoggedIn ?? keepAnalystLoggedIn;
    const normalizedSession = session
      ? {
          ...session,
          lastActivityAt: session.lastActivityAt || Date.now(),
        }
      : null;

    setCurrentUser(normalizedSession);
    if (typeof window === 'undefined') return;

    if (normalizedSession) {
      writeSessionToStorage(ANALYST_SESSION_KEY, normalizedSession, keepLoggedIn);
      window.localStorage.setItem(ANALYST_REMEMBER_MARKER, keepLoggedIn ? '1' : '0');
      return;
    }

    clearSessionFromStorage(ANALYST_SESSION_KEY);
    window.localStorage.removeItem(ANALYST_REMEMBER_MARKER);
  }, [keepAnalystLoggedIn]);

  const clearAnalystSession = useCallback(() => {
    persistAnalystSession(null);
    setAnalystTab('mesa');
  }, [persistAnalystSession, setAnalystTab]);

  const persistManagerSession = useCallback((session, options = {}) => {
    const keepLoggedIn = options.keepLoggedIn ?? keepManagerLoggedIn;
    const normalizedSession = session
      ? {
          ...session,
          lastActivityAt: session.lastActivityAt || Date.now(),
        }
      : null;

    setManagerSession(normalizedSession);
    if (typeof window === 'undefined') return;

    if (normalizedSession) {
      writeSessionToStorage(MANAGER_SESSION_KEY, normalizedSession, keepLoggedIn);
      window.localStorage.setItem(MANAGER_REMEMBER_MARKER, keepLoggedIn ? '1' : '0');
      return;
    }

    clearSessionFromStorage(MANAGER_SESSION_KEY);
    window.localStorage.removeItem(MANAGER_REMEMBER_MARKER);
  }, [keepManagerLoggedIn]);

  const clearManagerSession = useCallback(() => {
    persistManagerSession(null);
  }, [persistManagerSession]);

  const touchAnalystActivity = useCallback(() => {
    const now = Date.now();
    if (now - sessionActivityPersistRef.current.analyst < 15000) return;
    sessionActivityPersistRef.current.analyst = now;
    setCurrentUser((prev) => {
      if (!prev?.id) return prev;
      const next = { ...prev, lastActivityAt: now };
      if (typeof window !== 'undefined') {
        const keepLoggedIn = window.localStorage.getItem(ANALYST_REMEMBER_MARKER) === '1';
        writeSessionToStorage(ANALYST_SESSION_KEY, next, keepLoggedIn);
      }
      return next;
    });
  }, []);

  const touchManagerActivity = useCallback(() => {
    const now = Date.now();
    if (now - sessionActivityPersistRef.current.manager < 15000) return;
    sessionActivityPersistRef.current.manager = now;
    setManagerSession((prev) => {
      if (!prev?.token) return prev;
      const next = { ...prev, lastActivityAt: now };
      if (typeof window !== 'undefined') {
        const keepLoggedIn = window.localStorage.getItem(MANAGER_REMEMBER_MARKER) === '1';
        writeSessionToStorage(MANAGER_SESSION_KEY, next, keepLoggedIn);
      }
      return next;
    });
  }, []);

  const handleAnalystLogout = useCallback(async ({ reason = 'manual' } = {}) => {
    if (!currentUser?.id) {
      clearAnalystSession();
      markReturnedAfterLogout();
      setView('login');
      return;
    }

    clearAnalystSession();
    setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
    markReturnedAfterLogout();
    setView('login');

    if (reason === 'idle') {
      setSafeLoginNotice('Sua sessão foi encerrada por inatividade. Faça login para retomar o atendimento.');
      notify('Sessão encerrada por inatividade.', 'error');
      return;
    }

    if (reason === 'daily-cutoff') {
      setSafeLoginNotice('Sessão encerrada automaticamente às 23:59. Faça login novamente para continuar.');
      notify('Sessão encerrada automaticamente às 23:59.', 'success');
      return;
    }

    if (reason === 'password-change') {
      setSafeLoginNotice('Senha atualizada com sucesso. Entre novamente para abrir uma nova sessão segura.');
      notify('Senha alterada. Por segurança, faça login novamente.', 'success');
      return;
    }

    if (reason === 'manager-revocation') {
      setSafeLoginNotice('Sua sessão foi encerrada pelo gestor. Faça login novamente para continuar.');
      notify('Acesso encerrado pelo gestor. Faça login novamente.', 'error');
      return;
    }
    notify('Sessão encerrada.', 'success');
  }, [currentUser, clearAnalystSession, markReturnedAfterLogout, notify, setSafeLoginNotice, setView]);

  const handleManagerUnauthorized = useCallback(() => {
    clearManagerSession();
    setShowManagerLoginModal(false);
    setManagerIdentifier('');
    setManagerPassword('');
    setShowManagerPassword(false);
    setManagerTab('dashboard');
    markReturnedAfterLogout();
    setView('login');
    setSafeLoginNotice('Sua sessão de gestor expirou. Faça login novamente para continuar no painel.');
    notify('Sessão do administrador expirada. Faça login novamente.', 'error');
  }, [clearManagerSession, markReturnedAfterLogout, notify, setSafeLoginNotice, setManagerTab, setView]);

  const handleAnalystUnauthorized = useCallback(() => {
    const hasAnalystSession = typeof window !== 'undefined'
      && (Boolean(window.sessionStorage.getItem(ANALYST_SESSION_KEY))
        || Boolean(window.localStorage.getItem(ANALYST_SESSION_KEY)));

    clearAnalystSession();
    setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
    markReturnedAfterLogout();
    setView('login');

    if (!hasAnalystSession) return;

    setSafeLoginNotice('Sua sessão foi encerrada pelo gestor ou expirou. Faça login novamente para continuar.');
    notify('Sessão revogada ou expirada. Faça login novamente.', 'error');
  }, [clearAnalystSession, markReturnedAfterLogout, notify, setSafeLoginNotice, setView]);

  useEffect(() => {
    if (view === 'manager' && !managerSession?.token) {
      setView('login');
    }
  }, [managerSession, view, setView]);

  useEffect(() => {
    if (view === 'login') return;

    const handleActivity = () => {
      if (managerSession?.token) {
        touchManagerActivity();
        return;
      }
      if (currentUser?.id) {
        touchAnalystActivity();
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, [view, managerSession?.token, currentUser?.id, touchManagerActivity, touchAnalystActivity]);

  useEffect(() => {
    if (view === 'login') {
      setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
      return;
    }

    const interval = setInterval(() => {
      if (managerSession?.token) {
        if (idlePrompt.visible && idlePrompt.role === 'admin') {
          setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
        }
        return;
      }

      if (currentUser?.id) {
        if (idlePrompt.visible && idlePrompt.role === 'analyst') {
          setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    view,
    managerSession,
    currentUser,
    idlePrompt.visible,
    idlePrompt.role,
    clearManagerSession,
    handleAnalystLogout,
    notify,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (view === 'login' || managerSession?.token || !currentUser?.id) return undefined;

    const maybeDailyLogout = () => {
      const now = new Date();
      const isCutoffReached = now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 59);
      if (!isCutoffReached) return;

      const todayKey = getLocalDateKey(now);
      const alreadyLoggedOutToday = window.localStorage.getItem(DAILY_ANALYST_LOGOUT_MARKER) === todayKey;
      if (alreadyLoggedOutToday) return;

      window.localStorage.setItem(DAILY_ANALYST_LOGOUT_MARKER, todayKey);
      void handleAnalystLogout({ reason: 'daily-cutoff' });
    };

    maybeDailyLogout();
    const interval = window.setInterval(maybeDailyLogout, 30 * 1000);
    return () => window.clearInterval(interval);
  }, [view, managerSession?.token, currentUser?.id, handleAnalystLogout]);

  return {
    currentUser, setCurrentUser,
    managerSession, setManagerSession,
    keepAnalystLoggedIn, setKeepAnalystLoggedIn,
    keepManagerLoggedIn, setKeepManagerLoggedIn,
    hasReturnedAfterLogout,
    loginNotice, setLoginNotice,
    loginSuccessSplash,
    idlePrompt, setIdlePrompt,
    mobileIdleWarningDismissUntil, setMobileIdleWarningDismissUntil,
    managerIdentifier, setManagerIdentifier,
    managerPassword, setManagerPassword,
    showManagerPassword, setShowManagerPassword,
    showManagerLoginModal, setShowManagerLoginModal,
    persistAnalystSession, clearAnalystSession,
    persistManagerSession, clearManagerSession,
    touchAnalystActivity, touchManagerActivity,
    setSafeLoginNotice, markReturnedAfterLogout,
    runLoginSuccessSplash,
    handleManagerLogout: null,
    handleAnalystUnauthorized, handleManagerUnauthorized,
    normalizeUiData,
  };
}
