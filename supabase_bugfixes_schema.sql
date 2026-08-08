-- ==========================================================
-- CORREÇÕES DE BUGS - SCHEMA UPDATES
-- ==========================================================
-- Execute este script no SQL Editor do Supabase
-- ==========================================================

-- 1. ADICIONAR CAMPOS FALTANTES NA TABELA CARDS
-- ==========================================================
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "group" TEXT DEFAULT 'Geral';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS layout_style TEXT DEFAULT 'classic';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS repeat_interval INT DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#0f172a';

-- ==========================================================
-- 2. CORRIGIR POLÍTICAS DE SEGURANÇA PARA CARDS
-- ==========================================================

-- Permitir que usuários excluam seus próprios cards
DROP POLICY IF EXISTS "Users can delete own cards" ON public.cards;
CREATE POLICY "Users can delete own cards" 
ON public.cards 
FOR DELETE 
USING (auth.uid() = creator_id);

-- Permitir que usuários atualizem seus próprios cards
DROP POLICY IF EXISTS "Users can update own cards" ON public.cards;
CREATE POLICY "Users can update own cards" 
ON public.cards 
FOR UPDATE 
USING (auth.uid() = creator_id);

-- ==========================================================
-- 3. CRIAR TABELA DE SALAS PERSISTENTES
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  auto_clean_messages BOOLEAN DEFAULT false,
  auto_clean_on_close BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Políticas para Rooms
CREATE POLICY "Users can view own rooms" 
ON public.rooms 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create rooms" 
ON public.rooms 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own rooms" 
ON public.rooms 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own rooms" 
ON public.rooms 
FOR DELETE 
USING (auth.uid() = owner_id);

-- ==========================================================
-- 4. CRIAR TABELA DE MEMBROS DE SALAS
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.room_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;

-- Políticas para Room Memberships
CREATE POLICY "Users can view memberships" 
ON public.room_memberships 
FOR SELECT 
USING (auth.uid() = user_id OR room_id IN (SELECT id FROM public.rooms WHERE owner_id = auth.uid()));

CREATE POLICY "Room owners can manage memberships" 
ON public.room_memberships 
FOR ALL 
USING (room_id IN (SELECT id FROM public.rooms WHERE owner_id = auth.uid()));

-- ==========================================================
-- 5. MELHORAR FUNÇÃO DE COMPRA DE CARDS
-- ==========================================================
CREATE OR REPLACE FUNCTION process_card_purchase(
  p_card_id TEXT,
  p_buyer_id UUID,
  p_creator_id UUID,
  p_amount INT,
  p_earnings INT,
  p_card_title TEXT DEFAULT '',
  p_buyer_name TEXT DEFAULT ''
)
RETURNS VOID AS $$
DECLARE
  buyer_balance INT;
BEGIN
  -- Verificar saldo do comprador
  SELECT credits INTO buyer_balance 
  FROM public.profiles 
  WHERE id = p_buyer_id;

  IF buyer_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- 1. Deduzir créditos do comprador
  UPDATE public.profiles 
  SET credits = credits - p_amount 
  WHERE id = p_buyer_id;

  -- 2. Adicionar ganhos ao criador
  UPDATE public.profiles 
  SET earnings = earnings + p_earnings 
  WHERE id = p_creator_id;

  -- 3. Registrar a venda com título do card e nome do comprador
  INSERT INTO public.sales_transactions (
    seller_id,
    buyer_id,
    buyer_name,
    card_id,
    card_title,
    amount
  ) VALUES (
    p_creator_id,
    p_buyer_id,
    p_buyer_name,
    p_card_id,
    p_card_title,
    p_earnings
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro na transação: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- 6. ADICIONAR ÍNDICES PARA MELHOR PERFORMANCE
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_cards_creator_id ON public.cards(creator_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON public.sales_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_buyer_id ON public.sales_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON public.rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_room_memberships_user_id ON public.room_memberships(user_id);

-- ==========================================================
-- 7. HABILITAR REALTIME PARA NOVAS TABELAS
-- ==========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_memberships;

-- ==========================================================
-- CONCLUÍDO!
-- ==========================================================
-- Execute as queries diagnósticas em diagnostic_queries.sql
-- para verificar o estado atual do banco de dados.
-- ==========================================================
