# Deploy do Backend em VPS

Este diretório contém uma stack pronta para subir o backend em VPS com Docker Compose e Nginx.

## Pré-requisitos

- Docker Engine e Docker Compose instalados na VPS
- Arquivo de ambiente do backend configurado em `backend/.env`
- DNS do subdomínio da API apontando para a VPS (ex.: `api.seudominio.com`)

## Subida

Na raiz do projeto:

```bash
cd deploy/vps
chmod +x preflight.sh deploy.sh
./deploy.sh
```

Se preferir manualmente:

```bash
cd deploy/vps
./preflight.sh
docker compose up -d --build
```

## Verificação

```bash
docker compose ps
curl -I http://localhost/docs
```

## Atualização

```bash
cd deploy/vps
docker compose pull
docker compose up -d --build
```

## Variáveis críticas para produção

No `backend/.env` da VPS, valide principalmente:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CVCRM_TOKEN`
- `CVCRM_LOTEAR_TOKEN`
- `ADMIN_AUTH_SECRET`
- `ANALYST_AUTH_SECRET`
- `ALLOWED_ORIGINS`
- `FRONTEND_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## HTTPS

Este exemplo publica HTTP na porta 80. Para produção, coloque HTTPS com um proxy reverso (Nginx + Certbot, Caddy ou Traefik).

## Checklist de prontidão para o dia da migração

- DNS do backend apontando para a VPS
- Variável `VITE_API_URL` do frontend apontando para a nova API
- `ALLOWED_ORIGINS` e `FRONTEND_URL` ajustados para domínio final
- Segredos rotacionados no ambiente de produção
- Backup/configuração atual documentada antes do cutover
