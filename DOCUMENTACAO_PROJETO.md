# Documentacao do Projeto

## 1. O que e este projeto

Este projeto e um sistema interno de distribuicao e acompanhamento de reservas/pastas de analise comercial da VCA. Ele busca reservas em situacoes especificas no CVCRM, distribui essas reservas entre analistas elegiveis, permite que o time acompanhe a fila em tempo real e oferece um painel de gestao para controle operacional.

Na pratica, a aplicacao resolve quatro frentes principais:

- capturar reservas do CRM automaticamente;
- distribuir cada pasta para um analista com base nas permissoes e disponibilidade;
- registrar historico de conclusoes e transferencias;
- dar ao gestor visibilidade da operacao, incluindo equipe, carga atual, produtividade e administracao de acessos.

## 2. Stack utilizada

### Frontend

- React 18
- Vite
- JavaScript/JSX
- Tailwind CSS
- lucide-react para icones
- `xlsx`, `jspdf` e `jspdf-autotable` para exportacoes e relatorios

O frontend fica em `frontend/` e roda localmente com Vite na porta `5173`. Em desenvolvimento, as chamadas `/api` sao encaminhadas para o backend em `http://localhost:8000`.

### Backend

- Python 3.11
- FastAPI
- Uvicorn
- requests
- supabase-py
- psycopg2-binary
- python-dotenv

O backend fica em `backend/` e expõe uma API HTTP que concentra autenticacao, sincronizacao com o CRM, regras de fila, transferencias, historico e administracao.

### Banco e servicos externos

- Supabase como banco principal e camada de acesso aos dados
- CVCRM como origem das reservas monitoradas
- SMTP para envio de e-mail de redefinicao de senha
- Fly.io para deploy do backend
- Vercel como URL de frontend de producao referenciada no backend

## 3. Estrutura geral da aplicacao

O projeto esta dividido em duas partes:

### `frontend/`

Aplicacao React com uma interface unica que muda de comportamento conforme o perfil autenticado.

Perfis principais:

- analista
- gestor/admin

Telas e modulos principais:

- login de analista
- reset de senha
- mesa do analista
- analytics do analista
- configuracoes do analista
- dashboard do gestor
- fila/equipe
- historico de transferencias
- administracao de analistas e administradores

### `backend/`

API FastAPI que:

- autentica analistas e gestores;
- sincroniza dados com o CVCRM em background;
- distribui reservas entre analistas;
- conclui reservas e registra historico;
- transfere reservas manualmente;
- revoga sessoes;
- gera dados analiticos para o painel.

## 4. Como o sistema funciona

### 4.1. Sincronizacao com o CRM

O backend executa uma tarefa em background no startup da aplicacao. Essa tarefa roda em loop e chama a sincronizacao em intervalo configuravel, hoje com default de `25` segundos (`SYNC_INTERVAL_SECONDS`).

Durante a sincronizacao, o sistema:

1. consulta todas as reservas das situacoes monitoradas no CVCRM;
2. suporta paginacao para buscar todas as paginas;
3. normaliza os ids das reservas;
4. verifica se a reserva ja existe localmente na tabela de distribuicao;
5. se for nova, tenta atribuir a um analista elegivel;
6. se ja existir, pode reatribuir quando o analista atual estiver inativo, offline ou ausente;
7. atualiza a situacao da reserva localmente quando ela muda no CRM;
8. remove da mesa local as reservas que nao estao mais no CRM, com uma limpeza segura para evitar apagar dados em caso de falha parcial de coleta.

As fontes monitoradas hoje sao:

- CVCRM principal
- CVCRM LOTEAR, quando o token especifico estiver configurado

### 4.2. Logica de distribuicao

Cada analista possui:

- nome
- e-mail
- senha
- status (`ativo` ou `inativo`)
- indicador de fila online/offline
- permissoes de situacoes

As permissoes definem quais tipos de reserva o analista pode receber. Quando chega uma nova reserva de uma determinada situacao, o backend procura um analista elegivel com aquela permissao. Se houver analista apto e online, a pasta e atribuida. Caso contrario, a reserva pode permanecer sem destino ate que alguem fique disponivel.

Tambem existe redistribuicao automatica quando um analista sai da fila ou fica indisponivel.

### 4.3. Operacao do analista

Depois do login, o analista acessa a propria mesa. Nela, ele consegue:

- ver as reservas atualmente atribuidas a ele;
- filtrar e pesquisar;
- abrir a reserva no CRM;
- concluir a pasta com um resultado;
- transferir uma pasta para outro analista;
- transferir varias pastas em massa;
- acompanhar metricas pessoais;
- alterar a senha.

Quando uma pasta e concluida:

1. o backend registra os dados na tabela `historico`;
2. a reserva e removida da tabela `distribuicoes`;
3. a produtividade passa a refletir essa conclusao nos dashboards.

### 4.4. Operacao do gestor

O painel do gestor consolida a operacao inteira. Ele oferece:

