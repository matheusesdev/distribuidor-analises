import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  RefreshCw, Clock, CheckCircle2, History, Building2, 
  Hash, LayoutDashboard, AlertTriangle, XCircle, BarChart4, 
  TrendingUp, Calendar, LogOut, Lock, Eye, EyeOff,
  UserPlus, Trash2, Power, Settings, CheckSquare, Square, 
  Edit3, UserCheck, Users, ShieldCheck, CheckCircle, Save,
  Layout, ChevronDown, Search, User as UserIcon,
  Tag, BarChart3, PieChart, RotateCcw, ListOrdered, ArrowRightLeft
} from 'lucide-react';

const AUTO_REFRESH_SECONDS = 15;

const App = () => {
  // --- ESTADOS DE NAVEGAÇÃO ---
  const [view, setView] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [analystTab, setAnalystTab] = useState('mesa'); 
  const [managerTab, setManagerTab] = useState('dashboard');
  const [transferMonthFilter, setTransferMonthFilter] = useState('all');
  const [transferOriginFilter, setTransferOriginFilter] = useState('all');
  const [transferDestinationFilter, setTransferDestinationFilter] = useState('all');

  // --- ESTADOS DE DADOS ---
  const [analysts, setAnalysts] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [metrics, setMetrics] = useState({ hoje: 0, ano: 0 });
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

  // --- ESTADOS DE SELEÇÃO DE PERFIL ---
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [profileSearch, setProfileSearch] = useState("");
  const dropdownRef = useRef(null);

  // --- ESTADOS DE MODAIS ---
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAnalyst, setSelectedAnalyst] = useState(null);
  const [editForm, setEditForm] = useState({ id: null, nome: "", senha: "", permissoes: [] });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const API_BASE = "http://localhost:8000/api";
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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notify = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

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
      const resA = await fetch(`${API_BASE}/analistas`);
      if (resA.ok) setAnalysts(await resA.json());

      if (view === 'analyst' && currentUser) {
        const resM = await fetch(`${API_BASE}/mesa/${currentUser.id}`);
        if (resM.ok) setMyTasks(await resM.json());
        const resMet = await fetch(`${API_BASE}/metricas/${currentUser.id}`);
        if (resMet.ok) setMetrics(await resMet.json());
      }

      if (view === 'manager') {
        const resD = await fetch(`${API_BASE}/gestor/overview`);
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
  }, [currentUser, view]);

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

  // --- ACÇÕES OPERACIONAIS ---
  const handleLogin = async () => {
    if (!selectedAnalyst) {
      notify("Selecione um usuário.", "error");
      return;
    }
    if (!password) return;
    setIsGlobalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: selectedAnalyst.id, senha: password })
      });
      if (res.ok) {
        const userData = await res.json();
        setCurrentUser(userData);
        setShowLoginModal(false);
        setView('analyst');
        notify(`Olá, ${selectedAnalyst.nome}!`);
      } else {
        notify(await getApiErrorMessage(res, "Falha no login"), "error");
      }
    } catch (e) { notify("Erro de conexão com o servidor.", "error"); }
    finally { setIsGlobalLoading(false); }
  };

  const toggleQueueStatus = async (status) => {
    setIsGlobalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analista/status-fila`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: currentUser.id, online: status })
      });
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
      const res = await fetch(`${API_BASE}/concluir?reserva_id=${id}&resultado=${outcome}`, { method: 'POST' });
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
      const res = await fetch(`${API_BASE}/analista/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserva_id: transferTask.reserva_id,
          analista_origem_id: currentUser.id,
          analista_destino_id: parseInt(transferToId),
          motivo: trimmedReason
        })
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
      const res = await fetch(`${API_BASE}/analista/transferir-massa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserva_ids: Array.from(selectedTaskIds),
          analista_origem_id: currentUser.id,
          analista_destino_id: parseInt(bulkTransferToId),
          motivo: trimmedReason
        })
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
      const res = await fetch(`${API_BASE}/gestor/redistribuir`, { method: 'POST' });
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
      const res = await fetch(`${API_BASE}/gestor/zerar-dados`, { method: 'POST' });
      if (res.ok) {
        notify("Mesas limpas e ordem reiniciada!");
        fetchData();
      } else {
        notify("Erro ao zerar dados.", "error");
      }
    } catch (e) { notify("Erro ao zerar dados.", "error"); }
    finally { setIsGlobalLoading(false); }
  };

  const handleAdminQueueToggle = async (analyst) => {
    if (togglingQueueIds.includes(analyst.id)) return;
    const nextStatus = !analyst.is_online;
    setTogglingQueueIds(prev => [...prev, analyst.id]);
    setDashData(prev => ({
      ...prev,
      equipe: (prev.equipe || []).map(a => a.id === analyst.id ? { ...a, is_online: nextStatus } : a)
    }));
    setAnalysts(prev => (prev || []).map(a => a.id === analyst.id ? { ...a, is_online: nextStatus } : a));

    try {
      const res = await fetch(`${API_BASE}/analista/status-fila`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: analyst.id, online: nextStatus })
      });
      if (res.ok) {
        const data = await res.json();
        if (!nextStatus) {
          notify(`${data.redistribuidas || 0} pastas redistribuídas, ${data.sem_destino || 0} sem destino.`);
        } else {
          notify(`${analyst.nome} ficou online.`);
        }
        fetchData(true);
      } else {
        setDashData(prev => ({
          ...prev,
          equipe: (prev.equipe || []).map(a => a.id === analyst.id ? { ...a, is_online: analyst.is_online } : a)
        }));
        setAnalysts(prev => (prev || []).map(a => a.id === analyst.id ? { ...a, is_online: analyst.is_online } : a));
        notify("Erro ao atualizar fila do analista.", "error");
      }
    } catch (e) {
      setDashData(prev => ({
        ...prev,
        equipe: (prev.equipe || []).map(a => a.id === analyst.id ? { ...a, is_online: analyst.is_online } : a)
      }));
      setAnalysts(prev => (prev || []).map(a => a.id === analyst.id ? { ...a, is_online: analyst.is_online } : a));
      notify("Erro ao atualizar fila do analista.", "error");
    } finally {
      setTogglingQueueIds(prev => prev.filter(id => id !== analyst.id));
    }
  };

  const handleSaveAnalyst = async () => {
    setIsGlobalLoading(true);
    try {
        const isEdit = editForm.id !== null;
        const url = isEdit ? `${API_BASE}/gestor/analistas/${editForm.id}` : `${API_BASE}/gestor/analistas`;
        const res = await fetch(url, {
            method: isEdit ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editForm)
        });
        if (res.ok) {
            notify("Alterações gravadas!");
            setShowEditModal(false);
            fetchData();
        } else { notify("Erro ao salvar."); }
    } catch (e) { notify("Erro de conexão."); }
    finally { setIsGlobalLoading(false); }
  };

  const handleDeleteAnalyst = async (id) => {
    if (!window.confirm("Remover este analista?")) return;
    setIsGlobalLoading(true);
    try {
        await fetch(`${API_BASE}/gestor/analistas/${id}`, { method: 'DELETE' });
        notify("Analista removido.");
        fetchData();
    } catch (e) { notify("Erro ao remover."); }
    finally { setIsGlobalLoading(false); }
  };

  // --- LÓGICA ANALÍTICA DE FILA ---
  const myQueuePositions = useMemo(() => {
    if (!currentUser || view !== 'analyst' || !analysts.length) return {};
    const onlineAnalysts = analysts.filter(a => a.is_online);
    const positions = {};
    Object.keys(SITUACOES_MAP).forEach(sitId => {
      const sid = parseInt(sitId);
      const eligible = onlineAnalysts.filter(a => a.permissoes && a.permissoes.includes(sid));
      if (eligible.some(a => a.id === currentUser.id)) {
        const sorted = [...eligible].sort((a, b) => {
          if (a.total_hoje !== b.total_hoje) return a.total_hoje - b.total_hoje;
          return new Date(a.ultima_atribuicao || 0) - new Date(b.ultima_atribuicao || 0);
        });
        const pos = sorted.findIndex(a => a.id === currentUser.id) + 1;
        positions[sid] = pos;
      }
    });
    return positions;
  }, [currentUser, analysts, view]);

  const filteredTasks = useMemo(() => {
    return (myTasks || []).filter(task => {
      const matchesSearch = task.cliente.toLowerCase().includes(taskSearch.toLowerCase()) || 
                          task.empreendimento.toLowerCase().includes(taskSearch.toLowerCase()) ||
                          task.reserva_id.toString().includes(taskSearch);
      const matchesSit = filterSit === "all" || task.situacao_id.toString() === filterSit;
      return matchesSearch && matchesSit;
    });
  }, [myTasks, taskSearch, filterSit]);

  const filteredAnalystsList = useMemo(() => {
    return (analysts || []).filter(a => a.nome.toLowerCase().includes(profileSearch.toLowerCase()));
  }, [analysts, profileSearch]);

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
      if (transferMonthFilter === 'all') return true;
      const dateRef = log.data_transferencia || log.created_at;
      if (!dateRef) return false;
      const d = new Date(dateRef);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === transferMonthFilter;
    }).filter(log => {
      if (transferOriginFilter === 'all') return true;
      return String(log.analista_origem_id) === String(transferOriginFilter);
    }).filter(log => {
      if (transferDestinationFilter === 'all') return true;
      return String(log.analista_destino_id) === String(transferDestinationFilter);
    });

    const grouped = {};

    filtered.forEach(log => {
      const dateRef = log.data_transferencia || log.created_at;
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
      const dateRef = log.data_transferencia || log.created_at;
      if (!dateRef) return;
      const d = new Date(dateRef);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        options.push({ value: key, label: label.charAt(0).toUpperCase() + label.slice(1) });
      }
    });
    return options.sort((a, b) => b.value.localeCompare(a.value));
  }, [dashData.logs_transferencias]);

  const transferOriginOptions = useMemo(() => {
    const map = new Map();
    (dashData.logs_transferencias || []).forEach(log => {
      if (!log.analista_origem_id) return;
      const key = String(log.analista_origem_id);
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: log.analista_origem_nome || `Analista ${log.analista_origem_id}`
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [dashData.logs_transferencias]);

  const transferDestinationOptions = useMemo(() => {
    const map = new Map();
    (dashData.logs_transferencias || []).forEach(log => {
      if (!log.analista_destino_id) return;
      const key = String(log.analista_destino_id);
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: log.analista_destino_nome || `Analista ${log.analista_destino_id}`
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
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
    setTransferMonthFilter('all');
    setTransferOriginFilter('all');
    setTransferDestinationFilter('all');
  };

  // --- UI COMPONENTS ---
  const LoadingOverlay = () => (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px]">
      <div className="bg-white p-5 rounded-2xl shadow-2xl flex flex-col items-center gap-3 border border-slate-100 animate-in zoom-in-95">
        <RefreshCw className="text-blue-600 animate-spin" size={24} />
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Processando...</p>
      </div>
    </div>
  );

  const StatusToast = () => (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'} ${toast.type === 'success' ? 'bg-blue-600 shadow-blue-200' : 'bg-red-500 shadow-red-200'} text-white`}>
      {toast.type === 'success' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
      <span className="font-bold text-[11px] uppercase tracking-tight">{toast.message}</span>
    </div>
  );

  const ConfirmActionModal = () => {
    if (!confirmAction.open) return null;
    const isDanger = confirmAction.tone === "danger";
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[450] flex items-center justify-center p-4" onClick={() => closeConfirmation(false)}>
        <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDanger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">{confirmAction.title}</h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">{confirmAction.message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button onClick={() => closeConfirmation(false)} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase border border-slate-100">Cancelar</button>
            <button onClick={() => closeConfirmation(true)} className={`py-2.5 rounded-xl text-[10px] font-black uppercase text-white ${isDanger ? 'bg-red-600' : 'bg-amber-600'}`}>{confirmAction.confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  };

  // --- TELA DE LOGIN ---
  if (view === 'login') return (
    <div className="min-h-screen flex font-sans overflow-hidden">
      <StatusToast />
      <ConfirmActionModal />
      {isGlobalLoading && <LoadingOverlay />}

      {/* Painel esquerdo — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-blue-600 p-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10">
          <img src="/logo.png" alt="VCA Logo" className="h-10 w-auto object-contain brightness-0 invert" />
        </div>
        <div className="relative z-10 space-y-5">
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight">Um sistema de distribuição de pastas que organiza e direciona demandas para a equipe de analistas em tempo real.</h1>
          <p className="text-blue-200 text-sm font-bold leading-relaxed max-w-xs">VCA Cloud</p>
        </div>
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Sincronização em tempo real</span>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f8fafc]">
        {/* Logo mobile */}
        <div className="lg:hidden mb-10">
          <img src="/logo.png" alt="VCA Logo" className="h-9 w-auto object-contain" />
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-slate-400 text-sm font-bold mt-1.5">Selecione seu perfil para continuar</p>
          </div>

          <div className="space-y-4">
            <div ref={dropdownRef} className="relative">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Perfil de acesso</label>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className={`w-full flex items-center justify-between p-4 bg-white border-2 transition-all rounded-2xl shadow-sm ${isProfileDropdownOpen ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
              >
                <div className="flex items-center gap-3 truncate">
                  {selectedAnalyst ? (
                    <>
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-[11px] font-black flex-shrink-0 uppercase">
                        {selectedAnalyst.nome?.charAt(0)}
                      </div>
                      <span className="text-sm font-black text-slate-700 uppercase tracking-tight truncate">{selectedAnalyst.nome}</span>
                    </>
                  ) : (
                    <>
                      <UserIcon size={16} className="text-slate-300 flex-shrink-0" />
                      <span className="text-sm font-bold text-slate-400">Selecionar perfil...</span>
                    </>
                  )}
                </div>
                <ChevronDown size={16} className={`text-slate-300 transition-transform flex-shrink-0 ${isProfileDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in slide-in-from-top-1">
                  <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                    <Search size={13} className="text-slate-300" />
                    <input autoFocus type="text" placeholder="Filtrar analista..." className="bg-transparent border-none outline-none text-xs font-bold w-full text-slate-600" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} />
                  </div>
                  <div className="max-h-52 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
                    {filteredAnalystsList.map(a => (
                      <button key={a.id} onClick={() => { setSelectedAnalyst(a); setIsProfileDropdownOpen(false); setShowLoginModal(true); setProfileSearch(""); setPassword(""); }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-600 group rounded-xl transition-all text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 uppercase transition-all">{a.nome?.charAt(0)}</div>
                          <span className="text-xs font-black text-slate-600 uppercase group-hover:text-white transition-colors">{a.nome}</span>
                        </div>
                        {a.is_online && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setView('manager')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-100 bg-white text-slate-400 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
            >
              <BarChart4 size={13} /> Acesso Admin
            </button>
          </div>

          <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">VCA Construtora © {new Date().getFullYear()}</p>
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[250] flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="bg-blue-600 px-8 pt-8 pb-6 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black uppercase">
                {selectedAnalyst?.nome?.charAt(0)}
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm uppercase tracking-tight">{selectedAnalyst?.nome}</p>
                <p className="text-blue-200 text-[9px] font-bold uppercase tracking-widest mt-0.5">Confirme sua identidade</p>
              </div>
            </div>
            <div className="px-8 py-6 space-y-4">
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-10 pr-10 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                  placeholder="Senha"
                />
                <button onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                disabled={isGlobalLoading || !password.trim()}
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Entrar
              </button>
              <button onClick={() => setShowLoginModal(false)} className="w-full py-2 text-slate-400 font-black uppercase text-[9px] tracking-widest hover:text-slate-600 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- PAINEL GESTOR ---
  if (view === 'manager') return (
    <div className="min-h-screen font-sans bg-[#f8fafc] text-slate-800 flex flex-col overflow-x-hidden">
      <StatusToast />
      <ConfirmActionModal />
      {isGlobalLoading && <LoadingOverlay />}
      <nav className="bg-white border-b border-slate-100 p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-3 truncate">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-500/20 flex-shrink-0"><BarChart4 size={16} className="text-white"/></div>
          <h1 className="text-xs md:text-sm font-black tracking-tighter uppercase truncate leading-none">VCA GESTÃO <span className="text-blue-500 text-[8px] md:text-[9px] tracking-widest ml-1.5 font-black uppercase hidden sm:inline">Admin</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRedistribute} className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-amber-100 active:scale-95 flex items-center gap-2 shadow-sm"><RotateCcw size={12}/> Redistribuir</button>
          <button onClick={handleResetData} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-red-100 active:scale-95 flex items-center gap-2 shadow-sm"><Trash2 size={12}/> Zerar Dados</button>
          <button onClick={() => setView('login')} className="bg-white text-slate-400 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-slate-100 active:scale-95 shadow-sm">Sair</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 flex-1">
        <section className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm flex gap-2 w-fit">
          <button onClick={() => setManagerTab('dashboard')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${managerTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}>Dashboard</button>
          <button onClick={() => setManagerTab('transferencias')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex items-center gap-2 ${managerTab === 'transferencias' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}><ArrowRightLeft size={12} /> Transferências</button>
        </section>

        {managerTab === 'dashboard' && (
        <>
        <section className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8 px-1">
                <div className="flex items-center gap-2.5"><BarChart3 size={16} className="text-blue-600" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Fluxo por Situação</h3></div>
                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border transition-all ${isSyncing ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' : 'bg-green-50 text-green-600 border-green-100'}`}><RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''}/> {isSyncing ? 'Sincronizando' : 'Sincronizado'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(SITUACOES_MAP).map(([id, nome]) => {
                const sitStyle = SIT_COLORS[id] || { text: '#0f172a', bg: '#f8fafc' };
                return (
                  <div key={id} className="p-3 rounded-xl border text-center transition-all" style={{ backgroundColor: sitStyle.bg, borderColor: sitStyle.bg }}>
                    <p className="text-[7px] font-bold uppercase leading-tight mb-1 h-5 overflow-hidden line-clamp-2" style={{ color: sitStyle.text, opacity: 0.8 }}>{nome}</p>
                    <div className="text-lg md:text-xl font-black leading-none" style={{ color: sitStyle.text }}>{calculatedBreakdown[id] || 0}</div>
                  </div>
                );
              })}
            </div>
        </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Pendente CRM</p><div className="text-4xl md:text-5xl font-black text-blue-600 leading-none">{dashData.total_pendente_cvcrm}</div></div>
              <Hash className="text-blue-50 opacity-20 flex-shrink-0" size={48}/>
           </div>
            <div className="bg-red-50 p-5 md:p-6 rounded-2xl border border-red-100 flex items-center justify-between group">
              <div><p className="text-[9px] font-black text-red-400 uppercase mb-1 tracking-widest">Sem Destino</p><div className="text-4xl md:text-5xl font-black text-red-600 leading-none">{dashData.pastas_sem_destino || 0}</div></div>
              <AlertTriangle className="text-red-200 opacity-70 flex-shrink-0" size={48}/>
            </div>
           <div className="bg-blue-600 p-5 md:p-6 rounded-2xl shadow-xl shadow-blue-500/10 flex items-center justify-between text-white group">
              <div><p className="text-[9px] font-black text-blue-100 uppercase mb-1 tracking-widest">Equipa Online</p><div className="text-4xl md:text-5xl font-black leading-none">{dashData.equipe?.filter(a => a.is_online).length || 0}</div></div>
              <Users className="text-white opacity-20 flex-shrink-0" size={48}/>
           </div>
        </section>

        <section className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
          <div className="p-5 md:p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
            <div className="flex items-center gap-2"><PieChart size={18} className="text-blue-600" /><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Processo Analítico da Equipa</h2></div>
            <button onClick={() => { setEditForm({id: null, nome: "", senha: "", permissoes: [62, 66, 30]}); setShowEditModal(true); }} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500 shadow-lg active:scale-95 flex items-center gap-2"><UserPlus size={14}/> Novo Analista</button>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[11px] min-w-[850px]">
              <thead className="text-[9px] text-slate-400 uppercase font-black border-b border-slate-50 bg-slate-50/30 text-center">
                <tr><th className="p-4 text-left">Analista</th><th className="p-4">Situações</th><th className="p-4">Recebidas (Hoje)</th><th className="p-4">Feitas (Hoje)</th><th className="p-4">Na Mesa (Atual)</th><th className="p-4 text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dashData.equipe?.map(a => {
                    const stats = analistasMapa[a.id] || { naMesa: 0, feitosHoje: 0 };
                    return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group text-[11px] text-center">
                        <td className="p-4 text-left"><div className="flex flex-col"><span className="font-bold text-slate-700 uppercase truncate max-w-[150px]">{a.nome}</span><span className={`text-[7px] font-black uppercase ${a.is_online ? 'text-green-500' : 'text-slate-300'}`}>{a.is_online ? "FILA ATIVA" : "OFFLINE"}</span></div></td>
                        <td className="p-4"><div className="flex flex-wrap gap-1 justify-center max-w-[150px] mx-auto">{(a.permissoes || []).slice(0, 3).map(p => <span key={p} className="bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded text-[7px] border border-slate-200 font-bold">{p}</span>)}</div></td>
                        <td className="p-4 font-black text-slate-900 text-sm">{a.total_hoje || 0}</td>
                        <td className="p-4 font-black text-green-600 text-sm">{stats.feitosHoje}</td>
                        <td className="p-4 font-black text-blue-600 text-sm">{stats.naMesa}</td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <button disabled={togglingQueueIds.includes(a.id)} onClick={() => handleAdminQueueToggle(a)} className={`p-2 rounded-lg border transition-all inline-flex items-center justify-center ${togglingQueueIds.includes(a.id) ? 'animate-pulse opacity-80 cursor-wait' : ''} ${a.is_online ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-green-600 text-white border-green-600 hover:bg-green-500'}`} title={a.is_online ? 'Desligar fila' : 'Ligar fila'}>{togglingQueueIds.includes(a.id) ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14}/>}</button>
                          <button onClick={() => { setEditForm({id: a.id, nome: a.nome, senha: a.senha, permissoes: a.permissoes || []}); setShowEditModal(true); }} className="text-slate-300 hover:text-blue-500 p-2 transition-all inline-block"><Edit3 size={14}/></button>
                          <button onClick={() => handleDeleteAnalyst(a.id)} className="text-slate-300 hover:text-red-500 p-2 transition-all inline-block"><Trash2 size={14}/></button>
                        </td>
                    </tr>
                )})}
              </tbody>
            </table>
          </div>
        </section>

        </>
        )}

        {managerTab === 'transferencias' && (
        <section className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
          <div className="p-5 md:p-6 border-b border-slate-50 flex items-center gap-2 bg-slate-50/20">
            <ArrowRightLeft size={18} className="text-blue-600" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Log de Transferências (por dia)</h2>
          </div>

          <div className="p-4 md:p-6 border-b border-slate-100 bg-white/60 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtros</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto">
                <select value={transferMonthFilter} onChange={(e) => setTransferMonthFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 outline-none">
                  <option value="all">Todos os meses</option>
                  {transferMonthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select value={transferOriginFilter} onChange={(e) => setTransferOriginFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 outline-none">
                  <option value="all">Origem: todos</option>
                  {transferOriginOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select value={transferDestinationFilter} onChange={(e) => setTransferDestinationFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600 outline-none">
                  <option value="all">Destino: todos</option>
                  {transferDestinationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <button
                  onClick={resetTransferFilters}
                  className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-amber-700 hover:bg-amber-100 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  Limpar filtros
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Quem mais enviou</p>
                <p className="text-[11px] font-black text-slate-700 uppercase truncate">{transferInsights.topSender ? transferInsights.topSender[0] : '—'}</p>
                <p className="text-[9px] font-black text-blue-600 mt-1">{transferInsights.topSender ? `${transferInsights.topSender[1]} transferências` : 'Sem dados'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Quem mais recebeu</p>
                <p className="text-[11px] font-black text-slate-700 uppercase truncate">{transferInsights.topReceiver ? transferInsights.topReceiver[0] : '—'}</p>
                <p className="text-[9px] font-black text-green-600 mt-1">{transferInsights.topReceiver ? `${transferInsights.topReceiver[1]} recebidas` : 'Sem dados'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Recebeu mais de quem</p>
                <p className="text-[11px] font-black text-slate-700 uppercase truncate">{transferInsights.topPair ? transferInsights.topPair[0].split('|||')[0] : '—'}</p>
                <p className="text-[9px] font-black text-amber-600 mt-1 truncate">{transferInsights.topPair ? `${transferInsights.topPair[1]} de ${transferInsights.topPair[0].split('|||')[1]}` : 'Sem dados'}</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar">
            {groupedTransferLogs.length > 0 ? groupedTransferLogs.map(([dia, logs]) => (
              <div key={dia} className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600">{dia}</div>
                <div className="divide-y divide-slate-50">
                  {logs.map((log, idx) => {
                    const hora = new Date(log.data_transferencia || log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={`${log.id || log.reserva_id}-${idx}`} className="px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                          Pasta {log.reserva_id} • {log.analista_origem_nome} <span className="text-slate-300">→</span> {log.analista_destino_nome}
                          {log.motivo ? <span className="text-slate-400 normal-case font-bold"> • Motivo: {log.motivo}</span> : null}
                        </div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">{hora}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )) : (
              <div className="py-8 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.2em]">Sem transferências registradas.</div>
            )}
          </div>
        </section>
        )}
      </main>

      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[1.5rem] max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 text-slate-800 overflow-hidden">
              <h3 className="text-xl font-black text-center mb-6 uppercase tracking-tighter flex-shrink-0">Configurar Analista</h3>
              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                 <div className="space-y-3 px-1">
                    <input type="text" value={editForm.nome} onChange={(e) => setEditForm({...editForm, nome: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="Nome Completo" />
                    <input type="text" value={editForm.senha} onChange={(e) => setEditForm({...editForm, senha: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="Senha" />
                 </div>
                 <div className="pt-1 px-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-3 tracking-widest">Responsabilidades</p>
                    <div className="grid grid-cols-1 gap-2">
                       {Object.entries(SITUACOES_MAP).map(([id, nome]) => {
                        const pid = parseInt(id);
                        const isSelected = editForm.permissoes.includes(pid);
                        return (
                            <button key={id} onClick={() => {
                                setEditForm(p => ({...p, permissoes: isSelected ? p.permissoes.filter(x => x !== pid) : [...p.permissoes, pid]}));
                            }} className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] text-left transition-all active:scale-95 ${isSelected ? 'bg-blue-600 border-blue-600 text-white font-black' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                                {isSelected ? <CheckSquare size={14} className="shrink-0"/> : <Square size={14} className="shrink-0"/>}
                                <span className="leading-tight uppercase truncate font-bold">{nome}</span>
                            </button>
                        );
                       })}
                    </div>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-6 mt-4 border-t border-slate-100 flex-shrink-0">
                <button onClick={() => setShowEditModal(false)} className="py-3 bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest hover:bg-slate-100 rounded-xl border border-slate-100">Cancelar</button>
                <button onClick={handleSaveAnalyst} className="py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-blue-500"><Save size={14}/> Salvar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  // --- PAINEL DO ANALISTA ---
  return (
    <div className="min-h-screen font-sans bg-[#f8fafc] text-slate-800 flex flex-col overflow-x-hidden">
      <StatusToast />
      <ConfirmActionModal />
      {showTransferModal && transferTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[450] flex items-center justify-center p-4" onClick={() => setShowTransferModal(false)}>
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
                      {a.is_online && <span className="text-[8px] font-black uppercase text-green-500 flex-shrink-0">Online</span>}
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[450] flex items-center justify-center p-4" onClick={() => setShowBulkTransferModal(false)}>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 flex-shrink-0">
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
                      {a.is_online && <span className="text-[8px] font-black uppercase text-green-500 flex-shrink-0">Online</span>}
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
      <nav className="bg-white border-b border-slate-100 p-2 md:p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-[100] shadow-sm h-14 md:h-16">
        <div className="flex items-center gap-3 md:gap-4 truncate">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20 flex-shrink-0">{currentUser?.nome?.charAt(0)}</div>
          <div className="hidden sm:block truncate">
            <h3 className="font-bold text-slate-700 leading-none text-xs md:text-sm uppercase truncate">{currentUser?.nome}</h3>
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mt-1 flex items-center gap-1 ${currentUser?.is_online ? 'text-green-600' : 'text-slate-400'}`}>{currentUser?.is_online ? `ATIVO NA FILA • ${refreshCountdown}s` : 'PAUSADO'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
           <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentUser?.is_online ? 'bg-green-50 border-green-100 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${currentUser?.is_online ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              <Clock size={12} className="opacity-70" />
              <span className="text-[9px] font-black uppercase tracking-widest">{currentUser?.is_online ? `DISPONÍVEL • ${refreshCountdown}s` : 'OFFLINE'}</span>
           </div>
           <div className="flex bg-slate-50 p-1 rounded-xl gap-1 md:gap-1.5 items-center border border-slate-100 flex-shrink-0">
                <button onClick={() => toggleQueueStatus(!currentUser?.is_online)} className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all shadow-sm ${currentUser?.is_online ? 'bg-red-50 text-red-600 border border-red-100 active:scale-95' : 'bg-green-600 text-white shadow-md active:scale-95'}`}>
                <Power size={14} /> <span className="hidden xs:inline">{currentUser?.is_online ? "Pausar" : "Ligar"}</span>
                </button>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <button onClick={() => setAnalystTab('mesa')} className={`p-1.5 md:p-2 rounded-lg transition-all ${analystTab === 'mesa' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-300 hover:text-slate-400'}`}><LayoutDashboard size={18}/></button>
                <button onClick={() => setAnalystTab('historico')} className={`p-1.5 md:p-2 rounded-lg transition-all ${analystTab === 'historico' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-300 hover:text-slate-400'}`}><History size={18}/></button>
            </div>
            <button onClick={() => { setView('login'); setCurrentUser(null); }} className="bg-white text-slate-300 p-1.5 md:p-2 rounded-lg hover:text-red-500 transition-all border border-slate-100 active:scale-95 shadow-sm ml-1 flex-shrink-0"><LogOut size={18}/></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700 w-full flex-1">
        {currentUser && !currentUser.is_online && analystTab === 'mesa' ? (
           <div className="py-20 md:py-24 text-center bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] max-w-md mx-auto flex flex-col items-center animate-in zoom-in-95 px-6">
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 border border-slate-100 flex-shrink-0"><AlertTriangle size={32}/></div>
              <h2 className="text-xl font-black text-slate-700 mb-2 uppercase tracking-tighter text-center leading-none">Você está Pausado</h2>
              <p className="text-slate-400 font-bold text-[10px] max-w-xs mx-auto mb-8 text-center uppercase tracking-widest leading-relaxed px-4">Ative sua fila no menu superior para voltar a receber pastas do CRM.</p>
              <button onClick={() => toggleQueueStatus(true)} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] shadow-xl active:scale-95 flex items-center gap-3"><Power size={18}/> Ligar Fila</button>
           </div>
        ) : (
          analystTab === 'mesa' ? (
            <div className="flex flex-col lg:flex-row gap-6 md:gap-10 items-start relative">
               {/* ÁREA DE TRABALHO */}
               <div className="flex-1 w-full space-y-5">
                  <div className="flex flex-wrap gap-2 px-2">
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl shadow-sm">
                      <ListOrdered size={14} className="text-blue-600"/>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Minha Posição:</span>
                      <div className="flex gap-2">
                        {Object.entries(myQueuePositions).map(([sitId, pos]) => (
                          <div key={sitId} className="flex items-center gap-1.5 bg-white border border-blue-200 px-2 py-0.5 rounded-lg shadow-sm">
                             <span className="text-[8px] font-black text-blue-600">{sitId}</span>
                             <span className="text-[10px] font-black text-slate-800">{pos}º</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-3">
                     <div className="flex items-center gap-2.5 flex-wrap">
                        <UserCheck className="text-blue-600" size={18} />
                        <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Minha Mesa</h2>
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-lg shadow-blue-500/10">{filteredTasks.length} Ativas</span>
                        {filteredTasks.length > 0 && (
                          <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-[9px] font-black uppercase text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all bg-white"
                          >
                            {selectedTaskIds.size === filteredTasks.length ? <CheckSquare size={12} className="text-blue-600"/> : <Square size={12}/>}
                            {selectedTaskIds.size === filteredTasks.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                          </button>
                        )}
                        {selectedTaskIds.size > 0 && (
                          <button
                            onClick={openBulkTransferModal}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                          >
                            <ArrowRightLeft size={12}/>
                            Transferir {selectedTaskIds.size} pasta{selectedTaskIds.size !== 1 ? 's' : ''}
                          </button>
                        )}
                     </div>
                     <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                        <div className="flex items-center gap-2 px-3 flex-1 sm:w-44 border-r border-slate-100"><Search size={14} className="text-slate-300 shrink-0" /><input type="text" placeholder="Filtrar..." className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600 w-full" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}/></div>
                        <select value={filterSit} onChange={(e) => setFilterSit(e.target.value)} className="bg-transparent border-none outline-none text-[9px] font-black uppercase text-slate-500 px-2 cursor-pointer"><option value="all">Todas Situações</option>{Object.entries(SITUACOES_MAP).map(([id, nome]) => (<option key={id} value={id}>{nome}</option>))}</select>
                     </div>
                  </div>

                  <div className="space-y-2.5">
                     {filteredTasks.length > 0 ? filteredTasks.map(task => {
                       const sitStyle = SIT_COLORS[task.situacao_id] || { text: '#2563eb', bg: '#eff6ff' };
                       const isSelected = selectedTaskIds.has(task.reserva_id);
                       return (
                       <div
                         key={task.reserva_id}
                         className={`bg-white p-3 md:p-3.5 rounded-2xl border shadow-sm hover:border-blue-400 transition-all flex group relative items-center cursor-pointer ${isSelected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-100'}`}
                         onClick={() => openReservaInCRM(task.reserva_id)}
                         role="button"
                         tabIndex={0}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' || e.key === ' ') {
                             e.preventDefault();
                             openReservaInCRM(task.reserva_id);
                           }
                         }}
                       >
                          <div className="grid grid-cols-12 items-center w-full gap-4">
                             <div className="col-span-12 lg:col-span-5 flex items-center gap-3 min-w-0">
                               <button
                                 onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.reserva_id); }}
                                 className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:border-blue-400 transition-all bg-white"
                                 title={isSelected ? "Desmarcar" : "Selecionar para transferência em massa"}
                               >
                                 {isSelected ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-slate-300"/>}
                               </button>
                               <div className="w-8 h-8 md:w-9 md:h-9 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 flex-shrink-0 group-hover:text-blue-500 transition-all">{task.reserva_id.toString().slice(-2)}</div>
                               <div className="min-w-0 flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none block">ID: {task.reserva_id}</span><h4 className="text-[12px] md:text-[13px] font-black text-slate-800 uppercase tracking-tight truncate pr-2" title={task.cliente}>{task.cliente}</h4></div>
                            </div>
                             <div className="col-span-12 lg:col-span-4 space-y-1 min-w-0 lg:border-l border-slate-100 lg:pl-4">
                               <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase truncate"><Building2 size={12} className="text-blue-300 shrink-0"/><span className="truncate">{task.empreendimento}</span></div>
                               <div className="flex items-center gap-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit transition-colors shadow-sm" style={{ backgroundColor: sitStyle.bg, color: sitStyle.text }}><Tag size={9} className="shrink-0"/><span className="truncate">{task.situacao_nome || "Geral"}</span></div>
                            </div>
                            <div className="col-span-12 lg:col-span-3 flex items-center justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-50">
                              <button
                                onClick={(e) => { e.stopPropagation(); openTransferModal(task); }}
                                className="bg-blue-50 text-blue-600 p-2 rounded-xl text-[9px] font-black uppercase active:scale-95 border border-blue-100 flex items-center justify-center"
                                title="Transferir pasta"
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleFinish(task.reserva_id, 'Concluído'); }} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-md active:scale-95 flex-1 lg:flex-initial">Concluir</button>
                              <button onClick={(e) => { e.stopPropagation(); handleFinish(task.reserva_id, 'Discussão'); }} className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 border border-slate-100 flex-1 lg:flex-initial">Pendente</button>
                            </div>
                          </div>
                       </div>
                     )}) : (
                       <div className="py-20 text-center bg-white border-2 border-dashed border-slate-50 rounded-[2rem] shadow-sm px-6"><CheckCircle2 size={40} className="mx-auto mb-4 text-slate-100"/><p className="text-slate-300 font-black uppercase text-[10px] tracking-[0.3em] italic">Mesa livre.</p></div>
                     )}
                  </div>
               </div>

               {/* PERFORMANCE */}
               <div className="w-full lg:w-[240px] space-y-5 flex-shrink-0">
                  <h2 className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">Performance</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                     <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-center group hover:border-blue-200 transition-all h-[95px] shadow-sm"><p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest uppercase">Hoje</p><div className="text-2xl font-black text-blue-600 leading-none">{metrics.hoje}</div></div>
                     <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-center group hover:border-blue-200 transition-all h-[95px] shadow-sm"><p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest uppercase">Ano</p><div className="text-2xl font-black text-slate-700 leading-none">{metrics.ano}</div></div>
                  </div>
                  <div className="bg-blue-600 p-4 rounded-xl shadow-xl shadow-blue-500/10 flex items-center gap-3 text-white group overflow-hidden relative"><TrendingUp size={18} className="flex-shrink-0 opacity-80"/><div className="truncate"><p className="text-[7px] font-bold text-blue-100 uppercase tracking-widest mb-0.5 leading-none font-black uppercase">Fila VCA</p><div className="text-[10px] font-black uppercase tracking-tight truncate">Sync Real Time</div></div></div>
               </div>
            </div>
          ) : (
            <div className="space-y-6 py-20 text-center text-slate-300 italic text-[11px] uppercase tracking-[0.4em] font-bold px-6">Histórico detalhado sendo carregado...</div>
          )
        )}
      </main>
    </div>
  );
};

export default App;