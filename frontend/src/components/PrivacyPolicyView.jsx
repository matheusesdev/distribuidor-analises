import React from 'react';
import { ArrowLeft, BadgeInfo, CalendarDays, ChevronRight, Database, Eye, FileText, Globe2, Lock, ShieldCheck, Sparkles } from 'lucide-react';

const sectionCardClass = 'rounded-[1.6rem] border border-slate-200/70 bg-white/92 p-5 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.55)] backdrop-blur-sm';

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
  blue: 'border-sky-100 bg-sky-50/70 text-sky-700',
  emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  amber: 'border-amber-100 bg-amber-50/80 text-amber-700',
};

const PrivacyPolicyView = ({ onBackToLogin }) => {
  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16)_0%,_rgba(255,255,255,0)_36%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12)_0%,_rgba(255,255,255,0)_34%),linear-gradient(180deg,#f8fbff_0%,#edf4fb_40%,#e5edf7_100%)] text-slate-800">
      <div className="pointer-events-none fixed inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.16)_1px,transparent_0)] [background-size:26px_26px]" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-blue-300 hover:text-blue-700 hover:shadow-md"
          >
            <ArrowLeft size={14} /> Voltar ao login
          </button>

          <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            <Sparkles size={12} /> Documento público
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <header className={`${sectionCardClass} relative overflow-hidden p-6 sm:p-7 lg:p-8`}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.12)_0%,rgba(14,165,233,0.08)_46%,rgba(255,255,255,0)_100%)]" />
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 shadow-sm">
                  <ShieldCheck size={13} /> Política de Privacidade
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                  <BadgeInfo size={13} /> Acesso rápido na tela de login
                </span>
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[3rem] lg:leading-[1.04]">
                  Como tratamos dados no sistema
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                  Esta página descreve, de forma direta, como as informações são coletadas, utilizadas e protegidas no sistema de distribuição de pastas.
                  O conteúdo foi organizado para facilitar leitura rápida, com uma visão clara sobre o que é armazenado, por que isso acontece e quais
                  mecanismos ajudam a preservar a segurança das operações.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {quickFacts.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_10px_30px_-26px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <Icon size={12} className="text-blue-600" /> {label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className={`${sectionCardClass} p-5 sm:p-6`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Lock size={15} className="text-blue-600" /> Resumo executivo
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Os dados são usados para autenticação, distribuição de pastas, auditoria operacional e suporte às equipes de análise e gestão.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                    <Eye size={12} /> Acesso restrito
                  </div>
                  <p className="mt-2 text-sm text-slate-700">Somente usuários autorizados acessam informações operacionais.</p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    <Globe2 size={12} /> Escopo interno
                  </div>
                  <p className="mt-2 text-sm text-slate-700">A política vale para o uso interno da plataforma e seus painéis administrativos.</p>
                </div>
              </div>
            </div>

            <nav className={`${sectionCardClass} p-5 sm:p-6`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText size={15} className="text-blue-600" /> Navegação rápida
              </div>
              <div className="mt-4 grid gap-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-left transition-all duration-200 hover:border-blue-300 hover:bg-white hover:shadow-sm"
                  >
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{section.title}</span>
                    <ChevronRight size={14} className="text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </a>
                ))}
              </div>
            </nav>
          </aside>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} id={section.id} className={`${sectionCardClass} scroll-mt-6`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneStyles[section.tone]}`}>
                      <Icon size={12} /> Seção
                    </div>
                    <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-900">{section.title}</h2>
                  </div>
                </div>

                {'items' in section ? (
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    {section.body.map((paragraph) => (
                      <p key={paragraph} className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="mt-6 pb-2 text-center text-[11px] font-medium text-slate-500">
          Página de política de privacidade criada para acesso público no login.
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;