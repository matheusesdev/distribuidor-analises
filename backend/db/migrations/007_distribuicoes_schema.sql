-- 007_distribuicoes_schema.sql
-- Cria/ajusta a tabela operacional da mesa atual.

create table if not exists public.distribuicoes (
  reserva_id text primary key,
  cliente text,
  empreendimento text,
  unidade text,
  situacao_id integer,
  situacao_nome text,
  analista_id bigint,
  data_atribuicao timestamptz,
  created_at timestamptz not null default now()
);

alter table public.distribuicoes add column if not exists cliente text;
alter table public.distribuicoes add column if not exists empreendimento text;
alter table public.distribuicoes add column if not exists unidade text;
alter table public.distribuicoes add column if not exists situacao_id integer;
alter table public.distribuicoes add column if not exists situacao_nome text;
alter table public.distribuicoes add column if not exists analista_id bigint;
alter table public.distribuicoes add column if not exists data_atribuicao timestamptz;
alter table public.distribuicoes add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_distribuicoes_reserva_unique
  on public.distribuicoes (reserva_id);

create index if not exists idx_distribuicoes_analista
  on public.distribuicoes (analista_id);

create index if not exists idx_distribuicoes_analista_data
  on public.distribuicoes (analista_id, data_atribuicao desc);

create index if not exists idx_distribuicoes_situacao
  on public.distribuicoes (situacao_id);

create index if not exists idx_distribuicoes_data_atribuicao
  on public.distribuicoes (data_atribuicao desc);
