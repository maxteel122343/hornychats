
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://haoeofdwohcoggdbgknz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhb2VvZmR3b2hjb2dnZGJna256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODY0MzUsImV4cCI6MjA4NDk2MjQzNX0.hsZ6r5zelKNt22si_Tnh2nIiDp0yCuaHZBFwQHW1XS4';

export const supabase = createClient(supabaseUrl, supabaseKey);
