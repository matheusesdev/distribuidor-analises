const API_BASE = "http://localhost:8000/api";

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
  listAnalysts: () => request("/analistas"),
  getMesa: (analystId) => request(`/mesa/${analystId}`),
  getMetrics: (analystId) => request(`/metricas/${analystId}`),
  getManagerOverview: () => request("/gestor/overview"),

  login: (analystId, password) =>
    request("/login", {
      method: "POST",
      body: { analista_id: analystId, senha: password },
    }),

  setQueueStatus: (analystId, online) =>
    request("/analista/status-fila", {
      method: "POST",
      body: { analista_id: analystId, online },
    }),

  finishTask: (reservaId, resultado) =>
    request(`/concluir?reserva_id=${encodeURIComponent(reservaId)}&resultado=${encodeURIComponent(resultado)}`, {
      method: "POST",
    }),

  transferTask: ({ reserva_id, analista_origem_id, analista_destino_id, motivo }) =>
    request("/analista/transferir", {
      method: "POST",
      body: { reserva_id, analista_origem_id, analista_destino_id, motivo },
    }),

  transferTaskBulk: ({ reserva_ids, analista_origem_id, analista_destino_id, motivo }) =>
    request("/analista/transferir-massa", {
      method: "POST",
      body: { reserva_ids, analista_origem_id, analista_destino_id, motivo },
    }),

  redistribute: () => request("/gestor/redistribuir", { method: "POST" }),
  resetData: () => request("/gestor/zerar-dados", { method: "POST" }),

  saveAnalyst: ({ id, payload }) =>
    request(id ? `/gestor/analistas/${id}` : "/gestor/analistas", {
      method: id ? "PATCH" : "POST",
      body: payload,
    }),

  deleteAnalyst: (id) => request(`/gestor/analistas/${id}`, { method: "DELETE" }),
};
