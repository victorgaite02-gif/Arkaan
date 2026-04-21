import { createClient } from '@supabase/supabase-js'

// Configuração para produção: Busca variáveis de ambiente (VITE_...).
// Configuração para dev: Usa as chaves hardcoded como fallback.
// Fix: Safely access env to prevent runtime errors if import.meta.env is undefined
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://egqyenvhnuiwpkdjytta.supabase.co'
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVncXllbnZobnVpd3BrZGp5dHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjcxODIsImV4cCI6MjA3ODU0MzE4Mn0.doZe_VKFDR92jARq9-luht0cZbiTEYCsVjltstv_myM'

export const supabase = createClient(supabaseUrl, supabaseKey)