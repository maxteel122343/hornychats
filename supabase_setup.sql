-- ==============================================================================
-- SQL DE ATUALIZAÇÃO SUPABASE (CURTIDAS, SEGUIDORES, FOTO DE PERFIL E CARDS)
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. TABELA DE CURTIDAS NOS CARDS (card_likes)
CREATE TABLE IF NOT EXISTS card_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(card_id, user_id)
);

-- Índices para alta performance
CREATE INDEX IF NOT EXISTS idx_card_likes_card_id ON card_likes(card_id);
CREATE INDEX IF NOT EXISTS idx_card_likes_user_id ON card_likes(user_id);

-- Habilitar RLS para card_likes
ALTER TABLE card_likes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (RLS)
DROP POLICY IF EXISTS "Leitura pública de curtidas" ON card_likes;
CREATE POLICY "Leitura pública de curtidas" 
  ON card_likes FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem curtir" ON card_likes;
CREATE POLICY "Usuários autenticados podem curtir" 
  ON card_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem remover suas próprias curtidas" ON card_likes;
CREATE POLICY "Usuários podem remover suas próprias curtidas" 
  ON card_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- 2. TABELA DE SEGUIDORES (followers)
CREATE TABLE IF NOT EXISTS followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de seguidores" ON followers;
CREATE POLICY "Leitura pública de seguidores" 
  ON followers FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem seguir" ON followers;
CREATE POLICY "Usuários autenticados podem seguir" 
  ON followers FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Usuários podem deixar de seguir" ON followers;
CREATE POLICY "Usuários podem deixar de seguir" 
  ON followers FOR DELETE 
  USING (auth.uid() = follower_id);

-- 3. GARANTIR COLUNAS DE FOTO E NOME NA TABELA profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Permitir leitura pública dos perfis para que qualquer visitante veja fotos e nomes
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis públicos para visualização" ON profiles;
CREATE POLICY "Perfis públicos para visualização" 
  ON profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON profiles;
CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 4. GARANTIR COLUNAS DE METADADOS NOS CARDS (cards)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS creator_name TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS creator_photo TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 5. BUCKET DE MÍDIA / FOTOS (Storage)
-- Garante que o bucket 'media' é público para avatares e mídias
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para fotos de perfil e mídias
DROP POLICY IF EXISTS "Acesso público ao bucket de mídia" ON storage.objects;
CREATE POLICY "Acesso público ao bucket de mídia"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Upload autenticado no bucket de mídia" ON storage.objects;
CREATE POLICY "Upload autenticado no bucket de mídia"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Atualização autenticada no bucket de mídia" ON storage.objects;
CREATE POLICY "Atualização autenticada no bucket de mídia"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media');
