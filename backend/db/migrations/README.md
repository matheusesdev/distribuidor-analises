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

## Quando rodar

- Ambiente novo: execute 001 -> 002 -> 003 -> 004.
- Ambiente existente: execute somente o script necessario (todos usam `if not exists` quando aplicavel).
- Se um endpoint reclamar de tabela ausente, rode o script correspondente e teste novamente.
