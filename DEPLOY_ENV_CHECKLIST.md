# Checklist de Variaveis por Ambiente

Use este checklist para garantir configuracao consistente e segura entre dev, staging e producao.

## Regras gerais

- Nunca commitar segredos em arquivos .env reais.
- Versionar apenas arquivos de exemplo (.env.example).
- Definir segredos no provedor (Vercel, Fly, VPS, CI/CD secret store).
- Rotacionar segredos ao trocar ambiente ou suspeita de vazamento.

## Dev (local)

Backend:
- [ ] SUPABASE_URL
- [ ] SUPABASE_KEY
- [ ] CVCRM_EMAIL
- [ ] CVCRM_TOKEN
- [ ] ADMIN_AUTH_SECRET (>= 32 chars)
- [ ] ANALYST_AUTH_SECRET (opcional, padrao usa ADMIN_AUTH_SECRET)
- [ ] ALLOWED_ORIGINS=http://localhost:5173
- [ ] FRONTEND_URL=http://localhost:5173

Frontend:
- [ ] VITE_API_URL=http://localhost:8000

## Staging

Backend:
- [ ] SUPABASE_URL (projeto staging)
- [ ] SUPABASE_KEY (chave staging)
- [ ] CVCRM_EMAIL (conta de teste)
- [ ] CVCRM_TOKEN (token de teste)
- [ ] CVCRM_BASE_URL
- [ ] CVCRM_LOTEAR_BASE_URL
- [ ] CVCRM_LOTEAR_TOKEN (se aplicavel)
- [ ] ADMIN_AUTH_SECRET (unico do staging)
- [ ] ANALYST_AUTH_SECRET (recomendado unico)
- [ ] ALLOWED_ORIGINS=https://staging-seu-frontend
- [ ] FRONTEND_URL=https://staging-seu-frontend
- [ ] SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

Frontend:
- [ ] VITE_API_URL=https://staging-sua-api

## Producao

Backend:
- [ ] SUPABASE_URL (projeto prod)
- [ ] SUPABASE_KEY (chave prod)
- [ ] CVCRM_EMAIL
- [ ] CVCRM_TOKEN
- [ ] CVCRM_BASE_URL
- [ ] CVCRM_LOTEAR_BASE_URL
- [ ] CVCRM_LOTEAR_TOKEN (se aplicavel)
- [ ] ADMIN_AUTH_SECRET (forte e exclusivo)
- [ ] ANALYST_AUTH_SECRET (forte e exclusivo)
- [ ] ALLOWED_ORIGINS=https://seu-frontend-prod
- [ ] FRONTEND_URL=https://seu-frontend-prod
- [ ] SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- [ ] MANAGER_TOKEN_TTL_SECONDS
- [ ] ANALYST_TOKEN_TTL_SECONDS
- [ ] RESET_TOKEN_TTL_MINUTES

Frontend:
- [ ] VITE_API_URL=https://sua-api-prod

## Validacao rapida antes de deploy

- [ ] API sobe sem erro de variavel obrigatoria
- [ ] Login de analista e gestor funcionando
- [ ] CORS permite apenas dominios esperados
- [ ] Fluxo de reset de senha envia link correto
- [ ] Nenhum arquivo .env real aparece em git status