- visao da equipe;
- contagem de reservas pendentes no CRM;
- distribuicao atual da mesa;
- historico recente;
- logs de transferencias;
- analytics por analista, dia, mes e situacao;
- criacao, edicao e exclusao de analistas;
- gestao de administradores;
- revogacao de sessoes de admin e analistas.

O endpoint `/api/gestor/overview` monta boa parte dessa visao combinando:

- equipe cadastrada;
- distribuicoes atuais;
- historico do dia;
- historico analitico do periodo;
- logs de transferencias;
- estado do ultimo sync.

## 5. Regras de autenticacao e seguranca

O sistema possui autenticacao separada para analistas e administradores.

### Analistas

- podem fazer login por ID e senha;
- tambem podem fazer login por e-mail e senha;
- possuem token proprio de sessao;
- podem redefinir senha por e-mail;
- tem sessao invalidada quando a senha muda ou quando o gestor revoga o acesso.

### Gestores/Admins

- fazem login no painel administrativo;
- possuem token proprio de sessao;
- podem criar novos administradores;
- podem revogar sessoes remotamente.

### Seguranca implementada

- senhas com hash PBKDF2-SHA256;
- tokens assinados com segredo do backend;
- `session_version` para invalidacao remota de sessoes;
- logs de revogacao de sessao;
- validacao de acesso via header `Authorization: Bearer ...`;
- CORS configurado para o frontend.

## 6. Principais tabelas e dados

Pelo codigo e pelas migrations presentes, estas sao as estruturas mais importantes do sistema:

### `analistas`

Tabela central de operadores. Armazena credenciais, status, fila online/offline, permissoes, total do dia e versao de sessao.

### `administradores`

Tabela dos gestores/admins que acessam o painel administrativo.

### `distribuicoes`

Tabela operacional da mesa atual. Guarda as reservas que ainda estao em atendimento, com o analista responsavel, dados da reserva e situacao atual.

Observacao: esta tabela e usada extensivamente no backend, mas a migration dela nao aparece entre os arquivos SQL versionados neste repositorio.

### `historico`

Tabela de conclucoes. Registra cada reserva finalizada, o analista, situacao e data de fechamento.

### `logs_transferencias`

Tabela de auditoria de transferencias manuais entre analistas.

### `logs_sessoes_revogadas`

Tabela de auditoria de revogacoes de sessao feitas pelo gestor.

## 7. Situacoes de negocio monitoradas

O backend trabalha com um conjunto fechado de situacoes mapeadas internamente. Hoje, o codigo monitora:

- Analise Venda Loteamento
- Analise Venda Parcelamento Incorporadora
- Analise Venda Caixa
- Confeccao de Contrato
- Assinado
- Aprovacao Expansao
- equivalentes do ambiente LOTEAR para parte dessas situacoes

Essas situacoes sao importantes porque:

- determinam quais reservas entram na fila;
- definem as permissoes dos analistas;
- influenciam dashboards e relatorios.

## 8. Fluxo resumido do negocio

Fluxo ponta a ponta:

1. o backend consulta o CVCRM periodicamente;
2. reservas das situacoes monitoradas entram na base local;
3. o sistema tenta atribuir cada reserva a um analista elegivel;
4. o analista atende a pasta na mesa;
5. a pasta pode ser concluida ou transferida;
6. conclusoes vao para `historico`;
7. transferencias vao para `logs_transferencias`;
8. o gestor acompanha tudo pelo painel.

## 9. Principais endpoints da API

### Autenticacao e conta

- `POST /api/login`
- `POST /api/login/email`
- `POST /api/gestor/login`
- `POST /api/analista/esqueceu-senha`
- `POST /api/analista/resetar-senha`
- `POST /api/analista/alterar-senha`

### Operacao do analista

- `GET /api/analistas`
- `GET /api/mesa/{analista_id}`
- `GET /api/metricas/{analista_id}`
- `GET /api/analista/dashboard/{analista_id}`
- `POST /api/analista/status-fila`
- `POST /api/concluir`
- `POST /api/analista/transferir`
- `POST /api/analista/transferir-massa`

### Operacao do gestor

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

## 10. Variaveis de ambiente importantes

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

Servidor local padrao:

- `http://localhost:8000`

### Frontend

Na pasta `frontend/`:

```bash
npm install
npm run dev
```

Servidor local padrao:

- `http://localhost:5173`

## 12. Resumo tecnico

Em resumo, este projeto e uma plataforma operacional de distribuicao de reservas para analistas, com sincronizacao automatica com o CVCRM, controle de fila, autenticacao separada por perfil, trilha de auditoria e painel gerencial.

O coracao da regra de negocio esta no backend, especialmente em:

- sincronizacao recorrente com o CRM;
- atribuicao e redistribuicao de pastas;
- controle de sessoes;
- consolidacao dos dados analiticos.

Ja o frontend funciona como interface operacional e gerencial para consumir essa API e transformar os dados em fluxo de trabalho diario.
