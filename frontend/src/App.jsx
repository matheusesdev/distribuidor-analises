import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  RefreshCw, Clock, CheckCircle2, History, Building2, 
  Hash, LayoutDashboard, AlertTriangle, XCircle, BarChart4, 
  TrendingUp, Calendar, LogOut, Lock, Eye, EyeOff,
  UserPlus, Trash2, Power, Settings, CheckSquare, Square, 
  Edit3, UserCheck, Users, ShieldCheck, Save,
  Layout, ChevronDown, Search, User as UserIcon,
  Tag, BarChart3, PieChart, RotateCcw, ArrowRightLeft
} from 'lucide-react';
import { api } from './services/api';
import { ConfirmActionModal, LoadingOverlay, StatusToast } from './components/FeedbackOverlays';
import LoginView from './components/LoginView';
import ResetPasswordView from './components/ResetPasswordView';
import MesaView from './components/analyst/MesaView';
import AnalystAnalyticsTab from './components/analyst/AnalystAnalyticsTab';
import AnalystSettingsTab from './components/analyst/AnalystSettingsTab';
import ManagerHeader from './components/manager/ManagerHeader';
import ManagerDashboardTab from './components/manager/ManagerDashboardTab';
import ManagerTransfersTab from './components/manager/ManagerTransfersTab';
import EditAnalystModal from './components/manager/EditAnalystModal';

const AUTO_REFRESH_SECONDS = 15;
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

