const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = RAW_API_URL.replace(/\/+$/, '').replace(/\/api$/, '');

const readSession = (key) => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
};

const getManagerAuthHeaders = () => {
  if (typeof window === "undefined") return {};

  const rawSession = readSession("managerSession");
  if (!rawSession) return {};

  try {
    const session = JSON.parse(rawSession);
    if (!session?.token) return {};
    return { Authorization: `Bearer ${session.token}` };
  } catch {
    return {};
  }
};

const getAnalystAuthHeaders = () => {
  if (typeof window === "undefined") return {};

  const rawSession = readSession("analystSession");
  if (!rawSession) return {};

  try {
    const session = JSON.parse(rawSession);
    if (!session?.token) return {};
    return { Authorization: `Bearer ${session.token}` };
  } catch {
    return {};
  }
};

const request = (path, { method = "GET", body, headers } = {}) => {
  const config = {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  return fetch(`${API_BASE}${path}`, config);
};

const requestWithFallbackPaths = async (paths, options = {}) => {
  const candidates = (paths || []).filter(Boolean);
  if (!candidates.length) {
    throw new Error("Nenhuma rota informada para fallback");
  }

  let response = await request(candidates[0], options);
  for (let i = 1; i < candidates.length && response.status === 404; i += 1) {
    response = await request(candidates[i], options);
  }

  return response;
};

export const api = {
  listAnalysts: () => request("/api/analistas", { headers: getAnalystAuthHeaders() }),
  getMesa: (analystId) => request(`/api/mesa/${analystId}`, { headers: getAnalystAuthHeaders() }),
  getMetrics: (analystId) => request(`/api/metricas/${analystId}`, { headers: getAnalystAuthHeaders() }),
  getAnalystDashboard: (analystId) => request(`/api/analista/dashboard/${analystId}`, { headers: getAnalystAuthHeaders() }),
  getManagerOverview: () => request("/api/gestor/overview", { headers: getManagerAuthHeaders() }),
  getManagerSyncStatus: () => request("/api/gestor/sync-status", { headers: getManagerAuthHeaders() }),
  getManagerAdmins: () =>
    requestWithFallbackPaths([
      "/api/gestor/admins",
      "/gestor/admins",
    ], { headers: getManagerAuthHeaders() }),

  login: (analystId, password) =>
    request("/api/login", {
      method: "POST",
      body: { analista_id: analystId, senha: password },
    }),

  loginEmail: (email, senha) =>
    request("/api/login/email", {
      method: "POST",
      body: { email, senha },
    }),

  forgotPassword: (email) =>
    requestWithFallbackPaths([
      "/api/analista/esqueceu-senha",
      "/analista/esqueceu-senha",
      "/api/esqueceu-senha",
    ], {
      method: "POST",
      body: { email },
    }),

  resetPassword: (token, nova_senha) =>
    requestWithFallbackPaths([
      "/api/analista/resetar-senha",
      "/analista/resetar-senha",
      "/api/resetar-senha",
    ], {
      method: "POST",
      body: { token, nova_senha },
    }),

  managerLogin: (username, password) =>
    request("/api/gestor/login", {
      method: "POST",
      body: { usuario: username, senha: password },
    }),

  createManagerAdmin: ({ email, senha, username, ativo }) =>
    requestWithFallbackPaths([
      "/api/gestor/admins",
      "/gestor/admins",
    ], {
      method: "POST",
      body: { email, senha, username, ativo },
      headers: getManagerAuthHeaders(),
    }),

  revokeUserSessions: ({ role, user_id, reason }) =>
    request("/api/gestor/sessoes/revogar", {
      method: "POST",
      body: { role, user_id, reason },
      headers: getManagerAuthHeaders(),
    }),

  changePassword: ({ analystId, currentPassword, newPassword }) =>
    request("/api/analista/alterar-senha", {
      method: "POST",
      body: {
        analista_id: analystId,
        senha_atual: currentPassword,
        nova_senha: newPassword,
      },
      headers: getAnalystAuthHeaders(),
    }),

  setQueueStatus: (analystId, online, options = {}) =>
    request("/api/analista/status-fila", {
      method: "POST",
      body: { analista_id: analystId, online },
      headers: options.asManager ? getManagerAuthHeaders() : getAnalystAuthHeaders(),
    }),

  finishTask: (reservaId, resultado) =>
    request(`/api/concluir?reserva_id=${encodeURIComponent(reservaId)}&resultado=${encodeURIComponent(resultado)}`, {
      method: "POST",
      headers: getAnalystAuthHeaders(),
    }),

  transferTask: ({ reserva_id, analista_origem_id, analista_destino_id, motivo }) =>
    request("/api/analista/transferir", {
      method: "POST",
      body: { reserva_id, analista_origem_id, analista_destino_id, motivo },
      headers: getAnalystAuthHeaders(),
    }),

  transferTaskBulk: ({ reserva_ids, analista_origem_id, analista_destino_id, motivo }) =>
    request("/api/analista/transferir-massa", {
      method: "POST",
      body: { reserva_ids, analista_origem_id, analista_destino_id, motivo },
      headers: getAnalystAuthHeaders(),
    }),

  redistribute: () => request("/api/gestor/redistribuir", { method: "POST", headers: getManagerAuthHeaders() }),
  resetData: () => request("/api/gestor/zerar-dados", { method: "POST", headers: getManagerAuthHeaders() }),

  saveAnalyst: ({ id, payload }) =>
    request(id ? `/api/gestor/analistas/${id}` : "/api/gestor/analistas", {
      method: id ? "PATCH" : "POST",
      body: payload,
      headers: getManagerAuthHeaders(),
    }),

  deleteAnalyst: (id) => request(`/api/gestor/analistas/${id}`, { method: "DELETE", headers: getManagerAuthHeaders() }),
};
