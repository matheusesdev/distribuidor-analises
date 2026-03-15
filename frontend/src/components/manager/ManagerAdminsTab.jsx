import React, { useMemo } from 'react';
import { Mail, ShieldCheck, UserPlus, Users, RotateCcw, UserCog } from 'lucide-react';

const ManagerAdminsTab = ({
  admins,
  adminForm,
  setAdminForm,
  handleCreateAdmin,
  analysts,
  handleRevokeAdminSession,
  handleRevokeAnalystSession,
  isGlobalLoading,
}) => {
  const sortedAdmins = useMemo(() => {
    return [...(admins || [])].sort((a, b) => {
      const aDate = new Date(a?.data_criacao || 0).getTime();
      const bDate = new Date(b?.data_criacao || 0).getTime();
      return bDate - aDate;
    });
  }, [admins]);

  const sortedAnalysts = useMemo(() => {
    return [...(analysts || [])].sort((a, b) => {
      return String(a?.nome || '').localeCompare(String(b?.nome || ''));
    });
  }, [analysts]);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
      <div className="bg-white/90 rounded-3xl border border-slate-200/80 shadow-[0_24px_45px_-30px_rgba(15,23,42,0.5)] p-5 md:p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-5">
          <UserPlus size={18} className="text-[#0071e3]" />
          <h2 className="text-[12px] font-semibold tracking-[0.05em] text-slate-700">Novo Administrador</h2>
        </div>

        <form className="space-y-3.5" onSubmit={handleCreateAdmin}>
          <input
            type="email"
            name="email"
            value={adminForm.email}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400"
            placeholder="E-mail do administrador"
            autoComplete="email"
          />

          <input
            type="text"
            name="username"
            value={adminForm.username}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, username: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400"
            placeholder="Username (opcional)"
            autoComplete="username"
          />

          <input
            type="password"
            name="senha"
            value={adminForm.senha}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, senha: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[15px] text-slate-900 font-medium outline-none transition-all focus:ring-4 focus:ring-sky-100/70 focus:border-sky-400"
            placeholder="Senha inicial"
            autoComplete="new-password"
          />

          <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
            <input
              type="checkbox"
              name="ativo"
              checked={adminForm.ativo}
              onChange={(e) => setAdminForm((prev) => ({ ...prev, ativo: e.target.checked }))}
              className="rounded border-slate-300"
            />
            Conta ativa
          </label>

          <button
            type="submit"
            disabled={isGlobalLoading}
            className={`w-full py-3.5 rounded-full font-semibold text-[14px] tracking-[0.01em] transition-all ${
              isGlobalLoading
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-[#0071e3] text-white hover:bg-[#0077ed] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] shadow-[0_16px_28px_-18px_rgba(0,113,227,0.9)]'
            }`}
          >
            {isGlobalLoading ? 'Criando...' : 'Criar Admin'}
          </button>
        </form>
      </div>

      <div className="bg-white/90 rounded-3xl border border-slate-200/80 shadow-[0_24px_45px_-30px_rgba(15,23,42,0.5)] p-5 md:p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#0071e3]" />
            <h2 className="text-[12px] font-semibold tracking-[0.05em] text-slate-700">Administradores</h2>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
            Total: {sortedAdmins.length}
          </span>
        </div>

        <div className="space-y-2 max-h-115 overflow-y-auto pr-1">
          {sortedAdmins.length > 0 ? (
            sortedAdmins.map((admin) => (
              <div key={admin.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">{admin.username}</p>
                    <p className="text-[11px] font-medium text-slate-500 truncate mt-1 inline-flex items-center gap-1">
                      <Mail size={12} /> {admin.email || 'Sem e-mail'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${admin.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      <ShieldCheck size={11} />
                      {admin.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      type="button"
                      disabled={isGlobalLoading}
                      onClick={() => handleRevokeAdminSession?.(admin)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
                        isGlobalLoading
                          ? 'border-slate-100 text-slate-300 bg-slate-100 cursor-not-allowed'
                          : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:-translate-y-0.5 active:translate-y-0'
                      }`}
                    >
                      <RotateCcw size={11} /> Encerrar Sessões
                    </button>
                    <p className="text-[10px] font-medium text-slate-400">Exige novo login em todos os dispositivos.</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-[11px] font-bold text-slate-400">
              Nenhum administrador encontrado.
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <UserCog size={18} className="text-[#0071e3]" />
              <h3 className="text-[12px] font-semibold tracking-[0.05em] text-slate-700">Sessões e Acessos</h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
              Total: {sortedAnalysts.length}
            </span>
          </div>

          <p className="text-[11px] font-medium text-slate-500 mb-3 leading-relaxed">
            Ao encerrar o acesso do analista, ele sai da plataforma, fica em pausa na fila e as pastas em andamento são redistribuídas.
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {sortedAnalysts.length > 0 ? (
              sortedAnalysts.map((analyst) => (
                <div key={analyst.id} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{analyst.nome}</p>
                      <p className="text-[11px] font-medium text-slate-500 truncate mt-1 inline-flex items-center gap-1">
                        <Mail size={12} /> {analyst.email || 'Sem e-mail'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isGlobalLoading}
                      onClick={() => handleRevokeAnalystSession?.(analyst)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold border transition-all shrink-0 ${
                        isGlobalLoading
                          ? 'border-slate-100 text-slate-300 bg-slate-100 cursor-not-allowed'
                          : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100 hover:-translate-y-0.5 active:translate-y-0'
                      }`}
                    >
                      <RotateCcw size={11} /> Encerrar e Pausar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                Nenhum analista encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ManagerAdminsTab;