const App = () => {
  // --- ESTADOS DE NAVEGAÇÃO ---
  const [view, setView] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [analystTab, setAnalystTab] = useState('mesa'); 
  const [managerTab, setManagerTab] = useState('dashboard');
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
    distribuicao_atual: [],
    historico_recente: [],
    logs_transferencias: [],
    total_pendente_cvcrm: 0,
    pastas_sem_destino: 0
  });

  // --- ESTADOS DE UI E INTERATIVIDADE ---
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [nextRefreshAt, setNextRefreshAt] = useState(Date.now() + (AUTO_REFRESH_SECONDS * 1000));
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [apiError, setApiError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- ESTADOS DE FILTROS ---
  const [taskSearch, setTaskSearch] = useState("");
  const [filterSit, setFilterSit] = useState("all");

  // --- ESTADOS DE MODAIS ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, nome: "", email: "", senha: "", permissoes: [], status: "ativo" });
  const [showManagerLoginModal, setShowManagerLoginModal] = useState(false);
  const [managerUsername, setManagerUsername] = useState(() => {
    if (typeof window === 'undefined') return 'admin';
    const rawSession = window.sessionStorage.getItem('managerSession');
    if (!rawSession) return 'admin';
    try {
      return JSON.parse(rawSession)?.usuario || 'admin';
    } catch {
      return 'admin';
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
  const [confirmAction, setConfirmAction] = useState({ open: false, title: "", message: "", confirmLabel: "Confirmar", tone: "warning" });
  const [togglingQueueIds, setTogglingQueueIds] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTask, setTransferTask] = useState(null);
  const [transferToId, setTransferToId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [bulkTransferToId, setBulkTransferToId] = useState("");
  const [bulkTransferReason, setBulkTransferReason] = useState("");
  const confirmResolverRef = useRef(null);

  const CRM_BASE = "https://vca.cvcrm.com.br/gestor/comercial/reservas";

  const SITUACOES_MAP = {
    62: "ANÁLISE VENDA LOTEAMENTO",
    66: "ANÁLISE VENDA PARCELAMENTO INCORPORADORA",
    30: "ANÁLISE VENDA CAIXA",
    16: "CONFECÇÃO DE CONTRATO",
    31: "ASSINADO",
    84: "APROVAÇÃO EXPANSÃO"
  };

  const SIT_COLORS = {
    62: { text: '#355e3b', bg: '#e8f3eb' },
    66: { text: '#2f6b2f', bg: '#e4f2e4' },
    30: { text: '#3b6b2f', bg: '#edf7e7' },
    84: { text: '#1f6b5f', bg: '#e2f3ef' },
    16: { text: '#7a6632', bg: '#faf5e2' },
    31: { text: '#8a5a2b', bg: '#fbeee3' }
  };

  useEffect(() => {
    const handleClickOutside = () => {};
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notify = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  }, []);

  const persistManagerSession = useCallback((session) => {
    setManagerSession(session);
    if (typeof window === 'undefined') return;

    if (session) {
      window.sessionStorage.setItem('managerSession', JSON.stringify(session));
      return;
    }

    window.sessionStorage.removeItem('managerSession');
  }, []);

  const clearManagerSession = useCallback(() => {
    persistManagerSession(null);
  }, [persistManagerSession]);

  const handleManagerUnauthorized = useCallback(() => {
    clearManagerSession();
    setShowManagerLoginModal(false);
    setManagerPassword('');
    setShowManagerPassword(false);
    setManagerTab('dashboard');
    setView('login');
    notify('Sessão do admin expirada. Faça login novamente.', 'error');
  }, [clearManagerSession, notify]);

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

  // --- CÁLCULOS ANALÍTICOS (FRONTEND PARA EVITAR ZEROS) ---
  const calculatedStats = useMemo(() => {
    const breakdown = {};
    Object.keys(SITUACOES_MAP).forEach(id => breakdown[id] = 0);
    
    const analistasMapa = {};
    dashData.equipe.forEach(a => {
        analistasMapa[a.id] = { naMesa: 0, feitosHoje: 0 };
    });

    dashData.distribuicao_atual?.forEach(item => {
      if (breakdown[item.situacao_id] !== undefined) breakdown[item.situacao_id]++;
      if (analistasMapa[item.analista_id]) analistasMapa[item.analista_id].naMesa++;
    });

    dashData.historico_recente?.forEach(item => {
        if (analistasMapa[item.analista_id]) analistasMapa[item.analista_id].feitosHoje++;
    });

    return { breakdown, analistasMapa };
  }, [dashData]);

  // Extração das variáveis para uso direto no JSX e evitar ReferenceError
  const calculatedBreakdown = calculatedStats.breakdown;
  const analistasMapa = calculatedStats.analistasMapa;

  const fetchData = useCallback(async (silent = true) => {
    if (!silent) setIsGlobalLoading(true);
    setIsSyncing(true);
    try {
      const resA = await api.listAnalysts();
      if (resA.ok) setAnalysts(await resA.json());

      if (view === 'analyst' && currentUser) {
        const resM = await api.getMesa(currentUser.id);
        if (resM.ok) setMyTasks(await resM.json());
        const resMet = await api.getMetrics(currentUser.id);
        if (resMet.ok) setMetrics(await resMet.json());
        const resAnalytics = await api.getAnalystDashboard(currentUser.id);
        if (resAnalytics.ok) {
          setAnalyticsData(await resAnalytics.json());
        } else {
          setAnalyticsData(EMPTY_ANALYTICS);
        }
      }

      if (view === 'manager') {
        const resD = await api.getManagerOverview();
        if (resD.ok) {
          const d = await resD.json();
          setDashData({ 
            equipe: d.equipe || [], 
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
      }
      setApiError(null);
    } catch (e) {
      if (!silent) setApiError("Backend Offline.");
    } finally {
      setIsSyncing(false);
      if (!silent) setIsGlobalLoading(false);
      setNextRefreshAt(Date.now() + (AUTO_REFRESH_SECONDS * 1000));
    }
  }, [currentUser, handleManagerUnauthorized, view]);

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
        setCurrentUser(userData);
        setAnalystTab('mesa');
        setView('analyst');
        notify(`Olá, ${userData.nome}!`);
      } else {
        notify(await getApiErrorMessage(res, "Falha no login"), "error");
      }
    } catch (e) { notify("Erro de conexão com o servidor.", "error"); }
    finally { setIsGlobalLoading(false); }
  };

  const handleManagerLogin = async () => {
    if (!managerUsername.trim() || !managerPassword.trim()) return;

    setIsGlobalLoading(true);
    try {
      const res = await api.managerLogin(managerUsername.trim(), managerPassword);
      if (res.ok) {
        const session = await res.json();
        persistManagerSession(session);
        setShowManagerLoginModal(false);
        setManagerPassword('');
        setShowManagerPassword(false);
        setManagerTab('dashboard');
        setView('manager');
        notify('Acesso admin liberado.');
      } else if (res.status === 404) {
        const legacyOverview = await api.getManagerOverview();

        if (legacyOverview.ok) {
          persistManagerSession({
            usuario: managerUsername.trim(),
            email: null,
            token: LEGACY_MANAGER_TOKEN,
            legacyMode: true,
          });
          setShowManagerLoginModal(false);
          setManagerPassword('');
          setShowManagerPassword(false);
          setManagerTab('dashboard');
          setView('manager');
          notify('Painel admin aberto em modo de compatibilidade.');
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
    setManagerPassword('');
    setShowManagerPassword(false);
    setManagerTab('dashboard');
    setView('login');
  }, [clearManagerSession]);

  const toggleQueueStatus = async (status) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.setQueueStatus(currentUser.id, status);
      if (res.ok) {
        setCurrentUser(prev => ({ ...prev, is_online: status }));
        notify(status ? "Você está Online!" : "Pausado.");
        fetchData();
      }
    } catch (e) { notify("Erro de status."); }
    finally { setIsGlobalLoading(false); }
  };

  const handleFinish = async (id, outcome) => {
    setIsGlobalLoading(true);
    try {
      const res = await api.finishTask(id, outcome);
      if (res.ok) {
        notify("Pasta finalizada.");
        fetchData();
      }
    } catch (e) { notify("Erro ao processar."); }
    finally { setIsGlobalLoading(false); }
  };

  const openReservaInCRM = (reservaId) => {
    if (!reservaId) return;
    const crmUrl = `${CRM_BASE}/${reservaId}/administrar`;
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
      const res = await api.setQueueStatus(analyst.id, nextStatus);
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

  const handleDeleteAnalyst = async (id) => {
    if (!window.confirm("Remover este analista?")) return;
    setIsGlobalLoading(true);
    try {
        const res = await api.deleteAnalyst(id);
        if (res.status === 401) {
            handleManagerUnauthorized();
            return;
        }
        notify("Analista removido.");
        fetchData();
    } catch (e) { notify("Erro ao remover."); }
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
        notify('Senha alterada com sucesso.');
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
      const matchesSearch = task.cliente.toLowerCase().includes(taskSearch.toLowerCase()) || 
                          task.empreendimento.toLowerCase().includes(taskSearch.toLowerCase()) ||
                          task.reserva_id.toString().includes(taskSearch);
      const matchesSit = filterSit === "all" || task.situacao_id.toString() === filterSit;
      return matchesSearch && matchesSit;
    });
  }, [myTasks, taskSearch, filterSit]);

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

  const resetTransferFilters = () => {
    setTransferMonthFilter(ALL_FILTER);
    setTransferOriginFilter(ALL_FILTER);
    setTransferDestinationFilter(ALL_FILTER);
  };

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
      managerUsername={managerUsername}
      setManagerUsername={setManagerUsername}
      managerPassword={managerPassword}
      setManagerPassword={setManagerPassword}
      showManagerPassword={showManagerPassword}
      setShowManagerPassword={setShowManagerPassword}
      handleLogin={handleLogin}
      handleManagerLogin={handleManagerLogin}
    />
  );

  // --- PAINEL GESTOR ---
  if (view === 'manager') return (
    <div className="min-h-screen font-sans bg-[#f8fafc] text-slate-800 flex flex-col overflow-x-hidden">
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      {isGlobalLoading && <LoadingOverlay />}
      <ManagerHeader
        handleRedistribute={handleRedistribute}
        handleResetData={handleResetData}
        onExit={handleManagerLogout}
      />

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 flex-1">
        <section className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm flex gap-2 w-fit">
          <button onClick={() => setManagerTab('dashboard')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${managerTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}>Dashboard</button>
          <button onClick={() => setManagerTab('transferencias')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex items-center gap-2 ${managerTab === 'transferencias' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}><ArrowRightLeft size={12} /> Transferências</button>
        </section>

        {managerTab === 'dashboard' && (
          <ManagerDashboardTab
            SITUACOES_MAP={SITUACOES_MAP}
            SIT_COLORS={SIT_COLORS}
            isSyncing={isSyncing}
            calculatedBreakdown={calculatedBreakdown}
            dashData={dashData}
            analistasMapa={analistasMapa}
            setEditForm={setEditForm}
            setShowEditModal={setShowEditModal}
            togglingQueueIds={togglingQueueIds}
            handleAdminQueueToggle={handleAdminQueueToggle}
            handleDeleteAnalyst={handleDeleteAnalyst}
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
    <div className="min-h-screen font-sans bg-[#f8fafc] text-slate-800 flex flex-col overflow-x-hidden">
      <StatusToast toast={toast} />
      <ConfirmActionModal confirmAction={confirmAction} onClose={closeConfirmation} />
      {showTransferModal && transferTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-450 flex items-center justify-center p-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                <ArrowRightLeft size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Transferir Pasta</h3>
                <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">Reserva {transferTask.reserva_id} • {transferTask.cliente}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Analista Destino</label>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                {transferTargetOptions.length > 0 ? transferTargetOptions.map(a => {
                  const isSelected = String(transferToId) === String(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setTransferToId(String(a.id))}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-100 hover:border-blue-200'}`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black uppercase ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                        {a.nome?.charAt(0) || 'A'}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wide truncate flex-1">{a.nome}</span>
                      {a.is_online && <span className="text-[8px] font-black uppercase text-green-500 shrink-0">Online</span>}
                    </button>
                  );
                }) : (
                  <div className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Nenhum analista ativo disponível
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                {selectedTransferTarget ? (
                  <span>Destino selecionado: <span className="text-blue-600">{selectedTransferTarget.nome}</span></span>
                ) : (
                  <span>Nenhum destino selecionado</span>
                )}
              </div>

              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da transferência *</label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Informe o motivo"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-[11px] text-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => setShowTransferModal(false)} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase border border-slate-100">Cancelar</button>
              <button
                disabled={!transferToId || !transferReason.trim()}
                onClick={handleTransferTask}
                className="py-2.5 rounded-xl text-[10px] font-black uppercase text-white bg-blue-600 disabled:bg-blue-300"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkTransferModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-450 flex items-center justify-center p-4" onClick={() => setShowBulkTransferModal(false)}>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shrink-0">
                <ArrowRightLeft size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Transferência em Massa</h3>
                <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">{selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''} selecionada{selectedTaskIds.size !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Analista Destino</label>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                {transferTargetOptions.length > 0 ? transferTargetOptions.map(a => {
                  const isSelected = String(bulkTransferToId) === String(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBulkTransferToId(String(a.id))}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-100 hover:border-blue-200'}`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black uppercase ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                        {a.nome?.charAt(0) || 'A'}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wide truncate flex-1">{a.nome}</span>
                      {a.is_online && <span className="text-[8px] font-black uppercase text-green-500 shrink-0">Online</span>}
                    </button>
                  );
                }) : (
                  <div className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Nenhum analista ativo disponível
                  </div>
                )}
              </div>

              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da transferência *</label>
              <input
                type="text"
                value={bulkTransferReason}
                onChange={(e) => setBulkTransferReason(e.target.value)}
                placeholder="Informe o motivo"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-[11px] text-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => setShowBulkTransferModal(false)} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase border border-slate-100">Cancelar</button>
              <button
                disabled={!bulkTransferToId || !bulkTransferReason.trim()}
                onClick={handleBulkTransfer}
                className="py-2.5 rounded-xl text-[10px] font-black uppercase text-white bg-blue-600 disabled:bg-blue-300"
              >
                Transferir {selectedTaskIds.size} Pasta{selectedTaskIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGlobalLoading && <LoadingOverlay />}
      <nav className="bg-white border-b border-slate-100 p-2 md:p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-100 shadow-sm h-14 md:h-16">
        <div className="flex items-center gap-3 md:gap-4 truncate">
          <div className="logo-shimmer shrink-0">
            <img src="/vcacloud.svg" alt="VCACloud" className="h-7 md:h-8 w-auto object-contain shrink-0 brightness-0 opacity-80" />
          </div>
          <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20 shrink-0">{currentUser?.nome?.charAt(0)}</div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="truncate">
              <h3 className="font-bold text-slate-700 leading-none text-xs md:text-sm uppercase truncate">{currentUser?.nome}</h3>
              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mt-1 flex items-center gap-1 ${currentUser?.is_online ? 'text-green-600' : 'text-slate-400'}`}>{currentUser?.is_online ? `ATIVO NA FILA • ${refreshCountdown}s` : 'PAUSADO'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
           <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentUser?.is_online ? 'bg-green-50 border-green-100 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${currentUser?.is_online ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              <Clock size={12} className="opacity-70" />
              <span className="text-[9px] font-black uppercase tracking-widest">{currentUser?.is_online ? `DISPONÍVEL • ${refreshCountdown}s` : 'OFFLINE'}</span>
           </div>
           <div className="flex bg-slate-50 p-1 rounded-xl gap-1 md:gap-1.5 items-center border border-slate-100 shrink-0">
                <button onClick={() => toggleQueueStatus(!currentUser?.is_online)} className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all shadow-sm ${currentUser?.is_online ? 'bg-red-50 text-red-600 border border-red-100 active:scale-95' : 'bg-green-600 text-white shadow-md active:scale-95'}`}>
                <Power size={14} /> <span className="hidden xs:inline">{currentUser?.is_online ? "Pausar" : "Ligar"}</span>
                </button>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <button onClick={() => setAnalystTab('mesa')} className={`p-1.5 md:p-2 rounded-lg transition-all ${analystTab === 'mesa' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-300 hover:text-slate-400'}`} title="Mesa"><LayoutDashboard size={18}/></button>
                <button onClick={() => setAnalystTab('analytics')} className={`p-1.5 md:p-2 rounded-lg transition-all ${analystTab === 'analytics' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-300 hover:text-slate-400'}`} title="Dashboard analítico"><BarChart3 size={18}/></button>
                <button onClick={() => setAnalystTab('settings')} className={`p-1.5 md:p-2 rounded-lg transition-all ${analystTab === 'settings' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-300 hover:text-slate-400'}`} title="Configurações"><Settings size={18}/></button>
            </div>
            <button onClick={() => { setView('login'); setCurrentUser(null); setAnalystTab('mesa'); }} className="bg-white text-slate-300 p-1.5 md:p-2 rounded-lg hover:text-red-500 transition-all border border-slate-100 active:scale-95 shadow-sm ml-1 shrink-0"><LogOut size={18}/></button>
        </div>
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
              openTransferModal={openTransferModal}
              handleFinish={handleFinish}
              metrics={metrics}
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