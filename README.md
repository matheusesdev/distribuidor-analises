# VCA Distribuidor

Sistema interno para distribuicao, acompanhamento e auditoria de reservas/pastas de analise comercial da VCA.

O projeto integra o CVCRM ao fluxo operacional dos analistas, distribuindo automaticamente as reservas entre usuarios elegiveis, registrando historico de atendimento e oferecendo um painel gerencial para acompanhamento da operacao.

## Visao Geral

O sistema cobre quatro frentes principais:

- sincronizacao automatica de reservas vindas do CRM;
- distribuicao de pastas entre analistas conforme permissoes e disponibilidade;
- registro de historico de conclusoes e transferencias;
- painel administrativo com visao da equipe, fila, produtividade e controle de acessos.

## Stack

### Frontend

- React 18
- Vite
- JavaScript/JSX
- Tailwind CSS
- lucide-react
- `xlsx`, `jspdf` e `jspdf-autotable`

### Backend

- Python 3.11
- FastAPI
- Uvicorn
- requests
- Supabase Client
- psycopg2-binary

### Infra e integracoes

- Supabase
- CVCRM
- SMTP para reset de senha
- Fly.io no backend
- Vercel no frontend

## Estrutura do Projeto

```text
.
|-- backend/
|   |-- main.py
|   |-- run.py
|   `-- db/migrations/
|-- frontend/
|   |-- src/
|   |-- public/
|   `-- package.json
|-- DOCUMENTACAO_PROJETO.md
`-- README.md
```

## Como Funciona

### Sincronizacao

O backend executa um processo em background que consulta periodicamente as situacoes monitoradas no CVCRM. A cada ciclo ele:

1. busca todas as reservas das situacoes configuradas;
2. normaliza os dados recebidos;
3. cria ou atualiza os registros locais;
4. tenta atribuir automaticamente cada reserva a um analista elegivel;
5. remove da mesa local reservas que ja nao existem no CRM, com limpeza segura.

### Distribuicao

Cada analista possui permissoes por situacao e estado de fila online/offline. Com base nisso, o sistema define quem pode receber cada nova pasta.

Quando um analista sai da fila, fica inativo ou perde a sessao, o backend pode redistribuir automaticamente as reservas para outros usuarios aptos.

### Operacao do Analista

O analista consegue:

- acessar a propria mesa;
- pesquisar e filtrar reservas;
- abrir a reserva no CRM;
- concluir a pasta;
- transferir uma ou varias pastas;
- acompanhar metricas e analytics;
- alterar a propria senha.

### Operacao do Gestor

O gestor/admin consegue:

- visualizar a equipe e a distribuicao atual;
- acompanhar historico e logs de transferencias;
- consultar dados analiticos da operacao;
- criar, editar e remover analistas;
- gerenciar administradores;
- revogar sessoes remotamente.

## Principais Modulos

### Frontend

- login e reset de senha;
- mesa do analista;
- dashboard analitico do analista;
- painel do gestor;
- administracao de usuarios.

### Backend

- autenticacao de analistas e admins;
- sincronizacao com CVCRM;
- distribuicao e redistribuicao de reservas;
- conclusao de atendimento e historico;
- transferencia manual e em massa;
- auditoria de revogacao de sessoes.

## Principais Tabelas

- `analistas`: operadores da fila
- `administradores`: acessos do painel gestor
- `distribuicoes`: mesa atual de reservas em atendimento
- `historico`: reservas concluidas
- `logs_transferencias`: auditoria de transferencias
- `logs_sessoes_revogadas`: auditoria de revogacao de sessao

Observacao: a tabela `distribuicoes` e usada no backend, mas a migration dela nao aparece entre os arquivos SQL versionados neste repositorio.

## Principais Endpoints

### Autenticacao

- `POST /api/login`
- `POST /api/login/email`
- `POST /api/gestor/login`
- `POST /api/analista/esqueceu-senha`
- `POST /api/analista/resetar-senha`

### Analista

- `GET /api/mesa/{analista_id}`
- `GET /api/metricas/{analista_id}`
- `GET /api/analista/dashboard/{analista_id}`
- `POST /api/analista/status-fila`
- `POST /api/concluir`
- `POST /api/analista/transferir`
- `POST /api/analista/transferir-massa`

### Gestor

- `GET /api/gestor/sync-status`
- `GET /api/gestor/overview`
- `POST /api/gestor/sessoes/revogar`
- `POST /api/gestor/analistas`
- `PATCH /api/gestor/analistas/{id}`
- `DELETE /api/gestor/analistas/{id}`

## Variaveis de Ambiente

### Backend

Configuracoes principais:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CVCRM_EMAIL`
- `CVCRM_TOKEN`
- `ADMIN_AUTH_SECRET`
- `ANALYST_AUTH_SECRET`
- `ALLOWED_ORIGINS`
- `SYNC_INTERVAL_SECONDS`
- `FRONTEND_URL`

Tambem existem variaveis de SMTP e de integracao com o ambiente LOTEAR.

### Frontend

- `VITE_API_URL`

## Execucao Local

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Disponivel em `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponivel em `http://localhost:5173`.

## Documentacao Complementar

Para uma explicacao mais completa da arquitetura, logica e funcionamento do sistema, veja [DOCUMENTACAO_PROJETO.md](./DOCUMENTACAO_PROJETO.md).
