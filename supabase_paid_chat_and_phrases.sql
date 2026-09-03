-- ====================================================================
-- MIGRAÇÃO SUPABASE: TEMPO DE CHAT ROTATIVO & BALÕES DE FRASES RÁPIDAS
-- ====================================================================
-- Execute este script no SQL Editor do seu Supabase Dashboard (https://app.supabase.com).

-- 1. Adiciona colunas na tabela rooms para persistir as configurações de Tempo de Chat e Frases Rápidas
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS paid_chat_config JSONB DEFAULT '{"enabled": false, "intervalMinutes": 5, "costCredits": 10, "warningSeconds": 60, "autoDebitDefault": false}'::jsonb;

ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS quick_phrases JSONB DEFAULT NULL;

-- 2. Permissões de acesso
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO anon;

-- 3. Comentários informativos
COMMENT ON COLUMN public.rooms.paid_chat_config IS 'Configurações de cobrança rotativa de chat (tempo em minutos, custo em créditos e cronômetro de aviso)';
COMMENT ON COLUMN public.rooms.quick_phrases IS 'Configurações dos balões de frases para o criador e para os visitantes';
