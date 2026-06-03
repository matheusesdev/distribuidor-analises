export const AUTO_REFRESH_SECONDS = 60;
export const LOGIN_SUCCESS_SPLASH_MS = 1600;
export const DAILY_ANALYST_LOGOUT_MARKER = 'analystDailyLogoutDate';
export const LAST_LOGIN_DATE_KEY = 'lastSuccessfulLoginDate';
export const RETURNED_AFTER_LOGOUT_KEY = 'returnedAfterLogout';
export const ANALYST_REMEMBER_MARKER = 'analystRememberMe';
export const MANAGER_REMEMBER_MARKER = 'managerRememberMe';
export const ANALYST_SESSION_KEY = 'analystSession';
export const MANAGER_SESSION_KEY = 'managerSession';
export const MESA_FREEZE_STORAGE_KEY = 'analystFrozenMesa';
export const MANUAL_TRANSFER_NOTIFICATION_STORAGE_KEY = 'manualTransferNotificationsSeen';
export const PRIVACY_POLICY_QUERY_KEY = 'privacy_policy';
export const ALL_FILTER = 'all';
export const LEGACY_MANAGER_TOKEN = 'legacy-admin-session';
export const EMPTY_ANALYTICS = {
  resumo: { total: 0, hoje: 0, mes: 0, ano: 0, media_por_dia: 0, dias_com_producao: 0 },
  series: { por_dia: [], por_mes: [] },
  rankings: { por_resultado: [], por_situacao: [], por_empreendimento: [] },
  schema: { historico_tem_analista_nome: false, historico_tem_situacao: false },
  registros: [],
  total_registros: 0,
  gerado_em: null,
};
