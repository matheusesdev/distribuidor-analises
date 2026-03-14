-- 005_session_version_security.sql
-- Adiciona controle de versao de sessao para revogacao remota por usuario.

alter table if exists public.analistas
  add column if not exists session_version integer not null default 1;

alter table if exists public.administradores
  add column if not exists session_version integer not null default 1;

update public.analistas
set session_version = 1
where session_version is null;

update public.administradores
set session_version = 1
where session_version is null;
