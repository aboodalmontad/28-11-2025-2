// supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials. 
// NOTE: Using service_role key on the client is insecure but used here as provided.
const supabaseUrl = "https://gvafdhyudvdymletqjee.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkzMDQ3NiwiZXhwIjoyMDc3NTA2NDc2fQ.y_D64FZILeOCFwAbZZaN0TqFVcpD3VSE9nJWPt_ypCc";

let supabase: SupabaseClient | null = null;

export function get_supabase_client(): SupabaseClient | null {
    if (supabase) return supabase;
    
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase credentials missing.");
        return null;
    }

    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        return supabase;
    } catch (error) {
        console.error("Supabase init error:", error);
        return null;
    }
}
