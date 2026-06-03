import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock, AlertTriangle, X, LayoutDashboard,
  TrendingUp, LogOut, Power, Settings,
  Edit3, Users, BarChart3, RotateCcw, ArrowRightLeft, LineChart, MessageSquare,
  Moon, Sun, UserPlus
} from 'lucide-react';
import { api } from './services/api';
import { normalizeUiText } from './utils/textEncoding';
import { markSuccessfulLoginToday, getStoredMesaFreeze, writeStoredMesaFreeze, getManualTransferNotificationKey, readManualTransferNotificationIds, writeManualTransferNotificationIds } from './utils/storage';
import { getLocalDateKey, createTransferOptions, getMonthKey, getLogDateRef, formatIdleCountdown } from './utils/format';
import { EMPTY_ANALYTICS, AUTO_REFRESH_SECONDS, ALL_FILTER, LEGACY_MANAGER_TOKEN, ANALYST_SESSION_KEY, PRIVACY_POLICY_QUERY_KEY } from './constants';
import { useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { useSession } from './hooks/useSession';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { ConfirmActionModal, LoadingOverlay, RevokeAccessModal, StatusToast } from './components/FeedbackOverlays';
import LoginView from './components/LoginView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import ResetPasswordView from './components/ResetPasswordView';
import MesaView from './components/analyst/MesaView';
import AnalystAnalyticsTab from './components/analyst/AnalystAnalyticsTab';
import AnalystSettingsTab from './components/analyst/AnalystSettingsTab';
import AnalystSuggestionsTab from './components/analyst/AnalystSuggestionsTab';
import ManagerHeader from './components/manager/ManagerHeader';
import ManagerDashboardTab from './components/manager/ManagerDashboardTab';
import ManagerTransfersTab from './components/manager/ManagerTransfersTab';
import ManagerQueueTab from './components/manager/ManagerQueueTab';
import ManagerAdminsTab from './components/manager/ManagerAdminsTab';
import ManagerSuggestionsTab from './components/manager/ManagerSuggestionsTab';
import EditAnalystModal from './components/manager/EditAnalystModal';
import TransferModal from './components/TransferModal';
import BulkTransferModal from './components/BulkTransferModal';

const getInitialView = () => {
  if (typeof window === 'undefined') return 'login';
  const params = new URLSearchParams(window.location.search);
  return params.get(PRIVACY_POLICY_QUERY_KEY) === '1' ? 'privacy-policy' : 'login';
};

const App = () => {
  const [view, setView] = useState(getInitialView);
  const [analystTab, setAnalystTab] = useState('mesa');
  const [managerTab, setManagerTab] = useState('dashboard');
  const [managerTabDirection, setManagerTabDirection] = useState('forward');
  const [transferMonthFilter, setTransferMonthFilter] = useState(ALL_FILTER);
  const [transferOriginFilter, setTransferOriginFilter] = useState(ALL_FILTER);
  const [transferDestinationFilter, setTransferDestinationFilter] = useState(ALL_FILTER);

  const [resetToken, setResetToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('reset_token') || null;
  });

  const [analysts, setAnalysts] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [metrics, setMetrics] = useState({ hoje: 0, ano: 0 });
  const [analyticsData, setAnalyticsData] = useState(EMPTY_ANALYTICS);
  const [suggestions, setSuggestions] = useState([]);
  const [managerSuggestions, setManagerSuggestions] = useState([]);
  const [hasLoadedMesa, setHasLoadedMesa] = useState(false);
  const [dashData, setDashData] = useState({
    equipe: [],
    resumo_equipe: [],
    distribuicao_atual: [],
    historico_recente: [],
    logs_transferencias: [],
    total_pendente_cvcrm: 0,
    pastas_sem_destino: 0
  });
  const [managerSyncStatus, setManagerSyncStatus] = useState({
    por_situacao: {},
    situacoes_falharam: [],
    limpeza_escopo: null,
    removidas_na_limpeza: 0,
    timestamp: null,
  });

  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiError, setApiError] = useState(null);

  const [taskSearch, setTaskSearch] = useState('');
  const [filterSit, setFilterSit] = useState('all');
  const [mesaFreeze, setMesaFreeze] = useState({ active: false, taskIds: [] });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, nome: '', email: '', senha: '', permissoes: [], status: 'ativo' });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminForm, setAdminForm] = useState({ email: '', username: '', senha: '', ativo: true });
  const [confirmAction, setConfirmAction] = useState({ open: false, title: '', message: '', confirmLabel: 'Confirmar', tone: 'warning' });
  const [revokeAction, setRevokeAction] = useState({
    open: false, role: 'admin', targetName: '', targetId: null,
    step: 1, acknowledged: false, confirmPhrase: '', reason: '',
  });
  const [togglingQueueIds, setTogglingQueueIds] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTask, setTransferTask] = useState(null);
  const [transferToId, setTransferToId] = useState('');
  const [transferTargetSearch, setTransferTargetSearch] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [bulkTransferToId, setBulkTransferToId] = useState('');
  const [bulkTransferTargetSearch, setBulkTransferTargetSearch] = useState('');
  const [bulkTransferReason, setBulkTransferReason] = useState('');

  const confirmResolverRef = useRef(null);
  const manualTransferNotificationRef = useRef({ key: null, ids: new Set() });

  const { toast, notify } = useToast();
  const { isDarkMode, toggleThemeMode } = useTheme({ view, resetToken });

  const session = useSession({ notify, view, setView, setAnalystTab, setManagerTab });
  const {
    currentUser, setCurrentUser,
    managerSession, setManagerSession,
    keepAnalystLoggedIn, setKeepAnalystLoggedIn,
    keepManagerLoggedIn, setKeepManagerLoggedIn,
    hasReturnedAfterLogout,
    loginNotice,
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
    handleAnalystUnauthorized, handleManagerUnauthorized,
    normalizeUiData,
  } = session;

  const openPrivacyPolicy = useCallback(() => {
    setView('privacy-policy');
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set(PRIVACY_POLICY_QUERY_KEY, '1');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const closePrivacyPolicy = useCallback(() => {
    setView('login');
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete(PRIVACY_POLICY_QUERY_KEY);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const CRM_BASE_BY_SOURCE = {
    cvcrm: 'https://vca.cvcrm.com.br/gestor/comercial/reservas',
    lotear: 'https://vcalotear.cvcrm.com.br/gestor/comercial/reservas',
  };

  const SITUACOES_MAP = {
    62: normalizeUiText('ANÁLISE VENDA LOTEAMENTO'),
    63: normalizeUiText('APROVAÇÃO FINANCEIRA'),
    66: normalizeUiText('ANÁLISE VENDA PARCELAMENTO INCORPORADORA'),
    30: normalizeUiText('ANÁLISE VENDA CAIXA'),
    16: normalizeUiText('CONFECÇÃO DE CONTRATO'),
    15: normalizeUiText('APROVAÇÃO FINANCEIRA (LOTEAR)'),
    31: normalizeUiText('ASSINADO'),
    84: normalizeUiText('APROVAÇÃO EXPANSÃO'),
    1012: normalizeUiText('ANÁLISE VENDA LOTEAMENTO (LOTEAR)'),
    1023: normalizeUiText('APROVAÇÃO EXPANSÃO (LOTEAR)'),
    1016: normalizeUiText('CONFECÇÃO DE CONTRATO (LOTEAR)'),
    1021: normalizeUiText('ASSINADO (LOTEAR)'),
  };

  const SIT_COLORS = useMemo(() => {
    if (isDarkMode) {
      return {
        62: { text: '#9dd6b5', bg: 'rgba(34, 197, 94, 0.10)', border: 'rgba(74, 222, 128, 0.18)' },
        63: { text: '#d4cf8a', bg: 'rgba(202, 138, 4, 0.11)', border: 'rgba(234, 179, 8, 0.18)' },
        66: { text: '#a7d9b5', bg: 'rgba(22, 163, 74, 0.10)', border: 'rgba(74, 222, 128, 0.18)' },
        30: { text: '#bdd98d', bg: 'rgba(101, 163, 13, 0.11)', border: 'rgba(190, 242, 100, 0.16)' },
        84: { text: '#93d5ca', bg: 'rgba(20, 184, 166, 0.10)', border: 'rgba(94, 234, 212, 0.17)' },
        16: { text: '#dfc98a', bg: 'rgba(217, 119, 6, 0.11)', border: 'rgba(251, 191, 36, 0.17)' },
        15: { text: '#c6ca83', bg: 'rgba(132, 145, 32, 0.12)', border: 'rgba(217, 229, 90, 0.15)' },
        31: { text: '#e4b286', bg: 'rgba(234, 88, 12, 0.11)', border: 'rgba(251, 146, 60, 0.17)' },
        1012: { text: '#8bd5e2', bg: 'rgba(8, 145, 178, 0.10)', border: 'rgba(103, 232, 249, 0.17)' },
        1023: { text: '#b7a9df', bg: 'rgba(124, 58, 237, 0.10)', border: 'rgba(196, 181, 253, 0.16)' },
        1016: { text: '#d1a8d6', bg: 'rgba(192, 38, 211, 0.10)', border: 'rgba(233, 213, 255, 0.15)' },
        1021: { text: '#e0a986', bg: 'rgba(234, 88, 12, 0.11)', border: 'rgba(251, 146, 60, 0.17)' },
      };
    }
    return {
      62: { text: '#355e3b', bg: '#e8f3eb' },
      63: { text: '#5c611f', bg: '#f4f1a6' },
      66: { text: '#2f6b2f', bg: '#e4f2e4' },
      30: { text: '#3b6b2f', bg: '#edf7e7' },
      84: { text: '#1f6b5f', bg: '#e2f3ef' },
      16: { text: '#7a6632', bg: '#faf5e2' },
      15: { text: '#5c611f', bg: '#e5ee78' },
      31: { text: '#8a5a2b', bg: '#fbeee3' },
      1012: { text: '#0b7285', bg: '#e3f4f7' },
      1023: { text: '#5f3dc4', bg: '#ede9fe' },
      1016: { text: '#9c36b5', bg: '#f8ecfc' },
      1021: { text: '#9a3412', bg: '#fff1e6' },
    };
  }, [isDarkMode]);

  const parseReservaRef = useCallback((reservaId) => {
    const normalized = String(reservaId || '').trim();
    if (!normalized) {
      return { source: 'cvcrm', externalId: '', fullId: '' };
    }
    const [prefix, ...rest] = normalized.split(':');
    if (rest.length > 0 && Object.prototype.hasOwnProperty.call(CRM_BASE_BY_SOURCE, prefix)) {
      return { source: prefix, externalId: rest.join(':'), fullId: normalized };
    }
    return { source: 'cvcrm', externalId: normalized, fullId: normalized };
  }, []);

  const getReservaDisplayId = useCallback((reservaId) => {
    return parseReservaRef(reservaId).externalId || String(reservaId || '');
  }, [parseReservaRef]);

  const calculatedStats = useMemo(() => {
    const breakdown = {};
    Object.keys(SITUACOES_MAP).forEach(id => breakdown[id] = 0);

    const syncBySituationName = managerSyncStatus?.por_situacao || {};
    const hasSyncBreakdown = Object.keys(syncBySituationName).length > 0;

    if (hasSyncBreakdown) {
      Object.entries(SITUACOES_MAP).forEach(([id, nome]) => {
        const total = Number(syncBySituationName[nome]);
        breakdown[id] = Number.isFinite(total) && total > 0 ? total : 0;
      });
    }

    const analistasMapa = {};
    dashData.equipe.forEach(a => {
      analistasMapa[a.id] = { naMesa: 0, feitosHoje: 0 };
    });

    dashData.distribuicao_atual?.forEach(item => {
      if (!hasSyncBreakdown && breakdown[item.situacao_id] !== undefined) breakdown[item.situacao_id]++;
      if (analistasMapa[item.analista_id]) analistasMapa[item.analista_id].naMesa++;
    });

    dashData.historico_recente?.forEach(item => {
      if (analistasMapa[item.analista_id]) analistasMapa[item.analista_id].feitosHoje++;
    });

    return { breakdown, analistasMapa };
  }, [dashData, managerSyncStatus?.por_situacao, SITUACOES_MAP]);

  const calculatedBreakdown = calculatedStats.breakdown;
  const analistasMapa = calculatedStats.analistasMapa;

  const getApiErrorMessage = async (response, fallbackMessage) => {
    try {
      const data = normalizeUiData(await response.json());
      if (typeof data === 'string' && data.trim()) return data;
      if (data?.detail) return data.detail;
      if (data?.message) return data.message;
    } catch {
      // ignora erro de parse para usar fallback
    }
    return `${fallbackMessage} (${response.status})`;
  };

  const fetchData = useCallback(async (silent = true) => {
    if (!silent) setIsGlobalLoading(true);
    setIsSyncing(true);
    try {
      if (view === 'analyst' && currentUser) {
        const resA = await api.listAnalysts();
        if (resA.ok) {
          setAnalysts(normalizeUiData(await resA.json()));
        } else if (resA.status === 401) {
          handleAnalystUnauthorized();
          return;
        }

        const resM = await api.getMesa(currentUser.id);
        if (resM.ok) {
          setMyTasks(normalizeUiData(await resM.json()));
          setHasLoadedMesa(true);
        } else if (resM.status === 401) {
          handleAnalystUnauthorized();
          return;
        }
        const resMet = await api.getMetrics(currentUser.id);
        if (resMet.ok) {
          setMetrics(normalizeUiData(await resMet.json()));
        } else if (resMet.status === 401) {
          handleAnalystUnauthorized();
          return;
        }
        const resAnalytics = await api.getAnalystDashboard(currentUser.id);
        if (resAnalytics.ok) {
          setAnalyticsData(normalizeUiData(await resAnalytics.json()));
        } else if (resAnalytics.status === 401) {
          handleAnalystUnauthorized();
          return;
        } else {
          setAnalyticsData(EMPTY_ANALYTICS);
        }

        const resSuggestions = await api.listSuggestions();
        if (resSuggestions.ok) {
          setSuggestions(normalizeUiData(await resSuggestions.json()));
        } else if (resSuggestions.status === 401) {
          handleAnalystUnauthorized();
          return;
        } else {
          setSuggestions([]);
        }
      }

      if (view === 'manager') {
        const [resD, resSync, resManagerSuggestions] = await Promise.all([
          api.getManagerOverview(),
          api.getManagerSyncStatus(),
          api.getManagerSuggestions(),
        ]);

        if (resD.ok) {
          const d = normalizeUiData(await resD.json());
          setDashData({
            equipe: d.equipe || [],
            resumo_equipe: d.resumo_equipe || [],
            distribuicao_atual: d.distribuicao_atual || [],
            historico_recente: d.historico_recente || [],
            logs_transferencias: d.logs_transferencias || [],
            total_pendente_cvcrm: d.total_pendente_cvcrm || 0,
            pastas_sem_destino: d.pastas_sem_destino || 0
          });
        } else if (resD.status === 401) {
          handleManagerUnauthorized();
          return;
        }

        if (resSync.ok) {
          const s = normalizeUiData(await resSync.json());
          setManagerSyncStatus({
            por_situacao: s.por_situacao || {},
            situacoes_falharam: s.situacoes_falharam || [],
            limpeza_escopo: s.limpeza_escopo || null,
            removidas_na_limpeza: s.removidas_na_limpeza || 0,
            timestamp: s.timestamp || null,
          });
        } else if (resSync.status === 401) {
          handleManagerUnauthorized();
          return;
        }

        if (resManagerSuggestions.ok) {
          setManagerSuggestions(normalizeUiData(await resManagerSuggestions.json()));
        } else if (resManagerSuggestions.status === 401) {
          handleManagerUnauthorized();
          return;
        } else {
          setManagerSuggestions([]);
        }
      }
      setApiError(null);
    } catch (e) {
      if (!silent) setApiError('Backend Offline.');
    } finally {
      setIsSyncing(false);
      if (!silent) setIsGlobalLoading(false);
      setNextRefreshAt(Date.now() + (AUTO_REFRESH_SECONDS * 1000));
    }
  }, [currentUser, handleManagerUnauthorized, handleAnalystUnauthorized, view]);

  const { refreshCountdown, setNextRefreshAt } = useAutoRefresh(fetchData);

  useEffect(() => {
    setMesaFreeze(getStoredMesaFreeze(currentUser?.id));
    setSelectedTaskIds(new Set());
    setHasLoadedMesa(false);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    writeStoredMesaFreeze(currentUser.id, mesaFreeze);
  }, [currentUser?.id, mesaFreeze]);

  useEffect(() => {
    if (!mesaFreeze.active || !hasLoadedMesa) return;

    const currentIds = new Set((myTasks || []).map((task) => String(task.reserva_id)));
    const remainingFrozenIds = mesaFreeze.taskIds.filter((id) => currentIds.has(String(id)));

    if (remainingFrozenIds.length === 0 && mesaFreeze.taskIds.length > 0) {
      setMesaFreeze({ active: false, taskIds: [] });
      setSelectedTaskIds(new Set());
      notify('Mesa congelada finalizada. Novas pastas já podem aparecer.', 'success');
      return;
    }

    if (remainingFrozenIds.length !== mesaFreeze.taskIds.length) {
      setMesaFreeze({ active: true, taskIds: remainingFrozenIds });
    }
  }, [hasLoadedMesa, mesaFreeze, myTasks, notify]);

  useEffect(() => {
    if (managerSession?.token && !loginSuccessSplash.visible) {
      setView('manager');
    }
  }, [managerSession?.token, loginSuccessSplash.visible]);

  useEffect(() => {
    if (view === 'login' && !loginSuccessSplash.visible && !managerSession?.token && currentUser?.id) {
      setView('analyst');
    }
  }, [view, loginSuccessSplash.visible, managerSession?.token, currentUser?.id]);

  useEffect(() => {
    if (view === 'manager' && !managerSession?.token) {
      setView('login');
    }
  }, [managerSession, view]);

  useEffect(() => {
    if (view !== 'analyst' || !currentUser?.id) {
      manualTransferNotificationRef.current = { key: null, ids: new Set() };
      return;
    }

    const storageKey = getManualTransferNotificationKey(currentUser.id);
    if (manualTransferNotificationRef.current.key === storageKey) return;

    manualTransferNotificationRef.current = {
      key: storageKey,
      ids: readManualTransferNotificationIds(currentUser.id),
    };
  }, [currentUser?.id, view]);

  useEffect(() => {
    if (view !== 'analyst' || !currentUser?.id || !Array.isArray(myTasks) || !myTasks.length) return;

    const storageKey = getManualTransferNotificationKey(currentUser.id);
    if (manualTransferNotificationRef.current.key !== storageKey) {
      manualTransferNotificationRef.current = {
        key: storageKey,
        ids: readManualTransferNotificationIds(currentUser.id),
      };
    }

    const seenIds = manualTransferNotificationRef.current.ids;
    const newTransfers = (myTasks || [])
      .map((task) => ({ task, transferencia: task?.transferencia_manual, transferenciaId: task?.transferencia_manual?.id }))
      .filter(({ transferenciaId }) => transferenciaId !== undefined && transferenciaId !== null && !seenIds.has(String(transferenciaId)));

    if (!newTransfers.length) return;

    const latestTransfer = newTransfers.reduce((latest, current) => {
      if (!latest) return current;
      const latestTime = new Date(latest.transferencia?.data_transferencia || 0).getTime();
      const currentTime = new Date(current.transferencia?.data_transferencia || 0).getTime();
      return currentTime >= latestTime ? current : latest;
    }, null);

    const transferCount = newTransfers.length;
    const sourceName = latestTransfer?.transferencia?.analista_origem_nome || `Analista ${latestTransfer?.transferencia?.analista_origem_id}`;
    const reason = latestTransfer?.transferencia?.motivo || 'não informado';
    const reservaLabel = latestTransfer?.task?.reserva_id ? `#${getReservaDisplayId(latestTransfer.task.reserva_id)}` : 'sem identificação';
    const prefix = transferCount === 1
      ? 'Uma pasta foi transferida manualmente para você'
      : `${transferCount} pastas foram transferidas manualmente para você`;

    notify(`${prefix} por ${sourceName}. Última recebida: reserva ${reservaLabel}. Motivo: ${reason}.`, 'success');

    newTransfers.forEach(({ transferenciaId }) => seenIds.add(String(transferenciaId)));
    writeManualTransferNotificationIds(currentUser.id, seenIds);
  }, [currentUser?.id, getReservaDisplayId, myTasks, notify, view]);

  useEffect(() => {
    if (view === 'manager' && managerTab === 'admins') {
      fetchAdminUsers();
    }
  }, [view, managerTab]);

  const requestConfirmation = useCallback(({ title, message, confirmLabel = 'Confirmar', tone = 'warning' }) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmAction({ open: true, title, message, confirmLabel, tone });
    });
  }, []);

  const closeConfirmation = (confirmed) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(confirmed);
      confirmResolverRef.current = null;
    }
    setConfirmAction(prev => ({ ...prev, open: false }));
  };

  const requestRevokeConfirmation = useCallback(({ role, targetName, targetId }) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setRevokeAction({
        open: true, role, targetName, targetId,
        step: 1, acknowledged: false, confirmPhrase: '', reason: '',
      });
    });
  }, []);

  const closeRevokeConfirmation = useCallback((payload) => {
    if (payload?.updateOnly) {
      setRevokeAction((prev) => ({ ...prev, ...(payload.patch || {}) }));
      return;
    }

    if (confirmResolverRef.current) {
      confirmResolverRef.current(payload || { confirmed: false });
      confirmResolverRef.current = null;
    }

    setRevokeAction((prev) => ({
      ...prev, open: false, step: 1, acknowledged: false, confirmPhrase: '', reason: '',
    }));
  }, []);

  const handleLogin = async (email, senha, rememberMe = false) => {
    if (!email || !senha) return;
    setIsGlobalLoading(true);
    try {
      const res = await api.loginEmail(email, senha);
      if (res.ok) {
        const userData = normalizeUiData(await res.json());
        setKeepAnalystLoggedIn(Boolean(rememberMe));
        persistAnalystSession(userData, { keepLoggedIn: Boolean(rememberMe) });
        markSuccessfulLoginToday();
        setAnalystTab('mesa');
        setSafeLoginNotice(null);
        notify(`Olá, ${userData.nome}!`);
        runLoginSuccessSplash('analyst', () => setView('analyst'));
      } else {
        notify(await getApiErrorMessage(res, 'Falha no login'), 'error');
      }
    } catch (e) { notify('Erro de conexão com o servidor.', 'error'); }
    finally { setIsGlobalLoading(false); }
  };

  const handleManagerLogin = async () => {
    if (!managerIdentifier.trim() || !managerPassword.trim()) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.managerLogin(managerIdentifier.trim().toLowerCase(), managerPassword);
      if (res.ok) {
        const sessionData = normalizeUiData(await res.json());
        setKeepManagerLoggedIn(Boolean(keepManagerLoggedIn));
        persistManagerSession(sessionData, { keepLoggedIn: Boolean(keepManagerLoggedIn) });
        markSuccessfulLoginToday();
        setShowManagerLoginModal(false);
        setManagerPassword('');
        setShowManagerPassword(false);
        setManagerTab('dashboard');
        setSafeLoginNotice(null);
        notify('Acesso de administrador liberado.');
        runLoginSuccessSplash('manager', () => setView('manager'));
      } else if (res.status === 404) {
        const legacyOverview = await api.getManagerOverview();

        if (legacyOverview.ok) {
          setKeepManagerLoggedIn(Boolean(keepManagerLoggedIn));
          persistManagerSession({
            usuario: managerIdentifier.trim(),
            email: null,
            token: LEGACY_MANAGER_TOKEN,
            legacyMode: true,
          }, {
            keepLoggedIn: Boolean(keepManagerLoggedIn),
          });
          markSuccessfulLoginToday();
          setShowManagerLoginModal(false);
          setManagerPassword('');
          setShowManagerPassword(false);
          setManagerTab('dashboard');
          setSafeLoginNotice(null);
          notify('Painel administrativo aberto em modo de compatibilidade.');
          runLoginSuccessSplash('manager', () => setView('manager'));
        } else {
          notify('O backend de produção não expõe o login do administrador nem a visão geral do painel.', 'error');
        }
      } else {
        notify(await getApiErrorMessage(res, 'Falha no login do administrador'), 'error');
      }
    } catch (e) {
      notify('Erro de conexão com o servidor.', 'error');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleManagerLogout = useCallback(() => {
    clearManagerSession();
    setShowManagerLoginModal(false);
    setManagerIdentifier('');
    setManagerPassword('');
    setShowManagerPassword(false);
    setManagerTab('dashboard');
    setSafeLoginNotice(null);
    markReturnedAfterLogout();
    setView('login');
  }, [clearManagerSession, markReturnedAfterLogout, setSafeLoginNotice]);

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
  }, [currentUser, clearAnalystSession, markReturnedAfterLogout, notify, setSafeLoginNotice]);

  const fetchAdminUsers = useCallback(async () => {
    if (!managerSession?.token) return;
    try {
      const res = await api.getManagerAdmins();
      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }
      if (res.ok) {
        setAdminUsers(normalizeUiData(await res.json()));
      }
    } catch {
      // Silencioso: listado auxiliar do painel.
    }
  }, [managerSession?.token, handleManagerUnauthorized]);

  const handleCreateAdminUser = async (event) => {
    event?.preventDefault?.();

    let emailRaw = adminForm.email || '';
    let senhaRaw = adminForm.senha || '';
    let usernameRaw = adminForm.username || '';
    let ativoRaw = adminForm.ativo;

    const form = event?.currentTarget;
    if (typeof FormData !== 'undefined' && form instanceof HTMLFormElement) {
      const formData = new FormData(form);
      emailRaw = String(formData.get('email') ?? emailRaw);
      senhaRaw = String(formData.get('senha') ?? senhaRaw);
      usernameRaw = String(formData.get('username') ?? usernameRaw);
      ativoRaw = formData.has('ativo');
    }

    const email = (emailRaw || '').trim().toLowerCase();
    const senha = (senhaRaw || '').trim();
    const username = (usernameRaw || '').trim().toLowerCase();

    setAdminForm((prev) => ({
      ...prev, email, senha, username, ativo: Boolean(ativoRaw),
    }));

    if (!email || !senha) {
      notify('Informe e-mail e senha do administrador.', 'error');
      return;
    }

    setIsGlobalLoading(true);
    try {
      const res = await api.createManagerAdmin({
        email, senha, username: username || null, ativo: Boolean(ativoRaw),
      });

      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }

      if (res.ok) {
        notify('Administrador criado com sucesso.');
        setAdminForm({ email: '', username: '', senha: '', ativo: true });
        fetchAdminUsers();
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao criar administrador'), 'error');
      }
    } catch {
      notify('Erro de conexão ao criar administrador.', 'error');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleRevokeAdminSession = async (admin) => {
    if (!admin?.id) return;
    const decision = await requestRevokeConfirmation({
      role: 'admin',
      targetName: admin.username || admin.email || 'admin',
      targetId: Number(admin.id),
    });
    if (!decision?.confirmed) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.revokeUserSessions({
        role: 'admin',
        user_id: Number(admin.id),
        reason: `[manager-panel][admin-revocation] ${decision.reason}`,
      });

      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }

      if (res.ok) {
        notify('Sessões do administrador encerradas com sucesso.');
        fetchAdminUsers();
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao revogar sessão do administrador'), 'error');
      }
    } catch {
      notify('Erro de conexão ao revogar sessão do administrador.', 'error');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleRevokeAnalystSession = async (analyst) => {
    if (!analyst?.id) return;
    const decision = await requestRevokeConfirmation({
      role: 'analyst',
      targetName: analyst.nome || `Analista ${analyst.id}`,
      targetId: Number(analyst.id),
    });
    if (!decision?.confirmed) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.revokeUserSessions({
        role: 'analyst',
        user_id: Number(analyst.id),
        reason: `[manager-panel][analyst-revocation] ${decision.reason}`,
      });

      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }

      if (res.ok) {
        notify('Sessão do analista encerrada com sucesso. A fila foi mantida ativa.');
        fetchData(true);
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao revogar sessão do analista'), 'error');
      }
    } catch {
      notify('Erro de conexão ao revogar sessão do analista.', 'error');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const toggleQueueStatus = async (status) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.setQueueStatus(currentUser.id, status);
      if (res.ok) {
        persistAnalystSession({ ...currentUser, is_online: status });
        notify(status ? 'Você está Online!' : 'Pausado.');
        fetchData();
      }
    } catch (e) { notify('Erro de status.'); }
    finally { setIsGlobalLoading(false); }
  };

  const handleFinish = async (id, outcome, options = {}) => {
    const isConclusion = outcome === 'Concluido';
    const confirmed = await requestConfirmation({
      title: isConclusion ? 'Confirmar conclusão' : 'Enviar para discussão',
      message: isConclusion
        ? 'Confirma a conclusão desta pasta? Essa ação registra no histórico do analista.'
        : 'Confirma o envio desta pasta para discussão? Ela ficará sinalizada para revisão.',
      confirmLabel: isConclusion ? 'Concluir pasta' : 'Enviar para discussão',
      tone: 'warning'
    });
    if (!confirmed) return { success: false, confirmed: false };

    if (typeof options?.onConfirmed === 'function') {
      options.onConfirmed();
    }

    setIsGlobalLoading(true);
    try {
      const res = await api.finishTask(id, outcome);
      if (res.ok) {
        notify(isConclusion ? 'Pasta concluída com sucesso.' : 'Pasta enviada para discussão.');
        fetchData();
        return { success: true, confirmed: true };
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao concluir pasta'), 'error');
        return { success: false, confirmed: true };
      }
    } catch (e) {
      notify('Erro ao processar conclusão da pasta.', 'error');
      return { success: false, confirmed: true };
    } finally { setIsGlobalLoading(false); }
  };

  const openReservaInCRM = (reservaId) => {
    if (!reservaId) return;
    const parsed = parseReservaRef(reservaId);
    const base = CRM_BASE_BY_SOURCE[parsed.source] || CRM_BASE_BY_SOURCE.cvcrm;
    const crmUrl = `${base}/${parsed.externalId}/administrar`;
    window.open(crmUrl, '_blank', 'noopener,noreferrer');
  };

  const openTransferModal = (task) => {
    setTransferTask(task);
    setTransferToId('');
    setTransferTargetSearch('');
    setTransferReason('');
    setShowTransferModal(true);
  };

  const handleTransferTask = async () => {
    if (!transferTask || !transferToId || !currentUser) return;
    const trimmedReason = transferReason.trim();
    if (!trimmedReason) {
      notify('Informe o motivo da transferência.', 'error');
      return;
    }
    setIsGlobalLoading(true);
    try {
      const res = await api.transferTask({
        reserva_id: transferTask.reserva_id,
        analista_origem_id: currentUser.id,
        analista_destino_id: parseInt(transferToId),
        motivo: trimmedReason
      });

      if (res.ok) {
        notify('Pasta transferida com sucesso.');
        setShowTransferModal(false);
        setTransferTask(null);
        try {
          await fetchData();
          const destId = parseInt(transferToId);
          setAnalysts((prev) => (prev || []).map((a) => (String(a?.id) === String(destId) ? { ...a, na_mesa: Number(a?.na_mesa || 0) + 1 } : a)));
        } catch (e) {
          // caso falhe, deixa o fetchData cuidar do estado
        }
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao transferir pasta'), 'error');
      }
    } catch (e) {
      notify('Erro ao transferir pasta.', 'error');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const toggleTaskSelection = (reservaId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(reservaId)) next.delete(reservaId);
      else next.add(reservaId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.reserva_id)));
    }
  };

  const openBulkTransferModal = () => {
    setBulkTransferToId('');
    setBulkTransferTargetSearch('');
    setBulkTransferReason('');
    setShowBulkTransferModal(true);
  };

  const handleBulkTransfer = async () => {
    if (!bulkTransferToId || !currentUser || selectedTaskIds.size === 0) return;
    const trimmedReason = bulkTransferReason.trim();
    if (!trimmedReason) {
      notify('Informe o motivo da transferência.', 'error');
      return;
    }
    setIsGlobalLoading(true);
    try {
      const res = await api.transferTaskBulk({
        reserva_ids: Array.from(selectedTaskIds),
        analista_origem_id: currentUser.id,
        analista_destino_id: parseInt(bulkTransferToId),
        motivo: trimmedReason
      });
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        notify(`${data.transferidas} pasta(s) transferida(s) com sucesso.${data.erros > 0 ? ` ${data.erros} com erro.` : ''}`);
        setShowBulkTransferModal(false);
        setSelectedTaskIds(new Set());
        try {
          await fetchData();
          const destId = parseInt(bulkTransferToId);
          const transferred = Number(data.transferidas || 0);
          if (transferred > 0) {
            setAnalysts((prev) => (prev || []).map((a) => (String(a?.id) === String(destId) ? { ...a, na_mesa: Number(a?.na_mesa || 0) + transferred } : a)));
          }
        } catch (e) {
          // deixa fetchData cuidar do estado
        }
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao transferir pastas'), 'error');
      }
    } catch (e) {
      notify('Erro ao transferir pastas.', 'error');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleCreateSuggestion = async ({ titulo, detalhes }) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.createSuggestion({ titulo, detalhes });
      if (res.status === 401) {
        handleAnalystUnauthorized();
        return { success: false };
      }
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        const created = data?.sugestao;
        if (created) {
          setSuggestions((prev) => [...(prev || []), created].sort((a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0)));
        } else {
          fetchData(true);
        }
        notify('Sugestão criada com sucesso.');
        return { success: true };
      }
      notify(await getApiErrorMessage(res, 'Erro ao criar sugestão'), 'error');
      return { success: false };
    } catch {
      notify('Erro de conexão ao criar sugestão.', 'error');
      return { success: false };
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleUpdateSuggestion = async (suggestionId, { titulo, detalhes }) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.updateSuggestion(suggestionId, { titulo, detalhes });
      if (res.status === 401) {
        handleAnalystUnauthorized();
        return { success: false };
      }
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        const updated = data?.sugestao;
        if (updated) {
          setSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
          setManagerSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
        } else {
          fetchData(true);
        }
        notify('Sugestão atualizada com sucesso.');
        return { success: true };
      }
      notify(await getApiErrorMessage(res, 'Erro ao atualizar sugestão'), 'error');
      return { success: false };
    } catch {
      notify('Erro de conexão ao atualizar sugestão.', 'error');
      return { success: false };
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleCancelSuggestion = async (suggestionId) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.cancelSuggestion(suggestionId);
      if (res.status === 401) {
        handleAnalystUnauthorized();
        return { success: false };
      }
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        const updated = data?.sugestao;
        if (updated) {
          setSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
          setManagerSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
        } else {
          fetchData(true);
        }
        notify('Sugestão cancelada com sucesso.');
        return { success: true };
      }
      notify(await getApiErrorMessage(res, 'Erro ao cancelar sugestão'), 'error');
      return { success: false };
    } catch {
      notify('Erro de conexão ao cancelar sugestão.', 'error');
      return { success: false };
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleDeleteSuggestion = async (suggestionId) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.deleteSuggestion(suggestionId);
      if (res.status === 401) {
        handleAnalystUnauthorized();
        return { success: false };
      }
      if (res.ok) {
        setSuggestions((prev) => (prev || []).filter((item) => Number(item?.id) !== Number(suggestionId)));
        setManagerSuggestions((prev) => (prev || []).filter((item) => Number(item?.id) !== Number(suggestionId)));
        notify('Sugestão excluída com sucesso.');
        return { success: true };
      }
      notify(await getApiErrorMessage(res, 'Erro ao excluir sugestão'), 'error');
      return { success: false };
    } catch {
      notify('Erro de conexão ao excluir sugestão.', 'error');
      return { success: false };
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleUpdateSuggestionStatus = async (suggestionId, status) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.updateManagerSuggestionStatus(suggestionId, status);
      if (res.status === 401) {
        handleManagerUnauthorized();
        return { success: false };
      }
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        const updated = data?.sugestao;
        if (updated) {
          setManagerSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
          setSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
        } else {
          fetchData(true);
        }
        notify('Status da sugestão atualizado com sucesso.');
        return { success: true };
      }
      notify(await getApiErrorMessage(res, 'Erro ao atualizar status da sugestão'), 'error');
      return { success: false };
    } catch {
      notify('Erro de conexão ao atualizar status da sugestão.', 'error');
      return { success: false };
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleRespondSuggestion = async (suggestionId, resposta) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.respondManagerSuggestion(suggestionId, resposta);
      if (res.status === 401) {
        handleManagerUnauthorized();
        return { success: false };
      }
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        const updated = data?.sugestao;
        if (updated) {
          setManagerSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
          setSuggestions((prev) =>
            (prev || []).map((item) => (Number(item?.id) === Number(suggestionId) ? { ...item, ...updated } : item)),
          );
        } else {
          fetchData(true);
        }
        notify('Resposta registrada com sucesso.');
        return { success: true };
      }
      notify(await getApiErrorMessage(res, 'Erro ao responder sugestão'), 'error');
      return { success: false };
    } catch {
      notify('Erro de conexão ao responder sugestão.', 'error');
      return { success: false };
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleRedistribute = async () => {
    const confirmed = await requestConfirmation({
      title: 'Confirmar redistribuição',
      message: 'Deseja realmente redistribuir as pastas agora?',
      confirmLabel: 'Redistribuir',
      tone: 'warning'
    });
    if (!confirmed) return;
    setIsGlobalLoading(true);
    try {
      const res = await api.redistribute();
      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }
      if (res.ok) {
        notify('Redistribuição efetuada!');
        fetchData();
      }
    } catch (e) { notify('Erro ao redistribuir.'); }
    finally { setIsGlobalLoading(false); }
  };

  const handleResetData = async () => {
    const confirmed = await requestConfirmation({
      title: 'Confirmar limpeza da mesa',
      message: 'Deseja realmente zerar os dados da mesa atual e reiniciar a ordem da fila (sem excluir histórico)?',
      confirmLabel: 'Zerar Dados',
      tone: 'danger'
    });
    if (!confirmed) return;
    setIsGlobalLoading(true);
    try {
      const res = await api.resetData();
      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }
      if (res.ok) {
        notify('Mesas limpas e ordem reiniciada!');
        fetchData();
      } else {
        notify('Erro ao zerar dados.', 'error');
      }
    } catch (e) { notify('Erro ao zerar dados.', 'error'); }
    finally { setIsGlobalLoading(false); }
  };

  const applyAnalystQueueStatus = useCallback((analystId, isOnline) => {
    setDashData(prev => ({
      ...prev,
      equipe: (prev.equipe || []).map(a => a.id === analystId ? { ...a, is_online: isOnline } : a)
    }));
    setAnalysts(prev => (prev || []).map(a => a.id === analystId ? { ...a, is_online: isOnline } : a));
  }, []);

  const handleAdminQueueToggle = async (analyst) => {
    if (togglingQueueIds.includes(analyst.id)) return;
    const nextStatus = !analyst.is_online;
    setTogglingQueueIds(prev => [...prev, analyst.id]);
    applyAnalystQueueStatus(analyst.id, nextStatus);

    try {
      const res = await api.setQueueStatus(analyst.id, nextStatus, { asManager: true });
      if (res.ok) {
        const data = normalizeUiData(await res.json());
        if (!nextStatus) {
          notify(`${data.redistribuidas || 0} pastas redistribuídas, ${data.sem_destino || 0} sem destino.`);
        } else {
          notify(`${analyst.nome} ficou online.`);
        }
        fetchData(true);
      } else {
        applyAnalystQueueStatus(analyst.id, analyst.is_online);
        notify('Erro ao atualizar fila do analista.', 'error');
      }
    } catch (e) {
      applyAnalystQueueStatus(analyst.id, analyst.is_online);
      notify('Erro ao atualizar fila do analista.', 'error');
    } finally {
      setTogglingQueueIds(prev => prev.filter(id => id !== analyst.id));
    }
  };

  const handleAdminBulkQueueToggle = async ({ analysts: bulkAnalysts, targetOnline, isFullSelection = false, totalSelected = 0 }) => {
    const targetStatus = Boolean(targetOnline);
    const uniqueCandidates = Array.isArray(bulkAnalysts)
      ? bulkAnalysts.filter(
          (analyst, index, list) =>
            analyst?.id &&
            list.findIndex((item) => Number(item?.id) === Number(analyst.id)) === index
        )
      : [];

    const actionable = uniqueCandidates.filter(
      (analyst) =>
        Boolean(analyst?.is_online) !== targetStatus &&
        !togglingQueueIds.includes(Number(analyst.id))
    );

    if (!actionable.length) {
      notify(
        targetStatus
          ? 'Nenhum analista elegível para ligar a fila.'
          : 'Nenhum analista elegível para desligar a fila.',
        'error'
      );
      return;
    }

    if (!targetStatus && isFullSelection) {
      const firstConfirmation = await requestConfirmation({
        title: 'Desligar fila de toda a equipe?',
        message: `Você selecionou todos os ${totalSelected || uniqueCandidates.length} analistas. Essa ação pode interromper novas atribuições até que alguém volte a ficar online.`,
        confirmLabel: 'Continuar',
        tone: 'danger',
      });

      if (!firstConfirmation) return;

      const secondConfirmation = await requestConfirmation({
        title: 'Confirmação final obrigatória',
        message: 'Confirma desligar a fila de TODOS os analistas selecionados agora?',
        confirmLabel: 'Desligar todos',
        tone: 'danger',
      });

      if (!secondConfirmation) return;
    }

    const ids = actionable.map((analyst) => Number(analyst.id));
    setTogglingQueueIds((prev) => [...new Set([...prev, ...ids])]);
    actionable.forEach((analyst) => applyAnalystQueueStatus(Number(analyst.id), targetStatus));

    const settledResults = await Promise.all(
      actionable.map(async (analyst) => {
        try {
          const response = await api.setQueueStatus(Number(analyst.id), targetStatus, { asManager: true });
          if (!response.ok) {
            return { ok: false, analyst, payload: {} };
          }

          let payload = {};
          try {
            payload = normalizeUiData(await response.json());
          } catch {
            payload = {};
          }

          return { ok: true, analyst, payload };
        } catch {
          return { ok: false, analyst, payload: {} };
        }
      })
    );

    const failures = [];
    const successes = [];
    let totalRedistribuidas = 0;
    let totalSemDestino = 0;

    settledResults.forEach((result) => {
      if (result.ok) {
        successes.push(result.analyst);
        totalRedistribuidas += Number(result.payload?.redistribuidas || 0);
        totalSemDestino += Number(result.payload?.sem_destino || 0);
        return;
      }
      failures.push(result.analyst);
    });

    if (failures.length) {
      failures.forEach((analyst) => {
        applyAnalystQueueStatus(Number(analyst.id), Boolean(analyst.is_online));
      });
    }

    if (successes.length) {
      if (targetStatus) {
        notify(`${successes.length} analista(s) ligado(s) na fila${failures.length ? `, ${failures.length} falha(s).` : '.'}`);
      } else {
        notify(
          `${successes.length} analista(s) desligado(s). Redistribuídas: ${totalRedistribuidas}. Sem destino: ${totalSemDestino}${
            failures.length ? `. Falhas: ${failures.length}.` : '.'
          }`
        );
      }
      fetchData(true);
    } else {
      notify('Não foi possível concluir a operação em massa.', 'error');
    }

    setTogglingQueueIds((prev) => prev.filter((id) => !ids.includes(Number(id))));
  };

  const handleSaveAnalyst = async () => {
    const isEdit = editForm.id !== null;
    const nome = (editForm.nome || '').trim();
    const email = (editForm.email || '').trim().toLowerCase();
    const senha = (editForm.senha || '').trim();
    const permissoes = Array.isArray(editForm.permissoes) ? editForm.permissoes.map(Number) : [];
    const status = (editForm.status || 'ativo').trim().toLowerCase();

    if (!nome) {
      notify('Informe o nome completo.', 'error');
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('Informe um e-mail de acesso válido.', 'error');
      return;
    }

    if (!isEdit && !senha) {
      notify('Informe uma senha para o novo analista.', 'error');
      return;
    }

    if (!permissoes.length) {
      notify('Selecione pelo menos uma situação.', 'error');
      return;
    }

    if (status !== 'ativo' && status !== 'inativo') {
      notify('Status inválido.', 'error');
      return;
    }

    const payload = { nome, email, permissoes, status };
    if (senha) payload.senha = senha;

    setIsGlobalLoading(true);
    try {
      const res = await api.saveAnalyst({ id: isEdit ? editForm.id : null, payload });
      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }
      if (res.ok) {
        notify(isEdit ? 'Analista atualizado com sucesso!' : 'Analista cadastrado com sucesso!');
        setShowEditModal(false);
        setEditForm({ id: null, nome: '', email: '', senha: '', permissoes: [], status: 'ativo' });
        fetchData();
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao salvar analista'), 'error');
      }
    } catch (e) { notify('Erro de conexão.', 'error'); }
    finally { setIsGlobalLoading(false); }
  };

  const handleDeleteAnalyst = async (analyst) => {
    const analystId = Number(typeof analyst === 'object' ? analyst?.id : analyst);
    if (!Number.isFinite(analystId) || analystId <= 0) {
      notify('Analista inválido para exclusão.', 'error');
      return;
    }

    const analystName = typeof analyst === 'object'
      ? (analyst?.nome || `Analista ${analystId}`)
      : `Analista ${analystId}`;

    const confirmed = await requestConfirmation({
      title: 'Excluir analista',
      message: `Deseja excluir ${analystName}? Esta ação remove o acesso e não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.deleteAnalyst(analystId);
      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }

      if (res.ok) {
        notify('Analista removido com sucesso.');
        fetchData();
      } else {
        notify(await getApiErrorMessage(res, 'Erro ao remover analista'), 'error');
      }
    } catch (e) { notify('Erro ao remover analista.', 'error'); }
    finally { setIsGlobalLoading(false); }
  };

  const handleChangePassword = async ({ currentPassword, newPassword }) => {
    if (!currentUser) return false;

    setIsGlobalLoading(true);
    try {
      const res = await api.changePassword({
        analystId: currentUser.id,
        currentPassword,
        newPassword,
      });

      if (res.ok) {
        await handleAnalystLogout({ reason: 'password-change' });
        return true;
      }

      notify(await getApiErrorMessage(res, 'Não foi possível alterar a senha'), 'error');
      return false;
    } catch (e) {
      notify('Erro de conexão ao alterar a senha.', 'error');
      return false;
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const displayedMesaTasks = useMemo(() => {
    if (!mesaFreeze.active) return myTasks || [];
    const frozenIds = new Set((mesaFreeze.taskIds || []).map((id) => String(id)));
    return (myTasks || []).filter((task) => frozenIds.has(String(task.reserva_id)));
  }, [mesaFreeze, myTasks]);

  const hiddenFrozenMesaCount = Math.max(0, (myTasks || []).length - displayedMesaTasks.length);

  useEffect(() => {
    const visibleIds = new Set(displayedMesaTasks.map((task) => task.reserva_id));
    setSelectedTaskIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [displayedMesaTasks]);

  const toggleMesaFreeze = useCallback(() => {
    if (mesaFreeze.active) {
      setMesaFreeze({ active: false, taskIds: [] });
      notify('Mesa descongelada. Novas pastas voltarão a aparecer.', 'success');
      return;
    }

    const taskIds = (myTasks || []).map((task) => String(task.reserva_id)).filter(Boolean);
    if (!taskIds.length) {
      notify('Não há pastas na mesa para congelar.', 'error');
      return;
    }

    setMesaFreeze({ active: true, taskIds });
    setSelectedTaskIds(new Set());
    notify(`${taskIds.length} pasta(s) congelada(s) na mesa atual.`);
  }, [mesaFreeze.active, myTasks, notify]);

  const filteredTasks = useMemo(() => {
    return (displayedMesaTasks || []).filter(task => {
      const reservaDisplayId = getReservaDisplayId(task.reserva_id);
      const matchesSearch = task.cliente.toLowerCase().includes(taskSearch.toLowerCase()) ||
                          task.empreendimento.toLowerCase().includes(taskSearch.toLowerCase()) ||
                          reservaDisplayId.toString().includes(taskSearch);
      const matchesSit = filterSit === 'all' || task.situacao_id.toString() === filterSit;
      return matchesSearch && matchesSit;
    });
  }, [displayedMesaTasks, taskSearch, filterSit, getReservaDisplayId]);

  const transferTargetOptions = useMemo(() => {
    if (!currentUser) return [];
    return (analysts || [])
      .filter((a) => {
        if (a.id === currentUser.id) return false;
        return a.status === 'ativo';
      })
      .sort((a, b) => {
        const queueDiff = Number(a?.na_mesa || 0) - Number(b?.na_mesa || 0);
        if (queueDiff !== 0) return queueDiff;

        const onlineDiff = Number(Boolean(b?.is_online)) - Number(Boolean(a?.is_online));
        if (onlineDiff !== 0) return onlineDiff;

        return String(a?.nome || '').localeCompare(String(b?.nome || ''));
      });
  }, [analysts, currentUser]);

  const selectedTransferTarget = useMemo(() => {
    if (!transferToId) return null;
    return transferTargetOptions.find(a => String(a.id) === String(transferToId)) || null;
  }, [transferTargetOptions, transferToId]);

  const selectedBulkTransferTarget = useMemo(() => {
    if (!bulkTransferToId) return null;
    return transferTargetOptions.find(a => String(a.id) === String(bulkTransferToId)) || null;
  }, [transferTargetOptions, bulkTransferToId]);

  const filteredTransferTargetOptions = useMemo(() => {
    const term = transferTargetSearch.trim().toLowerCase();
    if (!term) return transferTargetOptions;
    return transferTargetOptions.filter((a) => {
      const nome = String(a?.nome || '').toLowerCase();
      const email = String(a?.email || '').toLowerCase();
      return nome.includes(term) || email.includes(term);
    });
  }, [transferTargetOptions, transferTargetSearch]);

  const filteredBulkTransferTargetOptions = useMemo(() => {
    const term = bulkTransferTargetSearch.trim().toLowerCase();
    if (!term) return transferTargetOptions;
    return transferTargetOptions.filter((a) => {
      const nome = String(a?.nome || '').toLowerCase();
      const email = String(a?.email || '').toLowerCase();
      return nome.includes(term) || email.includes(term);
    });
  }, [transferTargetOptions, bulkTransferTargetSearch]);

  const groupedTransferLogs = useMemo(() => {
    const logs = dashData.logs_transferencias || [];

    const filtered = logs.filter(log => {
      if (transferMonthFilter === ALL_FILTER) return true;
      const dateRef = getLogDateRef(log);
      if (!dateRef) return false;
      const monthKey = getMonthKey(dateRef);
      if (!monthKey) return false;
      return monthKey === transferMonthFilter;
    }).filter(log => {
      if (transferOriginFilter === ALL_FILTER) return true;
      return String(log.analista_origem_id) === String(transferOriginFilter);
    }).filter(log => {
      if (transferDestinationFilter === ALL_FILTER) return true;
      return String(log.analista_destino_id) === String(transferDestinationFilter);
    });

    const grouped = {};

    filtered.forEach(log => {
      const dateRef = getLogDateRef(log);
      if (!dateRef) return;
      const dayKey = new Date(dateRef).toLocaleDateString('pt-BR');
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(log);
    });

    return Object.entries(grouped).sort((a, b) => {
      const [da, ma, aa] = a[0].split('/').map(Number);
      const [db, mb, ab] = b[0].split('/').map(Number);
      return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
    });
  }, [dashData.logs_transferencias, transferMonthFilter, transferOriginFilter, transferDestinationFilter]);

  const transferMonthOptions = useMemo(() => {
    const options = [];
    const seen = new Set();
    (dashData.logs_transferencias || []).forEach(log => {
      const dateRef = getLogDateRef(log);
      if (!dateRef) return;
      const key = getMonthKey(dateRef);
      if (!key) return;
      if (!seen.has(key)) {
        seen.add(key);
        const d = new Date(dateRef);
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        options.push({ value: key, label: label.charAt(0).toUpperCase() + label.slice(1) });
      }
    });
    return options.sort((a, b) => b.value.localeCompare(a.value));
  }, [dashData.logs_transferencias]);

  const transferOriginOptions = useMemo(() => {
    return createTransferOptions(dashData.logs_transferencias, 'analista_origem_id', 'analista_origem_nome');
  }, [dashData.logs_transferencias]);

  const transferDestinationOptions = useMemo(() => {
    return createTransferOptions(dashData.logs_transferencias, 'analista_destino_id', 'analista_destino_nome');
  }, [dashData.logs_transferencias]);

  const transferInsights = useMemo(() => {
    const logs = groupedTransferLogs.flatMap(([, dayLogs]) => dayLogs);
    const senderCount = {};
    const receiverCount = {};
    const pairCount = {};

    logs.forEach(log => {
      const sender = log.analista_origem_nome || `Analista ${log.analista_origem_id}`;
      const receiver = log.analista_destino_nome || `Analista ${log.analista_destino_id}`;
      senderCount[sender] = (senderCount[sender] || 0) + 1;
      receiverCount[receiver] = (receiverCount[receiver] || 0) + 1;
      const pairKey = `${receiver}|||${sender}`;
      pairCount[pairKey] = (pairCount[pairKey] || 0) + 1;
    });

    const topSender = Object.entries(senderCount).sort((a, b) => b[1] - a[1])[0] || null;
    const topReceiver = Object.entries(receiverCount).sort((a, b) => b[1] - a[1])[0] || null;
    const topPair = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0] || null;

    return { total: logs.length, topSender, topReceiver, topPair };
  }, [groupedTransferLogs]);

  const handleManagerTabChange = useCallback((nextTab) => {
    if (!nextTab || nextTab === managerTab) return;
    const tabOrder = ['dashboard', 'fila', 'transferencias', 'sugestoes', 'admins'];
    const currentIndex = tabOrder.indexOf(managerTab);
    const nextIndex = tabOrder.indexOf(nextTab);

    if (currentIndex >= 0 && nextIndex >= 0) {
      setManagerTabDirection(nextIndex > currentIndex ? 'forward' : 'backward');
    }

    setManagerTab(nextTab);
  }, [managerTab]);

  const resetTransferFilters = () => {
    setTransferMonthFilter(ALL_FILTER);
    setTransferOriginFilter(ALL_FILTER);
    setTransferDestinationFilter(ALL_FILTER);
  };

  const managerWarningWindowSeconds = 0;
  const analystWarningWindowSeconds = 0;
  const analystIdleSecondsLeft = null;
  const analystIdleWarningProgress = 0;
  const showAnalystMobileIdleWarning = false;
  const idlePromptWarningWindowSeconds = idlePrompt.role === 'admin'
    ? managerWarningWindowSeconds
    : analystWarningWindowSeconds;
  const idlePromptWarningProgress = idlePrompt.visible
    ? Math.max(0, Math.min(100, (idlePrompt.secondsLeft / Math.max(idlePromptWarningWindowSeconds, 1)) * 100))
    : 0;
  const refreshCycleProgress = Math.max(
    0,
    Math.min(100, ((AUTO_REFRESH_SECONDS - Math.max(0, refreshCountdown)) / AUTO_REFRESH_SECONDS) * 100)
  );

  const idlePromptModal = idlePrompt.visible ? (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-800">
              {idlePrompt.role === 'admin' ? 'Sessão de administrador quase expirada' : 'Sua sessão está perto de expirar'}
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">
              {idlePrompt.role === 'admin'
                ? 'Sem atividade recente no painel. Confirme sua presença para manter o acesso ativo.'
                : 'Sem atividade recente. Se a sessão expirar, você será desconectado e poderá entrar novamente sem alterar o status da sua fila.'}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_52%,#ffffff_100%)] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock size={12} />
              </div>
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-700">Expiração de sessão</p>
                <p className="text-[10px] font-semibold text-slate-700">Tempo restante para logout automático</p>
              </div>
            </div>
            <span className="text-base font-semibold text-amber-900 tracking-[0.08em]">{formatIdleCountdown(idlePrompt.secondsLeft)}</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#f97316_55%,#ef4444_100%)] transition-all duration-500"
              style={{ width: `${idlePromptWarningProgress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={() => {
              if (idlePrompt.role === 'admin') {
                clearManagerSession();
                markReturnedAfterLogout();
                setView('login');
                setSafeLoginNotice('Sua sessão de gestor foi encerrada por escolha manual. Faça login novamente quando precisar.');
                notify('Sessão de administrador encerrada manualmente.', 'success');
              } else {
                void handleAnalystLogout({ reason: 'idle' });
              }
            }}
            className="py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 text-[11px] font-semibold"
          >
            {idlePrompt.role === 'admin' ? 'Encerrar agora' : 'Encerrar agora'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (idlePrompt.role === 'admin') touchManagerActivity();
              if (idlePrompt.role === 'analyst') touchAnalystActivity();
              setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
            }}
            className="py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold tracking-[0.02em] hover:bg-blue-500"
          >
            {idlePrompt.role === 'admin' ? 'Continuar sessão' : 'Continuar trabalhando'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (resetToken) return (
    <ResetPasswordView
      token={resetToken}
      onSuccess={() => {
        window.history.replaceState({}, '', window.location.pathname);
        setResetToken(null);
        notify('Senha redefinida com sucesso! Faça login com a nova senha.');
      }}
      onBackToLogin={() => {
        window.history.replaceState({}, '', window.location.pathname);
        setResetToken(null);
      }}
    />
  );

  if (view === 'privacy-policy') return (
    <PrivacyPolicyView onBackToLogin={closePrivacyPolicy} />
  );

  if (view === 'login') return (
    <LoginView
      toast={toast}
      confirmAction={confirmAction}
      closeConfirmation={closeConfirmation}
      isGlobalLoading={isGlobalLoading}
      showManagerLoginModal={showManagerLoginModal}
      setShowManagerLoginModal={setShowManagerLoginModal}
      managerUsername={managerIdentifier}
      setManagerUsername={setManagerIdentifier}
      managerPassword={managerPassword}
      setManagerPassword={setManagerPassword}
      showManagerPassword={showManagerPassword}
      setShowManagerPassword={setShowManagerPassword}
      keepManagerLoggedIn={keepManagerLoggedIn}
      setKeepManagerLoggedIn={setKeepManagerLoggedIn}
      loginNotice={loginNotice}
      hasReturnedAfterLogout={hasReturnedAfterLogout}
      loginSuccessSplash={loginSuccessSplash}
      handleLogin={handleLogin}
      keepAnalystLoggedIn={keepAnalystLoggedIn}
      setKeepAnalystLoggedIn={setKeepAnalystLoggedIn}
      handleManagerLogin={handleManagerLogin}
      onOpenPrivacyPolicy={openPrivacyPolicy}
    />
  );

  if (view === 'manager') return (
    <div
      className={`min-h-[100dvh] text-slate-800 flex flex-col overflow-x-hidden ${isDarkMode ? 'bg-[#0a101b]' : 'bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f7fb_46%,#edf2f8_100%)]'}`}
    >
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      <RevokeAccessModal revokeAction={revokeAction} onClose={closeRevokeConfirmation} />
      {idlePromptModal}
      {isGlobalLoading && <LoadingOverlay />}
      <ManagerHeader
        handleRedistribute={handleRedistribute}
        handleResetData={handleResetData}
        onExit={handleManagerLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleThemeMode}
      />

      <main className="w-full max-w-[min(1480px,96vw)] mx-auto p-3 md:p-5 lg:p-6 space-y-5 flex-1">
        <section className="rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.48)] backdrop-blur-xl">
          <div className="flex flex-wrap gap-1">
            <button onClick={() => handleManagerTabChange('dashboard')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all inline-flex items-center gap-1.5 ${managerTab === 'dashboard' ? 'bg-[linear-gradient(135deg,#0b6fd3_0%,#075aa9_100%)] text-white shadow-[0_12px_24px_-18px_rgba(7,90,169,0.88)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><LayoutDashboard size={13} /> Dashboard</button>
            <button onClick={() => handleManagerTabChange('fila')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all inline-flex items-center gap-1.5 ${managerTab === 'fila' ? 'bg-[linear-gradient(135deg,#0b6fd3_0%,#075aa9_100%)] text-white shadow-[0_12px_24px_-18px_rgba(7,90,169,0.88)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><LineChart size={13} /> Fila</button>
            <button onClick={() => handleManagerTabChange('transferencias')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all inline-flex items-center gap-1.5 ${managerTab === 'transferencias' ? 'bg-[linear-gradient(135deg,#0b6fd3_0%,#075aa9_100%)] text-white shadow-[0_12px_24px_-18px_rgba(7,90,169,0.88)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><ArrowRightLeft size={13} /> Transferências</button>
            <button onClick={() => handleManagerTabChange('sugestoes')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all inline-flex items-center gap-1.5 ${managerTab === 'sugestoes' ? 'bg-[linear-gradient(135deg,#0b6fd3_0%,#075aa9_100%)] text-white shadow-[0_12px_24px_-18px_rgba(7,90,169,0.88)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><MessageSquare size={13} /> Sugestões</button>
            <button onClick={() => handleManagerTabChange('admins')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all inline-flex items-center gap-1.5 ${managerTab === 'admins' ? 'bg-[linear-gradient(135deg,#0b6fd3_0%,#075aa9_100%)] text-white shadow-[0_12px_24px_-18px_rgba(7,90,169,0.88)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><UserPlus size={13} /> Administradores</button>
          </div>
        </section>

        <div
          key={managerTab}
          className={`manager-tab-transition ${managerTabDirection === 'forward' ? 'is-forward' : 'is-backward'}`}
        >
          {managerTab === 'dashboard' && (
            <ManagerDashboardTab
              SITUACOES_MAP={SITUACOES_MAP}
              SIT_COLORS={SIT_COLORS}
              isSyncing={isSyncing}
              managerSyncStatus={managerSyncStatus}
              calculatedBreakdown={calculatedBreakdown}
              dashData={dashData}
              analistasMapa={analistasMapa}
              setEditForm={setEditForm}
              setShowEditModal={setShowEditModal}
              togglingQueueIds={togglingQueueIds}
              handleAdminQueueToggle={handleAdminQueueToggle}
              handleAdminBulkQueueToggle={handleAdminBulkQueueToggle}
              handleDeleteAnalyst={handleDeleteAnalyst}
            />
          )}

          {managerTab === 'fila' && (
            <ManagerQueueTab
              SITUACOES_MAP={SITUACOES_MAP}
              SIT_COLORS={SIT_COLORS}
              dashData={dashData}
              handleAdminQueueToggle={handleAdminQueueToggle}
              togglingQueueIds={togglingQueueIds}
            />
          )}

          {managerTab === 'transferencias' && (
            <ManagerTransfersTab
              transferMonthFilter={transferMonthFilter}
              setTransferMonthFilter={setTransferMonthFilter}
              transferMonthOptions={transferMonthOptions}
              transferOriginFilter={transferOriginFilter}
              setTransferOriginFilter={setTransferOriginFilter}
              transferOriginOptions={transferOriginOptions}
              transferDestinationFilter={transferDestinationFilter}
              setTransferDestinationFilter={setTransferDestinationFilter}
              transferDestinationOptions={transferDestinationOptions}
              resetTransferFilters={resetTransferFilters}
              transferInsights={transferInsights}
              groupedTransferLogs={groupedTransferLogs}
            />
          )}

          {managerTab === 'sugestoes' && (
            <ManagerSuggestionsTab
              suggestions={managerSuggestions}
              onUpdateStatus={handleUpdateSuggestionStatus}
              onRespondSuggestion={handleRespondSuggestion}
              isSubmitting={isGlobalLoading}
            />
          )}

          {managerTab === 'admins' && (
            <ManagerAdminsTab
              admins={adminUsers}
              analysts={dashData.equipe || []}
              adminForm={adminForm}
              setAdminForm={setAdminForm}
              handleCreateAdmin={handleCreateAdminUser}
              handleRevokeAdminSession={handleRevokeAdminSession}
              handleRevokeAnalystSession={handleRevokeAnalystSession}
              isGlobalLoading={isGlobalLoading}
            />
          )}
        </div>
      </main>
      <EditAnalystModal
        showEditModal={showEditModal}
        setShowEditModal={setShowEditModal}
        editForm={editForm}
        setEditForm={setEditForm}
        SITUACOES_MAP={SITUACOES_MAP}
        handleSaveAnalyst={handleSaveAnalyst}
      />
    </div>
  );

  return (
    <div className={`min-h-[100dvh] font-sans text-slate-800 flex flex-col overflow-x-hidden ${isDarkMode ? 'bg-[#0a101b]' : 'bg-[#f8fafc]'}`}>
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      <RevokeAccessModal revokeAction={revokeAction} onClose={closeRevokeConfirmation} />
      {idlePromptModal}
      {showTransferModal && transferTask && (
        <TransferModal
          transferTask={transferTask}
          transferToId={transferToId}
          setTransferToId={setTransferToId}
          transferTargetSearch={transferTargetSearch}
          setTransferTargetSearch={setTransferTargetSearch}
          transferReason={transferReason}
          setTransferReason={setTransferReason}
          filteredTransferTargetOptions={filteredTransferTargetOptions}
          selectedTransferTarget={selectedTransferTarget}
          handleTransferTask={handleTransferTask}
          onClose={() => setShowTransferModal(false)}
          getReservaDisplayId={getReservaDisplayId}
        />
      )}
      {showBulkTransferModal && (
        <BulkTransferModal
          selectedTaskIds={selectedTaskIds}
          bulkTransferToId={bulkTransferToId}
          setBulkTransferToId={setBulkTransferToId}
          bulkTransferTargetSearch={bulkTransferTargetSearch}
          setBulkTransferTargetSearch={setBulkTransferTargetSearch}
          bulkTransferReason={bulkTransferReason}
          setBulkTransferReason={setBulkTransferReason}
          filteredBulkTransferTargetOptions={filteredBulkTransferTargetOptions}
          selectedBulkTransferTarget={selectedBulkTransferTarget}
          handleBulkTransfer={handleBulkTransfer}
          onClose={() => setShowBulkTransferModal(false)}
        />
      )}
      {isGlobalLoading && <LoadingOverlay />}
      <nav className="sticky top-0 z-100 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="min-h-14 px-3 md:px-5 lg:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="logo-shimmer shrink-0">
              <img
                src="/vcacloud.svg"
                alt="VCACloud"
                className={`h-7 md:h-8 w-auto object-contain shrink-0 opacity-95 ${isDarkMode ? 'brightness-0 invert' : 'brightness-0'}`}
              />
            </div>

            <div className="hidden sm:flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/75 px-2.5 py-1.5 min-w-0">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-[linear-gradient(140deg,#0f172a_0%,#334155_100%)] rounded-xl flex items-center justify-center text-white font-bold text-[11px] shadow-[0_14px_22px_-16px_rgba(15,23,42,0.6)] shrink-0">
                {currentUser?.nome?.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800 leading-tight text-[11px] md:text-[12px] truncate max-w-42 md:max-w-60">{currentUser?.nome}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[9px] font-medium tracking-[0.06em] uppercase text-slate-400">Analista</span>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.04em] ${currentUser?.is_online ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${currentUser?.is_online ? 'bg-emerald-500 queue-presence-dot' : 'bg-slate-400'}`} />
                    {currentUser?.is_online ? 'Fila ativa' : 'Fila pausada'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2.5 shrink min-w-0">
            {analystIdleSecondsLeft !== null && analystIdleSecondsLeft > 0 && (
              <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_55%,#ffffff_100%)] text-slate-700 shadow-[0_14px_24px_-22px_rgba(251,146,60,0.75)]">
               <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 inline-flex items-center justify-center shrink-0">
                 <AlertTriangle size={12} className="shrink-0" />
               </div>
               <div className="min-w-0">
                 <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-700">Sessão ativa</p>
                 <p className="text-[10px] font-semibold text-slate-700">Expira em {formatIdleCountdown(analystIdleSecondsLeft)}</p>
                 <div className="mt-1 h-1 w-20 rounded-full bg-amber-100 overflow-hidden">
                   <div
                     className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#f97316_55%,#ef4444_100%)] transition-all duration-500"
                     style={{ width: `${analystIdleWarningProgress}%` }}
                   />
                 </div>
               </div>
              </div>
            )}
            <button
              onClick={() => setAnalystTab('analytics')}
              className="inline-flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
              title="Abrir dashboard analítico"
            >
              <TrendingUp size={12} className="shrink-0" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] md:hidden">{metrics.hoje}</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] hidden md:inline">Hoje: {metrics.hoje}</span>
            </button>
            <div
              data-tour="analyst-auto-update"
              className={`group relative hidden md:flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border transition-all duration-200 ${currentUser?.is_online ? 'bg-white/80 border-slate-200 text-slate-700 hover:border-slate-300' : 'bg-slate-50/90 border-slate-200 text-slate-400'}`}
            >
              <div className="relative h-8 w-8 shrink-0">
                <svg className="-rotate-90 h-8 w-8" viewBox="0 0 36 36" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-slate-200" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeDasharray={`${(Math.max(0, Math.min(100, currentUser?.is_online ? refreshCycleProgress : 0)) / 100) * 97.4} 97.4`}
                    className={`${currentUser?.is_online ? 'text-sky-500' : 'text-slate-300'} transition-all duration-500`}
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center ${currentUser?.is_online ? 'text-sky-600' : 'text-slate-400'}`}>
                  <Clock size={11} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-semibold tracking-[0.08em] uppercase text-slate-400">Atualização automática</p>
                <p className={`text-[10px] font-semibold tracking-[0.01em] ${currentUser?.is_online ? 'text-slate-700' : 'text-slate-400'}`}>
                  {currentUser?.is_online ? `${formatIdleCountdown(refreshCountdown)} para sincronizar` : 'Pausada com fila desligada'}
                </p>
              </div>
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-sky-500 animate-pulse' : 'bg-slate-300 group-hover:bg-slate-400'} transition-colors`} />
              <div className="pointer-events-none absolute right-0 top-[calc(100%+0.45rem)] w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold leading-relaxed text-slate-600 opacity-0 shadow-[0_16px_28px_-20px_rgba(15,23,42,0.45)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                Atualiza dados automaticamente a cada {AUTO_REFRESH_SECONDS}s enquanto a fila estiver ativa.
              </div>
            </div>
            <div className="flex flex-wrap items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
              <button
                onClick={() => toggleQueueStatus(!currentUser?.is_online)}
                data-tour="analyst-pause-toggle"
                className={`inline-flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${currentUser?.is_online ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' : 'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-500'}`}
                title={currentUser?.is_online ? 'Pausar fila' : 'Ligar fila'}
              >
                <Power size={14} />
                <span className="hidden md:inline">{currentUser?.is_online ? 'Pausar' : 'Ligar'}</span>
              </button>

              <button
                onClick={() => setAnalystTab('mesa')}
                data-tour="analyst-tab-mesa"
                className={`inline-flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${analystTab === 'mesa' ? 'bg-white text-[#0071e3] border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                title="Mesa"
              >
                <LayoutDashboard size={14} />
                <span className="hidden md:inline">Mesa</span>
              </button>

              <button
                onClick={() => setAnalystTab('analytics')}
                data-tour="analyst-tab-analytics"
                className={`inline-flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${analystTab === 'analytics' ? 'bg-white text-[#0071e3] border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                title="Dashboard analítico"
              >
                <BarChart3 size={14} />
                <span className="hidden lg:inline">Analítico</span>
              </button>

              <button
                onClick={() => setAnalystTab('suggestions')}
                className={`inline-flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${analystTab === 'suggestions' ? 'bg-white text-[#0071e3] border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                title="Sugestões de melhoria"
              >
                <MessageSquare size={14} />
                <span className="hidden lg:inline">Sugestões</span>
              </button>

              <button
                onClick={() => setAnalystTab('settings')}
                data-tour="analyst-tab-settings"
                className={`inline-flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${analystTab === 'settings' ? 'bg-white text-[#0071e3] border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                title="Configurações"
              >
                <Settings size={14} />
                <span className="hidden lg:inline">Config</span>
              </button>
            </div>

            <button
              onClick={() => { void handleAnalystLogout({ reason: 'manual' }); }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:text-rose-500 hover:border-rose-200 hover:-translate-y-0.5 active:translate-y-0"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
            <button
              onClick={toggleThemeMode}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:text-[#0071e3] hover:border-blue-200 hover:-translate-y-0.5 active:translate-y-0"
              title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {showAnalystMobileIdleWarning && (
          <div className="lg:hidden px-3 pb-2.5">
            <div className="rounded-xl border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_55%,#ffffff_100%)] px-3 py-2 shadow-[0_10px_18px_-16px_rgba(251,146,60,0.75)]">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 inline-flex items-center justify-center shrink-0">
                    <AlertTriangle size={11} />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-700 truncate">Sessão expira em {formatIdleCountdown(analystIdleSecondsLeft)}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold text-amber-800 tracking-[0.06em]">{formatIdleCountdown(analystIdleSecondsLeft)}</span>
                  <button
                    type="button"
                    onClick={() => setMobileIdleWarningDismissUntil(Date.now() + 15000)}
                    className="h-5 w-5 rounded-md border border-amber-200 bg-white/80 text-amber-700 inline-flex items-center justify-center"
                    title="Ocultar por alguns segundos"
                    aria-label="Ocultar aviso temporariamente"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-amber-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#f97316_55%,#ef4444_100%)] transition-all duration-500"
                  style={{ width: `${analystIdleWarningProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="w-full max-w-[min(1480px,96vw)] mx-auto p-3 md:p-5 lg:p-6 animate-in fade-in duration-500 flex-1">
        {analystTab === 'settings' ? (
          <AnalystSettingsTab
            isSubmitting={isGlobalLoading}
            onSubmit={handleChangePassword}
            onClose={() => setAnalystTab('mesa')}
          />
        ) : analystTab === 'analytics' ? (
          <AnalystAnalyticsTab
            analyticsData={analyticsData}
            currentUser={currentUser}
            notify={notify}
          />
        ) : analystTab === 'suggestions' ? (
          <AnalystSuggestionsTab
            suggestions={suggestions}
            onCreateSuggestion={handleCreateSuggestion}
            onUpdateSuggestion={handleUpdateSuggestion}
            onCancelSuggestion={handleCancelSuggestion}
            onDeleteSuggestion={handleDeleteSuggestion}
            isSubmitting={isGlobalLoading}
            currentUser={currentUser}
          />
        ) : currentUser && !currentUser.is_online && analystTab === 'mesa' ? (
           <div className="py-12 md:py-14 text-center bg-white border border-slate-200 rounded-2xl max-w-sm mx-auto flex flex-col items-center animate-in zoom-in-95 px-5">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100 shrink-0"><AlertTriangle size={22}/></div>
              <h2 className="text-lg font-semibold text-slate-700 mb-1 text-center leading-none">Você está pausado</h2>
              <p className="text-slate-500 font-medium text-[12px] max-w-xs mx-auto mb-5 text-center leading-relaxed">Ative sua fila no menu superior para voltar a receber pastas do CRM.</p>
              <button onClick={() => toggleQueueStatus(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-[12px] active:scale-[0.99] flex items-center gap-2"><Power size={15}/> Ligar fila</button>
           </div>
        ) : (
          analystTab === 'mesa' ? (
            <MesaView
              filteredTasks={filteredTasks}
              selectedTaskIds={selectedTaskIds}
              toggleSelectAll={toggleSelectAll}
              openBulkTransferModal={openBulkTransferModal}
              taskSearch={taskSearch}
              setTaskSearch={setTaskSearch}
              filterSit={filterSit}
              setFilterSit={setFilterSit}
              SITUACOES_MAP={SITUACOES_MAP}
              SIT_COLORS={SIT_COLORS}
              toggleTaskSelection={toggleTaskSelection}
              openReservaInCRM={openReservaInCRM}
              getReservaDisplayId={getReservaDisplayId}
              openTransferModal={openTransferModal}
              handleFinish={handleFinish}
              isMesaFrozen={mesaFreeze.active}
              onToggleMesaFreeze={toggleMesaFreeze}
              frozenMesaVisibleCount={displayedMesaTasks.length}
              hiddenFrozenMesaCount={hiddenFrozenMesaCount}
              totalMesaCount={(myTasks || []).length}
            />
          ) : (
            <div className="space-y-6 py-20 text-center text-slate-300 italic text-[11px] tracking-[0.16em] font-medium px-6">Nenhum conteúdo disponível nesta aba.</div>
          )
        )}
      </main>
    </div>
  );
};

export default App;
