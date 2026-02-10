import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  RefreshCw, Clock, CheckCircle2, History, Building2, 
  Hash, LayoutDashboard, AlertTriangle, XCircle, BarChart4, 
  TrendingUp, Calendar, LogOut, Lock, Eye, EyeOff,
  UserPlus, Trash2, Power, Settings, CheckSquare, Square, 
  Edit3, UserCheck, Users, ShieldCheck, CheckCircle, Save,
  Layout, ChevronDown, Search, User as UserIcon,
  Tag, BarChart3, PieChart, RotateCcw, ListOrdered
} from 'lucide-react';

const App = () => {
  // --- ESTADOS DE NAVEGAÇÃO ---
  const [view, setView] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [analystTab, setAnalystTab] = useState('mesa'); 

  // --- ESTADOS DE DADOS ---
  const [analysts, setAnalysts] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [metrics, setMetrics] = useState({ hoje: 0, ano: 0 });
  const [dashData, setDashData] = useState({ 
    equipe: [], 
    distribuicao_atual: [],
    historico_recente: [],
    total_pendente_cvcrm: 0
  });

  // --- ESTADOS DE UI E INTERATIVIDADE ---
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const API_BASE = "http://localhost:8000/api";

  const SITUACOES_MAP = {
    62: "ANÁLISE VENDA LOTEAMENTO",
    66: "ANÁLISE VENDA PARCELAMENTO INCORPORADORA",
    30: "ANÁLISE VENDA CAIXA",
    16: "CONFECÇÃO DE CONTRATO",
    31: "ASSINADO",
    84: "APROVAÇÃO EXPANSÃO"
  };

  const SIT_COLORS = {
    62: { text: '#080b01', bg: '#7bb581' },
    66: { text: '#060606', bg: '#5db144' },
    30: { text: '#080707', bg: '#94f67b' },
    84: { text: '#000000', bg: '#46c49e' },
    16: { text: '#0e0000', bg: '#e5ee78' },
    31: { text: '#010b04', bg: '#f49f51' }
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
            total_pendente_cvcrm: d.total_pendente_cvcrm || 0
          });
        }
      }
      setApiError(null);
    } catch (e) {
      if (!silent) setApiError("Backend Offline.");
    } finally {
      setIsSyncing(false);
      if (!silent) setIsGlobalLoading(false);
    }
  }, [currentUser, view]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 15000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- ACÇÕES OPERACIONAIS ---
  const handleLogin = async () => {
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
        notify("Senha incorreta.", "error");
      }
    } catch (e) { notify("Erro de conexão."); }
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

  const handleRedistribute = async () => {
    if (!window.confirm("Redistribuir todo o fluxo do zero?")) return;
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

  // --- TELA DE LOGIN ---
  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-[#f8fafc]">
      <StatusToast />
      {isGlobalLoading && <LoadingOverlay />}
      <div className="max-w-[340px] w-full bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 relative">
        <div className="text-center mb-8">
           <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="text-white" size={24} />
           </div>
           <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase leading-none">VCA Cloud</h2>
           <p className="text-slate-400 font-bold uppercase text-[8px] tracking-[0.2em] mt-2">Plataforma de Distribuição</p>
        </div>

        <div className="space-y-4">
           <div className="relative" ref={dropdownRef}>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Acesso por Perfil</label>
              <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className={`w-full flex items-center justify-between p-3 bg-slate-50 border transition-all rounded-xl ${isProfileDropdownOpen ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <div className="flex items-center gap-2.5 truncate">
                  <UserIcon size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-tight truncate">{selectedAnalyst ? selectedAnalyst.nome : "Selecionar Perfil..."}</span>
                </div>
                <ChevronDown size={14} className={`text-slate-300 transition-transform flex-shrink-0 ${isProfileDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </button>
              {isProfileDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in slide-in-from-bottom-1">
                  <div className="p-2 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
                    <Search size={12} className="text-slate-300" />
                    <input autoFocus type="text" placeholder="Filtrar..." className="bg-transparent border-none outline-none text-[10px] font-bold w-full text-slate-600" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)}/>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto custom-scrollbar p-1.5">
                    {filteredAnalystsList.map(a => (
                      <button key={a.id} onClick={() => { setSelectedAnalyst(a); setIsProfileDropdownOpen(false); setShowLoginModal(true); setProfileSearch(""); setPassword(""); }} className="w-full flex items-center justify-between p-2.5 hover:bg-blue-600 group rounded-lg transition-all mb-0.5 text-left">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-50 rounded-md flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-blue-50 group-hover:text-white uppercase">{a.nome?.charAt(0)}</div>
                          <span className="text-[10px] font-black text-slate-600 uppercase group-hover:text-white transition-colors">{a.nome}</span>
                        </div>
                        {a.is_online && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-2 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
           </div>
           <div className="pt-6 border-t border-slate-50 mt-4 text-center">
              <button onClick={() => setView('manager')} className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors tracking-widest px-4 py-2 rounded-xl hover:bg-blue-50 active:scale-95">
                <BarChart4 size={12}/> Painel Admin
              </button>
           </div>
        </div>
      </div>
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-[320px] w-full shadow-2xl border border-slate-100 animate-in zoom-in-95">
             <div className="flex flex-col items-center mb-6">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
                   <Lock size={18} className="text-blue-600" />
                </div>
                <h3 className="text-center text-base font-black text-slate-800 uppercase">Login</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate w-full px-2 text-center">{selectedAnalyst?.nome}</p>
             </div>
             <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6 text-sm" autoFocus placeholder="Senha" />
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowLoginModal(false)} className="py-2.5 bg-slate-50 text-slate-400 font-black uppercase text-[9px] rounded-xl">Voltar</button>
                <button disabled={isGlobalLoading} onClick={handleLogin} className="py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95">Aceder</button>
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
      {isGlobalLoading && <LoadingOverlay />}
      <nav className="bg-white border-b border-slate-100 p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-3 truncate">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-500/20 flex-shrink-0"><BarChart4 size={16} className="text-white"/></div>
          <h1 className="text-xs md:text-sm font-black tracking-tighter uppercase truncate leading-none">VCA GESTÃO <span className="text-blue-500 text-[8px] md:text-[9px] tracking-widest ml-1.5 font-black uppercase hidden sm:inline">Admin</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRedistribute} className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-amber-100 active:scale-95 flex items-center gap-2 shadow-sm"><RotateCcw size={12}/> Redistribuir</button>
          <button onClick={() => setView('login')} className="bg-white text-slate-400 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-slate-100 active:scale-95 shadow-sm">Sair</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 flex-1">
        <section className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8 px-1">
                <div className="flex items-center gap-2.5"><BarChart3 size={16} className="text-blue-600" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Fluxo por Situação</h3></div>
                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border transition-all ${isSyncing ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' : 'bg-green-50 text-green-600 border-green-100'}`}><RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''}/> {isSyncing ? 'Sincronizando' : 'Sincronizado'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(SITUACOES_MAP).map(([id, nome]) => (
                    <div key={id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center group hover:border-blue-400 transition-all">
                        <p className="text-[7px] font-bold text-slate-400 uppercase leading-tight mb-1 h-5 overflow-hidden line-clamp-2">{nome}</p>
                        <div className="text-lg md:text-xl font-black text-slate-800 group-hover:text-blue-600 leading-none">{calculatedBreakdown[id] || 0}</div>
                    </div>
                ))}
            </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Pendente CRM</p><div className="text-4xl md:text-5xl font-black text-blue-600 leading-none">{dashData.total_pendente_cvcrm}</div></div>
              <Hash className="text-blue-50 opacity-20 flex-shrink-0" size={48}/>
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
                        <td className="p-4 text-right space-x-1 whitespace-nowrap"><button onClick={() => { setEditForm({id: a.id, nome: a.nome, senha: a.senha, permissoes: a.permissoes || []}); setShowEditModal(true); }} className="text-slate-300 hover:text-blue-500 p-2 transition-all inline-block"><Edit3 size={14}/></button><button onClick={() => handleDeleteAnalyst(a.id)} className="text-slate-300 hover:text-red-500 p-2 transition-all inline-block"><Trash2 size={14}/></button></td>
                    </tr>
                )})}
              </tbody>
            </table>
          </div>
        </section>
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
      {isGlobalLoading && <LoadingOverlay />}
      <nav className="bg-white border-b border-slate-100 p-2 md:p-2.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-[100] shadow-sm h-14 md:h-16">
        <div className="flex items-center gap-3 md:gap-4 truncate">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20 flex-shrink-0">{currentUser?.nome?.charAt(0)}</div>
          <div className="hidden sm:block truncate">
            <h3 className="font-bold text-slate-700 leading-none text-xs md:text-sm uppercase truncate">{currentUser?.nome}</h3>
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mt-1 flex items-center gap-1 ${currentUser?.is_online ? 'text-green-600' : 'text-slate-400'}`}>{currentUser?.is_online ? 'ATIVO NA FILA' : 'PAUSADO'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
           <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentUser?.is_online ? 'bg-green-50 border-green-100 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${currentUser?.is_online ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">{currentUser?.is_online ? 'DISPONÍVEL' : 'OFFLINE'}</span>
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
                     <div className="flex items-center gap-2.5">
                        <UserCheck className="text-blue-600" size={18} />
                        <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Minha Mesa</h2>
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-lg shadow-blue-500/10">{filteredTasks.length} Ativas</span>
                     </div>
                     <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                        <div className="flex items-center gap-2 px-3 flex-1 sm:w-44 border-r border-slate-100"><Search size={14} className="text-slate-300 shrink-0" /><input type="text" placeholder="Filtrar..." className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600 w-full" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}/></div>
                        <select value={filterSit} onChange={(e) => setFilterSit(e.target.value)} className="bg-transparent border-none outline-none text-[9px] font-black uppercase text-slate-500 px-2 cursor-pointer"><option value="all">Todas Situações</option>{Object.entries(SITUACOES_MAP).map(([id, nome]) => (<option key={id} value={id}>{nome}</option>))}</select>
                     </div>
                  </div>

                  <div className="space-y-2.5">
                     {filteredTasks.length > 0 ? filteredTasks.map(task => {
                       const sitStyle = SIT_COLORS[task.situacao_id] || { text: '#2563eb', bg: '#eff6ff' };
                       return (
                       <div key={task.reserva_id} className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-400 transition-all flex group relative items-center">
                          <div className="grid grid-cols-12 items-center w-full gap-4">
                            <div className="col-span-12 md:col-span-5 flex items-center gap-3 min-w-0">
                               <div className="w-8 h-8 md:w-9 md:h-9 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 flex-shrink-0 group-hover:text-blue-500 transition-all">{task.reserva_id.toString().slice(-2)}</div>
                               <div className="min-w-0 flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none block">ID: {task.reserva_id}</span><h4 className="text-[12px] md:text-[13px] font-black text-slate-800 uppercase tracking-tight truncate pr-2" title={task.cliente}>{task.cliente}</h4></div>
                            </div>
                            <div className="col-span-12 md:col-span-4 space-y-1 min-w-0 border-l border-slate-100 md:pl-4">
                               <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase truncate"><Building2 size={12} className="text-blue-300 shrink-0"/><span className="truncate">{task.empreendimento}</span></div>
                               <div className="flex items-center gap-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit transition-colors shadow-sm" style={{ backgroundColor: sitStyle.bg, color: sitStyle.text }}><Tag size={9} className="shrink-0"/><span className="truncate">{task.situacao_nome || "Geral"}</span></div>
                            </div>
                            <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-50"><button onClick={() => handleFinish(task.reserva_id, 'Concluído')} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-md active:scale-95 flex-1 md:flex-initial">Concluir</button><button onClick={() => handleFinish(task.reserva_id, 'Discussão')} className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 border border-slate-100 flex-1 md:flex-initial">Pendente</button></div>
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