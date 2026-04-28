import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, Lock, Eye, Database, Globe2 } from 'lucide-react';

const sectionCardClass = 'rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.4)]';

const PrivacyPolicyView = ({ onBackToLogin }) => {
  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-[radial-gradient(circle_at_top,_#f8fbff_0%,_#edf3fb_42%,_#e7eef8_100%)] text-slate-800">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <button
          type="button"
          onClick={onBackToLogin}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:border-blue-300 hover:text-blue-700"
        >
          <ArrowLeft size={14} /> Voltar ao login
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <header className={`${sectionCardClass} relative overflow-hidden lg:p-8`}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.08)_0%,rgba(14,165,233,0.05)_45%,rgba(255,255,255,0)_100%)]" />
            <div className="relative space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                <ShieldCheck size={13} /> Política de Privacidade
              </div>
              <div className="max-w-2xl space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Como tratamos dados no sistema</h1>
                <p className="text-sm leading-7 text-slate-600 sm:text-[15px]">
                  Esta página descreve, de forma objetiva, como as informações são coletadas, utilizadas e protegidas no sistema de distribuição de pastas.
                  O objetivo é deixar claro o que é armazenado, por que isso acontece e quais controles existem para preservar a segurança das operações.
                </p>
              </div>
            </div>
          </header>

          <aside className={`${sectionCardClass} lg:p-6`}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Lock size={15} className="text-blue-600" /> Ponto principal
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O sistema usa os dados para autenticação, distribuição de pastas, auditoria operacional e suporte às equipes de análise e gestão.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <Eye size={13} /> Acesso
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">Somente usuários autorizados acessam informações operacionais.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <Globe2 size={13} /> Escopo
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">A política vale para o uso interno da plataforma e seus painéis administrativos.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className={sectionCardClass}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText size={15} className="text-blue-600" /> Dados que podem ser tratados
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Dados de acesso, como e-mail, nome de usuário e registros de sessão.</li>
              <li>Dados operacionais necessários para distribuir, registrar e auditar pastas e transferências.</li>
              <li>Informações associadas ao uso do sistema, como histórico de ações, logs e status de atendimento.</li>
              <li>Dados enviados por integrações e sistemas externos conectados ao fluxo de trabalho.</li>
            </ul>
          </section>

          <section className={sectionCardClass}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Database size={15} className="text-blue-600" /> Finalidades do uso
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Permitir autenticação, sessão e controle de acesso por perfil.</li>
              <li>Executar a distribuição de pastas e a gestão das filas de trabalho.</li>
              <li>Gerar auditoria, relatórios e histórico operacional para acompanhamento da operação.</li>
              <li>Apoiar suporte, melhoria contínua e prevenção de uso indevido da plataforma.</li>
            </ul>
          </section>

          <section className={sectionCardClass}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck size={15} className="text-blue-600" /> Compartilhamento e retenção
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              As informações são tratadas internamente para operar o sistema e registrar atividades. Quando houver integrações externas ou obrigações legais,
              o compartilhamento ocorre apenas na extensão necessária para cumprir a finalidade informada ou atender exigências de segurança e conformidade.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Os dados ficam armazenados pelo tempo necessário para manter a operação, os registros históricos e as obrigações aplicáveis ao negócio.
            </p>
          </section>

          <section className={sectionCardClass}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Lock size={15} className="text-blue-600" /> Segurança e contato
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              A plataforma utiliza controles de sessão, autenticação e segregação de perfis para reduzir o acesso indevido. Também são mantidos registros de
              atividade para suporte e auditoria.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Em caso de dúvidas sobre tratamento de dados, revisão de acesso ou solicitação relacionada à privacidade, o usuário deve contatar o responsável
              interno pela operação do sistema.
            </p>
          </section>
        </div>

        <footer className="mt-6 pb-2 text-center text-[11px] font-medium text-slate-500">
          Página de política de privacidade criada para acesso público no login.
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;