import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CalendarDays, FileText, Lock, ShieldCheck } from 'lucide-react';

const updatedAt = '28/04/2026';

const sections = [
  {
    id: 'dados',
    title: 'Dados tratados',
    body: [
      'Dados de acesso, como e-mail, nome de usuário e registros de sessão.',
      'Dados operacionais necessários para distribuir, registrar e auditar pastas e transferências.',
      'Histórico de ações, logs, status de atendimento e informações geradas pelo uso do sistema.',
      'Dados recebidos de integrações e sistemas externos conectados ao fluxo de trabalho.',
    ],
  },
  {
    id: 'finalidades',
    title: 'Finalidades',
    body: [
      'Autenticar usuários, manter sessões e controlar permissões por perfil.',
      'Executar a distribuição de pastas e organizar filas de trabalho.',
      'Gerar auditoria, relatórios e histórico operacional para acompanhamento da operação.',
      'Apoiar suporte, melhoria contínua e prevenção de uso indevido da plataforma.',
    ],
  },
  {
    id: 'compartilhamento',
    title: 'Compartilhamento e retenção',
    body: [
      'As informações são tratadas internamente para operar o sistema e registrar atividades.',
      'Quando houver integrações externas ou obrigações legais, o compartilhamento ocorre apenas na medida necessária para cumprir a finalidade aplicável.',
      'Os dados são mantidos pelo tempo necessário para a operação, histórico, auditoria e obrigações do negócio.',
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança e contato',
    body: [
      'A plataforma utiliza autenticação, controle de sessão e segregação de perfis para reduzir acessos indevidos.',
      'Registros de atividade podem ser mantidos para suporte, auditoria e segurança operacional.',
      'Em caso de dúvidas sobre privacidade, revisão de acesso ou tratamento de dados, procure o responsável interno pela operação do sistema.',
    ],
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
};

const PrivacyPolicyView = ({ onBackToLogin }) => {
  return (
    <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <motion.div {...fadeUp}>
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <ArrowLeft size={15} />
            Voltar ao login
          </button>
        </motion.div>

        <motion.header className="mt-8 border-b border-slate-200 pb-8" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.04 }}>
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-blue-600">Política de privacidade</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Como tratamos dados no sistema
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                Esta página resume quais dados podem ser tratados pela plataforma, para quais finalidades eles são usados e quais controles existem para proteger a operação.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              <CalendarDays size={13} />
              Atualização: {updatedAt}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              <Lock size={13} />
              Uso interno
            </span>
          </div>
        </motion.header>

        <motion.nav className="mt-6" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }} aria-label="Seções da política">
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {section.title}
              </a>
            ))}
          </div>
        </motion.nav>

        <motion.section
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.12 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-50 text-blue-600">
              <FileText size={17} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Resumo objetivo</h2>
              <p className="mt-1 text-[13px] font-medium text-slate-500">O sistema usa dados para acesso, distribuição, auditoria e suporte operacional.</p>
            </div>
          </div>
        </motion.section>

        <div className="mt-6 flex flex-col gap-5">
          {sections.map((section, index) => (
            <motion.section
              key={section.id}
              id={section.id}
              className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.14 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">{section.title}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {section.body.map((item) => (
                  <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-slate-600">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-5 pb-2 text-center text-[12px] font-medium text-slate-500">
          Página pública de política de privacidade disponível no login.
        </footer>
      </div>
    </main>
  );
};

export default PrivacyPolicyView;
