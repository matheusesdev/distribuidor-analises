# Migrations SQL (Supabase)

Esta pasta concentra os scripts SQL do projeto em ordem de execucao.

## Ordem recomendada de execucao

1. `001_historico_schema.sql`
   - Cria/ajusta a tabela `historico` e indices.
   - Rode ao configurar um ambiente novo ou quando faltar essa estrutura.

2. `002_logs_transferencias_schema.sql`
   - Cria a tabela `logs_transferencias` e indices.
   - Obrigatorio para registrar transferencias de pastas.

3. `003_administradores_schema.sql`
   - Cria a tabela `administradores` e insere/administra o admin padrao.
   - Necessario para login do gestor.

4. `004_email_login_migration.sql`
   - Adiciona colunas de login por e-mail e reset de senha em `analistas`.
   - Rode quando habilitar/atualizar fluxo de autenticacao por e-mail.

5. `005_session_version_security.sql`
   - Adiciona `session_version` em `analistas` e `administradores`.
   - Necessario para revogacao remota de sessao (multi-dispositivo).

6. `006_logs_sessoes_revogadas_schema.sql`
   - Cria a tabela `logs_sessoes_revogadas` e indices de consulta.
   - Necessario para persistir auditoria oficial de revogacoes de sessao.

7. `007_distribuicoes_schema.sql`
   - Cria/ajusta a tabela `distribuicoes` e indices da mesa atual.
   - Necessario para bootstrap completo do ambiente e para o `upsert` por `reserva_id`.

## Quando rodar

- Ambiente novo: execute 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007.
- Ambiente existente: execute somente o script necessario (todos usam `if not exists` quando aplicavel).
- Se um endpoint reclamar de tabela ausente, rode o script correspondente e teste novamente.
