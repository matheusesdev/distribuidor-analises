-- =============================================================================
-- MIGRAÇÃO: Login por E-mail + Reset de Senha
-- Executar no Supabase SQL Editor
-- =============================================================================

-- 1. Adiciona coluna de e-mail à tabela analistas
ALTER TABLE analistas
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- 2. Adiciona colunas para reset de senha (token hasheado + expiração)
ALTER TABLE analistas
  ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- 3. Atualiza os e-mails dos analistas existentes
UPDATE analistas SET email = 'mariana.pinto@vcaconstrutora.com.br'   WHERE nome ILIKE '%mariana%assis%'   OR nome ILIKE '%mariana%pinto%';
UPDATE analistas SET email = 'yan.mattos@vcaconstrutora.com.br'       WHERE nome ILIKE '%yan%mattos%';
UPDATE analistas SET email = 'naiara.silva@vcaconstrutora.com.br'     WHERE nome ILIKE '%naiara%';
UPDATE analistas SET email = 'felipe.teixeira@vcaconstrutora.com.br'  WHERE nome ILIKE '%felipe%teixeira%';
UPDATE analistas SET email = 'carolaine.matos@vcaconstrutora.com.br'  WHERE nome ILIKE '%carolaine%'         OR nome ILIKE '%caroline%';
UPDATE analistas SET email = 'karen.christina@vcaconstrutora.com.br'  WHERE nome ILIKE '%karen%';

-- 4. Cria índice para busca rápida por e-mail
CREATE INDEX IF NOT EXISTS idx_analistas_email ON analistas (email);

-- 5. Verificar resultado
SELECT id, nome, email, status FROM analistas ORDER BY nome;
