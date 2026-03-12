# Setup de Administradores no Supabase

## Passo 1: Executar o Script SQL

As credenciais do administrador agora são armazenadas na tabela `administradores` do Supabase, em vez de variáveis de ambiente.

1. Acesse o Supabase Dashboard
2. Vá para **SQL Editor**
3. Crie uma nova query
4. Copie o conteúdo de `administradores_schema.sql` e execute

Isso irá:
- ✅ Criar a tabela `administradores`
- ✅ Criar índices para buscas rápidas
- ✅ Inserir um admin padrão com credenciais:
  - **Username**: `admin`
  - **Senha**: `Admin@2026` (hash seguro PBKDF2-SHA256)

## Passo 2: Configurar ADMIN_AUTH_SECRET

O arquivo `.env` já contém um `ADMIN_AUTH_SECRET` gerado. Em produção, **recomenda-se gerar um novo**:

```bash
python -c "import os; print('ADMIN_AUTH_SECRET=' + os.urandom(32).hex())"
```

Copie o valor gerado e atualize seu `.env`.

## Passo 3: Reiniciar o Backend

Depois de executar o script SQL, reinicie o servidor backend:

```bash
cd backend
python run.py
```

## Gerenciar Administradores

Para adicionar/editar administradores após o setup inicial, você pode:

### Via Supabase Dashboard
1. Vá para **Table Editor**
2. Abra a tabela `administradores`
3. Insira novo admin com senha hasheada

Para gerar hash seguro da senha:
```bash
python -c "import main; print(main.hash_password('sua_senha_aqui'))"
```

### Estrutura da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | bigint | ID único (auto-gerado) |
| `username` | text | Nome de usuário (unique) |
| `senha` | text | Senha hasheada PBKDF2-SHA256 |
| `email` | text | Email do administrador |
| `ativo` | boolean | Controla se admin pode fazer login |
| `data_criacao` | timestamptz | Quando foi criado |
| `updated_at` | timestamptz | Última atualização |

## Desativar um Administrador

Para desativar um admin sem deletar:
```sql
UPDATE administradores SET ativo = false WHERE username = 'admin';
```

Para reativar:
```sql
UPDATE administradores SET ativo = true WHERE username = 'admin';
```

## Resetar Senha do Admin

```bash
python -c "import main; print(main.hash_password('nova_senha_segura'))"
```

Depois execute no Supabase SQL Editor:
```sql
UPDATE administradores 
SET senha = 'pbkdf2_sha256$310000$...' -- o hash gerado
WHERE username = 'admin';
```
