import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  RefreshCw, Clock, CheckCircle2, History, Building2, 
  Hash, LayoutDashboard, AlertTriangle, XCircle, BarChart4, 
  TrendingUp, Calendar, LogOut, Lock, Eye, EyeOff,
  UserPlus, Trash2, Power, Settings, CheckSquare, Square, 
  Edit3, UserCheck, Users, ShieldCheck, Save,
  Layout, ChevronDown, Search, User as UserIcon,
  Tag, BarChart3, PieChart, RotateCcw, ArrowRightLeft, LineChart,
  Moon, Sun
} from 'lucide-react';
import { api } from './services/api';
import { ConfirmActionModal, LoadingOverlay, RevokeAccessModal, StatusToast } from './components/FeedbackOverlays';
import LoginView from './components/LoginView';
import ResetPasswordView from './components/ResetPasswordView';
import MesaView from './components/analyst/MesaView';
import AnalystAnalyticsTab from './components/analyst/AnalystAnalyticsTab';
import AnalystSettingsTab from './components/analyst/AnalystSettingsTab';
import ManagerHeader from './components/manager/ManagerHeader';
import ManagerDashboardTab from './components/manager/ManagerDashboardTab';
import ManagerTransfersTab from './components/manager/ManagerTransfersTab';
import ManagerQueueTab from './components/manager/ManagerQueueTab';
import ManagerAdminsTab from './components/manager/ManagerAdminsTab';
import EditAnalystModal from './components/manager/EditAnalystModal';

const AUTO_REFRESH_SECONDS = 15;
const LOGIN_SUCCESS_SPLASH_MS = 1600;
const ALL_FILTER = 'all';
const LEGACY_MANAGER_TOKEN = 'legacy-admin-session';
const EMPTY_ANALYTICS = {
  resumo: { total: 0, hoje: 0, mes: 0, ano: 0, media_por_dia: 0, dias_com_producao: 0 },
  series: { por_dia: [], por_mes: [] },
  rankings: { por_resultado: [], por_situacao: [], por_empreendimento: [] },
  schema: { historico_tem_analista_nome: false, historico_tem_situacao: false },
  registros: [],
  total_registros: 0,
  gerado_em: null,
};

const getLogDateRef = (log) => log?.data_transferencia || log?.created_at;

const getMonthKey = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getAnalystDisplayName = (id, name) => name || `Analista ${id}`;

