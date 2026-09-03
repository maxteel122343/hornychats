-- ==============================================================================
-- SCRIPT SQL DEFINITIVO DE PERSISTÊNCIA & CORREÇÃO COMPLETA (SUPABASE)
-- Execute este script no SQL Editor do Supabase (https://app.supabase.com)
-- Todas as operações usam IF NOT EXISTS / DROP POLICY IF EXISTS (seguro para re-executar)
-- ==============================================================================

-- 1. TABELA DE SEGUIDORES (followers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON public.followers(following_id);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de seguidores" ON public.followers;
CREATE POLICY "Leitura pública de seguidores" 
  ON public.followers FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem seguir" ON public.followers;
CREATE POLICY "Usuários autenticados podem seguir" 
  ON public.followers FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

-- Importante para operações de upsert (evita erro 42501 de RLS no upsert)
DROP POLICY IF EXISTS "Usuários podem atualizar seguidores" ON public.followers;
CREATE POLICY "Usuários podem atualizar seguidores" 
  ON public.followers FOR UPDATE 
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Usuários podem deixar de seguir" ON public.followers;
CREATE POLICY "Usuários podem deixar de seguir" 
  ON public.followers FOR DELETE 
  USING (auth.uid() = follower_id);

GRANT ALL ON TABLE public.followers TO authenticated;
GRANT SELECT ON TABLE public.followers TO anon;


-- 2. TABELA DE CURTIDAS EM CARDS (card_likes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.card_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(card_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_card_likes_card_id ON public.card_likes(card_id);
CREATE INDEX IF NOT EXISTS idx_card_likes_user_id ON public.card_likes(user_id);

ALTER TABLE public.card_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de curtidas" ON public.card_likes;
CREATE POLICY "Leitura pública de curtidas" 
  ON public.card_likes FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem curtir" ON public.card_likes;
CREATE POLICY "Usuários autenticados podem curtir" 
  ON public.card_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem descurtir" ON public.card_likes;
CREATE POLICY "Usuários podem descurtir" 
  ON public.card_likes FOR DELETE 
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.card_likes TO authenticated;
GRANT SELECT ON TABLE public.card_likes TO anon;


-- 3. TABELA DE PERFIS (profiles) - COLUNAS RECENTES
-- ==============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS picpay_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paypal_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS earnings INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_credits INT DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_free_claim_at TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis públicos para visualização" ON public.profiles;
CREATE POLICY "Perfis públicos para visualização" 
  ON public.profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem criar seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem criar seus próprios perfis" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;


-- 4. TABELA DE CARDS (cards) - COLUNAS E PERMISSÕES
-- ==============================================================================
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS creator_name TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS creator_photo TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "group" TEXT DEFAULT 'Geral';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS layout_style TEXT DEFAULT 'classic';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS repeat_interval INT DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#0f172a';

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vitrine visível para todos" ON public.cards;
CREATE POLICY "Vitrine visível para todos" 
  ON public.cards FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Apenas logados publicam na vitrine" ON public.cards;
CREATE POLICY "Apenas logados publicam na vitrine" 
  ON public.cards FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios cards" ON public.cards;
CREATE POLICY "Usuários podem atualizar seus próprios cards" 
  ON public.cards FOR UPDATE 
  USING (auth.uid() = creator_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuários podem excluir seus próprios cards" ON public.cards;
CREATE POLICY "Usuários podem excluir seus próprios cards" 
  ON public.cards FOR DELETE 
  USING (auth.uid() = creator_id);

GRANT ALL ON TABLE public.cards TO authenticated;
GRANT SELECT ON TABLE public.cards TO anon;


-- 5. TABELA DE TRANSAÇÕES DE VENDAS & CRÉDITOS GRATUITOS (sales_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  buyer_name TEXT,
  card_id TEXT,
  card_title TEXT,
  amount INT DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sales_transactions ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem suas vendas e compras" ON public.sales_transactions;
CREATE POLICY "Usuários veem suas vendas e compras" 
  ON public.sales_transactions FOR SELECT 
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Inserção de vendas permitida" ON public.sales_transactions;
CREATE POLICY "Inserção de vendas permitida" 
  ON public.sales_transactions FOR INSERT 
  WITH CHECK (true);

GRANT ALL ON TABLE public.sales_transactions TO authenticated;
GRANT SELECT ON TABLE public.sales_transactions TO anon;


-- 6. TABELA DE SALAS (rooms) - TEMPO ROTATIVO, FRASES RÁPIDAS & WATCH PARTY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  creator_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  image_url TEXT,
  background_url TEXT,
  watch_party_data JSONB DEFAULT NULL,
  admins TEXT[] DEFAULT '{}',
  paid_chat_config JSONB DEFAULT '{"enabled": false, "intervalMinutes": 5, "costCredits": 10, "warningSeconds": 60, "autoDebitDefault": false}'::jsonb,
  quick_phrases JSONB DEFAULT NULL,
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS watch_party_data JSONB DEFAULT NULL;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS admins TEXT[] DEFAULT '{}';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS paid_chat_config JSONB DEFAULT '{"enabled": false, "intervalMinutes": 5, "costCredits": 10, "warningSeconds": 60, "autoDebitDefault": false}'::jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS quick_phrases JSONB DEFAULT NULL;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um pode ver as salas" ON public.rooms;
CREATE POLICY "Qualquer um pode ver as salas" 
  ON public.rooms FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados criam salas" ON public.rooms;
CREATE POLICY "Usuários autenticados criam salas" 
  ON public.rooms FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins e criadores atualizam salas" ON public.rooms;
CREATE POLICY "Admins e criadores atualizam salas" 
  ON public.rooms FOR UPDATE 
  USING (auth.role() = 'authenticated');

GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO anon;


-- 7. TABELA DE MENSAGENS (messages) - PERMISSÃO PARA LIMPEZA DE CHAT
-- ==============================================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mensagens visíveis para todos" ON public.messages;
CREATE POLICY "Mensagens visíveis para todos" 
  ON public.messages FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Qualquer um pode enviar mensagens" ON public.messages;
CREATE POLICY "Qualquer um pode enviar mensagens" 
  ON public.messages FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Qualquer um pode atualizar mensagens" ON public.messages;
CREATE POLICY "Qualquer um pode atualizar mensagens" 
  ON public.messages FOR UPDATE 
  USING (true);

DROP POLICY IF EXISTS "Permitir limpeza de mensagens da sala" ON public.messages;
CREATE POLICY "Permitir limpeza de mensagens da sala" 
  ON public.messages FOR DELETE 
  USING (true);

GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO anon;


-- 8. RPC DE COMPRA ATÔMICA DE CARDS (process_card_purchase)
-- ==============================================================================
-- Remove a versão antiga de 5 parâmetros para evitar erro PGRST203 (Multiple Choices)
DROP FUNCTION IF EXISTS public.process_card_purchase(text, uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.process_card_purchase(
  p_card_id TEXT,
  p_buyer_id UUID,
  p_creator_id UUID,
  p_amount INT,
  p_earnings INT,
  p_card_title TEXT DEFAULT 'Card',
  p_buyer_name TEXT DEFAULT 'Usuário'
)
RETURNS VOID AS $$
BEGIN
  -- 1. Deduzir créditos do comprador (se houver custo)
  IF p_amount > 0 THEN
    UPDATE public.profiles 
    SET credits = GREATEST(0, credits - p_amount) 
    WHERE id = p_buyer_id;
  END IF;

  -- 2. Adicionar ganhos ao criador
  IF p_earnings > 0 THEN
    UPDATE public.profiles 
    SET earnings = earnings + p_earnings 
    WHERE id = p_creator_id;
  END IF;

  -- 3. Registrar a venda na tabela sales_transactions
  INSERT INTO public.sales_transactions (
    seller_id,
    buyer_id,
    buyer_name,
    card_id,
    card_title,
    amount,
    is_free,
    created_at
  ) VALUES (
    p_creator_id,
    p_buyer_id,
    p_buyer_name,
    p_card_id,
    p_card_title,
    p_earnings,
    (p_amount = 0),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. BUCKET DE MÍDIA / FOTOS (storage.buckets & storage.objects)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

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
