alter table if exists public.sugestoes_melhoria
  add column if not exists cancelada boolean not null default false,
  add column if not exists cancelada_at timestamptz,
  add column if not exists resposta_admin text,
  add column if not exists resposta_admin_at timestamptz,
  add column if not exists resposta_admin_por_admin_id bigint,
  add column if not exists resposta_admin_por_admin_nome text;

update public.sugestoes_melhoria
set status = 'Em análise'
where status in ('Em anÃ¡lise', 'Em analise');

update public.sugestoes_melhoria
set status = 'Concluído'
where status in ('ConcluÃ­do', 'Concluido');

alter table if exists public.sugestoes_melhoria
  drop constraint if exists sugestoes_melhoria_status_check;

alter table if exists public.sugestoes_melhoria
  alter column status set default 'Em análise';

alter table if exists public.sugestoes_melhoria
  add constraint sugestoes_melhoria_status_check check (
    status in (
      'Em desenvolvimento',
      'Em Planejamento',
      'Em análise',
      'Aprovado',
      'Aguardando Cliente',
      'Concluído'
    )
  );

create index if not exists idx_sugestoes_melhoria_autor_analista_id
  on public.sugestoes_melhoria (autor_analista_id);

create index if not exists idx_sugestoes_melhoria_cancelada
  on public.sugestoes_melhoria (cancelada);
