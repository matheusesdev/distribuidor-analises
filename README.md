# VCA Distribuidor

Sistema interno para distribuição, acompanhamento e auditoria de reservas/pastas de análise comercial da VCA.

O projeto integra o CVCRM ao fluxo operacional dos analistas, distribuindo automaticamente as reservas entre usuários elegíveis, registrando histórico de atendimento e oferecendo um painel gerencial para acompanhamento da operação.

## Visão Geral

O sistema cobre quatro frentes principais:

- sincronização automática de reservas vindas do CRM;
- distribuição de pastas entre analistas conforme permissões e disponibilidade;
- registro de histórico de conclusões e transferências;
- painel administrativo com visão da equipe, fila, produtividade e controle de acessos.

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

### Infra e Integrações

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

### Sincronização

O backend executa um processo em background que consulta periodicamente as situações monitoradas no CVCRM. A cada ciclo, ele:

1. busca todas as reservas das situações configuradas;
2. normaliza os dados recebidos;
3. cria ou atualiza os registros locais;
4. tenta atribuir automaticamente cada reserva a um analista elegível;
5. remove da mesa local reservas que já não existem no CRM, com limpeza segura.

### Distribuição

Cada analista possui permissões por situação e estado de fila online/offline. Com base nisso, o sistema define quem pode receber cada nova pasta.

Quando um analista sai da fila, fica inativo ou perde a sessão, o backend pode redistribuir automaticamente as reservas para outros usuários aptos.

### Operação do Analista

O analista consegue:

- acessar a própria mesa;
- pesquisar e filtrar reservas;
- abrir a reserva no CRM;
- concluir a pasta;
- transferir uma ou várias pastas;
- acompanhar métricas e analytics;
- alterar a própria senha.

### Operação do Gestor

O gestor/admin consegue:

- visualizar a equipe e a distribuição atual;
- acompanhar histórico e logs de transferências;
- consultar dados analíticos da operação;
- criar, editar e remover analistas;
- gerenciar administradores;
- revogar sessões remotamente.

## Principais Módulos

### Frontend

- login e reset de senha;
- mesa do analista;
- dashboard analítico do analista;
- painel do gestor;
- administração de usuários.

### Backend

- autenticação de analistas e admins;
- sincronização com CVCRM;
- distribuição e redistribuição de reservas;
- conclusão de atendimento e histórico;
- transferência manual e em massa;
- auditoria de revogação de sessões.

## Principais Tabelas

- `analistas`: operadores da fila
- `administradores`: acessos do painel gestor
- `distribuicoes`: mesa atual de reservas em atendimento
- `historico`: reservas concluídas
- `logs_transferencias`: auditoria de transferências
- `logs_sessoes_revogadas`: auditoria de revogação de sessão

Observação: a tabela `distribuicoes` é usada no backend, mas a migration dela não aparece entre os arquivos SQL versionados neste repositório.

## Principais Endpoints

### Autenticação

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

## Variáveis de Ambiente

### Backend

Configurações principais:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CVCRM_EMAIL`
- `CVCRM_TOKEN`
- `ADMIN_AUTH_SECRET`
- `ANALYST_AUTH_SECRET`
- `ALLOWED_ORIGINS`
- `SYNC_INTERVAL_SECONDS`
- `FRONTEND_URL`

Também existem variáveis de SMTP e de integração com o ambiente LOTEAR.

### Frontend

- `VITE_API_URL`

## Execução Local

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Disponível em `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponível em `http://localhost:5173`.

## Documentação Complementar

Para uma explicação mais completa da arquitetura, lógica e funcionamento do sistema, veja [DOCUMENTACAO_PROJETO.md](./DOCUMENTACAO_PROJETO.md).