const createTransferOptions = (logs, idField, nameField) => {
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

const formatIdleCountdown = (secondsLeft) => {
  const safeSeconds = Math.max(0, Number(secondsLeft) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const App = () => {
  // --- ESTADOS DE NAVEGAÇÃO ---
  const [view, setView] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const rawSession = window.sessionStorage.getItem('analystSession');
    if (!rawSession) return null;
    try {
      return JSON.parse(rawSession);
    } catch {
      return null;
    }
  });
  const [analystTab, setAnalystTab] = useState('mesa'); 
  const [managerTab, setManagerTab] = useState('dashboard');
  const [managerTabDirection, setManagerTabDirection] = useState('forward');
  const [transferMonthFilter, setTransferMonthFilter] = useState(ALL_FILTER);
  const [transferOriginFilter, setTransferOriginFilter] = useState(ALL_FILTER);
  const [transferDestinationFilter, setTransferDestinationFilter] = useState(ALL_FILTER);

  // Detecta token de reset de senha na URL (?reset_token=...)
  const [resetToken, setResetToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('reset_token') || null;
  });

  // --- ESTADOS DE DADOS ---
  const [analysts, setAnalysts] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [metrics, setMetrics] = useState({ hoje: 0, ano: 0 });
  const [analyticsData, setAnalyticsData] = useState(EMPTY_ANALYTICS);
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

  // --- ESTADOS DE UI E INTERATIVIDADE ---
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [nextRefreshAt, setNextRefreshAt] = useState(Date.now() + (AUTO_REFRESH_SECONDS * 1000));
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [loginNotice, setLoginNotice] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('themeMode') === 'dark';
  });

  // --- ESTADOS DE FILTROS ---
  const [taskSearch, setTaskSearch] = useState("");
  const [filterSit, setFilterSit] = useState("all");

  // --- ESTADOS DE MODAIS ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, nome: "", email: "", senha: "", permissoes: [], status: "ativo" });
  const [showManagerLoginModal, setShowManagerLoginModal] = useState(false);
  const [managerIdentifier, setManagerIdentifier] = useState(() => {
    if (typeof window === 'undefined') return '';
    const rawSession = window.sessionStorage.getItem('managerSession');
    if (!rawSession) return '';
    try {
      return JSON.parse(rawSession)?.email || JSON.parse(rawSession)?.usuario || '';
    } catch {
      return '';
    }
  });
  const [managerPassword, setManagerPassword] = useState("");
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [managerSession, setManagerSession] = useState(() => {
    if (typeof window === 'undefined') return null;
    const rawSession = window.sessionStorage.getItem('managerSession');
    if (!rawSession) return null;
    try {
      return JSON.parse(rawSession);
    } catch {
      return null;
    }
  });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminForm, setAdminForm] = useState({
    email: '',
    username: '',
    senha: '',
    ativo: true,
  });
  const [confirmAction, setConfirmAction] = useState({ open: false, title: "", message: "", confirmLabel: "Confirmar", tone: "warning" });
  const [revokeAction, setRevokeAction] = useState({
    open: false,
    role: 'admin',
    targetName: '',
    targetId: null,
    step: 1,
    acknowledged: false,
    confirmPhrase: '',
    reason: '',
  });
  const [togglingQueueIds, setTogglingQueueIds] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTask, setTransferTask] = useState(null);
  const [transferToId, setTransferToId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [bulkTransferToId, setBulkTransferToId] = useState("");
  const [bulkTransferReason, setBulkTransferReason] = useState("");
  const [idlePrompt, setIdlePrompt] = useState({ visible: false, role: null, secondsLeft: 0 });
  const [mobileIdleWarningDismissUntil, setMobileIdleWarningDismissUntil] = useState(0);
  const [loginSuccessSplash, setLoginSuccessSplash] = useState({ visible: false, role: null });
  const confirmResolverRef = useRef(null);
  const sessionActivityPersistRef = useRef({ manager: 0, analyst: 0 });
  const sessionExpiryGuardRef = useRef(false);
  const loginSuccessTimerRef = useRef(null);

  const CRM_BASE_BY_SOURCE = {
    cvcrm: "https://vca.cvcrm.com.br/gestor/comercial/reservas",
    lotear: "https://vcalotear.cvcrm.com.br/gestor/comercial/reservas",
  };

  const SITUACOES_MAP = {
    62: "ANÁLISE VENDA LOTEAMENTO",
    66: "ANÁLISE VENDA PARCELAMENTO INCORPORADORA",
    30: "ANÁLISE VENDA CAIXA",
    16: "CONFECÇÃO DE CONTRATO",
    31: "ASSINADO",
    84: "APROVAÇÃO EXPANSÃO",
    1012: "ANÁLISE VENDA LOTEAMENTO (LOTEAR)",
    1023: "APROVAÇÃO EXPANSÃO (LOTEAR)",
    1016: "CONFECÇÃO DE CONTRATO (LOTEAR)",
    1021: "ASSINADO (LOTEAR)",
  };

  const SIT_COLORS = useMemo(() => {
    if (isDarkMode) {
      return {
        62: { text: '#bbf7d0', bg: '#14532d' },
        66: { text: '#86efac', bg: '#166534' },
        30: { text: '#d9f99d', bg: '#3f6212' },
        84: { text: '#99f6e4', bg: '#115e59' },
        16: { text: '#fde68a', bg: '#78350f' },
        31: { text: '#fdba74', bg: '#7c2d12' },
        1012: { text: '#67e8f9', bg: '#164e63' },
        1023: { text: '#c4b5fd', bg: '#4c1d95' },
        1016: { text: '#e9d5ff', bg: '#701a75' },
        1021: { text: '#fdba74', bg: '#9a3412' },
      };
    }

    return {
      62: { text: '#355e3b', bg: '#e8f3eb' },
      66: { text: '#2f6b2f', bg: '#e4f2e4' },
      30: { text: '#3b6b2f', bg: '#edf7e7' },
      84: { text: '#1f6b5f', bg: '#e2f3ef' },
      16: { text: '#7a6632', bg: '#faf5e2' },
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

  useEffect(() => {
    const handleClickOutside = () => {};
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const isAuthScreen = view === 'login' || Boolean(resetToken);
    const activeTheme = isAuthScreen ? 'light' : (isDarkMode ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', activeTheme);
    window.localStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, view, resetToken]);

  const toggleThemeMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const notify = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
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

  const persistAnalystSession = useCallback((session) => {
    const normalizedSession = session
      ? {
          ...session,
          lastActivityAt: session.lastActivityAt || Date.now(),
        }
      : null;

    setCurrentUser(normalizedSession);
    if (typeof window === 'undefined') return;

    if (normalizedSession) {
      window.sessionStorage.setItem('analystSession', JSON.stringify(normalizedSession));
      return;
    }

    window.sessionStorage.removeItem('analystSession');
  }, []);

  const clearAnalystSession = useCallback(() => {
    persistAnalystSession(null);
    setAnalystTab('mesa');
  }, [persistAnalystSession]);

  const persistManagerSession = useCallback((session) => {
    const normalizedSession = session
      ? {
          ...session,
          lastActivityAt: session.lastActivityAt || Date.now(),
        }
      : null;

    setManagerSession(normalizedSession);
    if (typeof window === 'undefined') return;

    if (normalizedSession) {
      window.sessionStorage.setItem('managerSession', JSON.stringify(normalizedSession));
      return;
    }

    window.sessionStorage.removeItem('managerSession');
  }, []);

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
        window.sessionStorage.setItem('analystSession', JSON.stringify(next));
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
        window.sessionStorage.setItem('managerSession', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const handleAnalystLogout = useCallback(async ({ reason = 'manual' } = {}) => {
    if (!currentUser?.id) {
      clearAnalystSession();
      setView('login');
      return;
    }

    let redistribuiuPastas = false;
    try {
      const response = await api.setQueueStatus(currentUser.id, false);
      if (response?.ok) {
        const payload = await response.json();
        redistribuiuPastas = Number(payload?.redistribuidas || 0) > 0;
      }
    } catch {
      // Continua o logout local mesmo em falha de rede.
    }

    clearAnalystSession();
    setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
    setView('login');

    if (reason === 'idle') {
      setLoginNotice('Sua sessão foi encerrada por inatividade. Faça login para retomar o atendimento.');
      notify('Sessão encerrada por inatividade. As pastas em atendimento foram redistribuídas automaticamente.', 'error');
      return;
    }

    if (reason === 'password-change') {
      setLoginNotice('Senha atualizada com sucesso. Entre novamente para abrir uma nova sessão segura.');
      notify('Senha alterada. Por segurança, faça login novamente.', 'success');
      return;
    }

    if (reason === 'manager-revocation') {
      setLoginNotice('Sua sessão foi encerrada pelo gestor. Faça login novamente para continuar.');
      notify('Acesso encerrado pelo gestor. Faça login novamente.', 'error');
      return;
    }

    if (redistribuiuPastas) {
      notify('Sessão encerrada. Suas pastas foram redistribuídas.', 'success');
    } else {
      notify('Sessão encerrada.', 'success');
    }
  }, [currentUser, clearAnalystSession, notify]);

  const handleManagerUnauthorized = useCallback(() => {
    clearManagerSession();
    setShowManagerLoginModal(false);
    setManagerIdentifier('');
    setManagerPassword('');
    setShowManagerPassword(false);
    setManagerTab('dashboard');
    setView('login');
    setLoginNotice('Sua sessão de gestor expirou. Faça login novamente para continuar no painel.');
    notify('Sessão do admin expirada. Faça login novamente.', 'error');
  }, [clearManagerSession, notify]);

  const handleAnalystUnauthorized = useCallback(() => {
    clearAnalystSession();
    setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
    setView('login');
    setLoginNotice('Sua sessão foi encerrada pelo gestor ou expirou. Faça login novamente para continuar.');
    notify('Sessão revogada ou expirada. Faça login novamente.', 'error');
  }, [clearAnalystSession, notify]);

  const getApiErrorMessage = async (response, fallbackMessage) => {
    try {
      const data = await response.json();
      if (typeof data === 'string' && data.trim()) return data;
      if (data?.detail) return data.detail;
      if (data?.message) return data.message;
    } catch {
      // ignora erro de parse para usar fallback
    }
    return `${fallbackMessage} (${response.status})`;
  };

  const requestConfirmation = useCallback(({ title, message, confirmLabel = "Confirmar", tone = "warning" }) => {
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
        open: true,
        role,
        targetName,
        targetId,
        step: 1,
        acknowledged: false,
        confirmPhrase: '',
        reason: '',
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
      ...prev,
      open: false,
      step: 1,
      acknowledged: false,
      confirmPhrase: '',
      reason: '',
    }));
  }, []);

  // --- CÁLCULOS ANALÍTICOS (FRONTEND PARA EVITAR ZEROS) ---
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

  // Extração das variáveis para uso direto no JSX e evitar ReferenceError
  const calculatedBreakdown = calculatedStats.breakdown;
  const analistasMapa = calculatedStats.analistasMapa;

  const fetchData = useCallback(async (silent = true) => {
    if (!silent) setIsGlobalLoading(true);
    setIsSyncing(true);
    try {
      if (view === 'analyst' && currentUser) {
        const resA = await api.listAnalysts();
        if (resA.ok) {
          setAnalysts(await resA.json());
        } else if (resA.status === 401) {
          handleAnalystUnauthorized();
          return;
        }

        const resM = await api.getMesa(currentUser.id);
        if (resM.ok) {
          setMyTasks(await resM.json());
        } else if (resM.status === 401) {
          handleAnalystUnauthorized();
          return;
        }
        const resMet = await api.getMetrics(currentUser.id);
        if (resMet.ok) {
          setMetrics(await resMet.json());
        } else if (resMet.status === 401) {
          handleAnalystUnauthorized();
          return;
        }
        const resAnalytics = await api.getAnalystDashboard(currentUser.id);
        if (resAnalytics.ok) {
          setAnalyticsData(await resAnalytics.json());
        } else if (resAnalytics.status === 401) {
          handleAnalystUnauthorized();
          return;
        } else {
          setAnalyticsData(EMPTY_ANALYTICS);
        }
      }

      if (view === 'manager') {
        const [resD, resSync] = await Promise.all([
          api.getManagerOverview(),
          api.getManagerSyncStatus(),
        ]);

        if (resD.ok) {
          const d = await resD.json();
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
          const s = await resSync.json();
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
      }
      setApiError(null);
    } catch (e) {
      if (!silent) setApiError("Backend Offline.");
    } finally {
      setIsSyncing(false);
      if (!silent) setIsGlobalLoading(false);
      setNextRefreshAt(Date.now() + (AUTO_REFRESH_SECONDS * 1000));
    }
  }, [currentUser, handleManagerUnauthorized, handleAnalystUnauthorized, view]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
      setRefreshCountdown(secondsLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRefreshAt]);

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

  // --- ACÇÕES OPERACIONAIS ---
  const handleLogin = async (email, senha) => {
    if (!email || !senha) return;
    setIsGlobalLoading(true);
    try {
      const res = await api.loginEmail(email, senha);
      if (res.ok) {
        const userData = await res.json();
        persistAnalystSession(userData);
        setAnalystTab('mesa');
        setLoginNotice(null);
        notify(`Olá, ${userData.nome}!`);
        runLoginSuccessSplash('analyst', () => setView('analyst'));
      } else {
        notify(await getApiErrorMessage(res, "Falha no login"), "error");
      }
    } catch (e) { notify("Erro de conexão com o servidor.", "error"); }
    finally { setIsGlobalLoading(false); }
  };

  const handleManagerLogin = async () => {
    if (!managerIdentifier.trim() || !managerPassword.trim()) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.managerLogin(managerIdentifier.trim().toLowerCase(), managerPassword);
      if (res.ok) {
        const session = await res.json();
        persistManagerSession(session);
        setShowManagerLoginModal(false);
        setManagerPassword('');
        setShowManagerPassword(false);
        setManagerTab('dashboard');
        setLoginNotice(null);
        notify('Acesso admin liberado.');
        runLoginSuccessSplash('manager', () => setView('manager'));
      } else if (res.status === 404) {
        const legacyOverview = await api.getManagerOverview();

        if (legacyOverview.ok) {
          persistManagerSession({
            usuario: managerIdentifier.trim(),
            email: null,
            token: LEGACY_MANAGER_TOKEN,
            legacyMode: true,
          });
          setShowManagerLoginModal(false);
          setManagerPassword('');
          setShowManagerPassword(false);
          setManagerTab('dashboard');
          setLoginNotice(null);
          notify('Painel admin aberto em modo de compatibilidade.');
          runLoginSuccessSplash('manager', () => setView('manager'));
        } else {
          notify('O backend de produção não expõe o login do admin nem o overview do painel.', 'error');
        }
      } else {
        notify(await getApiErrorMessage(res, 'Falha no login do admin'), 'error');
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
    setLoginNotice(null);
    setView('login');
  }, [clearManagerSession]);

  const fetchAdminUsers = useCallback(async () => {
    if (!managerSession?.token) return;
    try {
      const res = await api.getManagerAdmins();
      if (res.status === 401) {
        handleManagerUnauthorized();
        return;
      }
      if (res.ok) {
        setAdminUsers(await res.json());
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
      ...prev,
      email,
      senha,
      username,
      ativo: Boolean(ativoRaw),
    }));

    if (!email || !senha) {
      notify('Informe e-mail e senha do administrador.', 'error');
      return;
    }

    setIsGlobalLoading(true);
    try {
      const res = await api.createManagerAdmin({
        email,
        senha,
        username: username || null,
        ativo: Boolean(ativoRaw),
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
        notify(await getApiErrorMessage(res, 'Erro ao revogar sessão do admin'), 'error');
      }
    } catch {
      notify('Erro de conexão ao revogar sessão do admin.', 'error');
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
        const data = await res.json();
        const redistribuidas = Number(data.redistribuidas || 0);
        const semDestino = Number(data.sem_destino || 0);
        notify(`Sessão do analista encerrada. ${redistribuidas} pasta(s) redistribuída(s). ${semDestino} sem destino automático.`, semDestino > 0 ? 'error' : 'success');
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

  useEffect(() => {
    if (view === 'manager' && managerTab === 'admins') {
      fetchAdminUsers();
    }
  }, [view, managerTab, fetchAdminUsers]);

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
      const now = Date.now();

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

  const toggleQueueStatus = async (status) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.setQueueStatus(currentUser.id, status);
      if (res.ok) {
        persistAnalystSession({ ...currentUser, is_online: status });
        notify(status ? "Você está Online!" : "Pausado.");
        fetchData();
      }
    } catch (e) { notify("Erro de status."); }
    finally { setIsGlobalLoading(false); }
  };

  const handleFinish = async (id, outcome) => {
    const isConclusion = outcome === 'Concluido';
    const confirmed = await requestConfirmation({
      title: isConclusion ? 'Confirmar conclusão' : 'Enviar para discussão',
      message: isConclusion
        ? 'Confirma a conclusão desta pasta? Essa ação registra no histórico do analista.'
        : 'Confirma o envio desta pasta para discussão? Ela ficará sinalizada para revisão.',
      confirmLabel: isConclusion ? 'Concluir pasta' : 'Enviar para discussão',
      tone: 'warning'
    });
    if (!confirmed) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.finishTask(id, outcome);
      if (res.ok) {
        notify(isConclusion ? "Pasta concluída com sucesso." : "Pasta enviada para discussão.");
        fetchData();
      } else {
        notify(await getApiErrorMessage(res, "Erro ao concluir pasta"), "error");
      }
    } catch (e) { notify("Erro ao processar conclusão da pasta.", "error"); }
    finally { setIsGlobalLoading(false); }
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
    setTransferToId("");
    setTransferReason("");
    setShowTransferModal(true);
  };

  const handleTransferTask = async () => {
    if (!transferTask || !transferToId || !currentUser) return;
    const trimmedReason = transferReason.trim();
    if (!trimmedReason) {
      notify("Informe o motivo da transferência.", "error");
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
        notify("Pasta transferida com sucesso.");
        setShowTransferModal(false);
        setTransferTask(null);
        fetchData();
      } else {
        notify(await getApiErrorMessage(res, "Erro ao transferir pasta"), "error");
      }
    } catch (e) {
      notify("Erro ao transferir pasta.", "error");
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
    setBulkTransferToId("");
    setBulkTransferReason("");
    setShowBulkTransferModal(true);
  };

  const handleBulkTransfer = async () => {
    if (!bulkTransferToId || !currentUser || selectedTaskIds.size === 0) return;
    const trimmedReason = bulkTransferReason.trim();
    if (!trimmedReason) {
      notify("Informe o motivo da transferência.", "error");
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
        const data = await res.json();
        notify(`${data.transferidas} pasta(s) transferida(s) com sucesso.${data.erros > 0 ? ` ${data.erros} com erro.` : ''}`);
        setShowBulkTransferModal(false);
        setSelectedTaskIds(new Set());
        fetchData();
      } else {
        notify(await getApiErrorMessage(res, "Erro ao transferir pastas"), "error");
      }
    } catch (e) {
      notify("Erro ao transferir pastas.", "error");
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleRedistribute = async () => {
    const confirmed = await requestConfirmation({
      title: "Confirmar redistribuição",
      message: "Deseja realmente redistribuir as pastas agora?",
      confirmLabel: "Redistribuir",
      tone: "warning"
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
        notify("Redistribuição efetuada!");
        fetchData();
      }
    } catch (e) { notify("Erro ao redistribuir."); }
    finally { setIsGlobalLoading(false); }
  };

  const handleResetData = async () => {
    const confirmed = await requestConfirmation({
      title: "Confirmar limpeza da mesa",
      message: "Deseja realmente zerar os dados da mesa atual e reiniciar a ordem da fila (sem excluir histórico)?",
      confirmLabel: "Zerar Dados",
      tone: "danger"
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
        notify("Mesas limpas e ordem reiniciada!");
        fetchData();
      } else {
        notify("Erro ao zerar dados.", "error");
      }
    } catch (e) { notify("Erro ao zerar dados.", "error"); }
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
        const data = await res.json();
        if (!nextStatus) {
          notify(`${data.redistribuidas || 0} pastas redistribuídas, ${data.sem_destino || 0} sem destino.`);
        } else {
          notify(`${analyst.nome} ficou online.`);
        }
        fetchData(true);
      } else {
        applyAnalystQueueStatus(analyst.id, analyst.is_online);
        notify("Erro ao atualizar fila do analista.", "error");
      }
    } catch (e) {
      applyAnalystQueueStatus(analyst.id, analyst.is_online);
      notify("Erro ao atualizar fila do analista.", "error");
    } finally {
      setTogglingQueueIds(prev => prev.filter(id => id !== analyst.id));
    }
  };

  const handleAdminBulkQueueToggle = async ({ analysts, targetOnline, isFullSelection = false, totalSelected = 0 }) => {
    const targetStatus = Boolean(targetOnline);
    const uniqueCandidates = Array.isArray(analysts)
      ? analysts.filter(
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
            payload = await response.json();
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
        const res = await api.saveAnalyst({
          id: isEdit ? editForm.id : null,
          payload
        });
        if (res.status === 401) {
            handleManagerUnauthorized();
            return;
        }
        if (res.ok) {
            notify(isEdit ? "Analista atualizado com sucesso!" : "Analista cadastrado com sucesso!");
            setShowEditModal(false);
            setEditForm({ id: null, nome: "", email: "", senha: "", permissoes: [], status: "ativo" });
            fetchData();
        } else {
            notify(await getApiErrorMessage(res, "Erro ao salvar analista"), "error");
        }
    } catch (e) { notify("Erro de conexão.", "error"); }
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
    } catch (e) { notify("Erro ao remover analista.", 'error'); }
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
        try {
          if (currentUser.is_online) {
            await api.setQueueStatus(currentUser.id, false);
          }
        } catch {
          // Segue para logout mesmo em falha de rede.
        }

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

  const filteredTasks = useMemo(() => {
    return (myTasks || []).filter(task => {
      const reservaDisplayId = getReservaDisplayId(task.reserva_id);
      const matchesSearch = task.cliente.toLowerCase().includes(taskSearch.toLowerCase()) || 
                          task.empreendimento.toLowerCase().includes(taskSearch.toLowerCase()) ||
                          reservaDisplayId.toString().includes(taskSearch);
      const matchesSit = filterSit === "all" || task.situacao_id.toString() === filterSit;
      return matchesSearch && matchesSit;
    });
  }, [myTasks, taskSearch, filterSit, getReservaDisplayId]);

  const transferTargetOptions = useMemo(() => {
    if (!currentUser) return [];
    return (analysts || []).filter(a => {
      if (a.id === currentUser.id) return false;
      return a.status === 'ativo';
    });
  }, [analysts, currentUser]);

  const selectedTransferTarget = useMemo(() => {
    if (!transferToId) return null;
    return transferTargetOptions.find(a => String(a.id) === String(transferToId)) || null;
  }, [transferTargetOptions, transferToId]);

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

    return {
      total: logs.length,
      topSender,
      topReceiver,
      topPair
    };
  }, [groupedTransferLogs]);

  const handleManagerTabChange = useCallback((nextTab) => {
    if (!nextTab || nextTab === managerTab) return;
    const tabOrder = ['dashboard', 'fila', 'transferencias', 'admins'];
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

  const idlePromptModal = idlePrompt.visible ? (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">
              {idlePrompt.role === 'admin' ? 'Sessão admin quase expirada' : 'Sua sessão está perto de expirar'}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">
              {idlePrompt.role === 'admin'
                ? 'Sem atividade recente no painel. Confirme sua presença para manter o acesso ativo.'
                : 'Sem atividade recente. Se a sessão expirar, você será desconectado e suas pastas serão redistribuídas automaticamente.'}
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
                setView('login');
                setLoginNotice('Sua sessão de gestor foi encerrada por escolha manual. Faça login novamente quando precisar.');
                notify('Sessão admin encerrada manualmente.', 'success');
              } else {
                void handleAnalystLogout({ reason: 'idle' });
              }
            }}
            className="py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 text-[10px] font-black uppercase"
          >
            {idlePrompt.role === 'admin' ? 'Encerrar agora' : 'Pausar agora'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (idlePrompt.role === 'admin') touchManagerActivity();
              if (idlePrompt.role === 'analyst') touchAnalystActivity();
              setIdlePrompt({ visible: false, role: null, secondsLeft: 0 });
            }}
            className="py-2.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500"
          >
            {idlePrompt.role === 'admin' ? 'Continuar sessão' : 'Continuar trabalhando'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const managerIdleSecondsLeft = null;
  const analystIdleSecondsLeft = null;
  const managerWarningWindowSeconds = 0;
  const analystWarningWindowSeconds = 0;
  const managerIdleWarningProgress = 0;
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

  // --- TELA DE RESET DE SENHA (URL com ?reset_token=...) ---
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

  // --- TELA DE LOGIN ---
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
      loginNotice={loginNotice}
      loginSuccessSplash={loginSuccessSplash}
      handleLogin={handleLogin}
      handleManagerLogin={handleManagerLogin}
    />
  );

  // --- PAINEL GESTOR ---
  if (view === 'manager') return (
    <div
      className={`min-h-screen text-slate-800 flex flex-col overflow-x-hidden ${isDarkMode ? 'bg-[radial-gradient(circle_at_top,#0b1220_0%,#080f1c_46%,#020617_100%)]' : 'bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f7fb_46%,#edf2f8_100%)]'}`}
      style={{ fontFamily: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
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

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 flex-1 w-full">
        <section className="w-fit rounded-full border border-slate-200/80 bg-white/80 p-1.5 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.42)] backdrop-blur-xl flex gap-1.5">
          <button onClick={() => handleManagerTabChange('dashboard')} className={`px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.01em] transition-all inline-flex items-center gap-2 ${managerTab === 'dashboard' ? 'bg-[#0071e3] text-white shadow-[0_12px_24px_-16px_rgba(0,113,227,0.9)]' : 'text-slate-600 hover:bg-slate-100/90'}`}><LayoutDashboard size={13} /> Dashboard</button>
          <button onClick={() => handleManagerTabChange('fila')} className={`px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.01em] transition-all inline-flex items-center gap-2 ${managerTab === 'fila' ? 'bg-[#0071e3] text-white shadow-[0_12px_24px_-16px_rgba(0,113,227,0.9)]' : 'text-slate-600 hover:bg-slate-100/90'}`}><LineChart size={13} /> Fila</button>
          <button onClick={() => handleManagerTabChange('transferencias')} className={`px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.01em] transition-all inline-flex items-center gap-2 ${managerTab === 'transferencias' ? 'bg-[#0071e3] text-white shadow-[0_12px_24px_-16px_rgba(0,113,227,0.9)]' : 'text-slate-600 hover:bg-slate-100/90'}`}><ArrowRightLeft size={13} /> Transferências</button>
          <button onClick={() => handleManagerTabChange('admins')} className={`px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.01em] transition-all inline-flex items-center gap-2 ${managerTab === 'admins' ? 'bg-[#0071e3] text-white shadow-[0_12px_24px_-16px_rgba(0,113,227,0.9)]' : 'text-slate-600 hover:bg-slate-100/90'}`}><UserPlus size={13} /> Admins</button>
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

  // --- PAINEL DO ANALISTA ---
  return (
    <div className={`min-h-screen font-sans text-slate-800 flex flex-col overflow-x-hidden ${isDarkMode ? 'bg-[#020617]' : 'bg-[#f8fafc]'}`}>
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      <RevokeAccessModal revokeAction={revokeAction} onClose={closeRevokeConfirmation} />
      {idlePromptModal}
      {showTransferModal && transferTask && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-md z-450 flex items-center justify-center p-3 sm:p-4" onClick={() => setShowTransferModal(false)}>
          <div className="w-full max-w-xl border border-white/80 rounded-3xl bg-white/95 p-5 sm:p-6 shadow-[0_36px_70px_-30px_rgba(15,23,42,0.88)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50 border border-blue-100 text-[#0071e3]">
                <ArrowRightLeft size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Transferir pasta</h3>
                <p className="text-[12px] font-medium text-slate-500 mt-1 leading-relaxed truncate">Reserva {transferTask.reserva_id} • {transferTask.cliente}</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-semibold tracking-[0.06em] text-slate-600">Analista destino</label>
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-2.5 max-h-52 overflow-y-auto custom-scrollbar space-y-2">
                {transferTargetOptions.length > 0 ? transferTargetOptions.map(a => {
                  const isSelected = String(transferToId) === String(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setTransferToId(String(a.id))}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${isSelected ? 'bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] text-white border-blue-600 shadow-[0_12px_20px_-16px_rgba(0,113,227,0.9)]' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200 hover:-translate-y-0.5'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                        {a.nome?.charAt(0) || 'A'}
                      </div>
                      <span className="text-[12px] font-semibold tracking-[0.01em] truncate flex-1">{a.nome}</span>
                      {a.is_online && <span className={`text-[10px] font-semibold shrink-0 ${isSelected ? 'text-emerald-100' : 'text-emerald-600'}`}>Fila ativa</span>}
                    </button>
                  );
                }) : (
                  <div className="px-2 py-3 text-center text-[11px] font-semibold tracking-[0.02em] text-slate-400">
                    Nenhum analista ativo disponível
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-[11px] font-medium text-slate-600">
                {selectedTransferTarget ? (
                  <span>Destino selecionado: <span className="text-[#0071e3] font-semibold">{selectedTransferTarget.nome}</span></span>
                ) : (
                  <span>Nenhum destino selecionado</span>
                )}
              </div>

              <label className="text-[11px] font-semibold tracking-[0.06em] text-slate-600">Motivo da transferência *</label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Ex.: balanceamento de carga da fila"
                className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-[12px] text-slate-700 font-medium outline-none focus:ring-4 focus:ring-blue-100/80 focus:border-blue-300"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
              <button onClick={() => setShowTransferModal(false)} className="py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-semibold border border-slate-200 transition-all hover:bg-slate-100">Cancelar</button>
              <button
                disabled={!transferToId || !transferReason.trim()}
                onClick={handleTransferTask}
                className="py-2.5 rounded-2xl text-[11px] font-semibold text-white bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] disabled:bg-blue-300 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkTransferModal && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-md z-450 flex items-center justify-center p-3 sm:p-4" onClick={() => setShowBulkTransferModal(false)}>
          <div className="w-full max-w-xl border border-white/80 rounded-3xl bg-white/95 p-5 sm:p-6 shadow-[0_36px_70px_-30px_rgba(15,23,42,0.88)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50 border border-blue-100 text-[#0071e3] shrink-0">
                <ArrowRightLeft size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Transferência em massa</h3>
                <p className="text-[12px] font-medium text-slate-500 mt-1 leading-relaxed">{selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''} selecionada{selectedTaskIds.size !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-semibold tracking-[0.06em] text-slate-600">Analista destino</label>
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-2.5 max-h-52 overflow-y-auto custom-scrollbar space-y-2">
                {transferTargetOptions.length > 0 ? transferTargetOptions.map(a => {
                  const isSelected = String(bulkTransferToId) === String(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBulkTransferToId(String(a.id))}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${isSelected ? 'bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] text-white border-blue-600 shadow-[0_12px_20px_-16px_rgba(0,113,227,0.9)]' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200 hover:-translate-y-0.5'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                        {a.nome?.charAt(0) || 'A'}
                      </div>
                      <span className="text-[12px] font-semibold tracking-[0.01em] truncate flex-1">{a.nome}</span>
                      {a.is_online && <span className={`text-[10px] font-semibold shrink-0 ${isSelected ? 'text-emerald-100' : 'text-emerald-600'}`}>Fila ativa</span>}
                    </button>
                  );
                }) : (
                  <div className="px-2 py-3 text-center text-[11px] font-semibold tracking-[0.02em] text-slate-400">
                    Nenhum analista ativo disponível
                  </div>
                )}
              </div>

              <label className="text-[11px] font-semibold tracking-[0.06em] text-slate-600">Motivo da transferência *</label>
              <input
                type="text"
                value={bulkTransferReason}
                onChange={(e) => setBulkTransferReason(e.target.value)}
                placeholder="Ex.: redistribuição para acelerar atendimento"
                className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-[12px] text-slate-700 font-medium outline-none focus:ring-4 focus:ring-blue-100/80 focus:border-blue-300"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
              <button onClick={() => setShowBulkTransferModal(false)} className="py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-semibold border border-slate-200 transition-all hover:bg-slate-100">Cancelar</button>
              <button
                disabled={!bulkTransferToId || !bulkTransferReason.trim()}
                onClick={handleBulkTransfer}
                className="py-2.5 rounded-2xl text-[11px] font-semibold text-white bg-[linear-gradient(135deg,#0071e3_0%,#005bb7_100%)] disabled:bg-blue-300 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Transferir {selectedTaskIds.size} Pasta{selectedTaskIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGlobalLoading && <LoadingOverlay />}
      <nav className="sticky top-0 z-100 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl shadow-[0_14px_34px_-24px_rgba(15,23,42,0.45)]">
        <div className="h-16 md:h-18 px-3 md:px-6 lg:px-8 flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="logo-shimmer shrink-0">
              <img
                src="/vcacloud.svg"
                alt="VCACloud"
                className={`h-7 md:h-8 w-auto object-contain shrink-0 opacity-95 ${isDarkMode ? 'brightness-0 invert' : 'brightness-0'}`}
              />
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/85 px-2.5 py-1.5 min-w-0">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-[linear-gradient(140deg,#0071e3_0%,#005bb7_100%)] rounded-xl flex items-center justify-center text-white font-black text-sm shadow-[0_14px_22px_-14px_rgba(0,113,227,0.85)] shrink-0">
                {currentUser?.nome?.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800 leading-none text-[11px] md:text-[12px] truncate max-w-42 md:max-w-60">{currentUser?.nome}</h3>
                <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[8px] font-semibold tracking-[0.08em] ${currentUser?.is_online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${currentUser?.is_online ? 'bg-emerald-500 queue-presence-dot' : 'bg-slate-400'}`} />
                  {currentUser?.is_online ? `FILA ATIVA • ${formatIdleCountdown(refreshCountdown)}` : 'FILA PAUSADA'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
            {analystIdleSecondsLeft !== null && analystIdleSecondsLeft > 0 && analystIdleSecondsLeft <= (ANALYST_IDLE_WARNING_MS / 1000) && (
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
              <span className="text-[9px] font-black uppercase tracking-widest md:hidden">{metrics.hoje}</span>
              <span className="text-[9px] font-black uppercase tracking-widest hidden md:inline">Hoje: {metrics.hoje}</span>
            </button>
            <div className={`hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border backdrop-blur-sm ${currentUser?.is_online ? 'bg-white/90 border-blue-100 text-slate-700 shadow-[0_14px_24px_-22px_rgba(0,113,227,0.65)]' : 'bg-slate-50/90 border-slate-200 text-slate-400'}`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${currentUser?.is_online ? 'bg-blue-50 text-[#0071e3]' : 'bg-slate-100 text-slate-400'}`}>
                <Clock size={12} />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-semibold tracking-[0.08em] uppercase text-slate-500">Auto refresh</p>
                <p className="text-[10px] font-semibold tracking-[0.01em] text-slate-700">
                  {currentUser?.is_online ? `Atualiza em ${formatIdleCountdown(refreshCountdown)}` : 'Pausado'}
                </p>
                <div className="mt-1 h-1 w-20 rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${currentUser?.is_online ? 'bg-[linear-gradient(90deg,#34d399_0%,#0ea5e9_55%,#2563eb_100%)]' : 'bg-slate-300'}`}
                    style={{ width: `${currentUser?.is_online ? refreshCycleProgress : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center rounded-2xl border border-slate-200/80 bg-slate-50/85 p-1 gap-1">
              <button
                onClick={() => toggleQueueStatus(!currentUser?.is_online)}
                className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-xl text-[9px] font-semibold tracking-[0.03em] transition-all ${currentUser?.is_online ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' : 'bg-emerald-600 text-white border border-emerald-600 shadow-[0_12px_18px_-14px_rgba(5,150,105,0.85)] hover:bg-emerald-500'}`}
                title={currentUser?.is_online ? 'Pausar fila' : 'Ligar fila'}
              >
                <Power size={14} />
                <span className="hidden md:inline">{currentUser?.is_online ? 'Pausar' : 'Ligar'}</span>
              </button>

              <button
                onClick={() => setAnalystTab('mesa')}
                className={`inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-xl text-[9px] font-semibold tracking-[0.03em] transition-all ${analystTab === 'mesa' ? 'bg-white text-[#0071e3] border border-blue-100 shadow-[0_10px_14px_-12px_rgba(0,113,227,0.8)]' : 'text-slate-500 hover:text-slate-700'}`}
                title="Mesa"
              >
                <LayoutDashboard size={14} />
                <span className="hidden md:inline">Mesa</span>
              </button>

              <button
                onClick={() => setAnalystTab('analytics')}
                className={`inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-xl text-[9px] font-semibold tracking-[0.03em] transition-all ${analystTab === 'analytics' ? 'bg-white text-[#0071e3] border border-blue-100 shadow-[0_10px_14px_-12px_rgba(0,113,227,0.8)]' : 'text-slate-500 hover:text-slate-700'}`}
                title="Dashboard analítico"
              >
                <BarChart3 size={14} />
                <span className="hidden lg:inline">Analítico</span>
              </button>

              <button
                onClick={() => setAnalystTab('settings')}
                className={`inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-xl text-[9px] font-semibold tracking-[0.03em] transition-all ${analystTab === 'settings' ? 'bg-white text-[#0071e3] border border-blue-100 shadow-[0_10px_14px_-12px_rgba(0,113,227,0.8)]' : 'text-slate-500 hover:text-slate-700'}`}
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

      <main className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700 w-full flex-1">
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
        ) : currentUser && !currentUser.is_online && analystTab === 'mesa' ? (
           <div className="py-20 md:py-24 text-center bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] max-w-md mx-auto flex flex-col items-center animate-in zoom-in-95 px-6">
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 border border-slate-100 shrink-0"><AlertTriangle size={32}/></div>
              <h2 className="text-xl font-black text-slate-700 mb-2 uppercase tracking-tighter text-center leading-none">Você está Pausado</h2>
              <p className="text-slate-400 font-bold text-[10px] max-w-xs mx-auto mb-8 text-center uppercase tracking-widest leading-relaxed px-4">Ative sua fila no menu superior para voltar a receber pastas do CRM.</p>
              <button onClick={() => toggleQueueStatus(true)} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] shadow-xl active:scale-95 flex items-center gap-3"><Power size={18}/> Ligar Fila</button>
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
            />
          ) : (
            <div className="space-y-6 py-20 text-center text-slate-300 italic text-[11px] uppercase tracking-[0.4em] font-bold px-6">Nenhum conteúdo disponível nesta aba.</div>
          )
        )}
      </main>
    </div>
  );
};

export default App;
