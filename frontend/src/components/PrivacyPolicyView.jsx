import React from 'react';
import { ArrowLeft, CalendarDays, Database, Eye, FileText, Globe2, Lock, ShieldCheck } from 'lucide-react';

const sectionCardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

const quickFacts = [
  { label: 'Atualização', value: '28/04/2026', icon: CalendarDays },
  { label: 'Escopo', value: 'Uso interno', icon: Globe2 },
  { label: 'Controles', value: 'Sessão e auditoria', icon: ShieldCheck },
];

const sections = [
  {
    id: 'dados',
    title: 'Dados que podem ser tratados',
    icon: FileText,
    tone: 'blue',
    items: [
      'Dados de acesso, como e-mail, nome de usuário e registros de sessão.',
      'Dados operacionais necessários para distribuir, registrar e auditar pastas e transferências.',
      'Informações associadas ao uso do sistema, como histórico de ações, logs e status de atendimento.',
      'Dados enviados por integrações e sistemas externos conectados ao fluxo de trabalho.',
    ],
  },
  {
    id: 'finalidades',
    title: 'Finalidades do uso',
    icon: Database,
    tone: 'emerald',
    items: [
      'Permitir autenticação, sessão e controle de acesso por perfil.',
      'Executar a distribuição de pastas e a gestão das filas de trabalho.',
      'Gerar auditoria, relatórios e histórico operacional para acompanhamento da operação.',
      'Apoiar suporte, melhoria contínua e prevenção de uso indevido da plataforma.',
    ],
  },
  {
    id: 'compartilhamento',
    title: 'Compartilhamento e retenção',
    icon: ShieldCheck,
    tone: 'slate',
    body: [
      'As informações são tratadas internamente para operar o sistema e registrar atividades. Quando houver integrações externas ou obrigações legais, o compartilhamento ocorre apenas na extensão necessária para cumprir a finalidade informada ou atender exigências de segurança e conformidade.',
      'Os dados ficam armazenados pelo tempo necessário para manter a operação, os registros históricos e as obrigações aplicáveis ao negócio.',
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança e contato',
    icon: Lock,
    tone: 'amber',
    body: [
      'A plataforma utiliza controles de sessão, autenticação e segregação de perfis para reduzir o acesso indevido. Também são mantidos registros de atividade para suporte e auditoria.',
      'Em caso de dúvidas sobre tratamento de dados, revisão de acesso ou solicitação relacionada à privacidade, o usuário deve contatar o responsável interno pela operação do sistema.',
    ],
  },
];

const toneStyles = {
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
};

const PrivacyPolicyView = ({ onBackToLogin }) => {
  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-slate-50 text-slate-800">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Voltar ao login
          </button>
        </div>

        <header className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              <ShieldCheck size={13} /> Política de Privacidade
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Como tratamos dados no sistema
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-[15px]">
              Esta página explica, de forma simples e objetiva, quais dados podem ser tratados na plataforma, para que eles são usados e quais controles
              existem para preservar a segurança das operações.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {quickFacts.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Icon size={12} className="text-blue-600" /> {label}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.id} id={section.id} className={`${sectionCardClass} scroll-mt-6`}>
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneStyles[section.tone]}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Seção</div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{section.title}</h2>
                    </div>
                  </div>

                  {'items' in section ? (
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      {section.body.map((paragraph) => (
                        <p key={paragraph} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <aside className="space-y-4 lg:sticky lg:top-6">
              <div className={`${sectionCardClass} p-5`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Lock size={15} className="text-blue-600" /> Resumo
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  O sistema usa dados para autenticação, distribuição de pastas, auditoria operacional e suporte às equipes de análise e gestão.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <Eye size={12} /> Acesso restrito
                    </div>
                    <p className="mt-2 text-sm text-slate-700">Somente usuários autorizados acessam informações operacionais.</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <Globe2 size={12} /> Escopo interno
                    </div>
                    <p className="mt-2 text-sm text-slate-700">A política vale para o uso interno da plataforma e seus painéis administrativos.</p>
                  </div>
                </div>
              </div>

              <nav className={`${sectionCardClass} p-5`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText size={15} className="text-blue-600" /> Seções
                </div>
                <div className="mt-4 space-y-2">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                    >
                      {section.title}
                    </a>
                  ))}
                </div>
              </nav>
            </aside>
          </div>
        </div>

        <footer className="mt-6 pb-2 text-center text-xs text-slate-500">
          Página pública de política de privacidade disponível no login.
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;