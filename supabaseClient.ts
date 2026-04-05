// supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials. 
// NOTE: Using service_role key on the client is insecure but used here as provided.
const supabaseUrl = "https://gvafdhyudvdymletqjee.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkzMDQ3NiwiZXhwIjoyMDc3NTA2NDc2fQ.y_D64FZILeOCFwAbZZaN0TqFVcpD3VSE9nJWPt_ypCc";

/**
 * A robust fetch wrapper that handles common network errors with retries and exponential backoff.
 * This helps mitigate "Failed to fetch" errors in unstable network environments.
 */
async function robustFetch(url: string, options?: RequestInit, retries = 3, backoff = 300): Promise<Response> {
    try {
        const response = await fetch(url, options);
        
        // Retry on common server-side transient errors (502, 503, 504)
        if (!response.ok && [502, 503, 504].includes(response.status) && retries > 0) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return response;
    } catch (error) {
        const message = String(error).toLowerCase();
        const isNetworkError = 
            message.includes('failed to fetch') || 
            message.includes('network') || 
            message.includes('aborted') ||
            message.includes('timeout') ||
            message.includes('connection');

        if (isNetworkError && retries > 0) {
            console.warn(`robustFetch: Retrying ${url} due to network error: ${message}. Retries left: ${retries}`);
            // Exponential backoff with jitter
            const delay = backoff + Math.random() * backoff;
            await new Promise(resolve => setTimeout(resolve, delay));
            return robustFetch(url, options, retries - 1, backoff * 2);
        }
        
        throw error;
    }
}

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
            },
            global: {
                // Use our robust fetch wrapper for all Supabase requests
                fetch: robustFetch as any
            }
        });
        return supabase;
    } catch (error) {
        console.error("Supabase init error:", error);
        return null;
    }
}
