# Deploy do Backend em VPS

Este diretório contém uma stack mínima para subir o backend em VPS com Docker Compose e Nginx.

## Pré-requisitos

- Docker Engine e Docker Compose instalados na VPS
- Arquivo de ambiente do backend configurado em `backend/.env`
- DNS do subdomínio da API apontando para a VPS (ex.: `api.seudominio.com`)

## Subida

Na raiz do projeto:

```bash
cd deploy/vps
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
