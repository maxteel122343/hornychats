
-- ==========================================================
-- 1. ATUALIZAR PERFIS (Dados de Pagamento Persistentes)
-- ==========================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS picpay_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paypal_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS earnings INT DEFAULT 0;

-- ==========================================================
-- 2. HISTÓRICO DE SAQUES
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  amount INT NOT NULL,
  method TEXT NOT NULL, -- pix, picpay, etc
  target_key TEXT NOT NULL, -- a chave ou email usado
  status TEXT DEFAULT 'pending', -- pending, paid, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estimated_payout_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================================
-- 3. HISTÓRICO DE VENDAS (Quem comprou de quem)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.sales_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES auth.users NOT NULL,
  buyer_id UUID REFERENCES auth.users NOT NULL,
  buyer_name TEXT,
  card_id TEXT,
  card_title TEXT,
  amount INT, -- Valor líquido ganho pelo vendedor
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller views sales" ON public.sales_transactions FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "System inserts sales" ON public.sales_transactions FOR INSERT WITH CHECK (true);

-- ==========================================================
-- 4. FUNÇÃO SEGURA DE COMPRA (Atomicidade)
-- ==========================================================
CREATE OR REPLACE FUNCTION process_card_purchase(
  p_card_id TEXT,
  p_buyer_id UUID,
  p_creator_id UUID,
  p_amount INT, -- Custo total (ex: 10)
  p_earnings INT -- Ganho do criador (ex: 8)
)
RETURNS VOID AS $$
BEGIN
  -- 1. Deduzir créditos do comprador
  UPDATE public.profiles 
  SET credits = credits - p_amount 
  WHERE id = p_buyer_id;

  -- 2. Adicionar ganhos ao criador
  UPDATE public.profiles 
  SET earnings = earnings + p_earnings 
  WHERE id = p_creator_id;

  -- 3. (Opcional) Registrar a venda será feito pelo frontend ou trigger, 
  -- mas a dedução de saldo é crítica ser aqui.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- 5. CORREÇÃO DE UPLOAD DE FOTO (Storage Policies)
-- ==========================================================
-- Certifique-se de ter um bucket chamado 'media' público.
-- Estas políticas permitem upload/update/delete para usuários autenticados.

INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar Upload" ON storage.objects
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Avatar Update" ON storage.objects
FOR UPDATE TO authenticated 
USING (bucket_id = 'media');

CREATE POLICY "Avatar Select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'media');

-- ==========================================================
-- 6. GALERIA
-- ==========================================================
-- Garantir que todos vejam cards da galeria
CREATE POLICY "Public view cards" ON public.cards FOR SELECT USING (true);
