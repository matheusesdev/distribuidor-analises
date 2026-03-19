# Documentação do Projeto

## 1. O que é este projeto

Este projeto é um sistema interno de distribuição e acompanhamento de reservas/pastas de análise comercial da VCA. Ele busca reservas em situações específicas no CVCRM, distribui essas reservas entre analistas elegíveis, permite que o time acompanhe a fila em tempo real e oferece um painel de gestão para controle operacional.

Na prática, a aplicação resolve quatro frentes principais:

- capturar reservas do CRM automaticamente;
- distribuir cada pasta para um analista com base nas permissões e disponibilidade;
- registrar histórico de conclusões e transferências;
- dar ao gestor visibilidade da operação, incluindo equipe, carga atual, produtividade e administração de acessos.

## 2. Stack utilizada

### Frontend

- React 18
- Vite
- JavaScript/JSX
- Tailwind CSS
- lucide-react para ícones
- `xlsx`, `jspdf` e `jspdf-autotable` para exportações e relatórios

O frontend fica em `frontend/` e roda localmente com Vite na porta `5173`. Em desenvolvimento, as chamadas `/api` são encaminhadas para o backend em `http://localhost:8000`.

### Backend

- Python 3.11
- FastAPI
- Uvicorn
- requests
- supabase-py
- psycopg2-binary
- python-dotenv

O backend fica em `backend/` e expõe uma API HTTP que concentra autenticação, sincronização com o CRM, regras de fila, transferências, histórico e administração.

### Banco e serviços externos

- Supabase como banco principal e camada de acesso aos dados
- CVCRM como origem das reservas monitoradas
- SMTP para envio de e-mail de redefinição de senha
- Fly.io para deploy do backend
- Vercel como URL de frontend de produção referenciada no backend

## 3. Estrutura geral da aplicação

O projeto está dividido em duas partes:

### `frontend/`

Aplicação React com uma interface única que muda de comportamento conforme o perfil autenticado.

Perfis principais:

- analista
- gestor/admin

Telas e módulos principais:

- login de analista
- reset de senha
- mesa do analista
- analytics do analista
- configurações do analista
- dashboard do gestor
- fila/equipe
- histórico de transferências
- administração de analistas e administradores

### `backend/`

API FastAPI que:

- autentica analistas e gestores;
- sincroniza dados com o CVCRM em background;
- distribui reservas entre analistas;
- conclui reservas e registra histórico;
- transfere reservas manualmente;
- revoga sessões;
- gera dados analíticos para o painel.

## 4. Como o sistema funciona

### 4.1. Sincronização com o CRM

O backend executa uma tarefa em background no startup da aplicação. Essa tarefa roda em loop e chama a sincronização em intervalo configurável, hoje com default de `25` segundos (`SYNC_INTERVAL_SECONDS`).

Durante a sincronização, o sistema:

1. consulta todas as reservas das situações monitoradas no CVCRM;
2. suporta paginação para buscar todas as páginas;
3. normaliza os IDs das reservas;
4. verifica se a reserva já existe localmente na tabela de distribuição;
5. se for nova, tenta atribuir a um analista elegível;
6. se já existir, pode reatribuir quando o analista atual estiver inativo, offline ou ausente;
7. atualiza a situação da reserva localmente quando ela muda no CRM;
8. remove da mesa local as reservas que não estão mais no CRM, com uma limpeza segura para evitar apagar dados em caso de falha parcial de coleta.

As fontes monitoradas hoje são:

- CVCRM principal
- CVCRM LOTEAR, quando o token específico estiver configurado

### 4.2. Lógica de distribuição

Cada analista possui:

- nome
- e-mail
- senha
- status (`ativo` ou `inativo`)
- indicador de fila online/offline
- permissões de situações

As permissões definem quais tipos de reserva o analista pode receber. Quando chega uma nova reserva de uma determinada situação, o backend procura um analista elegível com aquela permissão. Se houver analista apto e online, a pasta é atribuída. Caso contrário, a reserva pode permanecer sem destino até que alguém fique disponível.

Também existe redistribuição automática quando um analista sai da fila ou fica indisponível.

### 4.3. Operação do analista

Depois do login, o analista acessa a própria mesa. Nela, ele consegue:

- ver as reservas atualmente atribuídas a ele;
- filtrar e pesquisar;
- abrir a reserva no CRM;
- concluir a pasta com um resultado;
- transferir uma pasta para outro analista;
- transferir várias pastas em massa;
- acompanhar métricas pessoais;
- alterar a senha.

Quando uma pasta é concluída:

1. o backend registra os dados na tabela `historico`;
2. a reserva é removida da tabela `distribuicoes`;
3. a produtividade passa a refletir essa conclusão nos dashboards.

### 4.4. Operação do gestor

O painel do gestor consolida a operação inteira. Ele oferece:

- visão da equipe;
- contagem de reservas pendentes no CRM;
- distribuição atual da mesa;
- histórico recente;
- logs de transferências;
- analytics por analista, dia, mês e situação;
- criação, edição e exclusão de analistas;
- gestão de administradores;
- revogação de sessões de admin e analistas.

O endpoint `/api/gestor/overview` monta boa parte dessa visão combinando:

- equipe cadastrada;
- distribuições atuais;
- histórico do dia;
- histórico analítico do período;
- logs de transferências;
- estado do último sync.

## 5. Regras de autenticação e segurança

O sistema possui autenticação separada para analistas e administradores.

