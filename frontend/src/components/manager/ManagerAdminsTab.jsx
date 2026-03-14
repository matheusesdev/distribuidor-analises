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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <UserPlus size={18} className="text-blue-600" />
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Novo Administrador</h2>
        </div>

        <form className="space-y-3" onSubmit={handleCreateAdmin}>
          <input
            type="email"
            name="email"
            value={adminForm.email}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="E-mail do administrador"
            autoComplete="email"
          />

          <input
            type="text"
            name="username"
            value={adminForm.username}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, username: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Username (opcional)"
            autoComplete="username"
          />

          <input
            type="password"
            name="senha"
            value={adminForm.senha}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, senha: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm text-slate-800 font-bold outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Senha inicial"
            autoComplete="new-password"
          />

          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
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
            className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
              isGlobalLoading
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95 shadow-sm'
            }`}
          >
            {isGlobalLoading ? 'Criando...' : 'Criar Admin'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Administradores</h2>
          </div>
          <span className="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-black uppercase text-slate-500">
            Total: {sortedAdmins.length}
          </span>
        </div>

        <div className="space-y-2 max-h-115 overflow-y-auto pr-1">
          {sortedAdmins.length > 0 ? (
            sortedAdmins.map((admin) => (
              <div key={admin.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase text-slate-800 truncate">{admin.username}</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate mt-1 inline-flex items-center gap-1">
                      <Mail size={12} /> {admin.email || 'Sem e-mail'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase ${admin.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      <ShieldCheck size={11} />
                      {admin.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      type="button"
                      disabled={isGlobalLoading}
                      onClick={() => handleRevokeAdminSession?.(admin)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${
                        isGlobalLoading
                          ? 'border-slate-100 text-slate-300 bg-slate-100 cursor-not-allowed'
                          : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                      }`}
                    >
                      <RotateCcw size={11} /> Revogar Sessões
                    </button>
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
              <UserCog size={18} className="text-blue-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Revogação de Analistas</h3>
            </div>
            <span className="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-black uppercase text-slate-500">
              Total: {sortedAnalysts.length}
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {sortedAnalysts.length > 0 ? (
              sortedAnalysts.map((analyst) => (
                <div key={analyst.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase text-slate-800 truncate">{analyst.nome}</p>
                      <p className="text-[10px] font-bold text-slate-500 truncate mt-1 inline-flex items-center gap-1">
                        <Mail size={12} /> {analyst.email || 'Sem e-mail'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isGlobalLoading}
                      onClick={() => handleRevokeAnalystSession?.(analyst)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all shrink-0 ${
                        isGlobalLoading
                          ? 'border-slate-100 text-slate-300 bg-slate-100 cursor-not-allowed'
                          : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                      }`}
                    >
                      <RotateCcw size={11} /> Revogar
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
