// Fix: Use `import type` for SupabaseClient as it is used as a type, not a value. This resolves module resolution errors in some environments.
import { createClient, type SupabaseClient, AuthError } from '@supabase/supabase-js';

// Hardcoded Supabase credentials provided by the user.
const supabaseUrl = "https://gvafdhyudvdymletqjee.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzA0NzYsImV4cCI6MjA3NzUwNjQ3Nn0.PuoD-Mayi8cTscKG9CuQWA_qQU8x8lCeprI63jh5qCE";

// Singleton instance of the Supabase client.
let supabase: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Creates or retrieves a singleton Supabase client instance using hardcoded credentials.
 * @returns A Supabase client instance. Returns null if initialization fails.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
    if (clientPromise) {
        return clientPromise;
    }

    clientPromise = (async () => {
        if (supabase) {
            // Check if the current session is still valid
            if (!supabase.auth) {
                console.warn("Supabase auth not available on existing client, re-initializing.");
                supabase = null;
            } else {
                let sessionResult;
                try {
                    sessionResult = await supabase.auth.getSession();
                } catch (sessionErr) {
                    console.error("Failed to get Supabase session:", sessionErr);
                    supabase = null;
                    return null;
                }
                const { data: { session }, error } = sessionResult;
                if (error || !session) {
                    console.warn("Supabase session invalid or expired, re-initializing client.", error);
                    supabase = null; // Force re-initialization
                } else {
                    return supabase;
                }
            }
        }
        
        // If hardcoded credentials are not valid, return null.
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error("Supabase credentials are not defined in the code.");
            return null;
        }

        // Create a new client instance.
        try {
            supabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    storageKey: 'lawyer-app-auth-token',
                    storage: {
                        getItem: (key: string) => {
                            if (typeof window === 'undefined') return null;
                            return window.localStorage.getItem(key);
                        },
                        setItem: (key: string, value: string) => {
                            if (typeof window === 'undefined') return;
                            window.localStorage.setItem(key, value);
                        },
                        removeItem: (key: string) => {
                            if (typeof window === 'undefined') return;
                            window.localStorage.removeItem(key);
                        },
                    },
                }
            });
            return supabase;
        } catch (error) {
            console.error("Error creating Supabase client:", error);
            supabase = null; // Ensure supabase is null on failure
            return null;
        }
    })();

    return clientPromise;
}

/**
 * Synchronously retrieves the singleton Supabase client instance.
 * Note: This may return null if the client hasn't been initialized yet via getSupabaseClient().
 * @returns The Supabase client instance or null.
 */
export function getSupabaseClientSync(): SupabaseClient | null {
    return supabase;
}
