-- ==========================================================
-- QUERIES DIAGNÓSTICAS - INVESTIGAR PROBLEMAS
-- ==========================================================
-- Use estas queries no SQL Editor do Supabase para
-- investigar os problemas reportados
-- ==========================================================

-- ==========================================================
-- 1. VERIFICAR CARDS DO USUÁRIO EXMAN9001
-- ==========================================================
-- Substitua 'exman9001' pelo username real se diferente
SELECT 
  c.id,
  c.title,
  c.type,
  c.credit_cost,
  c.created_at,
  p.username as creator_name
FROM public.cards c
LEFT JOIN public.profiles p ON c.creator_id = p.id
WHERE p.username = 'exman9001'
ORDER BY c.created_at DESC;

-- ==========================================================
-- 2. VERIFICAR VENDAS DE AUDIO CARD (avatare003 -> exman9001)
-- ==========================================================
SELECT 
  st.id,
  st.card_id,
  st.card_title,
  st.amount as earnings,
  st.created_at,
  p_seller.username as seller,
  p_buyer.username as buyer
FROM public.sales_transactions st
LEFT JOIN public.profiles p_seller ON st.seller_id = p_seller.id
LEFT JOIN public.profiles p_buyer ON st.buyer_id = p_buyer.id
WHERE 
  (p_buyer.username = 'exman9001' AND p_seller.username = 'avatare003')
  OR (p_buyer.username = 'exman9001')
  OR (p_seller.username = 'avatare003')
ORDER BY st.created_at DESC;

-- ==========================================================
-- 3. VERIFICAR EARNINGS ACUMULADOS
-- ==========================================================
SELECT 
  id,
  username,
  credits,
  earnings,
  profile_photo,
  pix_key,
  created_at,
  updated_at
FROM public.profiles
WHERE username IN ('exman9001', 'avatare003')
ORDER BY username;

-- ==========================================================
-- 4. VERIFICAR TODAS AS MENSAGENS COM CARDS EM UMA SALA
-- ==========================================================
-- Substitua 'ROOM_ID' pelo ID real da sala
SELECT 
  m.id,
  m.sender_id,
  m.sender_name,
  m.card_data->>'id' as card_id,
  m.card_data->>'title' as card_title,
  m.card_data->>'type' as card_type,
  m.card_data->>'creditCost' as card_cost,
  m.created_at
FROM public.messages m
WHERE 
  m.room_id = 'ROOM_ID' 
  AND m.card_data IS NOT NULL
ORDER BY m.created_at DESC;

-- ==========================================================
-- 5. LISTAR TODOS OS CARDS NA GALERIA
-- ==========================================================
SELECT 
  c.id,
  c.title,
  c.type,
  c.credit_cost,
  c.category,
  c.tags,
  c.created_at,
  p.username as creator
FROM public.cards c
LEFT JOIN public.profiles p ON c.creator_id = p.id
ORDER BY c.created_at DESC
LIMIT 50;

-- ==========================================================
-- 6. VERIFICAR DUPLICATAS DE CARDS
-- ==========================================================
SELECT 
  id, 
  title, 
  COUNT(*) as count
FROM public.cards
GROUP BY id, title
HAVING COUNT(*) > 1;

-- ==========================================================
-- 7. VERIFICAR POLÍTICAS RLS DA TABELA CARDS
-- ==========================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'cards';

-- ==========================================================
-- 8. CONTAR MENSAGENS POR SALA
-- ==========================================================
SELECT 
  room_id,
  COUNT(*) as message_count,
  COUNT(CASE WHEN card_data IS NOT NULL THEN 1 END) as card_count,
  MAX(created_at) as last_message
FROM public.messages
GROUP BY room_id
ORDER BY last_message DESC;

-- ==========================================================
-- 9. VERIFICAR AUDIO CARDS ESPECIFICAMENTE
-- ==========================================================
SELECT 
  c.id,
  c.title,
  c.media_url,
  c.thumbnail,
  c.credit_cost,
  c.created_at,
  p.username as creator
FROM public.cards c
LEFT JOIN public.profiles p ON c.creator_id = p.id
WHERE c.type = 'audio'
ORDER BY c.created_at DESC;

-- ==========================================================
-- 10. LIMPAR CARDS DUPLICADOS (USE COM CUIDADO!)
-- ==========================================================
-- ATENÇÃO: Esta query deleta cards duplicados mantendo apenas o mais recente
-- Descomente apenas se tiver certeza que há duplicatas

-- DELETE FROM public.cards
-- WHERE id IN (
--   SELECT id
--   FROM (
--     SELECT id,
--       ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn
--     FROM public.cards
--   ) t
--   WHERE t.rn > 1
-- );

-- ==========================================================
-- 11. VERIFICAR E AJUSTAR CRÉDITOS DO USUÁRIO EXMAN9007
-- ==========================================================
-- Ver saldo atual do usuário exman9007
SELECT id, username, credits, earnings, free_credits, updated_at
FROM public.profiles
WHERE username = 'exman9007';

-- Ver histórico de transações de pagamento PIX do usuário
SELECT id, user_id, mp_payment_id, amount, credits_amount, status, created_at, updated_at
FROM public.payment_transactions
WHERE user_id = (SELECT id FROM public.profiles WHERE username = 'exman9007')
ORDER BY created_at DESC;

-- Atualizar saldo para 70 créditos (20 anteriores + 50 da recarga)
UPDATE public.profiles
SET credits = 70
WHERE username = 'exman9007';

