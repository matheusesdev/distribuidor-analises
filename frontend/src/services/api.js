const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

export const api = {
  listAnalysts: () => request("/api/analistas"),
  getMesa: (analystId) => request(`/api/mesa/${analystId}`),
  getMetrics: (analystId) => request(`/api/metricas/${analystId}`),
  getManagerOverview: () => request("/api/gestor/overview"),

  login: (analystId, password) =>
    request("/api/login", {
      method: "POST",
      body: { analista_id: analystId, senha: password },
    }),

  setQueueStatus: (analystId, online) =>
    request("/api/analista/status-fila", {
      method: "POST",
      body: { analista_id: analystId, online },
    }),

  finishTask: (reservaId, resultado) =>
    request(`/api/concluir?reserva_id=${encodeURIComponent(reservaId)}&resultado=${encodeURIComponent(resultado)}`, {
      method: "POST",
    }),

  transferTask: ({ reserva_id, analista_origem_id, analista_destino_id, motivo }) =>
    request("/api/analista/transferir", {
      method: "POST",
      body: { reserva_id, analista_origem_id, analista_destino_id, motivo },
    }),

  transferTaskBulk: ({ reserva_ids, analista_origem_id, analista_destino_id, motivo }) =>
    request("/api/analista/transferir-massa", {
      method: "POST",
      body: { reserva_ids, analista_origem_id, analista_destino_id, motivo },
    }),

  redistribute: () => request("/api/gestor/redistribuir", { method: "POST" }),
  resetData: () => request("/api/gestor/zerar-dados", { method: "POST" }),

  saveAnalyst: ({ id, payload }) =>
    request(id ? `/api/gestor/analistas/${id}` : "/api/gestor/analistas", {
      method: id ? "PATCH" : "POST",
      body: payload,
    }),

  deleteAnalyst: (id) => request(`/api/gestor/analistas/${id}`, { method: "DELETE" }),
};
