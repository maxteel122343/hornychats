-- ==========================================================
-- SCRIPT SQL: SEGUIDORES E CORREÇÃO DE CRÉDITOS/GANHOS
-- Execute este script no SQL Editor do Supabase para ativar
-- ==========================================================

-- 1. TABELA DE SEGUIDORES (Followers & Following)
CREATE TABLE IF NOT EXISTS public.followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users NOT NULL,    -- Quem segue
  following_id UUID REFERENCES auth.users NOT NULL,   -- Quem é seguido (o criador)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Qualquer um pode ver seguidores" ON public.followers
  FOR SELECT USING (true);

CREATE POLICY "Usuário autenticado pode seguir" ON public.followers
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Usuário pode deixar de seguir" ON public.followers
  FOR DELETE USING (auth.uid() = follower_id);


-- 2. CORREÇÃO DA FUNÇÃO PROCESS_CARD_PURCHASE
-- Remove a versão ambígua de 5 parâmetros para evitar o erro PGRST203 (Multiple Choices)
DROP FUNCTION IF EXISTS public.process_card_purchase(text, uuid, uuid, integer, integer);

-- Cria a versão oficial de 7 parâmetros com SECURITY DEFINER para garantir crédito aos criadores
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
    created_at
  ) VALUES (
    p_creator_id,
    p_buyer_id,
    p_buyer_name,
    p_card_id,
    p_card_title,
    p_earnings,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