### Analistas

- podem fazer login por ID e senha;
- também podem fazer login por e-mail e senha;
- possuem token próprio de sessão;
- podem redefinir senha por e-mail;
- têm sessão invalidada quando a senha muda ou quando o gestor revoga o acesso.

### Gestores/Admins

- fazem login no painel administrativo;
- possuem token próprio de sessão;
- podem criar novos administradores;
- podem revogar sessões remotamente.

### Segurança implementada

- senhas com hash PBKDF2-SHA256;
- tokens assinados com segredo do backend;
- `session_version` para invalidação remota de sessões;
- logs de revogação de sessão;
- validação de acesso via header `Authorization: Bearer ...`;
- CORS configurado para o frontend.

## 6. Principais tabelas e dados

Pelo código e pelas migrations presentes, estas são as estruturas mais importantes do sistema:

### `analistas`

Tabela central de operadores. Armazena credenciais, status, fila online/offline, permissões, total do dia e versão de sessão.

### `administradores`

Tabela dos gestores/admins que acessam o painel administrativo.

### `distribuicoes`

Tabela operacional da mesa atual. Guarda as reservas que ainda estão em atendimento, com o analista responsável, dados da reserva e situação atual.

Observação: esta tabela é usada extensivamente no backend, mas a migration dela não aparece entre os arquivos SQL versionados neste repositório.

### `historico`

Tabela de conclusões. Registra cada reserva finalizada, o analista, a situação e a data de fechamento.

### `logs_transferencias`

Tabela de auditoria de transferências manuais entre analistas.

### `logs_sessoes_revogadas`

Tabela de auditoria de revogações de sessão feitas pelo gestor.

## 7. Situações de negócio monitoradas

O backend trabalha com um conjunto fechado de situações mapeadas internamente. Hoje, o código monitora:

- Análise Venda Loteamento
- Análise Venda Parcelamento Incorporadora
- Análise Venda Caixa
- Confecção de Contrato
- Assinado
- Aprovação Expansão
- equivalentes do ambiente LOTEAR para parte dessas situações

Essas situações são importantes porque:

- determinam quais reservas entram na fila;
- definem as permissões dos analistas;
- influenciam dashboards e relatórios.

## 8. Fluxo resumido do negócio

Fluxo ponta a ponta:

1. o backend consulta o CVCRM periodicamente;
2. reservas das situações monitoradas entram na base local;
3. o sistema tenta atribuir cada reserva a um analista elegível;
4. o analista atende a pasta na mesa;
5. a pasta pode ser concluída ou transferida;
6. conclusões vão para `historico`;
7. transferências vão para `logs_transferencias`;
8. o gestor acompanha tudo pelo painel.

## 9. Principais endpoints da API

### Autenticação e conta

- `POST /api/login`
- `POST /api/login/email`
- `POST /api/gestor/login`
- `POST /api/analista/esqueceu-senha`
- `POST /api/analista/resetar-senha`
- `POST /api/analista/alterar-senha`

### Operação do analista

- `GET /api/analistas`
- `GET /api/mesa/{analista_id}`
- `GET /api/metricas/{analista_id}`
- `GET /api/analista/dashboard/{analista_id}`
- `POST /api/analista/status-fila`
- `POST /api/concluir`
- `POST /api/analista/transferir`
- `POST /api/analista/transferir-massa`

### Operação do gestor

- `GET /api/gestor/sync-status`
- `GET /api/gestor/overview`
- `GET /api/gestor/admins`
- `POST /api/gestor/admins`
- `POST /api/gestor/redistribuir`
- `POST /api/gestor/zerar-dados`
- `POST /api/gestor/sessoes/revogar`
- `POST /api/gestor/analistas`
- `PATCH /api/gestor/analistas/{id}`
- `DELETE /api/gestor/analistas/{id}`

## 10. Variáveis de ambiente importantes

### Backend

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CVCRM_EMAIL`
- `CVCRM_TOKEN`
- `CVCRM_BASE_URL`
- `CVCRM_LOTEAR_BASE_URL`
- `CVCRM_LOTEAR_TOKEN`
- `ADMIN_AUTH_SECRET`
- `ANALYST_AUTH_SECRET`
- `MANAGER_TOKEN_TTL_SECONDS`
- `ANALYST_TOKEN_TTL_SECONDS`
- `APP_TIMEZONE`
- `ALLOWED_ORIGINS`
- `SYNC_INTERVAL_SECONDS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `FRONTEND_URL`
- `RESET_TOKEN_TTL_MINUTES`

### Frontend

- `VITE_API_URL`

## 11. Como executar localmente

### Backend

Na pasta `backend/`:

```bash
pip install -r requirements.txt
python run.py
```

Servidor local padrão:

- `http://localhost:8000`

### Frontend

Na pasta `frontend/`:

```bash
npm install
npm run dev
```

Servidor local padrão:

- `http://localhost:5173`

## 12. Resumo técnico

Em resumo, este projeto é uma plataforma operacional de distribuição de reservas para analistas, com sincronização automática com o CVCRM, controle de fila, autenticação separada por perfil, trilha de auditoria e painel gerencial.

O coração da regra de negócio está no backend, especialmente em:

- sincronização recorrente com o CRM;
- atribuição e redistribuição de pastas;
- controle de sessões;
- consolidação dos dados analíticos.

Já o frontend funciona como interface operacional e gerencial para consumir essa API e transformar os dados em fluxo de trabalho diário.
