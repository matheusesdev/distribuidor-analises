# VCA Distribuidor

Sistema interno da VCA para distribuição, acompanhamento e auditoria de reservas/pastas de análise comercial.

O projeto conecta o fluxo operacional dos analistas ao CVCRM, distribui pastas entre usuários elegíveis, registra histórico de atendimento e oferece um painel gerencial para acompanhar fila, produtividade, transferências e acessos.

## Sumário

- [Visão geral](#visão-geral)
- [Principais recursos](#principais-recursos)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Fluxo operacional](#fluxo-operacional)
- [Execução local](#execução-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Deploy](#deploy)
- [Documentação complementar](#documentação-complementar)

## Visão geral

O VCA Distribuidor centraliza a mesa de análise comercial e reduz trabalho manual no roteamento de reservas. A aplicação mantém uma base local sincronizada com o CRM, identifica analistas aptos por situação/permissão, controla disponibilidade de fila e mantém trilhas de auditoria para ações sensíveis.

Ambiente de produção do frontend:

```text
https://distribuidor-analises.vercel.app/
```

## Principais recursos

### Analista

- Login por credenciais e controle de sessão.
- Mesa de trabalho com busca, filtros e links para o CRM.
- Congelamento visual da mesa para evitar mudanças inesperadas durante conferência.
- Conclusão de pastas com registro em histórico.
- Transferência individual e em massa.
- Métricas, analytics e exportações.
- Sugestões/melhorias para acompanhamento pelo gestor.
- Alteração e redefinição de senha.

### Gestor

- Dashboard operacional da fila e das situações monitoradas.
- Visão de produtividade por analista.
- Controle de fila online/offline.
- Criação, edição e remoção de analistas.
- Administração de usuários gestores.
- Revogação remota de sessões.
- Log de transferências e auditoria.
- Painel de sugestões com status e resposta.

### Experiência de UI

- Layout responsivo para desktop, notebook, tablet e mobile.
- Dark mode preservado e refinado.
- Superfícies, tabelas, modais e cards ajustados para melhor contraste.
- Remoção de texturas/grades de fundo que prejudicavam leitura.

## Stack

### Frontend

- React 18
- Vite
- JavaScript/JSX
- Tailwind CSS 4
- lucide-react
- motion
- driver.js
- exceljs, xlsx, jsPDF e jsPDF AutoTable

### Backend

- Python 3.11+
- FastAPI
- Uvicorn
- Supabase Client
- psycopg2-binary
- requests
- python-dotenv
- python-multipart
- ftfy

### Infraestrutura e integrações

- Supabase como banco operacional.
- CVCRM como fonte de reservas.
- SMTP para recuperação de senha.
- Vercel para frontend.
- VPS com Docker/Nginx para backend.

## Estrutura do projeto

```text
.
|-- backend/
|   |-- main.py
|   |-- run.py
|   |-- requirements.txt
|   |-- requirements-test.txt
|   |-- db/
|   |   `-- migrations/
|   `-- tests/
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- package.json
|   `-- vite.config.js
|-- deploy/
|   `-- vps/
|       |-- docker-compose.yml
|       |-- nginx.conf
|       `-- README.md
|-- DEPLOY_ENV_CHECKLIST.md
|-- DOCUMENTACAO_PROJETO.md
|-- pytest.ini
`-- README.md
```

## Fluxo operacional

### Sincronização com CVCRM

O backend executa um worker em background que consulta periodicamente as situações monitoradas no CVCRM. Em cada ciclo, ele:

1. busca as reservas das situações configuradas;
2. normaliza dados recebidos do CRM;
3. cria ou atualiza registros locais;
4. atribui reservas a analistas elegíveis;
5. identifica reservas removidas do CRM;
6. limpa a mesa local de forma segura;
7. expõe status de sincronização para o painel gestor.

### Distribuição de pastas

A distribuição considera:

- permissões do analista por situação;
- status de fila online/offline;
- disponibilidade do analista;
- quantidade de pastas já recebidas;
- integridade da reserva e da origem.

Quando necessário, o gestor pode acionar redistribuição ou alterar manualmente o estado da fila de analistas.

### Transferências

O sistema suporta:

- transferência individual;
- transferência em massa;
- motivo obrigatório;
- validação de destino;
- log por data, origem, destino e pasta.

### Auditoria

A aplicação registra eventos relevantes para rastreabilidade operacional, incluindo:

- conclusões;
- transferências;
- revogações de sessão;
- status de sincronização;
- alterações administrativas.

## Principais tabelas

- `analistas`: usuários operacionais da fila.
- `administradores`: usuários do painel gestor.
- `distribuicoes`: mesa atual de reservas distribuídas.
- `historico`: reservas concluídas.
- `logs_transferencias`: trilha de transferências.
- `logs_sessoes_revogadas`: trilha de revogação de sessão.
- Tabelas auxiliares de reset de senha, sugestões e configuração conforme migrations.

## Principais endpoints

### Autenticação

```text
POST /api/login
POST /api/login/email
POST /api/gestor/login
POST /api/analista/esqueceu-senha
POST /api/analista/resetar-senha
```

### Analista

```text
GET  /api/mesa/{analista_id}
GET  /api/metricas/{analista_id}
GET  /api/analista/dashboard/{analista_id}
POST /api/analista/status-fila
POST /api/concluir
POST /api/analista/transferir
POST /api/analista/transferir-massa
```

### Gestor

```text
GET    /api/gestor/sync-status
GET    /api/gestor/overview
POST   /api/gestor/sessoes/revogar
POST   /api/gestor/analistas
PATCH  /api/gestor/analistas/{id}
DELETE /api/gestor/analistas/{id}
```

## Execução local

### Pré-requisitos

- Node.js 18+
- npm
- Python 3.11+
- Supabase configurado
- Credenciais válidas do CVCRM

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

API local:

```text
http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local:

```text
http://localhost:5173
```

### Build do frontend

```bash
cd frontend
npm run build
```

### Testes do backend

```bash
python -m pip install -r backend/requirements-test.txt
python -m pytest backend/tests -q
```

## Variáveis de ambiente

Nunca versionar arquivos `.env` com segredos reais. Use os arquivos `.env.example` como base.

### Backend

Arquivo de referência:

```text
backend/.env.example
```

Variáveis principais:

```text
PORT=8000
SUPABASE_URL=
SUPABASE_KEY=
CVCRM_EMAIL=
CVCRM_TOKEN=
CVCRM_BASE_URL=
CVCRM_LOTEAR_TOKEN=
CVCRM_LOTEAR_BASE_URL=
ADMIN_AUTH_SECRET=
MANAGER_TOKEN_TTL_SECONDS=
ANALYST_AUTH_SECRET=
ANALYST_TOKEN_TTL_SECONDS=
ALLOWED_ORIGINS=
SYNC_INTERVAL_SECONDS=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_USE_TLS=
SMTP_USE_SSL=
SMTP_TIMEOUT_SECONDS=
FRONTEND_URL=
RESET_TOKEN_TTL_MINUTES=
```

Observações:

- `ALLOWED_ORIGINS` deve listar as origens permitidas separadas por vírgula.
- Não usar `*` em produção quando `allow_credentials` estiver habilitado.
- `FRONTEND_URL` é usado nos links de redefinição de senha.
- `ADMIN_AUTH_SECRET` e `ANALYST_AUTH_SECRET` devem ser strings fortes e distintas.

### Frontend

Arquivo de referência:

```text
frontend/.env.example
```

Variável principal:

```text
VITE_API_URL=http://localhost:8000
```

Em produção, `VITE_API_URL` deve apontar para a API pública do backend.

## Deploy

### Frontend na Vercel

URL de produção:

```text
https://distribuidor-analises.vercel.app/
```

Fluxo recomendado:

```bash
git switch main
git pull origin main
cd frontend
npm run build
```

Depois de validar, fazer push para `main`. O projeto conectado na Vercel publica a versão de produção.

### Backend em VPS

Arquivos de infraestrutura:

```text
deploy/vps/docker-compose.yml
deploy/vps/nginx.conf
deploy/vps/README.md
```

Resumo:

```bash
cd deploy/vps
docker compose up -d --build
```

Antes de subir:

- configurar `backend/.env` no servidor;
- revisar `ALLOWED_ORIGINS`;
- revisar `FRONTEND_URL`;
- confirmar credenciais do Supabase;
- confirmar tokens do CVCRM;
- validar SMTP para reset de senha.

## Checklist rápido de produção

- `npm run build` passa no frontend.
- `pytest` passa no backend, quando aplicável.
- Migrations necessárias foram aplicadas no Supabase.
- `ALLOWED_ORIGINS` inclui a URL de produção do frontend.
- `FRONTEND_URL` aponta para o frontend de produção.
- `VITE_API_URL` aponta para a API pública.
- Tokens e secrets não estão versionados.
- Login de analista e gestor foram testados.
- Sincronização com CVCRM aparece como saudável no painel gestor.

## Convenções de manutenção

- Alterações de UI devem ficar no frontend.
- Alterações de regra de distribuição devem ser tratadas no backend com cuidado e teste.
- Não alterar regras de negócio junto com refatorações visuais.
- Commits devem ser pequenos e descrever a intenção.
- Para deploy, preferir merge em `main` após build local aprovado.

## Documentação complementar

- [DOCUMENTACAO_PROJETO.md](./DOCUMENTACAO_PROJETO.md): visão detalhada de arquitetura, regras e fluxos.
- [DEPLOY_ENV_CHECKLIST.md](./DEPLOY_ENV_CHECKLIST.md): checklist de variáveis por ambiente.
- [backend/db/migrations/README.md](./backend/db/migrations/README.md): instruções e histórico de migrations.
- [deploy/vps/README.md](./deploy/vps/README.md): operação do backend em VPS.
