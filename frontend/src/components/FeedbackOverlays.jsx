import React from 'react';
import { AlertTriangle, CheckCircle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { normalizeUiText } from '../utils/textEncoding';

export const LoadingOverlay = () => (
  <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-slate-950/35 backdrop-blur-sm">
    <div className="bg-white/95 p-5 rounded-3xl shadow-[0_28px_55px_-24px_rgba(15,23,42,0.65)] flex flex-col items-center gap-3 border border-white/70 animate-in zoom-in-95">
      <RefreshCw className="text-blue-600 animate-spin" size={24} />
      <p className="text-slate-500 font-semibold text-[11px] tracking-[0.04em]">Processando...</p>
    </div>
  </div>
);

export const StatusToast = ({ toast }) => (
  <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-3 px-6 py-3 rounded-2xl shadow-[0_20px_36px_-22px_rgba(15,23,42,0.65)] border transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'} ${toast.type === 'success' ? 'bg-[#0071e3] border-blue-400/40' : 'bg-rose-500 border-rose-300/40'} text-white`}>
    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
    <span className="font-semibold text-[12px] tracking-[0.01em]">{normalizeUiText(toast.message)}</span>
  </div>
);

export const ConfirmActionModal = ({ confirmAction, onClose }) => {
  if (!confirmAction.open) return null;
  const isDanger = confirmAction.tone === 'danger';

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-md z-450 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => onClose(false)}>
      <div className="relative bg-white/95 border border-white/70 rounded-3xl shadow-[0_34px_80px_-30px_rgba(15,23,42,0.7)] w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">{confirmAction.title}</h3>
            <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-relaxed">{confirmAction.message}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={() => onClose(false)} className="py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-[13px] font-semibold border border-slate-200 transition-all hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0">Cancelar</button>
          <button onClick={() => onClose(true)} className={`py-2.5 rounded-2xl text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 ${isDanger ? 'bg-rose-600 shadow-[0_14px_24px_-16px_rgba(225,29,72,0.9)]' : 'bg-amber-600 shadow-[0_14px_24px_-16px_rgba(217,119,6,0.9)]'}`}>
            {confirmAction.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const RevokeAccessModal = ({ revokeAction, onClose }) => {
  if (!revokeAction?.open) return null;

  const isStepTwo = revokeAction.step === 2;
  const expectedPhrase = 'REVOGAR';
  const phraseMatches = (revokeAction.confirmPhrase || '').trim().toUpperCase() === expectedPhrase;
  const reasonOk = (revokeAction.reason || '').trim().length >= 10;
  const canContinue = Boolean(revokeAction.acknowledged);
  const canConfirm = phraseMatches && reasonOk;

  const impactBullets = revokeAction.role === 'admin'
    ? [
        'Todas as sessões ativas deste administrador serão encerradas imediatamente.',
        'Dispositivos em uso receberão expiração de sessão no próximo request.',
        'A ação será registrada para auditoria com data, alvo e responsável.',
      ]
    : [
        'O analista será desconectado imediatamente da sessão atual.',
        'A fila do analista permanece no estado atual (não será pausada automaticamente).',
        'A ação será registrada para auditoria com data, alvo e responsável.',
      ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-500 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => onClose({ confirmed: false })}>
      <div className="w-full max-w-lg rounded-3xl border border-white/75 bg-white/95 shadow-[0_42px_90px_-36px_rgba(15,23,42,0.75)] overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,#fee2e2_0%,#fff1f2_38%,#ffffff_100%)]">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-700">Ação sensível</p>
              <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-slate-900">Revogar acesso de {revokeAction.targetName}</h3>
              <p className="mt-1.5 text-[12px] font-medium text-slate-600 leading-relaxed">Esta operação impacta sessão ativa e deve ser confirmada em duas etapas.</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className={`inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-[10px] font-semibold ${!isStepTwo ? 'bg-[#0071e3] text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Impacto</span>
            <span className="h-px w-8 bg-slate-200" />
            <span className={`inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-[10px] font-semibold ${isStepTwo ? 'bg-[#0071e3] text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Confirmação</span>
          </div>
        </div>

        {!isStepTwo ? (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 space-y-2.5">
              {impactBullets.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <AlertTriangle size={13} className="text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-[12px] font-medium text-slate-700 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            <label className="inline-flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(revokeAction.acknowledged)}
                onChange={(event) => onClose({ updateOnly: true, patch: { acknowledged: event.target.checked } })}
                className="mt-0.5"
              />
              <span className="text-[11px] font-medium text-slate-700 leading-relaxed">Entendo o impacto e desejo avançar para a confirmação final.</span>
            </label>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Frase de confirmação</p>
                <p className="text-[12px] font-medium text-slate-700 mt-1">Digite <span className="font-semibold text-rose-600">{expectedPhrase}</span> para liberar a revogação.</p>
                <input
                  type="text"
                  value={revokeAction.confirmPhrase || ''}
                  onChange={(event) => onClose({ updateOnly: true, patch: { confirmPhrase: event.target.value } })}
                  placeholder={expectedPhrase}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70"
                />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Motivo de auditoria</p>
                <textarea
                  value={revokeAction.reason || ''}
                  onChange={(event) => onClose({ updateOnly: true, patch: { reason: event.target.value } })}
                  placeholder="Ex.: suspeita de compartilhamento de sessão em dispositivo não autorizado"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 outline-none resize-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70"
                />
              </div>

              <div className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                {canConfirm ? <CheckCircle2 size={13} className="text-emerald-600" /> : <AlertTriangle size={13} className="text-amber-500" />}
                {canConfirm ? 'Confirmação pronta para envio.' : 'Preencha frase e motivo para habilitar.'}
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => onClose({ confirmed: false })}
            className="py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 text-[12px] font-semibold transition-all hover:bg-slate-100"
          >
            Cancelar
          </button>
          {!isStepTwo ? (
            <button
              disabled={!canContinue}
              onClick={() => onClose({ updateOnly: true, patch: { step: 2 } })}
              className="py-2.5 rounded-2xl text-[12px] font-semibold text-white bg-[linear-gradient(140deg,#0071e3_0%,#005bb7_100%)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Avançar
            </button>
          ) : (
            <button
              disabled={!canConfirm}
              onClick={() => onClose({ confirmed: true, reason: (revokeAction.reason || '').trim() })}
              className="py-2.5 rounded-2xl text-[12px] font-semibold text-white bg-rose-600 shadow-[0_14px_24px_-16px_rgba(225,29,72,0.9)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Confirmar Revogação
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
